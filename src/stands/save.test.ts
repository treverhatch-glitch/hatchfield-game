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
    expect(game.standSize['11,6']).toBe('narrow')
    expect(game.standRung['11,6']).toBe(1)
    expect(game.standClass['11,6']).toBe('M')
    expect(game.standAccess['11,6']).toBe('remote')
    expect(game.fittings[hostKey('stand', 11, 6)]).toBeUndefined()
    expect(game.standIcao({ c: 11, r: 6 })).toBe('C')
    expect(game.standPaxMode({ c: 11, r: 6 })).toBe('walk')
  })

  it('fills an old jetway and does not raise a rung that is already stored', () => {
    const game = started()
    game.standAccess['11,6'] = 'jetway'
    game.standAccess['11,12'] = 'jetway'
    game.fittings = {}
    const loaded = reload(game, (snap) => {
      delete snap.standSize
      delete snap.standRung
      delete snap.fittings
    })
    expect(loaded.standSize['11,6']).toBe('narrow')
    expect(loaded.standRung['11,6']).toBe(1)
    expect(loaded.fittings[hostKey('stand', 11, 6)]).toEqual([{ id: 'jet_bridge' }])
    expect(loaded.standAccess['11,6']).toBe('jetway')
    expect(loaded.standClass['11,6']).toBe('M')

    loaded.standSize['11,12'] = 'light'
    loaded.standRung['11,12'] = 0
    loaded.standAccess['11,12'] = 'remote'
    delete loaded.fittings[hostKey('stand', 11, 12)]
    loaded.migrateMissingStands()
    expect(loaded.standRung['11,12']).toBe(0)
    expect(loaded.standSize['11,12']).toBe('light')
    expect(loaded.fittings[hostKey('stand', 11, 12)]).toBeUndefined()
  })

  it('keeps a legacy bridge as a bought attachment and leaves a remote stand alone', () => {
    const game = started()
    const host = hostKey('stand', 11, 6)
    game.standAccess['11,6'] = 'jetway'
    game.fittings[host] = [{ id: 'jet_bridge', granted: 'legacy' }]
    game.standAccess['11,12'] = 'remote'
    delete game.fittings[hostKey('stand', 11, 12)]
    const loaded = reload(game, () => {})
    expect(loaded.fittings[host]).toEqual([{ id: 'jet_bridge' }])
    expect(loaded.standAccess['11,6']).toBe('jetway')
    expect(loaded.fittings[hostKey('stand', 11, 12)]).toBeUndefined()
    expect(loaded.standAccess['11,12']).toBe('remote')
    const cash = loaded.cash
    loaded.removeFitting(host, 'jet_bridge')
    expect(loaded.cash - cash).toBe(Math.round(jetBridgeCost('narrow') * BULLDOZE_REFUND))
    expect(loaded.standAccess['11,6']).toBe('remote')
  })

  it('turns a missing access beside a hall into a bought bridge', () => {
    const game = started()
    const loaded = reload(game, (snap) => {
      delete snap.standAccess
      delete snap.fittings
    })
    expect(loaded.fittings[hostKey('stand', 11, 6)]).toEqual([{ id: 'jet_bridge' }])
    expect(loaded.standAccess['11,6']).toBe('jetway')
    expect(loaded.standPaxMode({ c: 11, r: 6 })).toBe('jetway')
  })
})
