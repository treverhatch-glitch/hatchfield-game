import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'

function field(focus: 'pax' | 'cargo' | 'hybrid' = 'pax'): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = focus
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

describe('day-one hall crowd', () => {
  it('seeds walking passengers when the passenger starter kit lands', () => {
    const game = field('pax')
    const crowd = game.hallGuests.filter((g) => g.preview)
    expect(crowd.length).toBeGreaterThanOrEqual(8)
    const colors = new Set(crowd.map((g) => g.color))
    expect(colors.size).toBeGreaterThanOrEqual(8)
    for (const g of crowd) {
      expect(g.clearedSec).toBe(true)
      expect(g.path[0]).toBe('entrance')
      expect(g.path).toContain('security')
      expect(g.path.at(-1)).toBe('gate')
      expect(g.seg).toBeGreaterThanOrEqual(0)
      expect(g.seg).toBeLessThan(g.path.length - 1)
    }
    const cash = game.cash
    const reputation = game.reputation
    const served = game.paxServed
    const before = crowd.map((g) => ({ seg: g.seg, t: g.t }))
    game.tickHall(1.2)
    expect(game.hallGuests.filter((g) => g.preview).length).toBe(crowd.length)
    expect(game.cash).toBe(cash)
    expect(game.reputation).toBe(reputation)
    expect(game.paxServed).toBe(served)
    expect(crowd.some((g, i) => g.t !== before[i].t || g.seg !== before[i].seg)).toBe(true)
  })

  it('seeds the same crowd for a hybrid kit and none for cargo', () => {
    expect(field('hybrid').hallGuests.filter((g) => g.preview).length).toBeGreaterThanOrEqual(8)
    expect(field('cargo').hallGuests).toHaveLength(0)
  })

  it('steps aside once real passengers are in the hall', () => {
    const game = field()
    expect(game.hallGuests.some((g) => g.preview)).toBe(true)
    for (let i = 0; i < 8; i++) {
      const g = spawnHallGuest(`real-${i}`, 'depart', 'budget', { hallId: game.hallKey(game.fits[0]) })
      g.releaseAt = undefined
      g.clearedSec = true
      g.node = 'food'
      g.path = []
      g.needs.boarding = 90
      g.needs.hunger = 0
      g.needs.bladder = 0
      g.needs.shop = 0
      g.needs.play = 0
      g.needs.energy = 0
      game.hallGuests.push(g)
    }
    game.tickHall(0.05)
    expect(game.hallGuests.some((g) => g.preview)).toBe(false)
    expect(game.hallGuests.filter((g) => g.flightId.startsWith('real-')).length).toBe(8)
  })
})
