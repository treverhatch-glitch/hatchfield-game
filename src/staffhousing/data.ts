import type { HousingTierId } from './types.ts'

/** One-way city commute before anyone lives on the field. */
export const COMMUTE_LINK = {
  none: { minutes: 95, reliability: 0.42, label: 'No link' },
  road: { minutes: 52, reliability: 0.68, label: 'Local road' },
  roadEdge: { minutes: 38, reliability: 0.78, label: 'Access road' },
  bus: { minutes: 26, reliability: 0.88, label: 'City bus' },
  rail: { minutes: 16, reliability: 0.94, label: 'City rail' },
  tier3: { minutes: 11, reliability: 0.97, label: 'Rail station' },
} as const

export const COMMUTE = {
  /** Extra stops shave a little time and add a little reliability, then stop. */
  busMinutesPerStop: 1.5,
  busReliabilityPerStop: 0.015,
  busExtraCap: 3,
  /** Headway minutes become door-to-door: headway * scale + bias, clamped. */
  tier3HeadwayScale: 0.35,
  tier3HeadwayBias: 6,
  tier3MinMinutes: 8,
  /** On-site walk from a bed to the hall. */
  onSiteMinutes: 5,
  onSiteReliability: 0.985,
  /** Past this, the extra minutes count as lateness. */
  comfortMinutes: 20,
  moraleBase: 0.78,
  moraleDragCap: 0.28,
  /** Late minutes that exhaust the full morale drag. */
  moraleMinutes: 80,
  moraleMin: 0.4,
  moraleLerp: 0.45,
  retentionBase: 0.74,
  retentionDrag: 0.45,
  hireFloor: 0.68,
  /** Share of (1 - retention) * commuters that can quit on one day close. */
  dailyQuit: 0.22,
  /** A tolerable road does not shed staff. Worse links can. */
  quitFailureFloor: 0.3,
  lateReputation: 2,
  /** Output pace stays 1 at this morale and moves after the first day close. */
  moraleStart: 0.78,
  outputPerMorale: 0.2,
  outputMin: 0.82,
  outputMax: 1.12,
} as const

export interface HousingTierDef {
  id: HousingTierId
  name: string
  blurb: string
  fieldLevel: number
  /** Previous tier that must already stand. */
  requires: HousingTierId | null
  cost: number
  upkeepPerDay: number
  beds: number
  plots: number
  /** Added to base morale. The best built tier wins; beds still stack. */
  moraleBonus: number
  retentionBonus: number
  /** Subtracted from 1. The best built tier wins. */
  hireDiscount: number
  /** Cuts the remaining no-show chance after housed staff are taken off the road. */
  failureCut: number
  economyTier: 1 | 2 | 3
}

export const HOUSING_TIERS: readonly HousingTierDef[] = [
  {
    id: 'dorm',
    name: 'Staff dorm',
    blurb: 'Bunks on a spare parcel. The night shift stops driving in from town.',
    fieldLevel: 2,
    requires: null,
    cost: 28_000,
    upkeepPerDay: 420,
    beds: 18,
    plots: 1,
    moraleBonus: 0.08,
    retentionBonus: 0.05,
    hireDiscount: 0.1,
    failureCut: 0.12,
    economyTier: 1,
  },
  {
    id: 'apartments',
    name: 'Staff apartments',
    blurb: 'Flats for crews who stay. Hiring gets cheaper once people can live here.',
    fieldLevel: 4,
    requires: 'dorm',
    cost: 86_000,
    upkeepPerDay: 1_150,
    beds: 56,
    plots: 1,
    moraleBonus: 0.14,
    retentionBonus: 0.1,
    hireDiscount: 0.18,
    failureCut: 0.22,
    economyTier: 2,
  },
  {
    id: 'village',
    name: 'Staff village',
    blurb: 'A small neighbourhood on the fringe. Most of the roster walks to work.',
    fieldLevel: 5,
    requires: 'apartments',
    cost: 210_000,
    upkeepPerDay: 2_800,
    beds: 140,
    plots: 2,
    moraleBonus: 0.22,
    retentionBonus: 0.18,
    hireDiscount: 0.3,
    failureCut: 0.4,
    economyTier: 3,
  },
]

export const HOUSING_TIER_IDS: readonly HousingTierId[] = HOUSING_TIERS.map((tier) => tier.id)

export function housingTier(id: HousingTierId): HousingTierDef {
  const found = HOUSING_TIERS.find((tier) => tier.id === id)
  if (!found) throw new Error(`Unknown housing tier ${id}`)
  return found
}

/** How many walkers leave the houses, and how long a one-way stroll takes. */
export const WALKERS = {
  sample: 4,
  tripSec: 42,
} as const

export const MAP_SIZE = 32
