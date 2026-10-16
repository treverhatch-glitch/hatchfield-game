import { describe, expect, it } from 'vitest'
import { HYDRANT_CARD } from '../fuel/hydrant.ts'
import { SAVE_SCHEMA_VERSION, serialize, storedData } from '../features/save/index.ts'
import { Game } from '../game/sim.ts'
import { SAVE_KEY } from '../game/types.ts'
import { progressionBuildable } from '../progression/unlocks.ts'
import { hostKey } from './catalog.ts'

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

function pitRow(game: Game) {
  game.tool = 'pan'
  game.clickTile({ c: 12, r: 7 })
  return game.buildingCard()?.sections?.find((section) => section.id === 'attachments')?.rows.find((row) =>
    row.id.startsWith('pit:'),
  )
}

describe('hydrant pit row', () => {
  it('buys the existing pit from the stand card and leaves the note on the fuel card', () => {
    const game = field()
    const pit = progressionBuildable('hydrant')!
    expect(pitRow(game)?.label).toBe('Hydrant pit needs Field level 5.')
    expect(pitRow(game)?.disabled).toBe(true)
    game.fieldXp = 700
    game.researchUnlocked.push('hydrant_fuel')
    expect(pitRow(game)?.label).toBe(`Hydrant pit · $${pit.cost.toLocaleString('en-US')}`)
    const cash = game.cash
    game.standCardAction('pit:12,7')
    expect(game.standPits['12,7']).toBe(true)
    expect(game.standPits['12,10']).toBeUndefined()
    expect(game.cash).toBe(cash - pit.cost)
    expect(JSON.stringify(game.fittings[hostKey('stand', 12, 7)] ?? [])).not.toContain('hydrant')
    expect(game.buildingCard()?.note).toBe(HYDRANT_CARD.short)
    expect(pitRow(game)?.label).toBe('This stand already has a pit.')
    game.standCardAction('pit:12,7')
    expect(game.cash).toBe(cash - pit.cost)
  })

  it('grants legacy pits only when the save has no standPits key and hydrants are researched', () => {
    const game = field()
    game.researchUnlocked.push('hydrant_fuel')
    game.autosave = true
    game.persist()
    const raw = localStorage.getItem(SAVE_KEY)
    expect(raw).toBeTruthy()
    const snap = storedData(raw!) as Record<string, unknown>
    delete snap.standPits
    localStorage.setItem(SAVE_KEY, serialize({ version: SAVE_SCHEMA_VERSION, snapshot: () => snap, restore() {} }, 0))
    const loaded = new Game()
    loaded.autosave = false
    expect(loaded.load()).toBe(true)
    expect(loaded.standPits['12,7']).toBe(true)
    expect(loaded.standPits['12,10']).toBe(true)
    expect(loaded.cash).toBe(game.cash)

    loaded.tiles[2]![2] = 'stand'
    loaded.standClass['2,2'] = 'M'
    expect(loaded.standPits['2,2']).toBeUndefined()

    game.standPits = {}
    game.persist()
    const kept = storedData(localStorage.getItem(SAVE_KEY)!) as Record<string, unknown>
    expect(kept.standPits).toEqual({})
    const respected = new Game()
    respected.autosave = false
    expect(respected.load()).toBe(true)
    expect(respected.standPits['12,7']).toBeUndefined()
    expect(respected.hasResearch('hydrant_fuel')).toBe(true)
  })
})
