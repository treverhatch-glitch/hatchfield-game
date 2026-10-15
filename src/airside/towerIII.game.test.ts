import { beforeEach, describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { SAVE_KEY } from '../game/types.ts'
import { TOWER_III_UPGRADE } from './data.ts'
import { canBuildTowerIII } from './tower.ts'

function lateGame(): Game {
  const game = new Game()
  game.beginNew('easy')
  game.buyLand('factory')
  game.cash = 2_000_000
  game.fieldXp = 3_200
  game.progressionBuilt.push(TOWER_III_UPGRADE.prerequisite)
  game.tiles[4]![4] = 'tower'
  game.setTool('pan')
  return game
}

describe('Tower III', () => {
  beforeEach(() => localStorage.clear())

  it('requires the late field level, ATC approach, and a placed tower', () => {
    expect(
      canBuildTowerIII({
        towerPlaced: true,
        fieldLevel: 8,
        hasApproachControl: true,
        alreadyBuilt: false,
      }).why,
    ).toMatch(/Field level 9/)
    expect(
      canBuildTowerIII({
        towerPlaced: true,
        fieldLevel: 9,
        hasApproachControl: false,
        alreadyBuilt: false,
      }).why,
    ).toMatch(/ATC approach/)
  })

  it('is bought from the clicked tower and raises live approach capacity', () => {
    const game = lateGame()
    const cash = game.cash
    const upkeep = game.landsideUpkeep()
    const inbound = game.maxInbound()

    game.clickTile({ c: 4, r: 4 })

    expect(game.infoOpen).toBe('tower:4,4')
    expect(game.towerIIIUpgradeOffer()?.ok).toBe(true)
    expect(game.buyTowerIII()).toBe(true)
    expect(game.cash).toBe(cash - TOWER_III_UPGRADE.cost)
    expect(game.maxInbound()).toBe(inbound + TOWER_III_UPGRADE.maxInboundBonus)
    expect(game.landsideUpkeep()).toBe(upkeep + TOWER_III_UPGRADE.upkeepPerDay)
    expect(game.infoLines('tower:4,4')).toContain(
      `ATC runway capacity ${TOWER_III_UPGRADE.movementsPerHour} movements/hr`,
    )
  })

  it('round-trips with the placed tower and is removed if that tower is bulldozed', () => {
    const game = lateGame()
    game.clickTile({ c: 4, r: 4 })
    expect(game.buyTowerIII()).toBe(true)
    game.persist()

    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.towerIII.has('4,4')).toBe(true)

    loaded.setTool('clear')
    loaded.clickTile({ c: 4, r: 4 })
    expect(loaded.towerIII.has('4,4')).toBe(false)
    localStorage.removeItem(SAVE_KEY)
  })
})
