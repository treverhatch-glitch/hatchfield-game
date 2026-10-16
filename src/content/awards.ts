export type AwardCriterionKind =
  | 'passengers'
  | 'satisfaction'
  | 'cleanliness'
  | 'net'
  | 'on_time_pct'
  | 'transfer_pct'
  | 'leased_units'
  | 'avg_quality'
  | 'green_share'
  | 'cargo_tonnes'

export interface AwardCriterion {
  kind: AwardCriterionKind
  /** Minimum value that must be met (inclusive). */
  min: number
}

export interface AwardDef {
  id: string
  name: string
  blurb: string
  prestige: number
  reputation: number
  /** All criteria must pass (AND). */
  criteria: AwardCriterion[]
}

export const RESERVED_AWARD_IDS = [
  'best_regional',
  'cleanest_terminal',
  'leased_concourse',
]

export const AWARDS: readonly AwardDef[] = [
  {
    id: 'punctual_hub',
    name: 'Punctual Hub',
    blurb: 'Recognized for outstanding on-time performance across all flights.',
    prestige: 8,
    reputation: 4,
    criteria: [
      { kind: 'on_time_pct', min: 95 },
      { kind: 'passengers', min: 1000 },
    ],
  },
  {
    id: 'transfer_champion',
    name: 'Transfer Champion',
    blurb: 'A premier destination for connecting flights and seamless transfers.',
    prestige: 6,
    reputation: 3,
    criteria: [
      { kind: 'transfer_pct', min: 50 },
      { kind: 'passengers', min: 2000 },
    ],
  },
  {
    id: 'cargo_night_owl',
    name: 'Cargo Night Owl',
    blurb: 'Exceptional cargo handling capabilities around the clock.',
    prestige: 5,
    reputation: 2,
    criteria: [
      { kind: 'cargo_tonnes', min: 500 },
    ],
  },
  {
    id: 'green_pioneer',
    name: 'Green Pioneer',
    blurb: 'Leading the way in sustainable aviation and eco-friendly operations.',
    prestige: 10,
    reputation: 5,
    criteria: [
      { kind: 'green_share', min: 40 },
      { kind: 'satisfaction', min: 80 },
    ],
  },
  {
    id: 'luxury_lounge',
    name: 'Luxury Lounge',
    blurb: 'Providing top-tier amenities and exceptional quality for discerning travelers.',
    prestige: 7,
    reputation: 4,
    criteria: [
      { kind: 'avg_quality', min: 9 },
      { kind: 'satisfaction', min: 90 },
    ],
  },
  {
    id: 'skytrax_like_five_star',
    name: 'Five-Star Airport',
    blurb: 'Awarded the highest honors for overall passenger experience and facility cleanliness.',
    prestige: 12,
    reputation: 6,
    criteria: [
      { kind: 'cleanliness', min: 95 },
      { kind: 'satisfaction', min: 95 },
      { kind: 'avg_quality', min: 8 },
    ],
  },
  {
    id: 'zero_mishandles_week',
    name: 'Zero Mishandles Week',
    blurb: 'A flawless week of operations with excellent service and efficiency.',
    prestige: 4,
    reputation: 2,
    criteria: [
      { kind: 'satisfaction', min: 85 },
      { kind: 'on_time_pct', min: 99 },
    ],
  },
  {
    id: 'festival_host',
    name: 'Festival Host',
    blurb: 'Successfully managing massive passenger surges during major events.',
    prestige: 5,
    reputation: 3,
    criteria: [
      { kind: 'passengers', min: 5000 },
      { kind: 'net', min: 100000 },
    ],
  },
  {
    id: 'military_host',
    name: 'Military Host',
    blurb: 'Accommodating specialized flights and providing excellent service to military personnel.',
    prestige: 3,
    reputation: 2,
    criteria: [
      { kind: 'leased_units', min: 5 },
      { kind: 'net', min: 50000 },
    ],
  },
  {
    id: 'rail_gateway',
    name: 'Rail Gateway',
    blurb: 'An exemplary integration of air and rail travel networks.',
    prestige: 6,
    reputation: 3,
    criteria: [
      { kind: 'transfer_pct', min: 30 },
      { kind: 'green_share', min: 20 },
    ],
  },
  {
    id: 'world_airport_awards_nominee',
    name: 'World Airport Awards Nominee',
    blurb: 'Nominated for the prestigious global award for outstanding operations.',
    prestige: 9,
    reputation: 5,
    criteria: [
      { kind: 'passengers', min: 10000 },
      { kind: 'satisfaction', min: 88 },
      { kind: 'cleanliness', min: 85 },
    ],
  },
  {
    id: 'regional_champion_plus',
    name: 'Regional Champion Plus',
    blurb: 'Going above and beyond standard regional airport expectations.',
    prestige: 11,
    reputation: 4,
    criteria: [
      { kind: 'passengers', min: 2500 },
      { kind: 'satisfaction', min: 75 },
      { kind: 'leased_units', min: 10 },
    ],
  },
]

export function validateAwards(awards: readonly AwardDef[], reserved: string[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const names = new Set<string>()

  for (const award of awards) {
    if (ids.has(award.id)) {
      errors.push(`Duplicate award ID: ${award.id}`)
    }
    ids.add(award.id)

    if (names.has(award.name)) {
      errors.push(`Duplicate award name: ${award.name}`)
    }
    names.add(award.name)

    if (reserved.includes(award.id)) {
      errors.push(`Award ID conflicts with reserved ID: ${award.id}`)
    }

    if (award.prestige < 2 || award.prestige > 12) {
      errors.push(`Award ${award.id} prestige out of range (2-12): ${award.prestige}`)
    }

    if (award.reputation < 1 || award.reputation > 6) {
      errors.push(`Award ${award.id} reputation out of range (1-6): ${award.reputation}`)
    }

    if (!award.criteria || award.criteria.length === 0) {
      errors.push(`Award ${award.id} must have at least one criterion`)
    } else {
      for (const c of award.criteria) {
        if (!Number.isFinite(c.min) || c.min < 0) {
          errors.push(`Award ${award.id} criterion ${c.kind} min is invalid: ${c.min}`)
        }
      }
    }
  }

  return errors
}

export function awardMatches(def: AwardDef, snapshot: Record<AwardCriterionKind, number>): boolean {
  if (!def.criteria || def.criteria.length === 0) {
    return false
  }
  for (const c of def.criteria) {
    const val = snapshot[c.kind]
    if (val === undefined || val < c.min) {
      return false
    }
  }
  return true
}
