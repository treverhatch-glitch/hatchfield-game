/**
 * The 46-airline roster: the 5 base airlines, 40 fictional ones, and Siam Breeze.
 * Colours for the 40 come from public/art/refs/airlines/palettes.json (sampled
 * from the Gemini livery refs). Siam Breeze wears the teal/gold plate already
 * on disk. Tunable numbers live in rosterConfig.ts; the contract and livery
 * code only read this file.
 */
import palettes from '../../public/art/refs/airlines/palettes.json'
import { DEFAULT_AIRLINES } from './data.ts'
import { TYPE_REQS, TYPE_SATISFACTION, TYPE_TO_LADDER_TIER, TYPE_UNLOCK_FLIGHTS, type LadderTier } from './rosterConfig.ts'
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
  /** No drawn motif. A photographed emblem sits on the fin instead. */
  | 'none'

export interface RosterAirline {
  id: string
  name: string
  /** ICAO-style three-letter code, unique across the roster. */
  code: string
  type: AirlineType
  /** Passenger ladder tier 0-5. Null for cargo, which has its own ladder. */
  ladderTier: LadderTier | null
  primary: string
  secondary: string
  accent: string
  motif: TailMotif
  /** Model ids from MODEL_SPECS and AIRFRAMES. A roster carrier only flies these. */
  fleet: string[]
  /** Palette ref image, when the airline has one. */
  ref?: string
  /** Side colour when it is not the default white crown or the solid primary. */
  fuselage?: string
  belly?: string
  cheatline?: string
  /** Fin colour when it is not the primary. */
  tail?: string
  /** Roof colour. The isometric camera sees this on the crown. */
  crown?: string
  /** Wing colour. The isometric camera sees this from above. */
  wing?: string
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
  fuselage?: string
  belly?: string
  cheatline?: string
  tail?: string
  crown?: string
  wing?: string
}

/**
 * The 5 base airlines. Colours are sampled from docs/art/livery-concepts
 * (side views for the palette, top views for crown and wing). The fin mark
 * is the tail decal in public/assets/airline-logos, not a photographed plate.
 * National Airways and HeavyLift have no top view, so National keeps the
 * default grey wing and HeavyLift's wing matches its grey fuselage.
 */
const BASE: Record<string, BasePaint> = {
  air_regional_1: {
    code: 'PDJ',
    type: 'regional',
    motif: 'none',
    primary: '#149e96',
    secondary: '#f0c030',
    accent: '#f0c030',
    fuselage: '#f4f7f6',
    belly: '#e7eeec',
    cheatline: '#149e96',
    tail: '#0f8f88',
    crown: '#f7faf8',
    wing: '#2eb4b0',
  },
  air_lowcost_1: {
    code: 'SKC',
    type: 'budget',
    motif: 'none',
    primary: '#f25c00',
    secondary: '#fff7f2',
    accent: '#1a1a1a',
    fuselage: '#f7f6f4',
    belly: '#f3f0ec',
    cheatline: '#f25c00',
    tail: '#f25c00',
    crown: '#f7f6f4',
    wing: '#a3a7ae',
  },
  air_fullservice_1: {
    code: 'PRS',
    type: 'flag',
    motif: 'none',
    primary: '#192749',
    secondary: '#c6a35a',
    accent: '#c6a35a',
    fuselage: '#192749',
    belly: '#f2f4f6',
    cheatline: '#c6a35a',
    tail: '#192749',
    crown: '#192749',
    wing: '#a0a4aa',
  },
  air_flag_1: {
    code: 'NAW',
    type: 'flag',
    motif: 'none',
    primary: '#003060',
    secondary: '#f4f7fb',
    accent: '#c41230',
    fuselage: '#f7f8fa',
    belly: '#e8eef4',
    cheatline: '#c41230',
    tail: '#003060',
    crown: '#f7f8fa',
  },
  air_cargo_1: {
    code: 'HLC',
    type: 'cargo',
    motif: 'none',
    primary: '#5e686e',
    secondary: '#e6c800',
    accent: '#1c1c1c',
    fuselage: '#5e686e',
    belly: '#4a5258',
    cheatline: '#e6c800',
    tail: '#e6c800',
    crown: '#5e686e',
    wing: '#5e686e',
  },
}

interface PaletteFile {
  airlines: Record<string, { name: string; ref: string; primary: string; secondary: string; accent: string }>
}
const PALETTES = (palettes as PaletteFile).airlines

/** Default passenger ladder tier for a type; cargo is off this ladder. */
export function defaultLadderTier(type: AirlineType): LadderTier | null {
  return type === 'cargo' ? null : TYPE_TO_LADDER_TIER[type]
}

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
      ladderTier: defaultLadderTier(paint.type),
      primary: paint.primary,
      secondary: paint.secondary,
      accent: paint.accent,
      motif: paint.motif,
      fleet: [...base.fleet],
      fuselage: paint.fuselage,
      belly: paint.belly,
      cheatline: paint.cheatline,
      tail: paint.tail,
      crown: paint.crown,
      wing: paint.wing,
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
      ladderTier: defaultLadderTier(seed.type),
      primary: pal.primary,
      secondary: pal.secondary,
      accent: pal.accent,
      motif: seed.motif,
      fleet: [...pool[used[seed.type]++ % pool.length]],
      ref: pal.ref,
    })
  }
  // Photographed plate already on disk. Not a palette-file carrier.
  out.push({
    id: 'siam_breeze',
    name: 'Siam Breeze',
    code: 'SMB',
    type: 'budget',
    ladderTier: defaultLadderTier('budget'),
    primary: '#1b8480',
    secondary: '#c6a35a',
    accent: '#f7fbfa',
    motif: 'none',
    fleet: ['a320neo'],
  })
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
