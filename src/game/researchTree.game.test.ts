import { describe, expect, it } from 'vitest'
import { SAVE_SCHEMA_VERSION, serialize, storedData } from '../features/save/index.ts'
import { FLIGHT_RP, FLIGHT_RP_PER_50_PAX, OPS_RP_PER_SEC, RESEARCH_DAY_SEC, ROOM_RP_PER_SEC, TIER_COSTS, levelReward } from '../research/config.ts'
import { SAVE_KEY } from './types.ts'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'

function opened(): Game {
  const game = new Game()
  game.autosave = false
  game.beginNew('easy')
  game.buyLand('city')
  return game
}

describe('research tree on the field', () => {
  it('earns research points on day 1 before any staff or rooms', () => {
    const game = opened()
    expect(game.researchers).toBe(0)
    expect(game.labGear()).toEqual({ desks: 0, boards: 0, machines: 0 })
    const before = game.researchTree.points() + game.researchTree.state.carry
    game.tick(180)
    const after = game.researchTree.points() + game.researchTree.state.carry
    expect(after - before).toBeCloseTo(OPS_RP_PER_SEC * 180, 5)
    expect(game.researchTree.points()).toBeGreaterThan(0)
    expect(game.researchers).toBe(0)
  })

  it('banks room points with no researchers, and pays more once one is hired', () => {
    const game = opened()
    game.buildStarterKit()
    const hall = game.fits[0]
    expect(hall).toBeTruthy()
    hall!.rooms.rdesk = 1
    hall!.rooms.rboard = 1
    hall!.rooms.rmachine = 1
    const roomSum = ROOM_RP_PER_SEC.desk + ROOM_RP_PER_SEC.board + ROOM_RP_PER_SEC.machine
    expect(game.researchers).toBe(0)
    const bare = OPS_RP_PER_SEC + roomSum
    expect(game.researchRate()).toBeCloseTo(bare, 5)
    expect(game.researchRate() * RESEARCH_DAY_SEC).toBeGreaterThan(TIER_COSTS[1]!)
    expect(game.researchRate() * RESEARCH_DAY_SEC).toBeLessThan(TIER_COSTS[4]!)
    const before = game.researchPoints + game.researchTree.state.carry
    game.tick(1)
    expect(game.researchPoints + game.researchTree.state.carry - before).toBeCloseTo(bare, 5)
    game.researchers = 1
    expect(game.researchRate()).toBeGreaterThan(bare)
  })

  it('pays the field-level lump in cash and research points once', () => {
    const game = opened()
    const cash = game.cash
    game.grantFieldXp(90)
    expect(game.fieldLevel()).toBe(2)
    expect(game.cash).toBe(cash + levelReward(2).cash)
    expect(game.bank.ledger().byCategory.level_reward).toBe(levelReward(2).cash)
    expect(game.cash).toBeCloseTo(game.bank.balance, 5)
    expect(game.researchTree.points()).toBe(levelReward(2).rp)
    game.grantFieldXp(1)
    expect(game.cash).toBe(cash + levelReward(2).cash)
    expect(game.bank.ledger().byCategory.level_reward).toBe(levelReward(2).cash)
    expect(game.researchTree.points()).toBe(levelReward(2).rp)
  })

  it('opens the hydrant dispenser from the Fuel farm node, with the old desk list still empty', () => {
    const game = opened()
    game.fieldXp = 700
    game.cash = 200_000
    expect(game.fieldLevel()).toBe(5)
    expect(game.researchUnlocked).not.toContain('hydrant_fuel')
    expect(game.buyScaleVehicle('hydrant_dispenser')).toBeUndefined()
    expect(game.scaleFleet.hydrant_dispenser ?? 0).toBe(0)
    game.researchTree.state.unlocked.push('airside-1')
    expect(game.researchGrants()).toContain('hydrant_fuel')
    expect(game.researchUnlocked).not.toContain('hydrant_fuel')
    game.buyScaleVehicle('hydrant_dispenser')
    expect(game.scaleFleet.hydrant_dispenser).toBe(1)
  })

  it('adds a finished flight to the growth tree', () => {
    const game = opened()
    const before = game.researchTree.points() + game.researchTree.state.carry
    game.grantResearchForFlight({ pax: 80, kind: 'narrowbody' } as Flight)
    const after = game.researchTree.points() + game.researchTree.state.carry
    expect(after - before).toBeCloseTo(FLIGHT_RP + FLIGHT_RP_PER_50_PAX, 5)
    expect(game.researchPoints).toBe(game.researchTree.points())
  })

  it('folds an old desk balance into the tree once', () => {
    const starter = opened()
    starter.autosave = true
    starter.persist()
    starter.autosave = false
    const raw = localStorage.getItem(SAVE_KEY)
    expect(raw).toBeTruthy()
    const oldSnap = storedData(raw!) as Record<string, unknown>
    oldSnap.researchPoints = 40.25
    oldSnap.researchUnlocked = ['deice']
    oldSnap.researchUnified = false
    oldSnap.researchTree = { points: 0, carry: 0, unlocked: [], rewardedThrough: 1, primarySpec: null }
    const wave = oldSnap.wave3 as { research?: { points?: number; carry?: number; unlocked?: string[] } } | undefined
    if (wave?.research) {
      wave.research.points = 0
      wave.research.carry = 0
      wave.research.unlocked = []
    }
    localStorage.setItem(
      SAVE_KEY,
      serialize({ version: SAVE_SCHEMA_VERSION, snapshot: () => oldSnap, restore() {} }, 0),
    )
    const loaded = new Game()
    loaded.autosave = false
    expect(loaded.load()).toBe(true)
    expect(loaded.researchTree.points() + loaded.researchTree.state.carry).toBeCloseTo(40.25, 5)
    expect(loaded.researchTree.state.unlocked).toContain('airfield-2')
    expect(loaded.researchPoints).toBe(loaded.researchTree.points())
    loaded.persist()
    const again = new Game()
    again.autosave = false
    expect(again.load()).toBe(true)
    expect(again.researchTree.points() + again.researchTree.state.carry).toBeCloseTo(40.25, 5)
  })

  it('refuses a linked stamp until its node is owned', () => {
    const game = opened()
    game.fieldXp = 90
    game.cash = 200_000
    const cell = { c: 6, r: 5 }
    game.tiles[cell.r]![cell.c] = 'grass'
    game.tiles[cell.r]![cell.c + 1] = 'road'
    game.setTool('depot')
    game.placeSingle(cell)
    expect(game.sites).toHaveLength(0)
    expect(game.news[0]?.text).toMatch(/Requires research: GSE depot/)
    game.researchTree.state.unlocked.push('airside-3')
    game.placeSingle(cell)
    expect(game.sites.some((site) => site.tile === 'depot')).toBe(true)
  })
})
