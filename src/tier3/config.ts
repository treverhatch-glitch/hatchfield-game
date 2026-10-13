/**
 * Tunables for the two Tier III buildings. Logic reads these; it does not
 * hard-code fees, bay times, or staff counts.
 *
 * Sized for a mid/late fleet (widebody and jumbo on the field, not the
 * starter regional pair). A Tier I power plant is 250, so one of each
 * building fits and a second hub trips a brown-out.
 */

export const TIER3_MIN_FIELD_LEVEL = 4

/** Economy tech ids. Tier III is the third node (field level 5 on that tree). */
export const MRO_TECH_IDS = ['maintenance.t3', 'maintenance.t4'] as const
export const NIGHT_HUB_TECH_IDS = ['cargo.t3', 'cargo.t4'] as const

/** Live research desk ids. Both sit behind Heavy metal pack. */
export const MRO_RESEARCH_ID = 'mro_hangar'
export const NIGHT_HUB_RESEARCH_ID = 'cargo_night_hub'

export const MRO_COST = 92_000
export const MRO_UPKEEP_PER_DAY = 9_200
export const MRO_POWER_DEMAND = 80
export const MRO_TECHS_REQUIRED = 8
/** Game minutes between inductions, so the hangar cannot swallow the ramp. */
export const MRO_INDUCTION_GAP = 180
export const MRO_TAXI_MINUTES = 24
/**
 * Hangar MRO on the tech tree is a flag (1), not a rate. When that node is
 * owned the check pays this much more.
 */
export const MRO_TECH_BONUS = 1.15

export type BaySize = 'narrow' | 'wide' | 'jumbo'

export interface MroBayDef {
  id: string
  size: BaySize
  /** Game minutes in the bay once the aircraft has taxied in. */
  checkMinutes: number
  /** Airline payment for a fully staffed, fully powered check. */
  fee: number
}

export const MRO_BAYS: readonly MroBayDef[] = [
  { id: 'narrow-a', size: 'narrow', checkMinutes: 240, fee: 6_400 },
  { id: 'narrow-b', size: 'narrow', checkMinutes: 240, fee: 6_400 },
  { id: 'wide', size: 'wide', checkMinutes: 480, fee: 12_800 },
  { id: 'jumbo', size: 'jumbo', checkMinutes: 720, fee: 24_000 },
]

/** Known late-game frames. Anything else uses a narrow bay. */
export const JUMBO_AIRFRAMES: readonly string[] = ['a380', 'an124', 'c5', 'b748f']
export const WIDE_AIRFRAMES: readonly string[] = ['b789', 'a359', 'b763f', 'b788', 'b78x', 'a333', 'b772', 'b77w', 'b744']

export const NIGHT_HUB_COST = 78_000
export const NIGHT_HUB_UPKEEP_PER_DAY = 6_400
export const NIGHT_HUB_POWER_DEMAND = 90
export const NIGHT_HUB_GROUND_CREW = 12
/** One vehicle depot contributes this many ground crew to the existing pool. */
export const GROUND_CREW_PER_DEPOT = 6
/** Warehouse tonnes vs the starter cargo terminal. */
export const NIGHT_HUB_STORAGE_SCALE = 1.8
/** Tonnes the wave can push in one night at full ground crew and full power. */
export const NIGHT_HANDLING_TONNES = 200
/** On top of the cargo slice's express tariff. */
export const NIGHT_PREMIUM = 1.35

export interface NightSlotDef {
  id: string
  airframeId: string
  tonnes: number
}

/** One wave: two 767F, a 757F, and a jumbo slot if storage and handling allow. */
export const NIGHT_BANK_SLOTS: readonly NightSlotDef[] = [
  { id: 'bank-1', airframeId: 'b763f', tonnes: 40 },
  { id: 'bank-2', airframeId: 'b763f', tonnes: 40 },
  { id: 'bank-3', airframeId: 'b752f', tonnes: 28 },
  { id: 'bank-4', airframeId: 'an124', tonnes: 80 },
]

export const NOISE_PER_TONNE = 1
/** City fine per noise point when Night bank research has opened the curfew. */
export const CURFEW_FINE_RELAXED = 70
/** City fine per noise point while the soft curfew is still in force. */
export const CURFEW_FINE_TIGHT = 180
export const CURFEW_HEAT_RELAXED = -0.2
export const CURFEW_HEAT_TIGHT = -0.6

/** Box meshes for both buildings stay under this. FPS is already tight. */
export const MESH_TRIANGLE_BUDGET = 180
