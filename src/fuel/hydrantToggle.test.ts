import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { progressionBuildable } from '../progression/unlocks.ts'
import { hostKey } from '../stands/catalog.ts'
import { standDrawsHydrant, writeHydrantPit } from './hydrant.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  return game
}

describe('hydrant pit toggle', () => {
  it('writes the pit map and nothing else', () => {
    const pits: Record<string, true> = {}
    expect(writeHydrantPit(pits, '11,6', true)).toBe(true)
    expect(pits).toEqual({ '11,6': true })
    expect(writeHydrantPit(pits, '11,6', true)).toBe(false)
    expect(writeHydrantPit(pits, '11,6', false)).toBe(true)
    expect(pits).toEqual({})
    expect(writeHydrantPit(pits, '11,6', false)).toBe(false)
  })

  it('lets a stand attachment toggle the same pit the stamp writes', () => {
    const game = field()
    const cash = game.cash
    const fittings = JSON.stringify(game.fittings)

    expect(game.setHydrantPit(11, 6, true)).toBe(true)
    expect(game.hydrantPitOn(11, 6)).toBe(true)
    expect(game.standPits['11,6']).toBe(true)
    expect(game.hydrantPitOn(11, 12)).toBe(false)
    expect(game.cash).toBe(cash)
    expect(JSON.stringify(game.fittings)).toBe(fittings)
    expect(JSON.stringify(game.fittings[hostKey('stand', 11, 6)] ?? [])).not.toContain('hydrant')
    expect(standDrawsHydrant('11,6', game.standPits, 1)).toBe(true)
    expect(standDrawsHydrant('11,12', game.standPits, 1)).toBe(false)
    expect(standDrawsHydrant('11,6', game.standPits, 0)).toBe(false)

    expect(game.setHydrantPit(11, 6, true)).toBe(true)
    expect(game.cash).toBe(cash)
    expect(game.setHydrantPit(4, 4, true)).toBe(false)
    expect(game.standPits['4,4']).toBeUndefined()

    expect(game.setHydrantPit(11, 6, false)).toBe(true)
    expect(game.hydrantPitOn(11, 6)).toBe(false)
    expect(game.standPits['11,6']).toBeUndefined()
    expect(standDrawsHydrant('11,6', game.standPits, 1)).toBe(false)
    expect(game.cash).toBe(cash)

    const pit = progressionBuildable('hydrant')!
    game.fieldXp = 700
    game.researchUnlocked.push('hydrant_fuel')
    game.stampHydrantPit({ c: 11, r: 6 })
    expect(game.cash).toBe(cash - pit.cost)
    expect(game.hydrantPitOn(11, 6)).toBe(true)
    const afterStamp = game.cash
    expect(game.setHydrantPit(11, 6, false)).toBe(true)
    expect(game.cash).toBe(afterStamp)
    expect(game.hydrantPitOn(11, 6)).toBe(false)
  })
})
