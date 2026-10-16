import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { spawnHallGuest } from '../game/guests.ts'
import { overlaySignature } from './interior/InteriorView.ts'

function hall() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

describe('hall flow overlay signature', () => {
  it('is empty while hidden, steady between frames, and moves with a guest path', () => {
    const game = hall()
    const fit = game.activeHall()
    expect(overlaySignature(game, false, [], fit)).toBe('')
    const g = spawnHallGuest('walk', 'depart', 'budget', { hallId: fit ? game.hallKey(fit) : undefined })
    g.path = ['entrance', 'checkin']
    game.hallGuests.push(g)
    const a = overlaySignature(game, true, [], fit)
    expect(overlaySignature(game, true, [], fit)).toBe(a)
    g.path = ['checkin', 'security']
    expect(overlaySignature(game, true, [], fit)).not.toBe(a)
    expect(overlaySignature(game, false, [{ c: 1, r: 2 }], fit)).not.toBe(overlaySignature(game, false, [{ c: 2, r: 2 }], fit))
  })
})
