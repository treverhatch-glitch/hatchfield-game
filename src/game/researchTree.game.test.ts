import { describe, expect, it } from 'vitest'
import { OPS_RP_PER_SEC, RESEARCH_DAY_SEC, ROOM_RP_PER_SEC, TIER_COSTS, levelReward } from '../research/config.ts'
import { Game } from './sim.ts'

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
    expect(game.researchRate() * RESEARCH_DAY_SEC).toBeLessThan(TIER_COSTS[1]!)
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
