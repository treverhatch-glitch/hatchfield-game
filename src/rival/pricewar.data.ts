/**
 * Tunables for the Bellwater price war. Logic reads this table.
 * Trunk does not have PR #64's full rival airport yet, so these numbers
 * are the war slice (and the small Bellwater stub) until that merge.
 */
export interface PriceWarTune {
  rivalName: string
  /** Bellwater's tariff before the first undercut. 1 is list price. */
  startFee: number
  /** First game-day a war may roll. */
  minDay: number
  /** Quiet days after an effect ends before another war may roll. */
  cooldownDays: number
  /** Daily chance once the field is eligible, before walked airlines. */
  startChance: number
  /** Added to the start chance for each airline that already walked to Bellwater. */
  walkedChance: number
  startChanceCap: number
  /** Intensity = min(cap, 1 + walked × this). */
  intensityPerWalked: number
  intensityCap: number
  /** Walk-in share lost while the player is holding or has not answered. */
  holdLoss: number
  /** Extra hold loss for each intensity point above 1. */
  holdLossPerIntensity: number
  /** Rival effects (this war + walked-airline cuts) cannot take more walk-in than this. */
  walkInLossCap: number
  /** Fee multiplier while the player matches. */
  matchMargin: number
  matchDays: number
  /** Residual walk-in loss while matching. Near zero means the share came back. */
  matchLoss: number
  promoteCost: number
  promoteDays: number
  /** Residual walk-in loss during the marketing push. */
  promoteLoss: number
  holdDays: number
  /** Rival tariff = player tariff × (1 − gap × intensity), not below the floor. */
  undercutGap: number
  feeFloor: number
  /** Chance to pull an open soft offer, before intensity. */
  poachChance: number
  poachChanceCap: number
  /** Days the card stays open before an ignored war becomes a hold. */
  responseWindowDays: number
  defaultPlayerFee: number
}

export const PRICE_WAR: PriceWarTune = {
  rivalName: 'Bellwater Intl',
  startFee: 1.04,
  minDay: 1,
  cooldownDays: 4,
  startChance: 0.58,
  walkedChance: 0.06,
  startChanceCap: 0.8,
  intensityPerWalked: 0.05,
  intensityCap: 1.35,
  holdLoss: 0.12,
  holdLossPerIntensity: 0.1,
  walkInLossCap: 0.25,
  matchMargin: 0.88,
  matchDays: 5,
  matchLoss: 0.02,
  promoteCost: 14_000,
  promoteDays: 4,
  promoteLoss: 0,
  holdDays: 5,
  undercutGap: 0.06,
  feeFloor: 0.72,
  poachChance: 0.4,
  poachChanceCap: 0.75,
  responseWindowDays: 2,
  defaultPlayerFee: 1,
}
