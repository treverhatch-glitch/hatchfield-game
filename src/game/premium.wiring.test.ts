import { describe, expect, it } from 'vitest'
import { buyFacility } from '../premium/index.ts'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

function atSecurity(game: Game, tag: 'premium' | 'budget' | 'business', cabin: 'premium' | 'economy' | 'vip') {
  const hall = game.fits[0]
  if (!hall) throw new Error('starter kit has no hall')
  const guest = spawnHallGuest('prem-flight', 'depart', tag, {
    hallId: game.hallKey(hall),
    airlineId: 'summit',
  })
  guest.serviceCabin = cabin
  guest.node = 'security'
  guest.path = []
  guest.clearedSec = false
  guest.needs.boarding = 90
  guest.needs.hunger = 10
  guest.needs.bladder = 10
  game.hallGuests.push(guest)
  return guest
}

describe('premium screening on the field', () => {
  it('refuses a lane below its field level and still bills an idle lane', () => {
    const game = field()
    game.fieldXp = 0
    const cash = game.cash
    expect(game.fieldLevel()).toBe(1)
    expect(game.buyPremium('fast_track_1')).toBe(false)
    expect(game.cash).toBe(cash)

    game.fieldXp = 420
    expect(game.fieldLevel()).toBe(4)
    expect(game.buyPremium('fast_track_1')).toBe(true)
    expect(game.premium.securityOfficers).toBe(0)
    const after = game.cash
    expect(game.billPremiumUpkeep()).toBe(600)
    expect(game.cash).toBe(after - 600)
  })

  it('screens premium passengers on the lane and keeps economy in the general queue', () => {
    const game = field()
    game.fieldXp = 420
    expect(game.hirePremiumOfficer()).toBe(true)
    expect(game.buyPremium('fast_track_1')).toBe(true)
    const premium = atSecurity(game, 'premium', 'premium')
    const economy = atSecurity(game, 'budget', 'economy')
    game.tick(0.4)
    expect(premium.premiumScreen).toBe('fast_track')
    expect(economy.premiumScreen).toBe('general')
  })

  it('opens fast-track II when the Growth tree has scanner lanes', () => {
    const game = field()
    game.fieldXp = 1_100
    game.cash = 100_000
    expect(game.fieldLevel()).toBe(6)
    expect(game.hasCtScanners()).toBe(false)
    expect(game.buyPremium('fast_track_2')).toBe(false)

    game.researchTree.state.unlocked.push('safety-4')
    expect(game.hasResearch('ct_lanes')).toBe(true)
    expect(game.hasCtScanners()).toBe(true)
    expect(game.buyPremium('fast_track_2')).toBe(true)
    expect(game.premium.built.some((row) => row.itemId === 'fast_track_2')).toBe(true)
  })

  it('drops happiness when premium passengers have no lane, and uses the VIP room when it is built', () => {
    const missed = field()
    const guest = atSecurity(missed, 'premium', 'premium')
    const before = guest.happiness
    missed.tick(0.3)
    expect(guest.premiumScreen).toBe('general')
    expect(guest.happiness).toBeLessThanOrEqual(before - 25)

    const game = field()
    const built = buyFacility(game.premium, 'vip_room', { fieldLevel: 8, hasCt: true })
    if (!built.ok) throw new Error(built.reason)
    game.premium = { ...built.state, securityOfficers: 2 }
    const vip = atSecurity(game, 'premium', 'vip')
    game.tick(0.3)
    expect(vip.premiumScreen).toBe('vip_room')
  })
})
