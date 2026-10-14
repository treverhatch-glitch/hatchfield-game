import { COMMUTE, COMMUTE_LINK, HOUSING_TIERS, housingTier } from './data.ts'
import type { CommuteMode, CommuteReport, HousingTierId, TransportLinks } from './types.ts'

export interface LinkProfile {
  mode: CommuteMode
  label: string
  minutes: number
  reliability: number
}

/** Best link on the field. Rail beats the bus, the bus beats a road, a road beats nothing. */
export function linkProfile(links: TransportLinks): LinkProfile {
  const tier3 = links.tier3Rail
  if (tier3?.present) {
    const minutes = tier3Minutes(tier3.headwayMin)
    const reliability = clamp01(tier3.reliability ?? COMMUTE_LINK.tier3.reliability)
    return {
      mode: 'rail',
      label: tier3.name?.trim() || COMMUTE_LINK.tier3.label,
      minutes,
      reliability: Math.max(COMMUTE_LINK.rail.reliability, reliability),
    }
  }
  if (links.passengerRail) {
    return { mode: 'rail', ...COMMUTE_LINK.rail }
  }
  if (links.busStops > 0) {
    const extra = Math.min(COMMUTE.busExtraCap, links.busStops - 1)
    return {
      mode: 'bus',
      label: COMMUTE_LINK.bus.label,
      minutes: Math.max(8, COMMUTE_LINK.bus.minutes - extra * COMMUTE.busMinutesPerStop),
      reliability: Math.min(0.97, COMMUTE_LINK.bus.reliability + extra * COMMUTE.busReliabilityPerStop),
    }
  }
  if (links.roadCells > 0 && links.roadReachesEdge) {
    return { mode: 'road', ...COMMUTE_LINK.roadEdge }
  }
  if (links.roadCells > 0) {
    return { mode: 'road', ...COMMUTE_LINK.road }
  }
  return { mode: 'none', ...COMMUTE_LINK.none }
}

export function tier3Minutes(headwayMin: number | undefined): number {
  if (headwayMin == null || !Number.isFinite(headwayMin)) return COMMUTE_LINK.tier3.minutes
  const door = headwayMin * COMMUTE.tier3HeadwayScale + COMMUTE.tier3HeadwayBias
  return clamp(door, COMMUTE.tier3MinMinutes, COMMUTE_LINK.rail.minutes)
}

export interface CommuteInput {
  links: TransportLinks
  beds: number
  employed: number
  /** Best built tier, if any. Bonuses do not stack; beds do. */
  bestTier: HousingTierId | null
}

/** Commute time, no-shows, morale, retention, and the hire discount. */
export function assessCommute(input: CommuteInput): CommuteReport {
  const link = linkProfile(input.links)
  const bonus = input.bestTier ? housingTier(input.bestTier) : null
  const employed = Math.max(0, Math.floor(input.employed))
  const beds = Math.max(0, Math.floor(input.beds))
  const housed = Math.min(beds, employed)
  const commuters = employed - housed
  const commuterShare = employed === 0 ? 1 : commuters / employed
  const housedShare = employed === 0 ? 0 : housed / employed
  const cityFail = 1 - link.reliability
  const onSiteFail = 1 - COMMUTE.onSiteReliability
  const blendedFail = housedShare * onSiteFail + (employed === 0 ? cityFail : commuterShare * cityFail)
  const failureCut = bonus?.failureCut ?? 0
  const failureChance = employed === 0 ? 0 : clamp(blendedFail * (1 - failureCut), 0, 0.85)
  const cityLate = Math.max(0, link.minutes - COMMUTE.comfortMinutes)
  const onSiteLate = Math.max(0, COMMUTE.onSiteMinutes - COMMUTE.comfortMinutes)
  const lateMinutes =
    employed === 0 ? cityLate : commuterShare * cityLate + housedShare * onSiteLate
  const drag = clamp(lateMinutes / COMMUTE.moraleMinutes, 0, COMMUTE.moraleDragCap)
  const morale = clamp(
    COMMUTE.moraleBase - drag + (bonus?.moraleBonus ?? 0),
    COMMUTE.moraleMin,
    1,
  )
  const retention = clamp(
    COMMUTE.retentionBase +
      (bonus?.moraleBonus ?? 0) * 0.5 +
      (bonus?.retentionBonus ?? 0) -
      drag * COMMUTE.retentionDrag,
    0.35,
    0.98,
  )
  const hireCostMultiplier = clamp(1 - (bonus?.hireDiscount ?? 0), COMMUTE.hireFloor, 1)
  const economyTier = bonus?.economyTier ?? 0
  return {
    mode: link.mode,
    modeLabel: link.label,
    minutes: round1(link.minutes),
    reliability: link.reliability,
    lateMinutes: round1(lateMinutes),
    failureChance,
    commuterShare,
    housed,
    beds,
    employed,
    morale,
    retention,
    hireCostMultiplier,
    economyTier,
  }
}

export function bestTierId(built: readonly HousingTierId[]): HousingTierId | null {
  let best: HousingTierId | null = null
  let rank = -1
  for (const id of built) {
    const next = HOUSING_TIERS.findIndex((tier) => tier.id === id)
    if (next > rank) {
      rank = next
      best = id
    }
  }
  return best
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function clamp01(n: number): number {
  return clamp(n, 0, 1)
}
