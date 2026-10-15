/**
 * Hub-tier tunables. The ladder sits on the wave 3 score and the diplomacy
 * bands. It does not replace either, and it does not add a landing-fee multiplier.
 * See docs/design/HUB_PROGRESSION.md.
 */
export const HUB_TIERS = ['station', 'focus', 'base', 'hub', 'primary'] as const

export type HubTier = (typeof HUB_TIERS)[number]

export type HubOfferTier = Exclude<HubTier, 'station'>

export const HUB_ARCHETYPES = ['budget', 'flag', 'regional', 'cargo', 'charter', 'heli'] as const

export type HubArchetype = (typeof HUB_ARCHETYPES)[number]

export const HUB_TIER_LABEL: Record<HubTier, string> = {
  station: 'Station',
  focus: 'Focus city',
  base: 'Base',
  hub: 'Hub',
  primary: 'Primary hub',
}

export const HUB_TIER_GATE = {
  focus: { minTier: 2, minBand: 'neutral', onTime: 0.8, days: 14 },
  base: { minTier: 3, minBand: 'warm', onTime: 0.85, days: 14 },
  hub: { minTier: 4, minBand: 'partner', onTime: 0.88, days: 30 },
  primary: { minTier: 5, minBand: 'partner', onTime: 0.9, days: 30 },
} as const

export type HubBand = (typeof HUB_TIER_GATE)[HubOfferTier]['minBand'] | 'hostile' | 'cold'

export const BAND_RANK: Record<HubBand, number> = {
  hostile: 0,
  cold: 1,
  neutral: 2,
  warm: 3,
  partner: 4,
}

/**
 * Cargo may enter Hub at Warm. The published gate stays Partner for everyone else.
 */
export const CARGO_HUB_BAND = 'warm' as const satisfies HubBand

/** Daily relationship credit per live lease. Same review as lounges and gates. */
export const SCORE_PER_LEASE = { preferred: 0.04, dedicated: 0.08 } as const
export const LEASE_SCORE_CAP = 1.6

const LEASE_KEYS = ['desk', 'lane', 'overnight', 'lounge', 'stand', 'pier', 'fuel', 'hangar', 'ramp', 'pad'] as const

export type LeaseKey = (typeof LEASE_KEYS)[number]

export const LEASE_KEY_ORDER = LEASE_KEYS

type LeaseAsk = Partial<Record<LeaseKey, number>>

export const LEASE_NEED = {
  budget: { focus: { desk: 1 }, base: { desk: 2, overnight: 1 }, hub: { desk: 4, stand: 6 } },
  flag: {
    focus: { desk: 1 },
    base: { desk: 2, overnight: 1 },
    hub: { desk: 2, lane: 1, lounge: 1, stand: 6 },
    primary: { desk: 4, lane: 1, lounge: 1, pier: 8, fuel: 1 },
  },
  regional: { focus: { desk: 1, stand: 2 } },
  cargo: { base: { ramp: 1, overnight: 1 }, hub: { hangar: 1, fuel: 1, ramp: 1 }, primary: { hangar: 1, fuel: 1, ramp: 1 } },
  charter: { focus: { desk: 1 } },
  heli: { base: { pad: 1, fuel: 1 } },
} as const satisfies Record<HubArchetype, Partial<Record<HubOfferTier, LeaseAsk>>>

/** Focus asks for a preferred desk. Higher tiers ask for dedicated desks. */
export const DESK_ASK: Record<HubOfferTier, 'preferred' | 'dedicated'> = {
  focus: 'preferred',
  base: 'dedicated',
  hub: 'dedicated',
  primary: 'dedicated',
}

/** Budget and regional may meet a preferred desk with a tagged kiosk. A flag will not. */
export const KIOSK_ARCHETYPES = ['budget', 'regional'] as const satisfies readonly HubArchetype[]

/** Shown on desk and lane lines until the allocator exports leasesFor. Counts are ignored until then. */
export const ALLOCATOR_WAIT = 'Waiting on the desk allocator'

/**
 * Connection or sort window, on the archetypes whose hub is a bank.
 * Budget hub is a large base with a fee promise, so it is not in this list.
 */
export const CONNECTION_AT: Partial<Record<HubArchetype, readonly HubOfferTier[]>> = {
  flag: ['hub'],
  cargo: ['hub'],
}

export const HUB_OFFER_FEE = { focus: 4_000, base: 8_000, hub: 14_000, primary: 22_000 } as const
export const TIER_DROP_WARNING_DAYS = 30
/** Share of one lounge room's daily upkeep the airline pays while the lease holds. */
export const LOUNGE_COFUND_SHARE = 0.5
export const CONNECTION_WINDOW_MIN = 45
export const BUDGET_TURN_TARGET_MIN = 25

export const PERK = {
  budgetTurn: 1,
  flagExclusiveType: 1,
  regionalFeedShare: 0.15,
  cargoNightRotations: 2,
  charterSeasonDays: 90,
  heliPadPriority: 1,
} as const

/** What accepting that tier grants. Archetype rows replace the shared list. */
export const TIER_REWARDS: Record<HubOfferTier, readonly string[]> = {
  focus: ['One guaranteed rotation on top of the Preferred extra slot.', 'A small marketing bump.'],
  base: ['Aircraft overnight.', 'Guaranteed first-wave rotations.', 'Crew jobs.', 'The diplomacy Base perk.'],
  hub: ['Transfer passengers.', 'A revenue share.', 'Denser slots.'],
  primary: [
    'Their largest airframe, while Primary hub holds.',
    'The rival penalty from the existing hub grant.',
    'The Flagship fee multiplier on landing fees.',
  ],
}

export const ARCHETYPE_REWARDS: Partial<Record<HubArchetype, Partial<Record<HubOfferTier, readonly string[]>>>> = {
  budget: {
    hub: ['A fee promise on a large base.', 'Guaranteed early rotations.'],
  },
  cargo: {
    hub: ['A night sort.', 'A revenue share on freight.', 'Denser night slots.'],
    primary: [
      'The night ramp to themselves.',
      'The rival penalty from the existing hub grant.',
      'The Flagship fee multiplier on landing fees.',
    ],
  },
  charter: {
    focus: ['A dated block of rotations.', 'A quiet season when the block ends.'],
  },
  heli: {
    base: ['Guaranteed pad turns.', 'The pad stays with them while the contract holds.'],
  },
}

/** The one perk of that archetype, on the tier where it turns on. */
export const PERK_AT: Record<HubArchetype, readonly { tier: HubOfferTier; text: string }[]> = {
  budget: [{ tier: 'base', text: `A ${BUDGET_TURN_TARGET_MIN}-minute turn on their dedicated stands.` }],
  flag: [
    { tier: 'hub', text: 'A branded lounge in their name.' },
    { tier: 'primary', text: 'Their largest type stays exclusive to this field.' },
  ],
  regional: [{ tier: 'focus', text: 'Their passengers feed a flag or cargo carrier at Hub or above.' }],
  cargo: [{ tier: 'hub', text: `${PERK.cargoNightRotations} guaranteed night rotations.` }],
  charter: [{ tier: 'focus', text: `A season block of ${PERK.charterSeasonDays} days, then a quiet season.` }],
  heli: [{ tier: 'base', text: 'Medevac keeps the pad ahead of a sightseeing heli.' }],
}
