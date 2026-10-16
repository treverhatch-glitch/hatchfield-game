import { describe, expect, it } from 'vitest'
import type { FacilityMetrics } from '../paxnav/index.ts'
import { SECURITY_TECH_RATES } from '../throughput/index.ts'
import { hallForecast } from './hallCapacity.ts'
import { HALL_CAPACITY_TUNING, HALL_MOOD_LINK } from './hallNavData.ts'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'

function point(kind: FacilityMetrics['kind'], over: Partial<FacilityMetrics> = {}): FacilityMetrics {
  return {
    id: `${kind}-${Math.random()}`,
    kind,
    roomId: null,
    queueLength: 0,
    serving: false,
    incoming: 0,
    avgWaitSec: 0,
    longestWaitSec: 0,
    estWaitSec: 0,
    staffed: true,
    inUse: false,
    serviceSec: 30,
    served: 0,
    leftQueue: 0,
    stock: null,
    line: [],
    ...over,
  }
}

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

describe('hall capacity forecast (src/throughput on the live walk)', () => {
  it('returns nothing for a hall with none of that kit', () => {
    expect(hallForecast('security', [point('checkin_desk')])).toBeNull()
  })

  it('reads a clear lane as clear', () => {
    const f = hallForecast('security', [point('security_lane'), point('security_lane')])!
    expect(f.committed).toBe(0)
    expect(f.bottleneck).toBe(false)
    expect(f.text).toContain('clear')
  })

  it('uses the live lane rate, not the table rate, and flags a lane that cannot keep up', () => {
    const slow = point('security_lane', { serviceSec: 60, queueLength: 30, incoming: 4, serving: true })
    const f = hallForecast('security', [slow])!
    const paxPerHr = (35 * 3600) / HALL_CAPACITY_TUNING.planWindowNavSec
    expect(f.utilisation).toBeCloseTo(paxPerHr / 60, 5)
    expect(SECURITY_TECH_RATES.xray).not.toBe(60)
    expect(f.bottleneck).toBe(true)
    expect(f.text).toContain('Add a lane')
  })

  it('more staffed lanes lower the load; an unstaffed lane adds nothing', () => {
    const load = { queueLength: 20, serving: true }
    const one = hallForecast('security', [point('security_lane', load)])!
    const two = hallForecast('security', [point('security_lane', load), point('security_lane')])!
    const closed = hallForecast('security', [point('security_lane', load), point('security_lane', { staffed: false })])!
    expect(two.utilisation).toBeLessThan(one.utilisation)
    expect(closed.utilisation).toBeCloseTo(one.utilisation, 5)
    expect(closed.openPoints).toBe(1)
    expect(closed.totalPoints).toBe(2)
  })

  it('says to hire when nothing at the kind is staffed', () => {
    const f = hallForecast('checkin', [point('checkin_desk', { staffed: false, queueLength: 5 })])!
    expect(f.openPoints).toBe(0)
    expect(f.text).toContain('Hire')
  })

  it('check-in forecast scales with desks', () => {
    const load = { queueLength: 12, serving: true, serviceSec: 75 }
    const one = hallForecast('checkin', [point('checkin_desk', load)])!
    const three = hallForecast('checkin', [point('checkin_desk', load), point('checkin_desk'), point('checkin_desk')])!
    expect(three.utilisation).toBeLessThan(one.utilisation / 2)
  })

  it('reads five people at a desk as 45 an hour', () => {
    expect(HALL_CAPACITY_TUNING.planWindowNavSec).toBe(400)
    const five = hallForecast('checkin', [
      point('checkin_desk', { id: 'belt-0', serviceSec: 75, queueLength: 4, serving: true }),
      point('checkin_desk', { id: 'belt-1', serviceSec: 75 }),
    ])!
    expect(five.committed).toBe(5)
    const paxPerHr = (5 * 3600) / HALL_CAPACITY_TUNING.planWindowNavSec
    expect(paxPerHr).toBe(45)
    expect(five.utilisation).toBeCloseTo(45 / (2 * (3600 / 75)), 5)
  })

  it('counts a staffed bag drop on the walk and does not also count it as a desk', () => {
    const desk = point('checkin_desk', { id: 'belt-0', serviceSec: 75, queueLength: 4, serving: true })
    const drop = point('checkin_desk', { id: 'drop-1-0', serviceSec: 75 })
    const asDesks = hallForecast('checkin', [desk, drop])!
    const withDrop = hallForecast('checkin', [desk, drop], [{ id: 'drop-1', def: 'bag_drop' }])!
    expect(withDrop.committed).toBe(5)
    expect(withDrop.utilisation).toBeCloseTo(asDesks.utilisation, 5)
    expect(withDrop.waitMinutes).toBeGreaterThan(asDesks.waitMinutes)
    const kiosk = point('checkin_desk', { id: 'kiosk-0', serviceSec: 75 })
    const withKiosk = hallForecast('checkin', [desk, kiosk], [{ id: 'kiosk', def: 'kiosk' }])!
    const kioskAsDesk = hallForecast('checkin', [desk, kiosk])!
    expect(withKiosk.utilisation).toBeCloseTo(kioskAsDesk.utilisation, 5)
    expect(withKiosk.waitMinutes).toBeCloseTo(kioskAsDesk.waitMinutes, 5)
  })

  it('leaves a closed bag drop out of the mix', () => {
    const desk = point('checkin_desk', { id: 'belt-0', serviceSec: 75, queueLength: 4, serving: true })
    const closed = point('checkin_desk', { id: 'drop-1-0', staffed: false, serviceSec: 75 })
    const forecast = hallForecast('checkin', [desk, closed], [{ id: 'drop-1', def: 'bag_drop' }])!
    const onlyDesk = hallForecast('checkin', [desk])!
    expect(forecast.openPoints).toBe(1)
    expect(forecast.totalPoints).toBe(2)
    expect(forecast.utilisation).toBeCloseTo(onlyDesk.utilisation, 5)
    expect(forecast.waitMinutes).toBeCloseTo(onlyDesk.waitMinutes, 5)
  })

  it('shows on the live security card of the starter hall', () => {
    const game = field()
    game.tickHallNav(0.01)
    game.view = 'hall'
    game.selectFacility('security')
    const card = game.buildingCard()
    expect(game.hallNav.live).toBe(true)
    expect(card?.note ?? '').toMatch(/^Security forecast:/)
  })

  it('reads a bag drop placed on the starter walk', () => {
    const game = field()
    const fit = game.activeHall()!
    const taken = new Set((fit.items ?? []).map((it) => `${it.c},${it.r}`))
    let spot: { c: number; r: number } | null = null
    for (let r = 0; r < (fit.zones ?? []).length && !spot; r++) {
      const row = fit.zones?.[r] ?? []
      for (let c = 0; c < row.length; c++) {
        if (row[c] === 'checkin' && !taken.has(`${c},${r}`)) {
          spot = { c, r }
          break
        }
      }
    }
    expect(spot).toBeTruthy()
    fit.items!.push({ id: 'drop-1', def: 'bag_drop', c: spot!.c, r: spot!.r, wear: 0, bundle: false })
    // The open check-in cell. The first free zone tile is the out-belt, which has no walk cell.
    fit.layout!.equipment = [...(fit.layout?.equipment ?? []), { id: 'drop-1', kind: 'checkin_desk', x: 10, y: 33, wear: 0 }]
    game.hallRev++
    game.tickHallNav(0.01)
    const metrics = game.hallNav.metrics()
    const drop = metrics.find((m) => m.id.startsWith('drop-1'))
    expect(drop?.kind).toBe('checkin_desk')
    expect(drop?.staffed).toBe(true)
    const queued = metrics.map((m) =>
      m.kind === 'checkin_desk'
        ? { ...m, queueLength: m.id === drop!.id ? 4 : 0, serving: m.id === drop!.id, incoming: 0 }
        : m,
    )
    const withDrop = hallForecast('checkin', queued, fit.items ?? [])!
    const asDesks = hallForecast('checkin', queued)!
    expect(withDrop.committed).toBe(5)
    expect(withDrop.utilisation).toBeCloseTo(asDesks.utilisation, 5)
    expect(withDrop.waitMinutes).toBeGreaterThan(asDesks.waitMinutes)
    game.view = 'hall'
    game.selectFacility('checkin')
    expect(game.buildingCard()?.note ?? '').toMatch(/^Check-in forecast:/)
  })
})

describe('walker thoughts reach the fare', () => {
  it('a thought moves the fare happiness by its configured share, and zero-weight thoughts do not', () => {
    const game = field()
    const hallId = game.hallKey(game.activeHall()!)
    const g = spawnHallGuest('mood-flight', 'depart', 'budget', { hallId })
    game.hallGuests.push(g)
    g.happiness = 70
    const real = game.hallNav.drainMood.bind(game.hallNav)
    game.hallNav.drainMood = () => [
      { id: g.id, key: 'lost', delta: -3 },
      { id: g.id, key: 'queue_long', delta: -4 },
      { id: 'nobody', key: 'lost', delta: -3 },
    ]
    game.applyHallMood()
    game.hallNav.drainMood = real
    expect(g.happiness).toBeCloseTo(70 - 3 * (HALL_MOOD_LINK.weight.lost ?? 0), 5)
    expect(HALL_MOOD_LINK.weight.crowded).toBe(0.2)
    expect(HALL_MOOD_LINK.weight.no_seats).toBe(0.2)
    expect(HALL_MOOD_LINK.weight.lost).toBe(0.6)
    expect(HALL_MOOD_LINK.weight.queue_long).toBeUndefined()
    expect(HALL_MOOD_LINK.weight.quick).toBeUndefined()
    expect(HALL_MOOD_LINK.weight.good_buy).toBeUndefined()
    expect(HALL_MOOD_LINK.weight.missed).toBeUndefined()
  })
})
