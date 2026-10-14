import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types'
import {
  emptyPillar,
  pillarReport,
  sizeTierOf,
  tierOpen,
} from './logic'
import type { FieldSnapshot, PillarState, SizeTier } from './types'

function grid(size: number): Tile[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 'grass' as Tile))
}

function paint(tiles: Tile[][], c: number, r: number, tile: Tile) {
  tiles[r][c] = tile
}

function fullJumboSetup(): { field: FieldSnapshot; state: PillarState } {
  const size = 10
  const tiles = grid(size)

  // Layout setup:
  // (1,2) Terminal, (2,2) Travelator, (3,2) Travelator, (4,2) Stand
  // (1,3) Skywalk, (2,3) Skywalk, (3,3) Skywalk, (4,3) Skywalk
  // (1,1) Mover, (2,1) Mover, (3,1) Mover, (4,1) Mover
  // (6,2) Hangar, (4,4) Fuel farm, (4,5) Oil station, (4,6) Fuel rail, (4,7) Fuel rail to edge
  // (6,4) Depot
  paint(tiles, 1, 2, 'terminal')
  paint(tiles, 2, 2, 'travelator')
  paint(tiles, 3, 2, 'travelator')
  paint(tiles, 4, 2, 'stand')

  paint(tiles, 1, 3, 'skywalk')
  paint(tiles, 2, 3, 'skywalk')
  paint(tiles, 3, 3, 'skywalk')
  paint(tiles, 4, 3, 'skywalk')

  paint(tiles, 1, 1, 'mover')
  paint(tiles, 2, 1, 'mover')
  paint(tiles, 3, 1, 'mover')
  paint(tiles, 4, 1, 'mover')

  paint(tiles, 6, 2, 'hangar')
  paint(tiles, 4, 4, 'fuel')
  paint(tiles, 4, 5, 'oil')
  paint(tiles, 4, 6, 'fuel_rail')
  paint(tiles, 4, 7, 'fuel_rail')
  paint(tiles, 4, 8, 'fuel_rail')
  paint(tiles, 4, 9, 'fuel_rail') // Edge cell (size - 1 = 9)

  paint(tiles, 6, 4, 'depot')

  const standScale: Record<string, SizeTier> = { '4,2': 'jumbo' }
  const hangarScale: Record<string, SizeTier> = { '6,2': 'jumbo' }

  const research: FieldSnapshot['research'] = [
    'widebody_ops',
    'heavy_pack',
    'bag_sorter',
    'bag_bhs',
    'self_service',
    'ct_lanes',
    'egates',
    'travelator',
    'skywalk',
    'people_mover',
    'hydrant_fuel',
    'rail_fuel',
    'tank_farm_ii',
    'tank_farm_iii',
  ]

  const f: FieldSnapshot = {
    size,
    fieldLevel: 5,
    research,
    tiles,
    standScale,
    standClass: { '4,2': 'L' },
    standAccess: { '4,2': 'jetway' },
    hangarScale,
    legacyFuel: false,
  }

  const s: PillarState = {
    ...emptyPillar(),
    contractId: 'mega_jumbo',
    tankTier: 3,
    supply: 'rail',
    bagSystem: 'bhs',
    desks: 8,
    kiosks: 8,
    bagDrops: 4,
    scannerLanes: 4,
    eGates: 2,
    fleet: {
      hydrant_dispenser: 1,
      heavy_tug: 1,
      highlift_catering: 1,
      heavy_baggage_tug: 2,
      main_deck_loader: 1,
    },
  }

  return { field: f, state: s }
}

describe('tierOpen gating tests', () => {
  it('opens size tiers correctly based on field level and research', () => {
    // Small airframes (e.g., B738, CRJ700)
    expect(tierOpen('b738', 1, [])).toBe(true)
    expect(tierOpen('crj700', 1, [])).toBe(true)

    // Widebody airframes (e.g., B789, B77W, A359)
    expect(tierOpen('b789', 3, [])).toBe(false) // Needs level 4 & widebody_ops
    expect(tierOpen('b789', 4, [])).toBe(false)
    expect(tierOpen('b789', 3, ['widebody_ops'])).toBe(false)
    expect(tierOpen('b789', 4, ['widebody_ops'])).toBe(true)

    // Jumbo airframes (e.g., A380, B748F)
    expect(tierOpen('a380', 4, ['widebody_ops', 'heavy_pack'])).toBe(false) // Needs level 5
    expect(tierOpen('a380', 5, ['widebody_ops'])).toBe(false) // Needs heavy_pack
    expect(tierOpen('a380', 5, ['heavy_pack'])).toBe(true)
  })

  it('verifies that sizeTierOf maps all standard airframes correctly', () => {
    expect(sizeTierOf('b738')).toBe('small')
    expect(sizeTierOf('crj700')).toBe('small')
    expect(sizeTierOf('b789')).toBe('wide')
    expect(sizeTierOf('a359')).toBe('wide')
    expect(sizeTierOf('a380')).toBe('jumbo')
    expect(sizeTierOf('b748f')).toBe('jumbo')
  })
})

describe('jumbo pillar gating edge tests', () => {
  it('passes pillarReport when all pillars are satisfied for a Jumbo A380', () => {
    const { field, state } = fullJumboSetup()
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(true)
    expect(report.hints).toHaveLength(0)
  })

  it('fails jumbo if field level is insufficient', () => {
    const { field, state } = fullJumboSetup()
    field.fieldLevel = 4
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'level-jumbo')).toBe(true)
  })

  it('fails jumbo if heavy metal research is missing', () => {
    const { field, state } = fullJumboSetup()
    field.research = field.research.filter((r) => r !== 'heavy_pack')
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'research-jumbo')).toBe(true)
  })

  it('fails jumbo if jetway stand rating or access is missing', () => {
    const { field, state } = fullJumboSetup()
    field.standScale['4,2'] = 'wide'
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'stand-jumbo')).toBe(true)
  })

  it('fails jumbo if jumbo hangar is missing', () => {
    const { field, state } = fullJumboSetup()
    field.hangarScale['6,2'] = 'wide'
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'hangar-jumbo')).toBe(true)
  })

  it('fails jumbo if hydrant dispenser vehicle is missing', () => {
    const { field, state } = fullJumboSetup()
    delete state.fleet.hydrant_dispenser
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'fuel-truck-jumbo')).toBe(true)
  })

  it('fails jumbo if heavy tug is missing', () => {
    const { field, state } = fullJumboSetup()
    delete state.fleet.heavy_tug
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'tug-jumbo')).toBe(true)
  })

  it('fails jumbo if highlift catering truck is missing', () => {
    const { field, state } = fullJumboSetup()
    delete state.fleet.highlift_catering
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'cater-jumbo')).toBe(true)
  })

  it('fails jumbo if main-deck loader is missing', () => {
    const { field, state } = fullJumboSetup()
    delete state.fleet.main_deck_loader
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'loader-jumbo')).toBe(true)
  })

  it('fails jumbo if heavy baggage tugs/carts are missing', () => {
    const { field, state } = fullJumboSetup()
    delete state.fleet.heavy_baggage_tug
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'carts-jumbo')).toBe(true)
  })

  it('fails jumbo if jumbo fuel contract is missing', () => {
    const { field, state } = fullJumboSetup()
    state.contractId = 'trunk_wide'
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'contract-jumbo')).toBe(true)
  })

  it('fails jumbo if tank farm size is insufficient', () => {
    const { field, state } = fullJumboSetup()
    state.tankTier = 1 // Tier 1 holds 80k, jumbo needs 190k
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'tank-jumbo')).toBe(true)
  })

  it('fails jumbo if hydrant system research is missing', () => {
    const { field, state } = fullJumboSetup()
    field.research = field.research.filter((r) => r !== 'hydrant_fuel')
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'hydrant')).toBe(true)
  })

  it('fails jumbo if rail fuel link chain is broken', () => {
    const { field, state } = fullJumboSetup()
    field.tiles[9][4] = 'grass' // Break rail link to edge
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'rail-flow')).toBe(true)
  })

  it('fails jumbo if baggage system tier or throughput is insufficient', () => {
    const { field, state } = fullJumboSetup()
    state.bagSystem = 'sorter'
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'bags-jumbo')).toBe(true)
  })

  it('fails jumbo if early bag storage is missing', () => {
    const { field, state } = fullJumboSetup()
    state.bagSystem = 'carts' // Carts have 0 early bag storage
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'early-bags')).toBe(true)
  })

  it('fails jumbo if check-in throughput is insufficient', () => {
    const { field, state } = fullJumboSetup()
    state.desks = 1
    state.kiosks = 0
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'checkin-jumbo')).toBe(true)
  })

  it('fails jumbo if security screening throughput is insufficient', () => {
    const { field, state } = fullJumboSetup()
    state.scannerLanes = 0
    state.eGates = 0
    const report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'security-jumbo')).toBe(true)
  })

  it('fails jumbo if travelator, skywalk, or people mover links are missing', () => {
    const { field, state } = fullJumboSetup()

    // Remove travelator
    paint(field.tiles, 2, 2, 'grass')
    let report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'travelator')).toBe(true)

    // Restore travelator, remove skywalk
    paint(field.tiles, 2, 2, 'travelator')
    paint(field.tiles, 1, 3, 'grass')
    report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'skywalk')).toBe(true)

    // Restore skywalk, remove mover
    paint(field.tiles, 1, 3, 'skywalk')
    paint(field.tiles, 1, 1, 'grass')
    report = pillarReport(field, state, 'a380')
    expect(report.ok).toBe(false)
    expect(report.hints.some((h) => h.id === 'mover')).toBe(true)
  })
})
