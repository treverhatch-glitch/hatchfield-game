import { describe, expect, it } from 'vitest'
import { BULLDOZE_REFUND } from './catalog.ts'
import { Game } from './sim.ts'
import { fittingDef, hostKey, RUNG_STEP } from '../stands/index.ts'

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

describe('stand review fixes', () => {
  it('refunds the stamp, the rungs and the bought fittings', () => {
    const game = field()
    const at = { c: 2, r: 2 }
    game.tiles[2]![2] = 'stand'
    game.standClass['2,2'] = 'L'
    game.standSize['2,2'] = 'heavy'
    game.standRung['2,2'] = 0
    expect(game.refundFor('stand', at)).toBe(Math.round(RUNG_STEP.heavy[0] * BULLDOZE_REFUND))
    game.standClass['2,2'] = 'M'
    game.standSize['2,2'] = 'narrow'
    game.standRung['2,2'] = 2
    const paved = RUNG_STEP.narrow[0] + RUNG_STEP.narrow[1] + RUNG_STEP.narrow[2]
    expect(game.refundFor('stand', at)).toBe(Math.round(paved * BULLDOZE_REFUND))
    game.fittings[hostKey('stand', 2, 2)] = [{ id: 'gpu_pca' }]
    expect(game.refundFor('stand', at)).toBe(Math.round((paved + fittingDef('gpu_pca').cost) * BULLDOZE_REFUND))
  })

  it('pins the bridge state when an old stand is migrated', () => {
    const game = field()
    game.tiles[2]![2] = 'stand'
    game.standClass['2,2'] = 'M'
    delete game.standSize['2,2']
    delete game.standRung['2,2']
    delete game.standAccess['2,2']
    game.migrateMissingStands()
    expect(game.standAccess['2,2']).toBe(game.fittings[hostKey('stand', 2, 2)] ? 'jetway' : 'remote')
  })
})
