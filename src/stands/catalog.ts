import type { ResearchId, StandClass } from '../game/types.ts'
import type { FittingHost, FittingId, StandRung, StandSize } from './types.ts'

/**
 * Tunables for the stand card. Totals for the pads the game already sells
 * match STAND_S_COST, STAND_COST, and STAND_OFFERS.
 */
export const STAND_STAMP: Record<StandSize, { cost: number; minFieldLevel: number }> = {
  light: { cost: 2_800, minFieldLevel: 1 },
  narrow: { cost: 4_400, minFieldLevel: 1 },
  heavy: { cost: 9_000, minFieldLevel: 3 },
}

/** Cash to step from the rung below. Rung 0 is the stamp. */
export const RUNG_STEP: Record<StandSize, readonly [number, number, number]> = {
  light: [2_800, 2_000, 3_500],
  narrow: [4_400, 1_800, 4_000],
  heavy: [9_000, 7_000, 12_000],
}

/** Daily bill once the stand is on this rung. */
export const RUNG_UPKEEP: Record<StandSize, readonly [number, number, number]> = {
  light: [20, 35, 55],
  narrow: [30, 40, 70],
  heavy: [60, 90, 160],
}

export const RUNG_LABEL: Record<StandSize, readonly [string, string, string]> = {
  light: ['Grass', 'Low concrete', 'Finished concrete'],
  narrow: ['Asphalt', 'Concrete', 'Reinforced'],
  heavy: ['Hardstand', 'Widebody slab', 'Heavy slab'],
}

export const SIZE_LABEL: Record<StandSize, string> = {
  light: 'Light stand',
  narrow: 'Narrow stand',
  heavy: 'Heavy stand',
}

/** ICAO letter the rung accepts, before the bush and asphalt lists. */
export const RUNG_LETTER: Record<StandSize, readonly ['A' | 'B' | 'C' | 'D' | 'E' | 'F', 'A' | 'B' | 'C' | 'D' | 'E' | 'F', 'A' | 'B' | 'C' | 'D' | 'E' | 'F']> = {
  light: ['A', 'B', 'B'],
  narrow: ['C', 'C', 'C'],
  heavy: ['D', 'E', 'F'],
}

/** Painted box. Light and narrow stay at their top letter. Only heavy grows. */
export function footprintLetter(size: StandSize, rung: StandRung): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
  if (size === 'heavy') return RUNG_LETTER.heavy[rung]
  if (size === 'light') return 'B'
  return 'C'
}

export function rungUpkeep(size: StandSize, rung: StandRung): number {
  return RUNG_UPKEEP[size][rung]
}

export function rungStepCost(size: StandSize, rung: StandRung): number {
  return RUNG_STEP[size][rung]
}

/** Props and the trainer. Citation and the CRJ want pavement. */
export const GRASS_AIRFRAMES = ['bn2', 'dhc6', 'pc12', 'at802'] as const

/** Regional metal that can live on asphalt. A 737 wants concrete. */
export const ASPHALT_AIRFRAMES = ['atr72', 'e175'] as const

export interface FittingDef {
  id: FittingId
  name: string
  hosts: readonly FittingHost[]
  sizes: readonly StandSize[]
  minRung: StandRung
  cost: number
  upkeepPerDay: number
  minFieldLevel: number
  research: ResearchId | null
  /** A tile that must already exist, or a progression id. */
  needs: 'deice' | 'substation' | null
  /** How many copies one host may hold. */
  max: number
}

export const FITTINGS: readonly FittingDef[] = [
  {
    id: 'jet_bridge',
    name: 'Jet bridge',
    hosts: ['stand'],
    sizes: ['light', 'narrow', 'heavy'],
    minRung: 0,
    cost: 5_000,
    upkeepPerDay: 45,
    minFieldLevel: 1,
    research: null,
    needs: null,
    max: 3,
  },
  {
    id: 'gpu_pca',
    name: 'Ground power and cabin air',
    hosts: ['stand'],
    sizes: ['light', 'narrow', 'heavy'],
    minRung: 1,
    cost: 4_500,
    upkeepPerDay: 25,
    minFieldLevel: 1,
    research: null,
    needs: null,
    max: 1,
  },
  {
    id: 'apron_light',
    name: 'Apron light',
    hosts: ['stand'],
    sizes: ['light', 'narrow', 'heavy'],
    minRung: 0,
    cost: 2_200,
    upkeepPerDay: 12,
    minFieldLevel: 2,
    research: null,
    needs: null,
    max: 1,
  },
  {
    id: 'deice_outlet',
    name: 'De-ice outlet',
    hosts: ['stand'],
    sizes: ['narrow', 'heavy'],
    minRung: 1,
    cost: 6_500,
    upkeepPerDay: 20,
    minFieldLevel: 1,
    research: 'deice',
    needs: 'deice',
    max: 1,
  },
  {
    id: 'flag',
    name: 'Flag',
    hosts: ['stand'],
    sizes: ['light', 'narrow', 'heavy'],
    minRung: 0,
    cost: 800,
    upkeepPerDay: 5,
    minFieldLevel: 1,
    research: null,
    needs: null,
    max: 1,
  },
  {
    id: 'alarm_bell',
    name: 'Alarm bell',
    hosts: ['fire'],
    sizes: [],
    minRung: 0,
    cost: 3_500,
    upkeepPerDay: 15,
    minFieldLevel: 2,
    research: null,
    needs: null,
    max: 1,
  },
  {
    id: 'line_office',
    name: 'Line office',
    hosts: ['hangar'],
    sizes: [],
    minRung: 0,
    cost: 4_000,
    upkeepPerDay: 20,
    minFieldLevel: 2,
    research: null,
    needs: null,
    max: 1,
  },
]

export function fittingDef(id: FittingId): FittingDef {
  const row = FITTINGS.find((item) => item.id === id)
  if (!row) throw new Error(`Unknown fitting ${id}`)
  return row
}

/** Jet-bridge price depends on the pad. The catalog row is the narrow default. */
export function jetBridgeCost(size: StandSize): number {
  if (size === 'light') return 4_500
  if (size === 'heavy') return 8_000
  return 5_000
}

export function jetBridgeUpkeep(size: StandSize): number {
  if (size === 'light') return 30
  if (size === 'heavy') return 70
  return 45
}

/** Extra bridge doors after the first. Heavy slab can hold three. */
export function bridgeCap(size: StandSize, rung: StandRung): number {
  if (size === 'heavy' && rung >= 2) return 3
  if (size === 'heavy' && rung >= 1) return 2
  if (size === 'narrow' && rung >= 2) return 2
  return 1
}

export function hostKey(host: FittingHost, c: number, r: number): string {
  return `${host}:${c},${r}`
}

export function parseHostKey(key: string): { host: FittingHost; c: number; r: number } | null {
  const match = /^(stand|fire|hangar|fuel):(\d+),(\d+)$/.exec(key)
  if (!match) return null
  return { host: match[1] as FittingHost, c: Number(match[2]), r: Number(match[3]) }
}

/**
 * Old tool ids still place the pad they place today.
 * A locked jumbo tool places the widebody slab, matching standScaleForTool.
 */
export function aliasSize(
  tool: string,
  jumboUnlocked = false,
): { size: StandSize; rung: StandRung; cls: StandClass } | null {
  if (tool === 'stand_light') return { size: 'light', rung: 0, cls: 'S' }
  if (tool === 'stand_narrow') return { size: 'narrow', rung: 0, cls: 'M' }
  if (tool === 'stand_heavy') return { size: 'heavy', rung: 0, cls: 'L' }
  if (tool === 'stand_s') return { size: 'light', rung: 1, cls: 'S' }
  if (tool === 'stand') return { size: 'narrow', rung: 1, cls: 'M' }
  if (tool === 'stand_w') return { size: 'heavy', rung: 1, cls: 'L' }
  if (tool === 'stand_l') return jumboUnlocked ? { size: 'heavy', rung: 2, cls: 'L' } : { size: 'heavy', rung: 1, cls: 'L' }
  return null
}
