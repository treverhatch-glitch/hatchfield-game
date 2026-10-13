import { describe, expect, it } from 'vitest'
import { CARGO_WAREHOUSE_CAP, HUB_BAN_THRESHOLD, HUB_HEAT_NEED, prestigeThreshold } from '../game/catalog.ts'
import { Game } from '../game/sim.ts'
import {
  BASE_SPEC_MODS,
  EXTRA_PATH_CAPSTONE_PREMIUM,
  SPEC_NODES,
  SPEC_PATHS,
  bankSlotCount,
  bankSpacing,
  foldSpecMods,
  nodeHasTradeoff,
  nodesForPath,
  retailPrice,
  screenMultiplier,
  specCashCost,
  treePointsForProgress,
  turnMinutes,
  warehouseCapacity,
  type SpecPath,
} from './specializations.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.scheduleAuto = false
  game.schedule = []
  return game
}

function maxAffordable(path: SpecPath, points: number): number {
  const nodes = nodesForPath(path)
  let best = 0
  for (let mask = 0; mask < 1 << nodes.length; mask++) {
    const owned = nodes.filter((_, i) => (mask & (1 << i)) !== 0)
    const cost = owned.reduce((sum, node) => sum + node.cost, 0)
    if (cost > points) continue
    const ids = new Set(owned.map((node) => node.id))
    if (!owned.every((node) => node.requires.every((req) => ids.has(req)))) continue
    best = Math.max(best, owned.length)
  }
  return best
}

describe('specialization trees', () => {
  it('gives each path 9 nodes, a capstone, and a trade-off on every node', () => {
    expect(SPEC_PATHS.map((p) => p.id)).toEqual(['hub', 'low-cost', 'cargo', 'luxury'])
    for (const path of SPEC_PATHS) {
      const nodes = nodesForPath(path.id)
      expect(nodes.length, path.id).toBeGreaterThanOrEqual(8)
      expect(nodes.length, path.id).toBeLessThanOrEqual(10)
      expect(nodes.reduce((sum, node) => sum + node.cost, 0), path.id).toBe(12)
      expect(nodes.filter((node) => node.capstone), path.id).toHaveLength(1)
      for (const node of nodes) {
        expect(node.perk.length, node.id).toBeGreaterThan(8)
        expect(node.tradeoff.length, node.id).toBeGreaterThan(8)
        expect(nodeHasTradeoff(node), node.id).toBe(true)
        for (const req of node.requires) {
          const parent = nodes.find((n) => n.id === req)
          expect(parent, req).toBeTruthy()
          expect(parent!.col).toBeLessThan(node.col)
        }
      }
    }
    expect(SPEC_NODES).toHaveLength(36)
  })

  it('lets P5 buy nearly one tree and not the whole of two', () => {
    expect(treePointsForProgress(5, 0)).toBe(0)
    expect(treePointsForProgress(6, 0)).toBe(1)
    expect(treePointsForProgress(10, 0)).toBe(6)
    expect(treePointsForProgress(10, 5)).toBe(11)
    for (const path of SPEC_PATHS) {
      expect(maxAffordable(path.id, 11), path.id).toBe(8)
      expect(maxAffordable(path.id, 12), path.id).toBe(9)
    }
    expect(maxAffordable('hub', 11) + maxAffordable('cargo', 11)).toBeGreaterThan(9)
    expect(maxAffordable('hub', 6)).toBeLessThan(8)
  })

  it('prices a later path capstone at +50% and leaves the first at list', () => {
    expect(specCashCost(18_000, ['hub'], 'hub')).toBe(18_000)
    expect(specCashCost(18_000, ['low-cost', 'hub'], 'hub')).toBe(
      Math.round(18_000 * (1 + EXTRA_PATH_CAPSTONE_PREMIUM)),
    )
    expect(specCashCost(14_000, [], 'low-cost')).toBe(14_000)
    expect(specCashCost(0, ['hub', 'cargo'], 'cargo')).toBe(0)
  })

  it('folds perks into the live systems and stays identity when nothing is owned', () => {
    expect(foldSpecMods([])).toEqual(BASE_SPEC_MODS)
    const hub = foldSpecMods(['hub_bank', 'hub_mct', 'hub_feed'])
    expect(hub.hubExtraSlots).toBe(2)
    expect(hub.hubSpacing).toBeCloseTo(0.86)
    expect(hub.connectSlackSec).toBe(8)
    expect(hub.missHeat).toBeCloseTo(1.4)
    expect(hub.scheduleCap).toBe(-1)
    expect(hub.upkeepPerDay).toBe(420 + 640)
    expect(bankSlotCount(2, { hub: true, lcc: false, mods: hub })).toBe(5)
    expect(bankSlotCount(2, { hub: true, lcc: false, mods: BASE_SPEC_MODS })).toBe(3)
    expect(bankSpacing('pax', true, hub, 0)).toBeCloseTo(12 * 0.86)
    expect(bankSpacing('pax', false, hub, 0)).toBeCloseTo(18 * 1.1)

    const lcc = foldSpecMods(['lcc_quick', 'lcc_fee', 'lcc_remote'])
    expect(turnMinutes(55, lcc, false)).toBe(Math.round(55 * 0.88 * 0.94 * 1.08))
    expect(turnMinutes(55, BASE_SPEC_MODS, false)).toBe(55)
    expect(lcc.lowCostFee).toBeCloseTo(0.85)
    expect(lcc.lccExtraSlots).toBe(1)

    const cargo = foldSpecMods(['cargo_apron', 'cargo_night', 'cargo_sort', 'cargo_rail'])
    expect(warehouseCapacity(CARGO_WAREHOUSE_CAP, cargo, false)).toBe(Math.round(140 * 1.18))
    expect(warehouseCapacity(CARGO_WAREHOUSE_CAP, cargo, true)).toBe(
      Math.round(140 * 1.18 * 1.15),
    )
    expect(cargo.nightCargoFee).toBeCloseTo(1.25)
    expect(cargo.dayCargoFee).toBeCloseTo(0.88)
    expect(cargo.cargoTonnage).toBeCloseTo(1.22)
    expect(cargo.nightHub).toBe(true)
    expect(cargo.nightSlots).toBe(1)

    const lux = foldSpecMods(['lux_lane', 'lux_lounge', 'lux_tenant'])
    expect(screenMultiplier(lux, true)).toBeCloseTo(0.75)
    expect(screenMultiplier(lux, false)).toBeCloseTo(1.12)
    expect(retailPrice(32, lux, 'lounge', false)).toBe(Math.round(32 * 1.3))
    expect(retailPrice(24, lux, 'tenant', false)).toBe(Math.round(24 * 1.18))
    expect(lux.tenantPref).toBeCloseTo(0.14)
    expect(screenMultiplier(BASE_SPEC_MODS, true)).toBe(1)
  })
})

describe('specialization tree on the field', () => {
  it('refuses a node before its path and before its parent', () => {
    const game = starter()
    game.fieldXp = 1100
    expect(game.treePointsLeft()).toBe(1)
    expect(game.buySpecNode('hub_bank')).toBe(false)
    expect(game.chooseSpec('hub')).toBe(true)
    expect(game.buySpecNode('hub_mct')).toBe(false)
    expect(game.specNodes).toEqual([])
    expect(game.buySpecNode('hub_bank')).toBe(true)
    expect(game.treePointsLeft()).toBe(0)
    expect(game.buySpecNode('hub_feed')).toBe(false)
  })

  it('bills node upkeep and keeps the first path off the mix premium', () => {
    const game = starter()
    game.fieldXp = 1100
    const before = game.landsideUpkeep()
    game.chooseSpec('hub')
    expect(game.landsideUpkeep()).toBe(before)
    game.buySpecNode('hub_bank')
    expect(game.landsideUpkeep()).toBe(before + 420)
    game.fieldXp = 2300
    game.chooseSpec('cargo')
    expect(game.landsideUpkeep()).toBe(Math.round((before + 420) * 1.1))
  })

  it('cuts low-cost landing fees and turn time, and widens the warehouse', () => {
    const fees = starter()
    fees.fieldXp = 1600
    expect(fees.landingFeeMult('northline')).toBe(1)
    expect(fees.scaledTurnMinutes(55)).toBe(55)
    fees.chooseSpec('low-cost')
    fees.buySpecNode('lcc_quick')
    fees.buySpecNode('lcc_fee')
    expect(fees.landingFeeMult('northline')).toBeCloseTo(0.85)
    expect(fees.landingFeeMult('harbor')).toBe(1)
    expect(fees.scaledTurnMinutes(55)).toBe(Math.round(55 * 0.88))

    const cargo = starter()
    cargo.fieldXp = 1100
    expect(cargo.cargoWarehouseCap()).toBe(CARGO_WAREHOUSE_CAP)
    cargo.chooseSpec('cargo')
    cargo.buySpecNode('cargo_apron')
    expect(cargo.cargoWarehouseCap()).toBe(Math.round(CARGO_WAREHOUSE_CAP * 1.18))
  })

  it('adds hub departures and saves the tree with the field', () => {
    const game = starter()
    game.fieldXp = 1100
    game.chooseSpec('hub')
    game.buySpecNode('hub_bank')
    game.hubAirlines = ['northline']
    game.seedScheduleForAirline('northline', 2)
    expect(game.schedule.filter((s) => s.airline === 'northline')).toHaveLength(4)

    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.specPaths).toEqual(['hub'])
    expect(loaded.specNodes).toEqual(['hub_bank'])
    expect(loaded.treePointsSpent()).toBe(1)
    loaded.schedule = []
    loaded.hubAirlines = ['northline']
    loaded.seedScheduleForAirline('northline', 2)
    expect(loaded.schedule.filter((s) => s.airline === 'northline')).toHaveLength(4)

    loaded.beginNew('easy')
    expect(loaded.specNodes).toEqual([])
    expect(loaded.specPaths).toEqual([])
  })

  it('holds the satellite capstone until prestige and charges the mix premium', () => {
    const game = starter()
    game.fieldXp = 4500
    game.chooseSpec('low-cost')
    game.chooseSpec('hub')
    game.cash = 400_000
    const chain = [
      'hub_bank',
      'hub_mct',
      'hub_feed',
      'hub_interline',
      'hub_dual',
      'hub_belt',
    ]
    for (const id of chain) expect(game.buySpecNode(id), id).toBe(true)
    expect(game.treePointsLeft()).toBe(0)
    expect(game.buySpecNode('hub_recovery')).toBe(false)

    game.fieldXp = prestigeThreshold(4)
    expect(game.treePointsLeft()).toBe(4)
    expect(game.buySpecNode('hub_recovery')).toBe(true)
    const cash = game.cash
    expect(game.buySpecNode('hub_satellite')).toBe(true)
    expect(game.cash).toBe(cash - Math.round(18_000 * 1.5))
    expect(game.specInboundBonus()).toBe(1)
    game.progressionBuilt.push('satellite')
    expect(game.specInboundBonus()).toBe(2)
    expect(game.hubHeatNeed()).toBe(HUB_HEAT_NEED)
    game.hubAirlines = ['northline']
    expect(game.banThreshold('northline')).toBe(HUB_BAN_THRESHOLD)
  })
})
