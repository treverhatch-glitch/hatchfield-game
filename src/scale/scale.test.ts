import { describe, expect, it } from 'vitest'
import { LogisticsSim } from '../logistics/engine'
import { defaultConfig } from '../logistics/defaults'
import type { Tile } from '../game/types'
import { SIZE_TIERS, TANK_TIERS } from './data'
import {
  cartCount,
  emptyPillar,
  operatingFleet,
  personSpeedMult,
  pillarReport,
  railHints,
  railLink,
  scaleAdvice,
  sizeTierOf,
  tickFuel,
  tierOpen,
  vehicleCanServe,
  walkMinutes,
} from './logic'
import type { FieldSnapshot, PillarState, SizeTier } from './types'

function grid(size: number): Tile[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 'grass' as Tile))
}

function field(partial: Partial<FieldSnapshot> = {}): FieldSnapshot {
  return {
    size: 8,
    fieldLevel: 1,
    research: [],
    tiles: grid(8),
    standScale: {},
    standClass: {},
    standAccess: {},
    hangarScale: {},
    legacyFuel: true,
    ...partial,
  }
}

function paint(tiles: Tile[][], c: number, r: number, tile: Tile) {
  tiles[r][c] = tile
}

describe('aircraft size tiers', () => {
  it('puts 737s, 787s and 777s, then the A380 on one ladder', () => {
    expect(sizeTierOf('b738')).toBe('small')
    expect(sizeTierOf('crj700')).toBe('small')
    expect(sizeTierOf('b789')).toBe('wide')
    expect(sizeTierOf('b77w')).toBe('wide')
    expect(sizeTierOf('a359')).toBe('wide')
    expect(sizeTierOf('a380')).toBe('jumbo')
    expect(sizeTierOf('b748f')).toBe('jumbo')
  })

  it('gates widebody and jumbo on field level and research', () => {
    expect(tierOpen('b738', 1, [])).toBe(true)
    expect(tierOpen('b789', 3, ['widebody_ops'])).toBe(false)
    expect(tierOpen('b789', 4, [])).toBe(false)
    expect(tierOpen('b77w', 4, ['widebody_ops'])).toBe(true)
    expect(tierOpen('a380', 5, ['widebody_ops'])).toBe(false)
    expect(tierOpen('a380', 5, ['heavy_pack'])).toBe(true)
  })
})

describe('service vehicles', () => {
  it('refuses a vehicle below the aircraft tier', () => {
    expect(vehicleCanServe('fuel_truck', 'small')).toBe(true)
    expect(vehicleCanServe('fuel_truck', 'wide')).toBe(false)
    expect(vehicleCanServe('heavy_fuel_truck', 'wide')).toBe(true)
    expect(vehicleCanServe('heavy_fuel_truck', 'jumbo')).toBe(false)
    expect(vehicleCanServe('hydrant_dispenser', 'jumbo')).toBe(true)
    expect(vehicleCanServe('pushback_tug', 'jumbo')).toBe(false)
    expect(vehicleCanServe('heavy_tug', 'jumbo')).toBe(true)
    expect(vehicleCanServe('catering_truck', 'jumbo')).toBe(false)
    expect(vehicleCanServe('highlift_catering', 'jumbo')).toBe(true)
    expect(vehicleCanServe('baggage_tug', 'wide')).toBe(false)
    expect(vehicleCanServe('gpu', 'jumbo')).toBe(true)
  })

  it('counts bag carts and will not let small tugs stand in for a widebody', () => {
    expect(cartCount({ baggage_tug: 1 })).toBe(2)
    expect(cartCount({ heavy_baggage_tug: 2 })).toBe(12)
    const tiles = grid(8)
    paint(tiles, 2, 2, 'fuel')
    const report = pillarReport(field({ tiles, fieldLevel: 4, research: ['widebody_ops'] }), emptyPillar(), 'b789')
    expect(report.hints.some((h) => h.id === 'carts-wide')).toBe(true)
    expect(report.hints.some((h) => h.id === 'fuel-truck-wide')).toBe(true)
  })
})

describe('fuel supply', () => {
  it('fills the farm from a road tanker and stops when the tank is the limit', () => {
    const tiles = grid(8)
    paint(tiles, 2, 2, 'fuel')
    const state = emptyPillar()
    state.contractId = 'apex_local'
    const first = tickFuel(field({ tiles, legacyFuel: false }), state, 89, 10_000)
    expect(first.delivered).toBe(0)
    const second = tickFuel(field({ tiles, legacyFuel: false }), state, 1, 10_000)
    expect(second.method).toBe('road')
    expect(second.delivered).toBe(36_000)
    expect(second.paid).toBeCloseTo(720)
    state.litres = TANK_TIERS[0].capacityLitres
    const full = tickFuel(field({ tiles, legacyFuel: false }), state, 200, 10_000)
    expect(full.delivered).toBe(0)
  })

  it('does not deliver rail fuel until the line and the station are connected', () => {
    const tiles = grid(6)
    paint(tiles, 2, 2, 'fuel')
    const state = emptyPillar()
    state.contractId = 'mega_jumbo'
    state.supply = 'rail'
    state.tankTier = 3
    const locked = field({ tiles, fieldLevel: 5, research: ['rail_fuel'], legacyFuel: false })
    expect(railLink(locked, true).flowing).toBe(false)
    expect(tickFuel(locked, state, 60, 50_000)).toMatchObject({ method: 'road', railFlowing: false })
    state.litres = 0
    expect(railHints(locked).map((h) => h.id)).toEqual(expect.arrayContaining(['rail-line', 'rail-station']))

    paint(tiles, 2, 1, 'oil')
    paint(tiles, 2, 0, 'fuel_rail')
    const linked = field({ tiles, fieldLevel: 5, research: ['rail_fuel'], legacyFuel: false })
    expect(railLink(linked, true)).toMatchObject({
      stationOnLine: true,
      reachesEdge: true,
      touchesFarm: true,
      flowing: true,
    })
    const delivered = tickFuel(linked, state, 60, 50_000)
    expect(delivered.method).toBe('rail')
    expect(delivered.delivered).toBe(280_000)
    expect(delivered.railFlowing).toBe(true)
  })

  it('names each missing piece of the rail chain', () => {
    const tiles = grid(6)
    paint(tiles, 4, 4, 'fuel')
    paint(tiles, 1, 1, 'oil')
    paint(tiles, 3, 3, 'fuel_rail')
    const hints = railHints(field({ tiles, research: ['rail_fuel'] })).map((h) => h.id)
    expect(hints).toContain('rail-join')
    expect(hints).toContain('rail-farm')

    const short = grid(6)
    paint(short, 2, 2, 'fuel')
    paint(short, 2, 1, 'oil')
    paint(short, 1, 1, 'fuel_rail')
    const edge = railHints(field({ tiles: short, research: ['rail_fuel'] })).map((h) => h.id)
    expect(edge).toContain('rail-edge')
    expect(edge).not.toContain('rail-join')
  })

  it('keeps the tank upgrade and the contract on the same tier ladder', () => {
    expect(TANK_TIERS.map((t) => t.capacityLitres)).toEqual([80_000, 480_000, 1_600_000])
    expect(SIZE_TIERS.wide.fuelLitres).toBeGreaterThan(TANK_TIERS[0].capacityLitres)
    expect(SIZE_TIERS.wide.fuelLitres).toBeLessThan(TANK_TIERS[1].capacityLitres)
    expect(SIZE_TIERS.jumbo.fuelLitres).toBeLessThan(TANK_TIERS[2].capacityLitres)
    const tiles = grid(4)
    paint(tiles, 1, 1, 'fuel')
    const state = emptyPillar()
    state.contractId = 'apex_local'
    const report = pillarReport(
      field({ tiles, fieldLevel: 4, research: ['widebody_ops'], legacyFuel: false }),
      state,
      'b789',
    )
    expect(report.hints.some((h) => h.id === 'contract-wide')).toBe(true)
    expect(report.hints.some((h) => h.id === 'tank-wide')).toBe(true)
  })
})

function ready(tier: SizeTier): { field: FieldSnapshot; state: PillarState } {
  const size = 8
  const tiles = grid(size)
  paint(tiles, 1, 2, 'terminal')
  paint(tiles, 4, 2, 'stand')
  paint(tiles, 4, 4, 'fuel')
  paint(tiles, 6, 2, 'hangar')
  paint(tiles, 6, 4, 'depot')
  const standScale: Record<string, SizeTier> = { '4,2': tier }
  const hangarScale: Record<string, SizeTier> = { '6,2': tier === 'small' ? 'small' : tier }
  if (tier !== 'small') {
    paint(tiles, 2, 2, 'travelator')
    paint(tiles, 3, 2, 'travelator')
    paint(tiles, 1, 3, 'skywalk')
    paint(tiles, 2, 3, 'skywalk')
    paint(tiles, 3, 3, 'skywalk')
    paint(tiles, 4, 3, 'skywalk')
  }
  if (tier === 'jumbo') {
    paint(tiles, 4, 5, 'oil')
    paint(tiles, 4, 6, 'fuel_rail')
    paint(tiles, 4, 7, 'fuel_rail')
    for (const c of [1, 2, 3, 4]) paint(tiles, c, 1, 'mover')
  }
  const research = []
  if (tier !== 'small') {
    research.push(
      'widebody_ops',
      'bag_sorter',
      'self_service',
      'ct_lanes',
      'travelator',
      'skywalk',
      'tank_farm_ii',
    )
  }
  if (tier === 'jumbo') {
    research.push('heavy_pack', 'hydrant_fuel', 'rail_fuel', 'tank_farm_iii', 'bag_bhs', 'egates', 'people_mover')
  }
  const state = emptyPillar()
  state.contractId = tier === 'jumbo' ? 'mega_jumbo' : tier === 'wide' ? 'trunk_wide' : 'apex_local'
  state.tankTier = tier === 'jumbo' ? 3 : tier === 'wide' ? 2 : 1
  state.supply = tier === 'jumbo' ? 'rail' : 'road'
  state.bagSystem = tier === 'jumbo' ? 'bhs' : tier === 'wide' ? 'sorter' : 'carts'
  state.desks = tier === 'jumbo' ? 4 : 2
  state.kiosks = tier === 'small' ? 0 : 4
  state.scannerLanes = tier === 'jumbo' ? 2 : tier === 'wide' ? 2 : 1
  state.eGates = tier === 'jumbo' ? 1 : 0
  if (tier !== 'small') {
    state.fleet = {
      heavy_fuel_truck: 1,
      uld_loader: 1,
      heavy_baggage_tug: tier === 'jumbo' ? 2 : 1,
    }
  }
  if (tier === 'jumbo') {
    state.fleet = {
      ...state.fleet,
      hydrant_dispenser: 1,
      highlift_catering: 1,
      main_deck_loader: 1,
      heavy_tug: 1,
    }
  }
  return {
    field: field({
      size,
      tiles,
      fieldLevel: SIZE_TIERS[tier].fieldLevel,
      research: research as FieldSnapshot['research'],
      standScale,
      standAccess: { '4,2': 'jetway' },
      standPits: tier === 'jumbo' ? { '4,2': true } : {},
      hangarScale,
      legacyFuel: false,
    }),
    state,
  }
}

describe('pillars together', () => {
  it('accepts a small jet on the starter pillar and rejects it climbing early', () => {
    const small = ready('small')
    expect(pillarReport(small.field, small.state, 'b738').ok).toBe(true)
    expect(pillarReport(small.field, small.state, 'b789').ok).toBe(false)
    expect(pillarReport(small.field, small.state, 'a380').ok).toBe(false)
  })

  it('accepts a 787 only when stands, trucks, fuel, bags, and the pier all match', () => {
    const wide = ready('wide')
    const ok = pillarReport(wide.field, wide.state, 'b789')
    expect(ok.hints.map((h) => h.id)).toEqual([])
    expect(ok.ok).toBe(true)
    wide.field.standScale['4,2'] = 'small'
    expect(pillarReport(wide.field, wide.state, 'b77w').hints.some((h) => h.id === 'stand-wide')).toBe(true)
  })

  it('accepts an A380 only on the jumbo pillar, including a live rail chain', () => {
    const jumbo = ready('jumbo')
    const ok = pillarReport(jumbo.field, jumbo.state, 'a380')
    expect(ok.hints.map((h) => h.id)).toEqual([])
    expect(ok.ok).toBe(true)
    jumbo.field.tiles[7][4] = 'grass'
    const broken = pillarReport(jumbo.field, jumbo.state, 'a380')
    expect(broken.ok).toBe(false)
    expect(broken.hints.some((h) => h.id === 'rail-flow')).toBe(true)
    expect(scaleAdvice(jumbo.field, jumbo.state).some((h) => h.id === 'rail-edge' || h.id === 'rail-flow')).toBe(true)
  })

  it('moves passengers faster on a travelator and a people mover', () => {
    expect(walkMinutes(6, 'travelator')).toBeLessThan(walkMinutes(6, 'walk'))
    expect(walkMinutes(6, 'mover')).toBeLessThan(walkMinutes(6, 'travelator'))
    expect(personSpeedMult('travelator')).toBeGreaterThan(1)
    expect(personSpeedMult('mover')).toBeGreaterThan(personSpeedMult('travelator'))
    expect(operatingFleet(ready('small').field, emptyPillar()).fuel_truck).toBeGreaterThan(0)
  })
})

describe('strict ramp dispatch', () => {
  it('will not send a small fuel truck to a widebody', () => {
    const config = defaultConfig({
      strictSizeTiers: true,
      vehicles: { fuel_truck: 2, catering_truck: 1, baggage_tug: 2, pushback_tug: 1, gpu: 1, belt_loader: 1 },
    })
    config.stands = config.stands.map((s) => ({ ...s, hydrant: false }))
    const sim = new LogisticsSim(config)
    sim.startTurnaround('stand-2', 'b789', 40)
    for (let i = 0; i < 30; i++) sim.tick(1)
    const turn = sim.getTurnaround(sim.turnaroundAt('stand-2')!.id)!
    expect(turn.services.fuel).not.toBe('done')
    expect(turn.completedAt).toBeNull()
  })
})
