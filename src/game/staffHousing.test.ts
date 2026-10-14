import { describe, expect, it } from 'vitest'
import { MECHANIC_HIRE, money } from './catalog.ts'
import { HOUSING_TIERS } from '../staffhousing/data.ts'
import { Game } from './sim.ts'
import { SAVE_KEY } from './types.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.buyLand('city')
  game.cash = 400_000
  return game
}

describe('staff housing on the field', () => {
  it('builds a dorm on an expansion plot and posts the ledger', () => {
    const game = field()
    expect(game.buildStaffHousing('dorm')).toBe(false)
    expect(game.news[0]?.text ?? '').toMatch(/Field Level 2|plot/i)

    game.grantFieldXp(90)
    expect(game.buyParcel()).toBe(true)
    const before = game.cash
    expect(game.buildStaffHousing('dorm')).toBe(true)
    const dorm = HOUSING_TIERS[0]!
    expect(game.cash).toBe(before - dorm.cost)
    expect(game.bank.ledger().byCategory.construction).toBe(-dorm.cost)
    expect(game.staffSites()).toHaveLength(1)
    expect(game.staffWalkers().length).toBeGreaterThan(1)
    expect(game.staffPanel().commuteSummary).toBe('Access road')
    expect(game.staffHireCost(MECHANIC_HIRE)).toBe(Math.round(MECHANIC_HIRE * 0.9))

    const hired = game.cash
    expect(game.hireMechanic()).toBeUndefined()
    expect(game.mechanics).toBe(1)
    expect(game.cash).toBe(hired - Math.round(MECHANIC_HIRE * 0.9))
    expect(game.bank.ledger().byCategory.staff_hiring).toBe(-Math.round(MECHANIC_HIRE * 0.9))
    expect(money(game.staffHireCost(MECHANIC_HIRE))).toMatch(/\$/)
  })

  it('bills daily upkeep, keeps the house in the save, and prefers rail', () => {
    const game = field()
    game.grantFieldXp(90)
    game.buyParcel()
    game.buildStaffHousing('dorm')
    const upkeep = HOUSING_TIERS[0]!.upkeepPerDay
    game.clock = 180
    game.tickPayroll(0)
    expect(game.bank.ledger().byCategory.building_upkeep).toBeLessThanOrEqual(-upkeep)

    game.tiles[4][4] = 'bus'
    expect(game.staffPanel().commuteSummary).toBe('City bus')
    game.railLinked = true
    game.tiles[5][5] = 'rail'
    expect(game.staffPanel().commute.minutes).toBeLessThan(26)
    expect(game.staffPanel().commuteSummary).toBe('City rail')
    expect(game.staffHousing.economyTier()).toBe(1)

    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.staffSites().map((site) => site.tier)).toEqual(['dorm'])
    expect(loaded.staffWalkers().length).toBeGreaterThan(1)
    localStorage.removeItem(SAVE_KEY)
  })
})
