/**
 * Tunables for the guest layer on the terminal walk (src/paxnav/guests.ts):
 * traits, needs, wayfinding, thoughts, groups, impatience and rebooking.
 * Logic reads these, never literals. Times are nav seconds, rates per nav hour.
 */

/** Why they fly. Every guest has exactly one. */
export type GuestPurpose = 'business' | 'leisure' | 'family' | 'budget'
/** Extra traits on top of the purpose. A guest has any number (first-timer and frequent flyer never both). */
export type GuestFlag = 'first_timer' | 'frequent_flyer' | 'reduced_mobility' | 'with_kids'
export type GuestTrait = GuestPurpose | GuestFlag

export const GUEST_PURPOSES = ['business', 'leisure', 'family', 'budget'] as const satisfies readonly GuestPurpose[]
export const GUEST_FLAGS = ['first_timer', 'frequent_flyer', 'reduced_mobility', 'with_kids'] as const satisfies readonly GuestFlag[]

/** Needs, 0 (fine) to 1 (urgent). Anxiety is worked out from the time left, not decayed. */
export type NeedKey = 'hunger' | 'thirst' | 'bladder' | 'boredom' | 'tired' | 'comfort' | 'anxiety'
export const NEED_KEYS = ['hunger', 'thirst', 'bladder', 'boredom', 'tired', 'comfort', 'anxiety'] as const satisfies readonly NeedKey[]
/** Needs that rise on their own over time. */
export type DecayNeed = Exclude<NeedKey, 'anxiety'>

/** Optional stops a need can pick (seating is the gate's own seats). */
export type AmenityStop = 'toilet' | 'food' | 'shop'

export interface TraitFx {
  speed: number
  patience: number
  spend: number
  anxiety: number
  /** Chance of getting lost. */
  lost: number
  /** Multipliers on how fast each need rises. */
  decay: Partial<Record<DecayNeed, number>>
  /** How much they want each amenity when the need is there. */
  taste: Partial<Record<AmenityStop, number>>
}

const FX = (fx: Partial<TraitFx>): TraitFx => ({
  speed: 1,
  patience: 1,
  spend: 1,
  anxiety: 1,
  lost: 1,
  decay: {},
  taste: {},
  ...fx,
})

/** Trait effects. They stack by multiplying. */
export const TRAIT_FX: Record<GuestTrait, TraitFx> = {
  business: FX({ speed: 1.12, patience: 0.7, spend: 1.3, anxiety: 0.9, lost: 0.6, taste: { food: 1.1, shop: 0.6 } }),
  leisure: FX({ speed: 0.95, patience: 1.15, decay: { boredom: 1.1 }, taste: { shop: 1.3 } }),
  family: FX({ speed: 0.88, patience: 0.9, spend: 1.1, anxiety: 1.15, decay: { bladder: 1.3, hunger: 1.2 }, taste: { food: 1.3, shop: 1.1 } }),
  budget: FX({ patience: 1.1, spend: 0.5, taste: { food: 0.7, shop: 0.5 } }),
  first_timer: FX({ speed: 0.95, anxiety: 1.4, lost: 2.5 }),
  frequent_flyer: FX({ speed: 1.08, patience: 0.8, anxiety: 0.6, lost: 0.2 }),
  reduced_mobility: FX({ speed: 0.6, patience: 1.1, lost: 1.2, decay: { tired: 2.2, bladder: 1.2, comfort: 1.4 } }),
  with_kids: FX({ speed: 0.85, patience: 0.75, decay: { bladder: 1.4, boredom: 1.5, hunger: 1.3 }, taste: { food: 1.2, shop: 1.4 } }),
}

/** Lines a guest can think. `delta` is the satisfaction change when the thought lands. */
export type ThoughtKey =
  | 'queue_long'
  | 'left_queue'
  | 'complain'
  | 'lost'
  | 'no_amenity'
  | 'out_of_stock'
  | 'nice_seats'
  | 'no_seats'
  | 'hungry'
  | 'thirsty'
  | 'need_toilet'
  | 'bored'
  | 'tired'
  | 'anxious'
  | 'crowded'
  | 'quick'
  | 'good_buy'
  | 'tasty'
  | 'relief'
  | 'missed'
  | 'rebooked'

export interface ThoughtDef {
  icon: string
  /** `{place}` is filled with what they were looking for. */
  text: string
  delta: number
}

export const THOUGHTS: Record<ThoughtKey, ThoughtDef> = {
  queue_long: { icon: '⏳', text: 'This queue is too long', delta: -4 },
  left_queue: { icon: '😤', text: "I'm not waiting in this line", delta: -3 },
  complain: { icon: '😠', text: "I'm complaining about this wait", delta: -6 },
  lost: { icon: '❓', text: "Can't find the {place}", delta: -3 },
  no_amenity: { icon: '🚫', text: "Can't find the {place}", delta: -4 },
  out_of_stock: { icon: '📦', text: 'Shop is out of stock', delta: -5 },
  nice_seats: { icon: '💺', text: 'Nice seats', delta: 3 },
  no_seats: { icon: '🧍', text: 'Nowhere to sit', delta: -3 },
  hungry: { icon: '🍔', text: "I'm starving", delta: -2 },
  thirsty: { icon: '🥤', text: 'I need a drink', delta: -2 },
  need_toilet: { icon: '🚻', text: 'I really need the restroom', delta: -3 },
  bored: { icon: '😐', text: "I'm bored", delta: -1 },
  tired: { icon: '🥱', text: 'My feet hurt', delta: -1 },
  anxious: { icon: '😰', text: "I'm going to miss my flight!", delta: -2 },
  crowded: { icon: '👥', text: "It's so crowded in here", delta: -2 },
  quick: { icon: '⚡', text: 'That was quick', delta: 2 },
  good_buy: { icon: '🛍️', text: 'Good shop', delta: 2 },
  tasty: { icon: '☕', text: 'That hit the spot', delta: 2 },
  relief: { icon: '😌', text: 'Much better', delta: 1 },
  missed: { icon: '✈️', text: 'I missed my flight!', delta: -25 },
  rebooked: { icon: '🎫', text: 'Rebooked, finally', delta: -2 },
}

/** Words for `{place}` by the stop they are heading for. */
export const PLACE_WORDS: Record<string, string> = {
  checkin: 'check-in',
  security: 'security',
  toilet: 'restroom',
  food: 'food court',
  shop: 'shops',
  gate: 'gate',
  rebook: 'rebooking desk',
}

export const GUEST_TUNING = {
  /** Purpose shares when the sim gives no hint. */
  purposeShare: { business: 0.25, leisure: 0.4, family: 0.15, budget: 0.2 } satisfies Record<GuestPurpose, number>,
  /** Chance of each flag by purpose. First-timer is rolled first; frequent flyer only if not. */
  flagShare: {
    business: { first_timer: 0.05, frequent_flyer: 0.6, reduced_mobility: 0.03, with_kids: 0 },
    leisure: { first_timer: 0.3, frequent_flyer: 0.1, reduced_mobility: 0.08, with_kids: 0.1 },
    family: { first_timer: 0.25, frequent_flyer: 0.05, reduced_mobility: 0.06, with_kids: 0.75 },
    budget: { first_timer: 0.35, frequent_flyer: 0.05, reduced_mobility: 0.05, with_kids: 0.15 },
  } satisfies Record<GuestPurpose, Record<GuestFlag, number>>,
  /** Seconds between a guest's "think" steps (needs, thoughts, choices). Staggered per guest. */
  thinkSec: 3,
  /** Starting need levels are rolled up to these. */
  startNeed: { hunger: 0.5, thirst: 0.5, bladder: 0.5, boredom: 0.2, tired: 0.2, comfort: 0.1 } satisfies Record<DecayNeed, number>,
  /** Rise per nav hour at base. */
  decayPerHour: { hunger: 0.22, thirst: 0.35, bladder: 0.3, boredom: 0.45, tired: 0.15, comfort: 0.2 } satisfies Record<DecayNeed, number>,
  /** Multipliers by what they are doing. Seated values below zero recover the need. */
  context: {
    queue: { boredom: 2, tired: 2, comfort: 2.5 },
    walk: { tired: 1.5, comfort: 0.5 },
    /** Seated: per hour change, added instead of the base rise. */
    seated: { tired: -0.9, comfort: -1.2, boredom: 0.8 },
  },
  /** Comfort rises this much faster per extra body over `crowdCellPax` on their cell. */
  crowdComfortPerPax: 0.6,
  /** What a stop does to the need it serves (subtracted, floored at 0). */
  relief: {
    toilet: { bladder: 1 },
    food: { hunger: 0.75, thirst: 0.85 },
    shop: { boredom: 0.65 },
  } satisfies Record<AmenityStop, Partial<Record<DecayNeed, number>>>,
  /** Need below which an amenity is not considered. */
  needMin: 0.35,
  /** Utility a stop needs to win. */
  pickMin: 0.2,
  /** Utility lost per point of anxiety. */
  anxietyWeight: 0.6,
  /** Utility lost per share of the slack the stop would use. */
  timeWeight: 0.5,
  /** Seconds a guest expects to spend at an amenity on top of its line. */
  amenityDwellSec: 120,
  /** Walk allowance to the gate after the last stop. */
  gateWalkSec: 90,
  /** Expected seconds per stop still ahead (plus its line) when guessing the time left. */
  stopBaseSec: { checkin: 90, security: 120 },
  /** Anxiety reaches 1 when the slack to boarding falls to zero; starts rising this far out. */
  anxietyWindowSec: 1500,
  /** Base patience in a line, seconds; trait and anxiety scale it. */
  patienceSec: 600,
  /** Anxiety at 1 cuts patience by this share. */
  anxietyPatienceCut: 0.5,
  /** Share of patience used before "This queue is too long". */
  queueLongShare: 0.5,
  /** Waited longer than patience: leave if there is another way (optional stop, or a shorter line elsewhere). */
  leaveShare: 1,
  /** Waited this many patiences on a stop they cannot skip: they complain. */
  complainShare: 1.3,
  /** A wait under this at check-in or security is "That was quick". */
  quickSec: 60,
  /** Starting satisfaction, 0–100. */
  startSatisfaction: 70,
  /** Same thought again only after this long. */
  thoughtCooldownSec: 300,
  /** Thoughts kept per guest for the card. */
  thoughtsKept: 5,
  /** Need level that raises its complaint thought. */
  needThought: 0.85,
  /** Anxiety that raises "I'm going to miss my flight!". */
  anxiousThought: 0.75,
  /** Lost: chance per minute of walking, before traits, anxiety and signs. */
  lostPerMin: 0.15,
  /** Cells a lost guest wanders before getting their bearings. */
  wanderCells: [6, 14] as const,
  /** Signage near a cell cuts the chance of getting lost: chance / (1 + coverage). */
  signRadiusM: 14,
  signWeight: 1.5,
  /** Departure boards: wider, weaker for wayfinding, and they calm anxiety in range. */
  boardRadiusM: 18,
  boardWeight: 0.8,
  boardCalm: 0.3,
  /** Scheme signs that come with a prefab hall count everywhere at this weight each. */
  schemeSignWeight: 0.35,
  /** Bodies per 1 m cell before walkers slow down and give way. */
  crowdCellPax: 2,
  /** Slowest a crowd makes anyone walk, as a share of their pace. */
  crowdMinPace: 0.45,
  /** Bodies on a cell for "It's so crowded in here". */
  crowdThoughtPax: 4,
  /** Spend per visit at base, before trait and a +/- 40% roll. */
  spend: { food: 14, shop: 22 },
  /** Shop counter stock: full shelf, and units restocked per nav hour. One sale uses one unit. */
  stockCap: 40,
  restockPerHour: 30,
  /** Out-of-stock counter: seconds to find out and walk off. */
  outOfStockSec: 4,
  /** They do not try an empty counter again for this long. */
  outOfStockAvoidSec: 900,
  /** Group size limit (leader plus followers). */
  groupMax: 5,
  /** Gap between group members walking behind the leader, metres. */
  groupGapM: 0.7,
  /** Extra service time per extra group member at a desk, lane or boarding desk (share of one). */
  groupServiceShare: 0.5,
  /** Trail points kept per group leader. */
  trailLen: 40,
  /** Leader trail point every this many metres (and on every cell change). */
  trailStepM: 0.2,
  /** Seconds at the rebooking desk. */
  rebookSec: 180,
  /** Reputation per satisfaction point thoughts move (sim reputation is 0–100). */
  repPerSatPoint: 0.002,
  /** Reputation per missed flight, and per complaint. */
  repPerMissed: -0.2,
  repPerComplaint: -0.05,
} as const
