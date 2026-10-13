import type {
  AgendaId,
  AirlineProfile,
  CapacityLight,
  DepositTier,
  Interest,
  NegotiationContext,
  ServiceId,
  TraitId,
} from './types.ts'

/** Every tunable number for negotiation lives here. Logic reads this file. */
export const NEGOTIATION = {
  defaultMaxCounters: 3,
  patientMaxCounters: 4,
  hardballMaxCounters: 2,
  moodStart: 1,
  /** Counter replies move this fraction of the way from the player's ask toward the target. */
  counterMoveMin: 0.3,
  counterMoveMax: 0.6,
  /** Bluff biases the move toward the low end without leaving the 30–60% band. */
  bluffPull: 0.65,
  minSpread: 0.05,
  overAskMin: 2,
  overAskMax: 6,
  overAskDays: 180,
  grudgeValue: -8,
  grudgeDays: 360,
  grudgeModifier: 'hard_bargain' as const,
  walkValue: -10,
  walkDays: 360,
  walkBarDays: 30,
  freebieMin: 2,
  freebieMax: 5,
  freebieDays: 180,
  ulccOpenMin: 0.4,
  ulccOpenMax: 0.6,
  ulccPitch: 'we bring mass travelers, just sell them things',
  /** Chance a trunk pax letter is replaced by an ULCC pitch. Uses the negotiation RNG only. */
  ulccOfferChance: 0.28,
  research: {
    coarse: { cost: 8_000, bandPct: 0.4 },
    fine: { cost: 20_000, bandPct: 0.15 },
  },
  spend: {
    average: 14,
    meanMin: 0.5,
    meanMax: 1.4,
    /** sd / mean. ±15% is 2.5 sd, so the fine band holds the actual in ~99% of seeds. */
    sdRatio: 0.06,
  },
  reportAfterDays: 14,
  rival: {
    name: 'Bellwater Intl',
    growthScore: 36,
    revenuePerAirline: 18_000,
    growthPerAirline: 6,
    trafficCutPerAirline: 0.05,
    trafficCutCap: 0.25,
  },
  economics: {
    loadFactor: 0.84,
    retailTake: 0.4,
    walkInPerDay: 6_000,
    overheadPerDay: 4_500,
    unknownSpendBand: 0.55,
    knownSpendBand: 0.05,
  },
  bot: {
    days: 30,
    startingCash: 20_000,
    ulccDay: 2,
    offerEvery: 3,
    cashFloor: -50_000,
  },
  services: [
    { id: 'landing', label: 'Landing' },
    { id: 'pax', label: 'Passenger' },
    { id: 'bags', label: 'Bags' },
    { id: 'fuel', label: 'Fuel' },
    { id: 'catering', label: 'Catering' },
    { id: 'parking', label: 'Parking' },
  ] as const satisfies readonly { id: ServiceId; label: string }[],
  deposits: [
    { id: 'none', label: 'No deposit', costRatio: 0, cashFraction: 0 },
    { id: 'standard', label: 'Standard', costRatio: 0.02, cashFraction: 0.06 },
    { id: 'high', label: 'High', costRatio: 0.045, cashFraction: 0.15 },
  ] as const satisfies readonly { id: DepositTier; label: string; costRatio: number; cashFraction: number }[],
  terms: [6, 12, 24] as const,
  parkingHours: [0, 2, 4, 8] as const,
  fuelDiscounts: [0, 5, 10, 15] as const,
  marketingFunds: [0, 5_000, 15_000, 40_000] as const,
  capacityCost: { green: 1, amber: 1.06, red: 1.18 } as Record<CapacityLight, number>,
  /** How far a 50-point rating swing moves the effective cost. */
  ratingSwing: 0.08,
  standingSwing: 0.06,
  faces: ['😠', '🙁', '😐', '🙂', '😀'] as const,
}

export const NEUTRAL_CONTEXT: NegotiationContext = {
  capacity: 'green',
  rating: 50,
  standing: 50,
}

/** Added to the baseline, then clamped. maxCounters is chosen by trait, not summed. */
export const PERSONALITY_BASE = {
  targetCost: 0.9,
  reservation: 1.06,
  patience: 0.5,
  greed: 0.35,
  bluff: 0.25,
  pride: 1,
  loyalty: 0.45,
}

export const TRAIT_WEIGHTS: Record<
  TraitId,
  Partial<typeof PERSONALITY_BASE>
> = {
  green: { targetCost: 0.04, patience: 0.08, loyalty: 0.08 },
  proud: { pride: 0.7, reservation: -0.02, loyalty: -0.06 },
  punctual: { patience: 0.06, loyalty: 0.08, pride: 0.1 },
  lavish: { targetCost: 0.08, reservation: 0.05, greed: -0.12 },
  showman: { bluff: 0.3, greed: 0.08 },
  hardball: { patience: -0.32, greed: 0.28, bluff: 0.4, pride: 0.35, loyalty: -0.08 },
  frugal: { targetCost: -0.22, reservation: -0.12, greed: 0.22, patience: -0.06 },
  patient: { patience: 0.4, loyalty: 0.12, greed: -0.05 },
}

export const AGENDA_WEIGHTS: Record<AgendaId, Partial<typeof PERSONALITY_BASE>> = {
  cost_cutter: { targetCost: -0.08, reservation: -0.04, greed: 0.1 },
  never_second: { pride: 0.25, reservation: -0.02 },
  biggest_everywhere: { greed: 0.06, targetCost: -0.03 },
  loyal_partner: { loyalty: 0.2, patience: 0.1, reservation: 0.03 },
}

/** Interest match on a freebie lowers the effective cost fraction. */
export const INTEREST_FIT: Record<Interest, { priority: number; contact: number; lounge: number; lead: number }> = {
  cost: { priority: 0, contact: 0, lounge: 0, lead: 0 },
  premium: { priority: 0.005, contact: 0.02, lounge: 0.025, lead: 0 },
  punctuality: { priority: 0.02, contact: 0.008, lounge: 0, lead: 0.015 },
  capacity: { priority: 0.01, contact: 0.01, lounge: 0, lead: 0.005 },
  green: { priority: 0, contact: 0, lounge: 0, lead: 0.004 },
  family: { priority: 0, contact: 0, lounge: 0.01, lead: 0.004 },
  prestige: { priority: 0.008, contact: 0.015, lounge: 0.02, lead: 0 },
  cargo: { priority: 0.01, contact: 0, lounge: 0, lead: 0.01 },
}

export const AIRLINES: AirlineProfile[] = [
  {
    id: 'northline',
    name: 'Northline',
    traits: ['frugal', 'patient'],
    agenda: 'cost_cutter',
    interests: ['cost', 'punctuality', 'family'],
    seats: 68,
    flightsPerDay: 4,
    handlingPerDay: 2_200,
    posted: { landing: 5_200, pax: 8, bags: 3, fuel: 4, catering: 2, parking: 280 },
    ulcc: false,
    pitch: null,
  },
  {
    id: 'harbor',
    name: 'Harbor Air',
    traits: ['punctual', 'proud'],
    agenda: null,
    interests: ['punctuality', 'premium', 'capacity'],
    seats: 160,
    flightsPerDay: 4,
    handlingPerDay: 3_400,
    posted: { landing: 7_400, pax: 14, bags: 5, fuel: 7, catering: 4, parking: 420 },
    ulcc: false,
    pitch: null,
  },
  {
    id: 'summit',
    name: 'Summit Premier',
    traits: ['lavish', 'proud'],
    agenda: 'never_second',
    interests: ['premium', 'prestige', 'punctuality'],
    seats: 220,
    flightsPerDay: 3,
    handlingPerDay: 4_800,
    posted: { landing: 11_000, pax: 18, bags: 6, fuel: 8, catering: 7, parking: 640 },
    ulcc: false,
    pitch: null,
  },
  {
    id: 'skypenny_max',
    name: 'SkyPenny Max',
    traits: ['hardball', 'frugal'],
    agenda: 'cost_cutter',
    interests: ['cost', 'capacity', 'punctuality'],
    seats: 186,
    flightsPerDay: 5,
    handlingPerDay: 7_000,
    posted: { landing: 700, pax: 4, bags: 1.2, fuel: 2.5, catering: 0, parking: 120 },
    ulcc: true,
    pitch: NEGOTIATION.ulccPitch,
  },
  {
    id: 'zoomjet',
    name: 'Zoomjet',
    traits: ['hardball', 'frugal'],
    agenda: 'cost_cutter',
    interests: ['cost', 'punctuality', 'capacity'],
    seats: 180,
    flightsPerDay: 5,
    handlingPerDay: 6_800,
    posted: { landing: 680, pax: 3.8, bags: 1.1, fuel: 2.4, catering: 0, parking: 110 },
    ulcc: true,
    pitch: NEGOTIATION.ulccPitch,
  },
  {
    id: 'budgie_ultra',
    name: 'Budgie Ultra',
    traits: ['hardball', 'frugal'],
    agenda: 'cost_cutter',
    interests: ['cost', 'family', 'capacity'],
    seats: 174,
    flightsPerDay: 5,
    handlingPerDay: 6_600,
    posted: { landing: 640, pax: 3.6, bags: 1, fuel: 2.2, catering: 0, parking: 100 },
    ulcc: true,
    pitch: NEGOTIATION.ulccPitch,
  },
]

export const ULCC_IDS = AIRLINES.filter((a) => a.ulcc).map((a) => a.id)

export const SERVICE_IDS: ServiceId[] = NEGOTIATION.services.map((s) => s.id)
