import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { BARGE, bargeLeadMinutes } from '../fuel/barge.ts'
import { PIPELINE } from '../fuel/pipeline.ts'
import { tankDef } from '../scale/logic.ts'

function field(site: 'city' | 'factory' = 'city'): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand(site)
  game.buildStarterKit()
  game.speed = 1
  game.cash += 400_000
  game.fieldXp = 700
  game.researchUnlocked.push('rail_fuel', 'hydrant_fuel', 'heavy_pack', 'widebody_ops')
  game.contractId = 'mega_jumbo'
  game.fuelBrand = 'kiln'
  game.tankTier = 3
  game.tankLitres = 10_000
  return game
}

describe('barge berth', () => {
  it('delivers one rail-day only when a river-edge berth is open', () => {
    const game = field()
    game.fuelSupply = 'barge'
    game.bargeMinutes = bargeLeadMinutes() - 1
    const dry = game.tankLitres
    game.tick(2)
    expect(game.tankLitres).toBe(dry)
    expect(game.berthIsOpen()).toBe(false)
    expect(game.bargeEmpty()).toBe(true)
    expect(game.news.some((n) => n.text === BARGE.card)).toBe(true)
    expect(game.termUnitPrice('mega_jumbo')).toBeCloseTo(0.012, 3)

    game.tiles[1]![0] = 'berth'
    game.ownedPlots.push({ id: '0,0', assessed: 1 })
    expect(game.berthIsOpen()).toBe(false)

    game.tiles[1]![0] = 'grass'
    game.tiles[0]![0] = 'berth'
    expect(game.berthIsOpen()).toBe(true)
    expect(game.termUnitPrice('mega_jumbo')).toBeCloseTo(0.012 + PIPELINE.railDifferential, 3)
    const before = game.tankLitres
    game.bargeMinutes = bargeLeadMinutes() - 1
    game.tick(2)
    expect(game.tankLitres).toBe(tankDef(3).capacityLitres)
    expect(game.tankLitres).toBeGreaterThan(before + 100_000)
    expect(game.bargeMinutes).toBe(0)
  })

  it('refuses barges on an inland field and lets an empty berth call one spot truck', () => {
    const inland = field('factory')
    inland.setFuelSupply('barge')
    expect(inland.fuelSupply).toBe('road')
    expect(inland.news.some((n) => n.text.includes('no river'))).toBe(true)

    const game = field()
    game.setFuelSupply('barge')
    expect(game.fuelSupply).toBe('barge')
    expect(game.news.some((n) => n.text.includes('Fuel supply set to barge'))).toBe(true)
    game.bargeMinutes = bargeLeadMinutes()
    game.tick(2)
    game.orderBargeSpot()
    expect(game.contractId).toBe('mega_jumbo')
    expect(game.spotInbound?.outage).toBe(true)
  })

  it('will not stamp a berth off the river edge', () => {
    const game = field()
    game.researchTree.state.unlocked.push('airside-6')
    game.ownedPlots.push({ id: '0,0', assessed: 1 })
    game.tool = 'berth'
    game.clickTile({ c: 0, r: 1 })
    expect(game.sites.some((site) => site.tile === 'berth')).toBe(false)
    expect(game.news.some((n) => n.text.includes('touches the river'))).toBe(true)
    game.clickTile({ c: 0, r: 0 })
    expect(game.sites.some((site) => site.tile === 'berth' && site.cells.some((cell) => cell.c === 0 && cell.r === 0))).toBe(true)
    game.tick(8)
    expect(game.tiles[0]![0]).toBe('berth')
    expect(game.berthIsOpen()).toBe(true)
  })
})
