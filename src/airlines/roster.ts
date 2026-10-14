/**
 * The 45-airline roster: the 5 base airlines plus 40 fictional ones.
 * Colours for the 40 come from public/art/refs/airlines/palettes.json (sampled
 * from the Gemini livery refs). Tunable numbers live in rosterConfig.ts; the
 * contract and livery code only read this file.
 */
import palettes from '../../public/art/refs/airlines/palettes.json'
import { DEFAULT_AIRLINES } from './data.ts'
import { TYPE_REQS, TYPE_SATISFACTION, TYPE_UNLOCK_FLIGHTS } from './rosterConfig.ts'
import type { Airline, AirlineRequirements, AirlineTier } from './types.ts'

export type AirlineType = 'budget' | 'flag' | 'regional' | 'cargo' | 'charter' | 'heli'

export const AIRLINE_TYPES: readonly AirlineType[] = ['budget', 'flag', 'regional', 'cargo', 'charter', 'heli']

export type TailMotif =
  | 'bar'
  | 'swoosh'
  | 'chevron'
  | 'star'
  | 'wave'
  | 'circle'
  | 'diamond'
  | 'stripes'
  | 'triangle'
  | 'crescent'

export interface RosterAirline {
  id: string
  name: string
  /** ICAO-style three-letter code, unique across the roster. */
  code: string
  type: AirlineType
  primary: string
  secondary: string
  accent: string
  motif: TailMotif
  /** Model ids from MODEL_SPECS. */
  fleet: string[]
  /** Palette ref image, when the airline has one. */
  ref?: string
}

interface Seed {
  id: string
  code: string
  type: AirlineType
  motif: TailMotif
}

/** Fleets by airline type. Each airline of a type takes the next entry. */
export const FLEET_POOLS: Record<AirlineType, string[][]> = {
  budget: [
    ['a320neo', 'a321'],
    ['b738', 'b38m'],
    ['a320neo', 'b738', 'a21xlr'],
  ],
  flag: [
    ['b789', 'a359', 'b77w'],
    ['a359', 'b77w', 'a380'],
    ['b789', 'b77w', 'a321'],
  ],
  regional: [
    ['atr72', 'dhc6'],
    ['crj700', 'e175'],
    ['at802', 'e175', 'a223'],
    ['bn2', 'dhc6', 'pc12'],
  ],
  cargo: [
    ['b752f', 'b763f'],
    ['b763f', 'b748f'],
    ['b748f', 'an124'],
  ],
  charter: [
    ['b738', 'a321'],
    ['b38m', 'a21xlr', 'e195e2'],
    ['a320neo', 'b789'],
  ],
  heli: [['aw139'], ['s76'], ['aw139', 's76']],
}

const SEEDS: Seed[] = [
  { id: 'brisa', code: 'BRS', type: 'budget', motif: 'swoosh' },
  { id: 'zephyr_go', code: 'ZPG', type: 'budget', motif: 'chevron' },
  { id: 'tango_air', code: 'TNG', type: 'budget', motif: 'bar' },
  { id: 'rio_sol', code: 'RSL', type: 'budget', motif: 'circle' },
  { id: 'andaman_hop', code: 'AND', type: 'budget', motif: 'wave' },
  { id: 'mekong_express', code: 'MKX', type: 'budget', motif: 'stripes' },
  { id: 'pampas_air', code: 'PMP', type: 'budget', motif: 'triangle' },
  { id: 'kiwi_wings', code: 'KWI', type: 'budget', motif: 'swoosh' },
  { id: 'aurora_nordic', code: 'AUN', type: 'flag', motif: 'star' },
  { id: 'baltic_breeze', code: 'BLB', type: 'flag', motif: 'wave' },
  { id: 'fjord_atlantic', code: 'FJA', type: 'flag', motif: 'chevron' },
  { id: 'gulf_pearl', code: 'GPL', type: 'flag', motif: 'circle' },
  { id: 'himalaya_air', code: 'HMA', type: 'flag', motif: 'triangle' },
  { id: 'indus_airways', code: 'IND', type: 'flag', motif: 'crescent' },
  { id: 'royal_sakura', code: 'RSK', type: 'flag', motif: 'diamond' },
  { id: 'seoul_star', code: 'SLS', type: 'flag', motif: 'star' },
  { id: 'celtic_isle', code: 'CTI', type: 'flag', motif: 'diamond' },
  { id: 'lotus_air', code: 'LTS', type: 'flag', motif: 'circle' },
  { id: 'alpine_swift', code: 'ALS', type: 'regional', motif: 'chevron' },
  { id: 'cityhopper', code: 'CHP', type: 'regional', motif: 'bar' },
  { id: 'maple_coastal', code: 'MPC', type: 'regional', motif: 'diamond' },
  { id: 'outback_link', code: 'OBL', type: 'regional', motif: 'triangle' },
  { id: 'savanna_air', code: 'SVA', type: 'regional', motif: 'stripes' },
  { id: 'kauri_air', code: 'KAU', type: 'regional', motif: 'swoosh' },
  { id: 'borneo_wings', code: 'BNW', type: 'regional', motif: 'wave' },
  { id: 'dune_jet', code: 'DNJ', type: 'regional', motif: 'crescent' },
  { id: 'atlas_cargo', code: 'ATC', type: 'cargo', motif: 'bar' },
  { id: 'ironclad_cargo', code: 'ICC', type: 'cargo', motif: 'chevron' },
  { id: 'polar_freight', code: 'PLF', type: 'cargo', motif: 'triangle' },
  { id: 'saharan_freight', code: 'SHF', type: 'cargo', motif: 'crescent' },
  { id: 'volga_cargo', code: 'VGC', type: 'cargo', motif: 'stripes' },
  { id: 'suncharter', code: 'SNC', type: 'charter', motif: 'circle' },
  { id: 'monarch_holidays', code: 'MNH', type: 'charter', motif: 'star' },
  { id: 'pacific_isles', code: 'PCI', type: 'charter', motif: 'wave' },
  { id: 'coral_coast', code: 'CRC', type: 'charter', motif: 'swoosh' },
  { id: 'harbor_heli', code: 'HBH', type: 'heli', motif: 'bar' },
  { id: 'island_heli', code: 'ISH', type: 'heli', motif: 'circle' },
  { id: 'medevac_one', code: 'MDV', type: 'heli', motif: 'diamond' },
  { id: 'rotorlink', code: 'RTL', type: 'heli', motif: 'chevron' },
  { id: 'skyline_rescue', code: 'SKR', type: 'heli', motif: 'star' },
]

interface BasePaint {
  code: string
  type: AirlineType
  motif: TailMotif
  primary: string
  secondary: string
  accent: string
}

/** The 5 base airlines have no ref art; their paint is set here. */
const BASE: Record<string, BasePaint> = {
  air_regional_1: { code: 'PDJ', type: 'regional', motif: 'bar', primary: '#2f7d4f', secondary: '#f0f0f0', accent: '#282830' },
  air_lowcost_1: { code: 'SKC', type: 'budget', motif: 'swoosh', primary: '#f2c200', secondary: '#f0f0f0', accent: '#282830' },
  air_fullservice_1: { code: 'PRS', type: 'flag', motif: 'diamond', primary: '#5b2a86', secondary: '#d9b45b', accent: '#282830' },
  air_flag_1: { code: 'NAW', type: 'flag', motif: 'star', primary: '#143c7a', secondary: '#f0f0f0', accent: '#c8102e' },
  air_cargo_1: { code: 'HLC', type: 'cargo', motif: 'chevron', primary: '#e8590c', secondary: '#f0f0f0', accent: '#282830' },
}

interface PaletteFile {
  airlines: Record<string, { name: string; ref: string; primary: string; secondary: string; accent: string }>
}
const PALETTES = (palettes as PaletteFile).airlines

function build(): RosterAirline[] {
  const out: RosterAirline[] = []
  const used: Record<AirlineType, number> = { budget: 0, flag: 0, regional: 0, cargo: 0, charter: 0, heli: 0 }
  for (const base of DEFAULT_AIRLINES) {
    const paint = BASE[base.id]
    if (!paint) throw new Error(`no paint for base airline ${base.id}`)
    out.push({
      id: base.id,
      name: base.name,
      code: paint.code,
      type: paint.type,
      primary: paint.primary,
      secondary: paint.secondary,
      accent: paint.accent,
      motif: paint.motif,
      fleet: [...base.fleet],
    })
  }
  for (const seed of SEEDS) {
    const pal = PALETTES[seed.id]
    if (!pal) throw new Error(`no palette for ${seed.id}`)
    const pool = FLEET_POOLS[seed.type]
    out.push({
      id: seed.id,
      name: pal.name,
      code: seed.code,
      type: seed.type,
      primary: pal.primary,
      secondary: pal.secondary,
      accent: pal.accent,
      motif: seed.motif,
      fleet: [...pool[used[seed.type]++ % pool.length]],
      ref: pal.ref,
    })
  }
  return out
}

export const ROSTER: readonly RosterAirline[] = build()

const BY_ID = new Map(ROSTER.map((a) => [a.id, a]))

export function rosterAirline(id: string): RosterAirline | undefined {
  return BY_ID.get(id)
}

export function rosterByType(type: AirlineType): RosterAirline[] {
  return ROSTER.filter((a) => a.type === type)
}

/** Legacy tier the existing offer logic understands. */
export const TYPE_TO_TIER: Record<AirlineType, AirlineTier> = {
  budget: 'low-cost',
  flag: 'flag-carrier',
  regional: 'regional',
  cargo: 'cargo',
  charter: 'full-service',
  heli: 'regional',
}

const NO_REQS: AirlineRequirements = {
  minRunwayLengthMeters: 0,
  requiresSmallStands: false,
  requiresMediumStands: false,
  requiresHeavyStands: false,
  minTerminalRating: 1,
  requiresFuel: false,
  requiresCatering: false,
  requiresMaintenance: false,
  requiresHeavyVehicles: false,
  minOnTimePercentage: 0,
  minTotalFlightsHandled: 0,
}

/**
 * The roster as `Airline` rows for the existing offer engine (AirlineState).
 * Base airlines keep their hand-tuned requirements.
 */
export function rosterAsAirlines(): Airline[] {
  return ROSTER.map((r) => {
    const base = DEFAULT_AIRLINES.find((b) => b.id === r.id)
    if (base) return base
    return {
      id: r.id,
      name: r.name,
      tier: TYPE_TO_TIER[r.type],
      fleet: r.fleet,
      baseSatisfaction: TYPE_SATISFACTION[r.type],
      requirements: { ...NO_REQS, ...TYPE_REQS[r.type], minTotalFlightsHandled: TYPE_UNLOCK_FLIGHTS[r.type] },
    }
  })
}
