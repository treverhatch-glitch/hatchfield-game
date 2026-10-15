import { describe, expect, it } from 'vitest'
import { SAVE_SCHEMA_VERSION, serialize, storedData } from '../features/save/index.ts'
import { SAVE_KEY } from './types.ts'
import { Game } from './sim.ts'

function freshGame(): Game {
  const game = new Game()
  game.sandbox = false
  game.autosave = false
  game.beginNew('easy')
  game.buyLand('city')
  return game
}

describe('ops wallet folded into the growth tree', () => {
  it('refuses an economy node the airport does not read', () => {
    const game = freshGame()
    expect(game.buyOpsTech('commercial.t1')).toBe(false)
    expect(game.hasOpsTech('sustainability.t1')).toBe(false)
    expect(game.news[0]?.text).toMatch(/Nothing in the airport reads/)
  })

  it('spends the Growth wallet on the node that replaced the ops tech', () => {
    const game = freshGame()
    game.fieldXp = 700
    game.researchPoints = 500
    expect(game.buyOpsTech('sustainability.t1')).toBe(false)
    expect(game.buyResearchNode('spec-charter')).toBe(true)
    expect(game.buyResearchNode('spec-green-1')).toBe(true)
    expect(game.buyResearchNode('spec-green-2')).toBe(true)
    const before = game.researchPoints
    expect(game.buyOpsTech('sustainability.t1')).toBe(true)
    expect(game.researchPoints).toBeLessThan(before)
    expect(game.researchTree.owns('spec-green-3')).toBe(true)
    expect(game.hasOpsTech('sustainability.t1')).toBe(true)
    game.autosave = true
    game.persist()

    const loaded = new Game()
    loaded.autosave = false
    expect(loaded.load()).toBe(true)
    expect(loaded.hasOpsTech('sustainability.t1')).toBe(true)
    expect(loaded.researchTree.owns('spec-green-3')).toBe(true)
    expect(loaded.opsWallet().points).toBe(0)
  })

  it('moves a saved ops balance into the growth wallet once', () => {
    const starter = freshGame()
    starter.autosave = true
    starter.persist()
    const raw = localStorage.getItem(SAVE_KEY)
    expect(raw).toBeTruthy()
    const oldSnap = storedData(raw!) as Record<string, unknown>
    oldSnap.economy = {
      elapsedSimMinutes: 0,
      fieldLevel: 1,
      researchPoints: 7,
      researchProgress: 0.4,
      unlockedTech: ['cargo.t4'],
      claimedMilestones: [],
      clearedBottlenecks: [],
      transitTier: 'road',
      housingTier: 0,
      powerPlantTier: 1,
    }
    localStorage.setItem(
      SAVE_KEY,
      serialize({ version: SAVE_SCHEMA_VERSION, snapshot: () => oldSnap, restore() {} }, 0),
    )

    const loaded = new Game()
    loaded.autosave = false
    expect(loaded.load()).toBe(true)
    expect(loaded.researchTree.points() + loaded.researchTree.state.carry).toBeCloseTo(7.4, 5)
    expect(loaded.researchTree.owns('spec-cargo-2')).toBe(true)
    expect(loaded.hasOpsTech('cargo.t4')).toBe(true)
    expect(loaded.opsWallet().points).toBe(0)

    loaded.autosave = true
    loaded.persist()
    const again = new Game()
    again.autosave = false
    expect(again.load()).toBe(true)
    expect(again.researchTree.points() + again.researchTree.state.carry).toBeCloseTo(7.4, 5)
    expect(again.opsWallet().points).toBe(0)
  })
})
