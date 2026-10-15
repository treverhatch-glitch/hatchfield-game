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
  it('seeds no preview passengers on a new game', () => {
    for (const focus of ['pax', 'hybrid', 'cargo'] as const) {
      expect(field(focus).hallGuests.filter((g) => g.preview), focus).toHaveLength(0)
    }
  })

  it('an old save’s preview crowd steps aside once real passengers are in the hall', () => {
    const game = field()
    const hallId = game.hallKey(game.fits[0])
    for (let i = 0; i < 12; i++) {
      const g = spawnHallGuest(`day1-preview-${i}`, 'depart', 'budget', { hallId })
      g.preview = true
      g.releaseAt = undefined
      game.hallGuests.push(g)
    }
    expect(game.hallGuests.some((g) => g.preview)).toBe(true)
    for (let i = 0; i < 8; i++) {
      const g = spawnHallGuest(`real-${i}`, 'depart', 'budget', { hallId })
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
