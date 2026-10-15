import { describe, expect, it } from 'vitest'
import { SAVE_SCHEMA_VERSION, serialize, storedData } from '../features/save/index.ts'
import { Game } from '../game/sim.ts'
import { SAVE_KEY } from '../game/types.ts'
import { hostKey } from './catalog.ts'

function started(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

describe('stand keys on a live field', () => {
  it('writes size and a legacy bridge beside the starter stands', () => {
    const game = started()
    expect(game.standSize['11,6']).toBe('narrow')
    expect(game.standRung['11,6']).toBe(1)
    expect(game.standClass['11,6']).toBe('M')
    expect(game.standAccess['11,6']).toBe('jetway')
    expect(game.fittings[hostKey('stand', 11, 6)]).toEqual([{ id: 'jet_bridge', granted: 'legacy' }])
    expect(game.standIcao({ c: 11, r: 6 })).toBe('C')
  })

  it('fills an old save and does not raise a rung that is already stored', () => {
    const game = started()
    game.standSize['11,6'] = 'light'
    game.standRung['11,6'] = 0
    game.fittings = {}
    game.autosave = true
    game.persist()
    const raw = localStorage.getItem(SAVE_KEY)
    expect(raw).toBeTruthy()
    const snap = storedData(raw!) as Record<string, unknown>
    delete snap.standSize
    delete snap.standRung
    delete snap.fittings
    localStorage.setItem(
      SAVE_KEY,
      serialize({ version: SAVE_SCHEMA_VERSION, snapshot: () => snap, restore() {} }, 0),
    )
    const loaded = new Game()
    loaded.autosave = false
    expect(loaded.load()).toBe(true)
    expect(loaded.standSize['11,6']).toBe('narrow')
    expect(loaded.standRung['11,6']).toBe(1)
    expect(loaded.fittings[hostKey('stand', 11, 6)]?.[0]?.id).toBe('jet_bridge')
    expect(loaded.standClass['11,6']).toBe('M')

    loaded.standSize['11,12'] = 'light'
    loaded.standRung['11,12'] = 0
    loaded.migrateMissingStands()
    expect(loaded.standRung['11,12']).toBe(0)
    expect(loaded.standSize['11,12']).toBe('light')
  })
})
