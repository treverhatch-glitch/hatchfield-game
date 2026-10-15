import { describe, expect, it } from 'vitest'
import { TOWER_III_UPGRADE } from '../airside/data.ts'
import { TIER3_BUILDINGS } from '../content/buildings_tier3.ts'
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
  it('blocks a second passenger contract until the player adds desks', () => {
    const game = starter()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toEqual(['northline'])

    game.offer = { airline: 'harbor', age: 0, deadline: 36 }
    const blocked = game.checkinSignReport('harbor')
    expect(blocked.ok).toBe(false)
    expect(blocked.line).toContain('Add check-in desks')
    expect(blocked.line).toContain('passengers a minute')
    game.acceptOffer()
    expect(game.signed).not.toContain('harbor')
    expect(game.offer?.airline).toBe('harbor')
    expect(game.news.some((note) => note.text.includes('Add check-in desks'))).toBe(true)

    game.offer = { airline: 'umazon', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toContain('umazon')

    game.paxDesks = 8
    game.offer = { airline: 'harbor', age: 0, deadline: 36 }
    expect(game.checkinSignReport('harbor').ok).toBe(true)
    game.acceptOffer()
    expect(game.signed).toContain('harbor')
  })

  it('signs the second carrier after one desk is placed inside the starter hall', () => {
    expect(STARTER_CAPACITY.desks).toBe(2)
    const game = starter()
    expect(game.paxDesks).toBe(2)
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.offer = { airline: 'harbor', age: 0, deadline: 36 }
    const before = game.checkinSignReport('harbor')
    expect(before.ok).toBe(false)

    game.placeHallItem('checkin_belt')
    game.tickHallNav(0)
    const after = game.checkinSignReport('harbor')
    expect(after.ok).toBe(true)
    expect(after.capacity).toBeGreaterThan(before.capacity)
    game.acceptOffer()
    expect(game.signed).toContain('harbor')
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
