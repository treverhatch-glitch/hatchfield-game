import { describe, expect, it } from 'vitest'
import { BULLDOZE_REFUND } from '../game/catalog.ts'
import { SAVE_SCHEMA_VERSION, serialize, storedData } from '../features/save/index.ts'
import { Game } from '../game/sim.ts'
import { SAVE_KEY } from '../game/types.ts'
import { hostKey, jetBridgeCost } from './catalog.ts'

function started(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

function reload(game: Game, edit: (snap: Record<string, unknown>) => void): Game {
  game.autosave = true
  game.persist()
  const raw = localStorage.getItem(SAVE_KEY)
  expect(raw).toBeTruthy()
  const snap = storedData(raw!) as Record<string, unknown>
  edit(snap)
  localStorage.setItem(
    SAVE_KEY,
    serialize({ version: SAVE_SCHEMA_VERSION, snapshot: () => snap, restore() {} }, 0),
  )
  const loaded = new Game()
  loaded.autosave = false
  expect(loaded.load()).toBe(true)
  return loaded
}

describe('stand keys on a live field', () => {
  it('writes a concrete rung and no bridge on the starter stands', () => {
    const game = started()
    expect(game.standSize['12,7']).toBe('narrow')
    expect(game.standRung['12,7']).toBe(1)
    expect(game.standClass['12,7']).toBe('M')
    expect(game.standAccess['12,7']).toBe('remote')
    expect(game.fittings[hostKey('stand', 12, 7)]).toBeUndefined()
    expect(game.standIcao({ c: 12, r: 7 })).toBe('C')
    expect(game.standPaxMode({ c: 12, r: 7 })).toBe('walk')
  })

  it('fills an old jetway and does not raise a rung that is already stored', () => {
    const game = started()
    game.standAccess['12,7'] = 'jetway'
    game.standAccess['12,10'] = 'jetway'
    game.fittings = {}
    const loaded = reload(game, (snap) => {
      delete snap.standSize
      delete snap.standRung
      delete snap.fittings
    })
    expect(loaded.standSize['12,7']).toBe('narrow')
    expect(loaded.standRung['12,7']).toBe(1)
    expect(loaded.fittings[hostKey('stand', 12, 7)]).toEqual([{ id: 'jet_bridge' }])
    expect(loaded.standAccess['12,7']).toBe('jetway')
    expect(loaded.standClass['12,7']).toBe('M')

    loaded.standSize['12,10'] = 'light'
    loaded.standRung['12,10'] = 0
    loaded.standAccess['12,10'] = 'remote'
    delete loaded.fittings[hostKey('stand', 12, 10)]
    loaded.migrateMissingStands()
    expect(loaded.standRung['12,10']).toBe(0)
    expect(loaded.standSize['12,10']).toBe('light')
    expect(loaded.fittings[hostKey('stand', 12, 10)]).toBeUndefined()
  })

  it('keeps a legacy bridge as a bought attachment and leaves a remote stand alone', () => {
    const game = started()
    const host = hostKey('stand', 12, 7)
    game.standAccess['12,7'] = 'jetway'
    game.fittings[host] = [{ id: 'jet_bridge', granted: 'legacy' }]
    game.standAccess['12,10'] = 'remote'
    delete game.fittings[hostKey('stand', 12, 10)]
    const loaded = reload(game, () => {})
    expect(loaded.fittings[host]).toEqual([{ id: 'jet_bridge' }])
    expect(loaded.standAccess['12,7']).toBe('jetway')
    expect(loaded.fittings[hostKey('stand', 12, 10)]).toBeUndefined()
    expect(loaded.standAccess['12,10']).toBe('remote')
    const cash = loaded.cash
    loaded.removeFitting(host, 'jet_bridge')
    expect(loaded.cash - cash).toBe(Math.round(jetBridgeCost('narrow') * BULLDOZE_REFUND))
    expect(loaded.standAccess['12,7']).toBe('remote')
  })

  it('turns a missing access beside a hall into a bought bridge', () => {
    const game = started()
    const loaded = reload(game, (snap) => {
      delete snap.standAccess
      delete snap.fittings
    })
    expect(loaded.fittings[hostKey('stand', 12, 7)]).toEqual([{ id: 'jet_bridge' }])
    expect(loaded.standAccess['12,7']).toBe('jetway')
    expect(loaded.standPaxMode({ c: 12, r: 7 })).toBe('jetway')
  })
})
