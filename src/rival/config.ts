/**
 * Tunable numbers for Bellwater Intl. Logic reads these; it does not
 * hard-code tariffs, growth, or poach odds.
 *
 * Demand is scored from fees, service and stands. At a 50/50 split the
 * player's load factor stays 1, so a matched airport does not lose half
 * its traffic on the day Bellwater appears.
 */
export const RIVAL_NAME = 'Bellwater Intl'
export const RIVAL_CODE = 'BLW'

export const RIVAL = {
  /** Opening commercial image and how the operation actually runs (0–100). */
  startReputation: 46,
  startService: 50,
  /** Stand-equivalents. The player starter kit stamps two stands. */
  startCapacity: 2,
  maxCapacity: 8,
  startTreasury: 380_000,
  fees: { landing: 1.05, passenger: 1.04, cargo: 1.07 },
  feeFloor: 0.78,
  feeCeiling: 1.35,
  /** Player tariff must be this much cheaper before Bellwater cuts. */
  undercutGap: 0.04,
  undercutStep: 0.03,
  /** Player tariff this much dearer, and a busy field, before they raise. */
  raiseGap: 0.06,
  raiseStep: 0.02,
  /** Days of upkeep they keep in reserve before refusing another cut. */
  solvencyDays: 3,
  upkeepPerStand: 1_800,
  /** Daily yield per based carrier, before the fee index. */
  yieldPerCarrier: 9_200,
  /** Capital cost of the next stand. Scales with stands already built. */
  expandBase: 72_000,
  expandGrowth: 0.85,
  /** Expand only when the roster fills this fraction of the stands. */
  growUtilization: 0.85,
  /** Minimum days between stand projects. */
  expandCooldownDays: 4,
  /** Capacity term in the demand score saturates at this many stands. */
  referenceCapacity: 8,
  weights: { fee: 0.42, service: 0.33, capacity: 0.25 },
  /** playerFactor = clamp(parityBase + slope * playerShare). Share 0.5 → 1. */
  demandParityBase: 0.55,
  demandSlope: 0.9,
  demandMin: 0.62,
  demandMax: 1.18,
  /** Inside this band the load factor stays 1, so a close day does not shuffle pax. */
  demandDeadband: 0.04,
  /** No unprompted poach before this game-day. Walkaways are courted sooner. */
  poachMinDay: 4,
  poachCooldownDays: 3,
  /** Player standing at or below this is vulnerable. */
  poachStandingMax: 42,
  poachChanceCap: 0.4,
  /** Reputation the player's field loses when a carrier is poached. */
  poachReputationHit: 4,
  courtBaseCost: 12_000,
  courtPerTier: 8_000,
  courtChanceFloor: 0.08,
  courtChanceCap: 0.72,
  /** Loyalty added when a pitch fails. */
  courtLoyaltyBump: 6,
  maxMoves: 8,
  panelMoves: 3,
  maxRoster: 6,
  /** How far service and reputation may drift in one day. */
  driftStep: 1.1,
  home: [
    { id: 'bushline', loyalty: 58 },
    { id: 'upps', loyalty: 66 },
  ],
} as const
