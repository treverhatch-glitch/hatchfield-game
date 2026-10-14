import { beforeEach, describe, expect, it } from 'vitest'
import { DIVERT_FEE_MIN } from './catalog.ts'
import { DISRUPTION_ALERT_PREFIX } from '../disruptions/alertFeed.ts'
import { Game } from './sim.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

function disruptionRows(game: Game) {
  return game.alerts.active.filter((a) => a.key.startsWith(DISRUPTION_ALERT_PREFIX))
}

describe('disruptions on the alert stack', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stays quiet before mid-game and does not lose passengers or bags', () => {
    const game = starter()
    expect(game.fieldLevel()).toBeLessThan(3)
    expect(game.triggerDisruption('software-outage')).toBeNull()
    for (let i = 0; i < 4; i++) game.tick(90)
    expect(disruptionRows(game)).toEqual([])
    expect(game.disruptions.checkInMultiplier()).toBe(1)
    expect(game.disruptions.feeMultiplier()).toBe(1)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('raises one alert, and dismiss, ignore, and minimise use the alert stack', () => {
    const game = starter()
    game.fieldXp = 700
    const ev = game.triggerDisruption('software-outage')
    expect(ev).not.toBeNull()
    expect(game.playtestYear.liveDisruptions()).toEqual([
      { day: ev!.day, kind: 'software-outage', revenueImpact: ev!.recoveryCost },
    ])
    game.tick(2)
    expect(game.playtestYear.liveDisruptions()).toHaveLength(1)
    expect(game.disruptions.checkInMultiplier()).toBeGreaterThan(1)
    let rows = disruptionRows(game)
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Software outage')
    expect(rows[0].detail).toContain('Fix:')
    expect(rows[0].at?.cells.length).toBeGreaterThan(0)

    game.triggerDisruption('software-outage')
    for (let i = 0; i < 3; i++) game.tick(0.5)
    rows = disruptionRows(game)
    expect(rows).toHaveLength(1)

    const id = rows[0].id
    game.dismissAlert(id)
    expect(disruptionRows(game)).toEqual([])
    game.tick(5)
    expect(disruptionRows(game)).toEqual([])
    expect(game.disruptions.checkInMultiplier()).toBeGreaterThan(1)
    game.tick(70)
    expect(disruptionRows(game)).toHaveLength(1)

    const back = disruptionRows(game)[0]
    game.ignoreAlert(back.id)
    game.tick(80)
    expect(disruptionRows(game)).toEqual([])
    expect(game.disruptions.checkInMultiplier()).toBeGreaterThan(1)

    game.minimiseAlerts(true)
    const next = game.triggerDisruption('health-screening')
    expect(next).not.toBeNull()
    expect(game.alerts.minimised).toBe(true)
    expect(disruptionRows(game)).toHaveLength(1)
    expect(disruptionRows(game)[0].title).toBe('Health-screening scare')
    game.minimiseAlerts(false)
    expect(game.alerts.minimised).toBe(false)
    expect(disruptionRows(game)).toHaveLength(1)
  })

  it('pans to the check-in zone, the runway, and a gate', () => {
    const game = starter()
    game.fieldXp = 700

    const outage = game.triggerDisruption('software-outage')!
    const checkin = disruptionRows(game)[0]
    expect(checkin.at?.view).toBe('hall')
    const zone = game.fits[0].zones
    const cell = checkin.at!.cells[0]
    expect(zone?.[cell.r]?.[cell.c]).toBe('checkin')
    game.panToAlert(checkin.id)
    expect(game.view).toBe('hall')
    expect(game.camGoal).toMatchObject({ view: 'hall', c: cell.c, r: cell.r })
    game.recoverDisruption(outage.id)
    expect(disruptionRows(game)).toEqual([])
    expect(game.disruptions.checkInMultiplier()).toBe(1)

    const visit = game.triggerDisruption('state-visit')!
    const runway = disruptionRows(game)[0]
    const strip = runway.at!.cells[0]
    expect(game.tiles[strip.r][strip.c]).toBe('runway')
    game.panToAlert(runway.id)
    expect(game.view).toBe('apron')
    expect(game.camGoal).toMatchObject({ view: 'apron', c: strip.c, r: strip.r })
    expect(game.disruptions.runwayClosed(game.clock)).toBe(true)
    game.recoverDisruption(visit.id)

    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.fieldXp = 700
    const ash = game.triggerDisruption('volcanic-ash')!
    expect(ash.effect.diversions).toBeGreaterThanOrEqual(8)
    expect(ash.effect.diversions).toBeLessThanOrEqual(12)
    expect(ash.effect.hosted + ash.effect.onward).toBe(ash.effect.diversions)
    const gate = disruptionRows(game)[0]
    const stand = gate.at!.cells[0]
    expect(game.tiles[stand.r][stand.c]).toBe('stand')
    game.panToAlert(gate.id)
    expect(game.camGoal).toMatchObject({ view: 'apron', c: stand.c, r: stand.r })
    const landed = game.flights.filter((f) => f.hostKind === 'divert')
    expect(landed).toHaveLength(ash.effect.hosted)
    expect(Number.isFinite(game.cash)).toBe(true)
    if (ash.effect.hosted > 0) expect(game.cash).toBeGreaterThanOrEqual(DIVERT_FEE_MIN)
    expect(disruptionRows(game)).toHaveLength(1)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('holds a runway window and rebanks one wave without a second card', () => {
    const game = starter()
    game.fieldXp = 700
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.fieldXp = 700
    game.schedule.push({
      id: 'due',
      airline: 'northline',
      flightNo: 'NL9',
      eta: game.clock - 1,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
    })
    const visit = game.triggerDisruption('state-visit')!
    game.spawnCool = 0
    game.trySpawn()
    const slot = game.schedule.find((s) => s.id === 'due')
    expect(slot?.delayReason).toBe('Runway closed')
    expect(slot?.status).toBe('delayed')
    expect(disruptionRows(game)).toHaveLength(1)
    game.recoverDisruption(visit.id)
    expect(game.disruptions.runwayClosed(game.clock)).toBe(false)

    game.schedule.push(
      {
        id: 'a',
        airline: 'northline',
        flightNo: 'NL1',
        eta: 40,
        status: 'scheduled',
        delaySec: 0,
        delayReason: null,
        manual: true,
        flightId: null,
      },
      {
        id: 'b',
        airline: 'northline',
        flightNo: 'NL2',
        eta: 50,
        status: 'scheduled',
        delaySec: 0,
        delayReason: null,
        manual: true,
        flightId: null,
      },
    )
    const melt = game.triggerDisruption('hub-meltdown')!
    expect(melt.effect.flightIds.length).toBeGreaterThan(0)
    for (const id of melt.effect.flightIds) {
      expect(game.schedule.find((s) => s.id === id)?.status).toBe('delayed')
    }
    expect(disruptionRows(game)).toHaveLength(1)
    game.recoverDisruption(melt.id)
    for (const id of melt.effect.flightIds) {
      const held = game.schedule.find((s) => s.id === id)
      expect(held?.status).toBe('scheduled')
      expect(held?.delayReason).toBe('Rebanked after the storm')
    }
    expect(disruptionRows(game)).toEqual([])
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.bagsLost).toBe(0)
  })

  it('thins one staff pool and restores it, and a price war cuts fees without a second card', () => {
    const game = starter()
    game.fieldXp = 700
    const strike = game.triggerDisruption('strike-day')!
    const pool = strike.effect.staffPool
    expect(pool).not.toBeNull()
    if (pool && pool !== 'desk') {
      expect(game.budgetOf(pool)).toBeLessThan(game.budgets[pool])
      expect(game.budgetOf(pool)).toBeGreaterThan(0)
    }
    expect(disruptionRows(game)).toHaveLength(1)
    const row = disruptionRows(game)[0]
    expect(row.at?.cells.length).toBeGreaterThan(0)
    game.panToAlert(row.id)
    expect(game.camGoal).toMatchObject({ c: row.at!.cells[0].c, r: row.at!.cells[0].r })
    game.recoverDisruption(strike.id)
    if (pool && pool !== 'desk') expect(game.budgetOf(pool)).toBe(game.budgets[pool])

    const before = game.landingFeeMult('northline')
    const war = game.triggerDisruption('rival-price-war')!
    expect(game.landingFeeMult('northline')).toBeLessThan(before)
    expect(game.landingFeeMult('northline')).toBeGreaterThanOrEqual(before * 0.55 - 1e-9)
    expect(disruptionRows(game)).toHaveLength(1)
    expect(disruptionRows(game)[0].key).toContain(war.id)
    game.recoverDisruption(war.id)
    expect(game.landingFeeMult('northline')).toBeCloseTo(before)
    expect(disruptionRows(game)).toEqual([])
  })
})
