import { describe, expect, it } from 'vitest'
import { Game } from '../../src/game/sim'
import type { StartFocus } from '../../src/game/types'
import { buildAirport, expectHealthy, runDays, useSeed } from './harness.ts'

function stamped(focus: StartFocus): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = focus
  game.buyLand(focus === 'cargo' ? 'factory' : 'city')
  game.buildStarterKit()
  return game
}

describe('world consistency', () => {
  useSeed(212)

  it('starter maps have no physical violations', () => {
    for (const focus of ['pax', 'cargo', 'hybrid'] as const) {
      const found = stamped(focus).worldAudit()
      expect(found.map((v) => v.message), focus).toEqual([])
    }
  })

  it('a short bot day on the starter kit stays legal', () => {
    const game = buildAirport()
    const m = runDays(game, 1)
    expectHealthy(m)
    expect(game.worldAudit()).toEqual([])
  })
})
