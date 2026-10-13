export type TraitId =
  | 'green'
  | 'proud'
  | 'punctual'
  | 'lavish'
  | 'showman'
  | 'hardball'
  | 'frugal'
  | 'patient'

export type AgendaId = 'cost_cutter' | 'never_second' | 'biggest_everywhere' | 'loyal_partner'

export type Interest =
  | 'cost'
  | 'premium'
  | 'punctuality'
  | 'capacity'
  | 'green'
  | 'family'
  | 'prestige'
  | 'cargo'

export type ServiceId = 'landing' | 'pax' | 'bags' | 'fuel' | 'catering' | 'parking'

export type CapacityLight = 'green' | 'amber' | 'red'

export type DepositTier = 'none' | 'standard' | 'high'

export type ReplyKind = 'accept' | 'counter' | 'accept_with_grudge' | 'walk'

/** Standing changes the host applies through the diplomacy adapter. */
export type StandingModifierName = 'over_ask' | 'hard_bargain' | 'walk' | 'freebie'

export interface Freebies {
  parkingHours: number
  fuelDiscountPct: number
  priorityGates: boolean
  contactGates: boolean
  marketingFund: number
  loungeAccess: boolean
  waivedLeadTime: boolean
}

export interface OfferTerms {
  feePct: Record<ServiceId, number>
  freebies: Freebies
  termMonths: number
  deposit: DepositTier
}

export interface PostedFees {
  landing: number
  pax: number
  bags: number
  fuel: number
  catering: number
  parking: number
}

export interface AirlineProfile {
  id: string
  name: string
  traits: TraitId[]
  agenda: AgendaId | null
  interests: Interest[]
  seats: number
  flightsPerDay: number
  /** Airport cost to handle one day of this carrier, before retail. */
  handlingPerDay: number
  posted: PostedFees
  ulcc: boolean
  pitch: string | null
}

export interface Personality {
  /** Cost per seat the airline hopes to pay, as a fraction of the posted tariff. */
  targetCost: number
  /** Walk if the effective cost fraction is above this. */
  reservation: number
  /** 0–1. Higher patience loses less mood per round. */
  patience: number
  /** 0–1. How hard they push the opening below their target. */
  greed: number
  /** 0–1. Higher bluff concedes less when they counter. */
  bluff: number
  /** Multiplier on over-ask Standing hits. Proud carriers sit above 1. */
  pride: number
  /** 0–1. Softens the cost of a long term and a warm Standing. */
  loyalty: number
  /** Player counters that may still draw a counter-reply. */
  maxCounters: number
}

export interface NegotiationContext {
  capacity: CapacityLight
  /** Airport rating 0–100. */
  rating: number
  /** Standing with this airline, 0–100. */
  standing: number
}

export interface StandingDelta {
  id: string
  airlineId: string
  modifier: StandingModifierName
  label: string
  value: number
  /** Linear decay reaches 0 at this age. */
  durationDays: number
  startDay: number
}

export interface ActiveModifier extends StandingDelta {
  /** 0–1 remaining. 0 means the modifier has expired. */
  remaining: number
}

export interface RivalAirport {
  name: string
  growthScore: number
  revenuePerDay: number
  airlines: string[]
}

export interface RivalCard {
  name: string
  growthScore: number
  revenuePerDay: number
  airlines: string[]
  /** Latest carrier the rival picked up, e.g. "+$18k/day". */
  headline: string
  trafficFactor: number
}

export interface SpendHidden {
  mean: number
  actual: number
}

export interface ResearchBand {
  cost: number
  /** Half-width as a fraction of the hidden mean. 0.4 means ±40%. */
  bandPct: number
  low: number
  high: number
  mean: number
}

export interface Session {
  id: string
  airlineId: string
  round: number
  counters: number
  mood: number
  status: 'open' | 'accepted' | 'grudge' | 'walked' | 'player_walk'
  ask: OfferTerms
  theirs: OfferTerms
  context: NegotiationContext
  lastReply: ReplyKind | null
  note: string
}

export interface SignedDeal {
  airlineId: string
  terms: OfferTerms
  signedDay: number
  operatedDays: number
  grudge: boolean
}

export interface NegotiationResult {
  reply: ReplyKind | 'player_walk' | null
  outcome: 'open' | 'signed' | 'walked' | 'player_walk'
  deltas: StandingDelta[]
  /** Cash the airport receives (deposit) or pays (marketing fund, research). */
  cashDelta: number
  note: string
}
