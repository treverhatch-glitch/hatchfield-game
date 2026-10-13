/**
 * Premium screening tunables. Logic reads this file; it does not hard-code prices.
 * Field levels match the design table (3 / 4 / 6 / 8), not a local shortcut.
 */

export type PremiumItemId =
  | 'premium_checkin'
  | 'fast_track_1'
  | 'fast_track_2'
  | 'fast_track_3'
  | 'vip_room'

export type PremiumStaffRole = 'terminal_staff' | 'security_officer'

export type PremiumKind = 'checkin' | 'lane' | 'vip'

export interface PremiumItemDef {
  id: PremiumItemId
  name: string
  blurb: string
  unlockFieldLevel: number
  cost: number
  upkeepPerDay: number
  /** Heads drawn from the shared staff pool. The building does not hire its own. */
  staff: number
  staffRole: PremiumStaffRole
  /** Passengers per hour when fully staffed. Check-in and the VIP room are not rated this way. */
  throughputPerHour: number
  needsCt: boolean
  kind: PremiumKind
  /** Higher priority is staffed first when the shared pool is short. */
  priority: number
}

export const PREMIUM_ITEMS: readonly PremiumItemDef[] = [
  {
    id: 'premium_checkin',
    name: 'Premium check-in desk',
    blurb: 'Quiet desk for business, first, and premium tickets. One agent from the hall roster.',
    unlockFieldLevel: 3,
    cost: 6_000,
    upkeepPerDay: 250,
    staff: 1,
    staffRole: 'terminal_staff',
    throughputPerHour: 0,
    needsCt: false,
    kind: 'checkin',
    priority: 10,
  },
  {
    id: 'fast_track_1',
    name: 'Fast-track lane I',
    blurb: 'One officer. 120 passengers an hour. Economy stays in the general line.',
    unlockFieldLevel: 4,
    cost: 18_000,
    upkeepPerDay: 600,
    staff: 1,
    staffRole: 'security_officer',
    throughputPerHour: 120,
    needsCt: false,
    kind: 'lane',
    priority: 20,
  },
  {
    id: 'fast_track_2',
    name: 'Fast-track lane II',
    blurb: 'Needs CT scanners. Two officers, 200 passengers an hour.',
    unlockFieldLevel: 6,
    cost: 26_000,
    upkeepPerDay: 900,
    staff: 2,
    staffRole: 'security_officer',
    throughputPerHour: 200,
    needsCt: true,
    kind: 'lane',
    priority: 22,
  },
  {
    id: 'fast_track_3',
    name: 'Fast-track lane III',
    blurb: 'Biometric lane. Two officers, 260 passengers an hour.',
    unlockFieldLevel: 8,
    cost: 40_000,
    upkeepPerDay: 1_300,
    staff: 2,
    staffRole: 'security_officer',
    throughputPerHour: 260,
    needsCt: false,
    kind: 'lane',
    priority: 24,
  },
  {
    id: 'vip_room',
    name: 'VIP private screening room',
    blurb: 'Private room and a secure corridor. Two officers from the shared pool.',
    unlockFieldLevel: 8,
    cost: 55_000,
    upkeepPerDay: 1_500,
    staff: 2,
    staffRole: 'security_officer',
    throughputPerHour: 0,
    needsCt: false,
    kind: 'vip',
    priority: 30,
  },
]

const ITEM_BY_ID = new Map(PREMIUM_ITEMS.map((item) => [item.id, item]))

export function premiumItem(id: PremiumItemId): PremiumItemDef {
  const item = ITEM_BY_ID.get(id)
  if (!item) throw new Error(`unknown premium item ${id}`)
  return item
}

/** Economy tech node that counts as CT scanners for lane II. */
export const CT_TECH_ID = 'safety_security.t2'

export const PREMIUM_RULES = {
  /** Happiness when a higher-service passenger is put in the general security queue. */
  generalQueueHappiness: -25,
  /** Standing lost each time this many higher-service passengers miss fast-track. */
  standingPerBatch: -1,
  premiumBatchSize: 20,
  /** Most Standing one airline can lose in a day from that batch rule. */
  standingCapPerDay: -5,
  /** One missed VIP, when neither the private room nor a lane can take them. */
  vipMissStanding: -8,
  /** VIP misses stop stacking after this much Standing in a day. */
  vipStandingCapPerDay: -8,
  /** Charged per passenger who clears a fast-track lane, and only while the player has the fee on. */
  fastTrackFee: 15,
  /** One-time cost to add an officer to the shared roster. Lane upkeep is separate. */
  officerHireCost: 1_200,
  officerCap: 24,
  /** Sim-seconds a dedicated lane or the private room holds someone. */
  dedicatedServiceSec: 0.8,
} as const
