import { describe, expect, it } from 'vitest'
import { TOWER_III_UPGRADE } from '../airside/data.ts'
import { buildPhoneFeed } from '../phone/feed.ts'
import { readPhoneWorld } from '../phone/readGame.ts'
import { TIER3_BUILDINGS } from '../content/buildings_tier3.ts'
import { emptyInterior } from '../terminalbuild/interior.ts'
import { ATC_MAX_GO_AROUNDS, GO_AROUND_STANDING_HIT } from './catalog.ts'
import { STARTER_CAPACITY } from './openingData.ts'
import { Game } from './sim.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = true
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 0
  return game
}

describe('check-in contract demand', () => {
  it('signs a second small carrier and blocks the third on the starter desks', () => {
    const game = starter()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toEqual(['northline'])

    // Day-0 Zoomjet letter: two small peaks are 28. Two desks at 12 plus the kiosk at 6 clear 30.
    const zoom = game.checkinSignReport('zoomjet')
    expect(zoom.peak).toBe(28)
    expect(zoom.capacity).toBe(30)
    expect(zoom.ok).toBe(true)
    expect(zoom.line).toContain('Zoomjet')

    game.offer = { airline: 'harbor', age: 0, deadline: 36 }
    const harbor = game.checkinSignReport('harbor')
    expect(harbor.ok).toBe(true)
    expect(harbor.capacity).toBe(30)
    game.acceptOffer()
    expect(game.signed).toContain('harbor')

    game.offer = { airline: 'umazon', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toContain('umazon')

    game.offer = { airline: 'bushline', age: 0, deadline: 36 }
    const blocked = game.checkinSignReport('bushline')
    expect(blocked.ok).toBe(false)
    expect(blocked.line).toContain('Add check-in desks')
    expect(blocked.line).toContain('passengers a minute')
    game.acceptOffer()
    expect(game.signed).not.toContain('bushline')
    expect(game.news.some((note) => note.text.includes('Add check-in desks'))).toBe(true)

    game.paxDesks = 8
    game.offer = { airline: 'bushline', age: 0, deadline: 36 }
    expect(game.checkinSignReport('bushline').ok).toBe(true)
    game.acceptOffer()
    expect(game.signed).toContain('bushline')
  })

  it('signs the third small carrier after one desk is placed inside the starter hall', () => {
    expect(STARTER_CAPACITY.desks).toBe(2)
    const game = starter()
    expect(game.paxDesks).toBe(2)
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.offer = { airline: 'harbor', age: 0, deadline: 36 }
    expect(game.checkinSignReport('harbor').ok).toBe(true)
    game.acceptOffer()

    game.offer = { airline: 'bushline', age: 0, deadline: 36 }
    const before = game.checkinSignReport('bushline')
    expect(before.ok).toBe(false)

    game.placeHallItem('checkin_belt')
    game.tickHallNav(0)
    const after = game.checkinSignReport('bushline')
    expect(after.ok).toBe(true)
    expect(after.capacity).toBeGreaterThan(before.capacity)
    game.acceptOffer()
    expect(game.signed).toContain('bushline')
    expect(game.paxDesks).toBe(2)
  })

  it('opens a bought security lane once a screener is on the post', () => {
    const game = starter()
    expect(game.securityServers()).toBe(2)
    game.placeHallItem('security_small')
    game.hireDeskStaff()
    game.tickHallNav(0)
    expect(game.securityServers()).toBe(3)
  })

  it('a third carrier needs another desk or lane, and the letter says why', () => {
    const game = starter()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.offer = { airline: 'harbor', age: 0, deadline: 36 }
    expect(game.checkinSignReport('harbor').ok).toBe(true)
    game.acceptOffer()
    expect(game.signed).toEqual(['northline', 'harbor'])

    game.offer = { airline: 'brisa', age: 0, deadline: 36 }
    const blocked = game.checkinSignReport('brisa')
    expect(blocked.ok).toBe(false)
    expect(blocked.slots).toBe(2)
    expect(blocked.line).toContain('expand the hall')
    expect(blocked.line).toContain('Add check-in desks')
    game.acceptOffer()
    expect(game.signed).not.toContain('brisa')

    const phone = buildPhoneFeed(readPhoneWorld(game)).find((card) => card.id === 'contract')
    const reason = phone?.lines?.find((row) => row.label.includes('expand the hall'))
    expect(reason?.met).toBe(false)
    expect(phone?.actions.find((button) => button.id === 'sign')?.disabled).toBe(true)

    for (let i = 0; i < 6 && !game.checkinSignReport('brisa').ok; i++) {
      game.placeHallItem('checkin_belt')
      game.hireDeskStaff()
      game.tickHallNav(0)
    }
    const desks = game.checkinSignReport('brisa')
    expect(desks.ok).toBe(true)
    expect(desks.slots).toBeGreaterThanOrEqual(3)
    expect(desks.capacity).toBeGreaterThan(blocked.capacity)
  })

  it('a security lane or a bigger hall also clears the third carrier', () => {
    const lane = starter()
    lane.offer = { airline: 'northline', age: 0, deadline: 36 }
    lane.acceptOffer()
    lane.offer = { airline: 'harbor', age: 0, deadline: 36 }
    lane.acceptOffer()
    lane.offer = { airline: 'brisa', age: 0, deadline: 36 }
    expect(lane.checkinSignReport('brisa').ok).toBe(false)
    lane.placeHallItem('security_small')
    lane.hireDeskStaff()
    lane.tickHallNav(0)
    expect(lane.securityServers()).toBeGreaterThan(2)
    expect(lane.checkinSignReport('brisa').ok).toBe(true)
    lane.acceptOffer()
    expect(lane.signed).toContain('brisa')

    const hall = starter()
    hall.offer = { airline: 'northline', age: 0, deadline: 36 }
    hall.acceptOffer()
    hall.offer = { airline: 'harbor', age: 0, deadline: 36 }
    hall.acceptOffer()
    hall.offer = { airline: 'brisa', age: 0, deadline: 36 }
    const before = hall.checkinSignReport('brisa')
    expect(before.ok).toBe(false)
    const fit = hall.fits[0]
    fit.interior = emptyInterior()
    fit.interior.foundation = [{ x: 2, y: 1, floor: 0 }]
    fit.interior.equipment = [{ id: 'e1', kind: 'toilet', x: 3, y: 1, wear: 0, floor: 0 }]
    hall.fieldXp = 220
    expect(hall.hallExpandOffer()?.id).toBe('prefab_ii')
    expect(hall.hallBuyLine('prefab_ii')).toContain('now 2')
    hall.upgradeHall()
    hall.tickHallNav(0)
    expect(hall.fits[0].tier).toBe(2)
    expect(hall.fits[0].interior?.foundation?.[0]?.floor).toBe(0)
    expect(hall.fits[0].interior?.equipment?.[0]?.floor).toBe(0)
    const after = hall.checkinSignReport('brisa')
    expect(after.ok).toBe(true)
    expect(after.capacity).toBeGreaterThan(before.capacity)
    expect(after.slots).toBeGreaterThanOrEqual(3)
    hall.acceptOffer()
    expect(hall.signed).toContain('brisa')

    hall.offer = { airline: 'zephyr_go', age: 0, deadline: 36 }
    const fourth = hall.checkinSignReport('zephyr_go')
    expect(fourth.ok).toBe(false)
    expect(fourth.line).toContain('expand the hall')
    hall.fieldXp = 2300
    hall.upgradeHall()
    hall.tickHallNav(0)
    expect(hall.fits[0].tier).toBe(3)
    expect(hall.checkinSignReport('zephyr_go').ok).toBe(true)
    expect(hall.checkinSignReport('zephyr_go').slots).toBeGreaterThanOrEqual(4)
    expect(hall.fits[0].secPerMin).toBeGreaterThan(60)
  })
})

describe('rebalance tunables', () => {
  it('softens go-arounds and cuts the late building prices without touching starter desks', () => {
    expect(ATC_MAX_GO_AROUNDS).toBe(6)
    expect(GO_AROUND_STANDING_HIT).toBe(0.15)
    expect(STARTER_CAPACITY.desks).toBe(2)
    expect(TOWER_III_UPGRADE.cost).toBe(140_000)
    expect(TOWER_III_UPGRADE.upkeepPerDay).toBe(12_000)
    expect(TIER3_BUILDINGS.find((row) => row.id === 'cargo_hub_ii')?.cost).toBe(220_000)
    expect(TIER3_BUILDINGS.find((row) => row.id === 'atc_approach_centre')?.cost).toBe(160_000)
  })
})
