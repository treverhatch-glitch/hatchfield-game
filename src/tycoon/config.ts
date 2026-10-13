/**
 * Tunable tycoon numbers. Logic reads these; it does not hard-code prices.
 * A game day is the shared 180-second cycle. A year is twelve of those days.
 */

export const DAYS_PER_YEAR = 12
/** Lease length in completed game days. */
export const LEASE_DAYS = 4
/** How far a re-roll may move rent and share, as a fraction of the brand card. */
export const BID_JITTER = 0.08
/** Rent multiplier when a tenant renews. */
export const RENEW_RENT_BUMP = 1.05
export const MAX_DAILY_RENT = 2_000
/** Skip a corrupted clock instead of replaying a huge backlog. */
export const MAX_CATCHUP_DAYS = 48
export const PRESTIGE_CAP = 100

/** Airport share of counter sales is this fraction (0.14 = 14%). */
export const SPEND_PER_PAX = { food: 4.5, retail: 3.2 } as const
export const QUALITY_SPEND = { 1: 0.8, 2: 1, 3: 1.3 } as const

/** Satisfaction is the main stay signal. Empty halls nudge it down a little. */
export const RENEW_AT = 64
export const LEAVE_BELOW = 42
export const QUIET_PENALTY = 6
export const QUALITY_STAY = 6
export const MID_RENEW_CHANCE = 0.55

/** Scores for the year card. Best and worst are picked from these scales. */
export const YEAR_REVENUE_GOOD = 40_000
export const YEAR_COST_HEAVY = 80_000
export const YEAR_PAX_GOOD = 500

/**
 * Financing is not operating revenue. Same set the daily payroll close ignores.
 */
export const YEAR_EXCLUDED_CATEGORIES = [
  'loan_proceeds',
  'ipo_proceeds',
  'share_sales',
  'share_purchases',
  'refunds',
] as const

export const AWARD_BEST_REGIONAL = {
  id: 'best_regional',
  name: 'Best Regional Airport',
  passengers: 400,
  satisfaction: 68,
  prestige: 8,
  reputation: 4,
} as const

export const AWARD_CLEANEST = {
  id: 'cleanest_terminal',
  name: 'Cleanest Terminal',
  cleanliness: 80,
  satisfaction: 72,
  prestige: 6,
  reputation: 3,
} as const

export const AWARD_LEASED = {
  id: 'leased_concourse',
  name: 'Leased Concourse',
  minQuality: 2,
  prestige: 3,
  reputation: 1,
} as const

export type QualityTier = 1 | 2 | 3
export type UnitKind = 'retail' | 'food'
export type CampaignKind = 'local' | 'regional' | 'airline'

export interface BrandCard {
  name: string
  quality: QualityTier
  dailyRent: number
  /** Airport cut of sales, 0–1. */
  revenueShare: number
}

export const FOOD_BRANDS: readonly BrandCard[] = [
  { name: 'Grab & Go', quality: 1, dailyRent: 920, revenueShare: 0.08 },
  { name: 'Tray Line', quality: 1, dailyRent: 860, revenueShare: 0.07 },
  { name: 'Gatehouse Grill', quality: 2, dailyRent: 540, revenueShare: 0.14 },
  { name: 'Counter Three', quality: 2, dailyRent: 500, revenueShare: 0.15 },
  { name: 'Linen & Rye', quality: 3, dailyRent: 260, revenueShare: 0.22 },
  { name: 'Northfork', quality: 3, dailyRent: 240, revenueShare: 0.24 },
]

export const RETAIL_BRANDS: readonly BrandCard[] = [
  { name: 'Newsstand Co', quality: 1, dailyRent: 740, revenueShare: 0.07 },
  { name: 'Quick Read', quality: 1, dailyRent: 700, revenueShare: 0.06 },
  { name: 'Pier Gifts', quality: 2, dailyRent: 430, revenueShare: 0.13 },
  { name: 'Concourse Goods', quality: 2, dailyRent: 400, revenueShare: 0.14 },
  { name: 'Atelier Duty', quality: 3, dailyRent: 210, revenueShare: 0.21 },
  { name: 'Glasshouse', quality: 3, dailyRent: 190, revenueShare: 0.23 },
]

export interface CampaignCard {
  kind: CampaignKind
  label: string
  cost: number
  days: number
  /** Added to the passenger load factor (1.08 = +8%). */
  demandBoost: number
  /** Added to the airline-letter keep chance, and to how fast the letter clock runs. */
  airlineInterest: number
  blurb: string
}

export const CAMPAIGNS: readonly CampaignCard[] = [
  {
    kind: 'local',
    label: 'Local',
    cost: 8_000,
    days: 3,
    demandBoost: 0.08,
    airlineInterest: 0,
    blurb: 'City ads. A small lift in passenger demand.',
  },
  {
    kind: 'regional',
    label: 'Regional',
    cost: 18_000,
    days: 4,
    demandBoost: 0.14,
    airlineInterest: 0.06,
    blurb: 'Regional press. Stronger demand, and airlines notice.',
  },
  {
    kind: 'airline',
    label: 'Airline',
    cost: 14_000,
    days: 3,
    demandBoost: 0.04,
    airlineInterest: 0.22,
    blurb: 'Trade pitches. Airlines write sooner.',
  },
]

export function qualityLabel(quality: QualityTier): string {
  if (quality === 1) return 'Economy'
  if (quality === 2) return 'Standard'
  return 'Premium'
}

export function brandsFor(kind: UnitKind): readonly BrandCard[] {
  return kind === 'food' ? FOOD_BRANDS : RETAIL_BRANDS
}
