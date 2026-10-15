/**
 * Pure hub checklist. No Game, no React, no building lookup.
 * The caller passes the carrier's stored tier and a snapshot of counts.
 * Desk and lane lines wait until `deskAllocator` is true. Counts on those
 * lines are ignored before that, so this module does not keep its own
 * assignment table.
 */
import { CONTRACT_TIERS } from '../wave3/config.ts'
import {
  ALLOCATOR_WAIT,
  ARCHETYPE_REWARDS,
  BAND_RANK,
  CARGO_HUB_BAND,
  CONNECTION_AT,
  CONNECTION_WINDOW_MIN,
  DESK_ASK,
  HUB_TIERS,
  HUB_TIER_GATE,
  KIOSK_ARCHETYPES,
  LEASE_KEY_ORDER,
  LEASE_NEED,
  PERK_AT,
  TIER_REWARDS,
  type HubArchetype,
  type HubBand,
  type HubOfferTier,
  type HubTier,
  type LeaseKey,
} from './config.ts'

export interface HubCarrier {
  id: string
  name: string
  type: HubArchetype
  signed: boolean
  /** Accepted tier. Station once they are signed and no higher offer has been accepted. */
  tier: HubTier
  /** Wave 3 contract tier, 1 through 5. */
  contractTier: number
  /**
   * Diplomacy band. Omit when that carrier has no diplomacy record.
   * The score gate still applies. A missing band does not add a line.
   */
  diplomacyBand?: HubBand
  /** Share of turns wave 3 already counts as on time. */
  onTimeRate: number
  /** Days in that on-time sample. */
  onTimeDays: number
  /**
   * Diplomacy `hubBlockers`, unchanged. Omit when there is no diplomacy record.
   * Pass an empty list when the record exists and the list is clear.
   * Read only for a Primary offer.
   */
  hubBlockers?: readonly string[]
}

/** Counts for this carrier. The checklist does not search the airport. */
export interface HubFacilities {
  /** False until the desk allocator exports `leasesFor`. */
  deskAllocator: boolean
  stands: number
  pads: number
  overnight: number
  lounges: number
  hangars: number
  fuel: number
  pier: number
  ramp: number
  /** Minutes. Null when the connection or sort clock has not been measured. */
  connectionMin: number | null
  dedicatedDesks: number
  /** Preferred desks. Dedicated desks also count toward a preferred ask. */
  preferredDesks: number
  dedicatedLanes: number
  /** Airline id holding Primary hub, if any. */
  primaryHolderId: string | null
  primaryHolderName: string | null
}

export type LineStatus = 'ok' | 'missing' | 'waiting'

export interface ChecklistLine {
  id: string
  label: string
  detail: string
  status: LineStatus
}

export interface HubChecklist {
  airlineId: string
  current: HubTier
  /** The next offer on this archetype's ladder. Null at the ceiling, and when unsigned. */
  next: HubOfferTier | null
  lines: ChecklistLine[]
  /** Every line is ok. Waiting is not ok. */
  eligible: boolean
  met: number
  total: number
  /** Next tier only, plus nothing from later tiers. */
  rewards: readonly string[]
  /** Archetype perk, when this offer is the tier that turns it on. */
  perk: string | null
  /** Facility asks on the tier after `next`. Empty at the ceiling. */
  nextAsk: readonly string[]
}

export function emptyHubFacilities(): HubFacilities {
  return {
    deskAllocator: false,
    stands: 0,
    pads: 0,
    overnight: 0,
    lounges: 0,
    hangars: 0,
    fuel: 0,
    pier: 0,
    ramp: 0,
    connectionMin: null,
    dedicatedDesks: 0,
    preferredDesks: 0,
    dedicatedLanes: 0,
    primaryHolderId: null,
    primaryHolderName: null,
  }
}

export function offerLadder(type: HubArchetype): HubOfferTier[] {
  const row = LEASE_NEED[type] as Partial<Record<HubOfferTier, unknown>>
  return (['focus', 'base', 'hub', 'primary'] as const).filter((tier) => row[tier] != null)
}

export function nextHubTier(type: HubArchetype, current: HubTier): HubOfferTier | null {
  const rank = HUB_TIERS.indexOf(current)
  return offerLadder(type).find((tier) => HUB_TIERS.indexOf(tier) > rank) ?? null
}

export function lineMet(line: ChecklistLine): boolean {
  return line.status === 'ok'
}

function leasesNeeded(type: HubArchetype, tier: HubOfferTier): Partial<Record<LeaseKey, number>> {
  const row = LEASE_NEED[type] as Partial<Record<HubOfferTier, Partial<Record<LeaseKey, number>>>>
  return row[tier] ?? {}
}

function bandWord(band: string): string {
  return band.slice(0, 1).toUpperCase() + band.slice(1)
}

function contractLabel(tier: number): string {
  return CONTRACT_TIERS.find((row) => row.tier === tier)?.label ?? 'Published'
}

function bandNeeded(type: HubArchetype, tier: HubOfferTier): HubBand {
  if (type === 'cargo' && tier === 'hub') return CARGO_HUB_BAND
  return HUB_TIER_GATE[tier].minBand
}

function deskLabel(type: HubArchetype, tier: HubOfferTier): string {
  if (DESK_ASK[tier] === 'preferred') {
    return (KIOSK_ARCHETYPES as readonly string[]).includes(type) ? 'Preferred desk or kiosk' : 'Preferred desk'
  }
  return 'Dedicated desks'
}

function facilityLabel(type: HubArchetype, tier: HubOfferTier, key: LeaseKey, need: number): string {
  if (key === 'desk') return deskLabel(type, tier)
  const one = need === 1
  switch (key) {
    case 'lane':
      return one ? 'Fast-track lane' : 'Fast-track lanes'
    case 'overnight':
      return 'Overnight parking'
    case 'lounge':
      return one ? 'Branded lounge' : 'Branded lounges'
    case 'stand':
      return one ? 'Stand they can use' : 'Stands they can use'
    case 'pier':
      return one ? 'Pier stand' : 'Pier stands'
    case 'fuel':
      return one ? 'Fuel hook' : 'Fuel hooks'
    case 'hangar':
      return one ? 'Hangar bay' : 'Hangar bays'
    case 'ramp':
      return 'Dedicated ramp'
    case 'pad':
      return one ? 'Helipad' : 'Helipads'
    default:
      return key
  }
}

function haveFacility(world: HubFacilities, key: LeaseKey, tier: HubOfferTier): number {
  switch (key) {
    case 'desk':
      return DESK_ASK[tier] === 'dedicated'
        ? world.dedicatedDesks
        : world.preferredDesks + world.dedicatedDesks
    case 'lane':
      return world.dedicatedLanes
    case 'overnight':
      return world.overnight
    case 'lounge':
      return world.lounges
    case 'stand':
      return world.stands
    case 'pier':
      return world.pier
    case 'fuel':
      return world.fuel
    case 'hangar':
      return world.hangars
    case 'ramp':
      return world.ramp
    case 'pad':
      return world.pads
    default:
      return 0
  }
}

function countLine(
  id: string,
  label: string,
  have: number,
  need: number,
  waiting: boolean,
): ChecklistLine {
  if (waiting) return { id, label, detail: ALLOCATOR_WAIT, status: 'waiting' }
  return {
    id,
    label,
    detail: `${have} / ${need}`,
    status: have >= need ? 'ok' : 'missing',
  }
}

function relationLine(contractTier: number, minTier: number): ChecklistLine {
  const need = contractLabel(minTier)
  const ok = contractTier >= minTier
  return {
    id: 'relation',
    label: `${need} relationship`,
    detail: ok ? need : `${contractLabel(contractTier)} (need ${need})`,
    status: ok ? 'ok' : 'missing',
  }
}

function bandLine(have: HubBand, need: HubBand): ChecklistLine {
  const ok = BAND_RANK[have] >= BAND_RANK[need]
  const needName = bandWord(need)
  return {
    id: 'band',
    label: `${needName} standing or better`,
    detail: ok ? needName : `${bandWord(have)} (need ${needName})`,
    status: ok ? 'ok' : 'missing',
  }
}

function onTimeLine(rate: number, days: number, needRate: number, needDays: number): ChecklistLine {
  const safeRate = Number.isFinite(rate) ? Math.max(0, Math.min(1, rate)) : 0
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0
  const pct = Math.round(safeRate * 100)
  const needPct = Math.round(needRate * 100)
  const enoughDays = safeDays >= needDays
  const ok = enoughDays && safeRate >= needRate
  const sample = enoughDays ? '' : ` · ${safeDays} of ${needDays} days`
  return {
    id: 'onTime',
    label: `On-time ${pct}%`,
    detail: `need ${needPct}% over ${needDays} days${sample}`,
    status: ok ? 'ok' : 'missing',
  }
}

function connectionLine(type: HubArchetype, minutes: number | null): ChecklistLine {
  const label = type === 'cargo' ? 'Sort window' : 'Connection window'
  if (minutes == null || !Number.isFinite(minutes)) {
    return { id: 'connection', label, detail: `need ${CONNECTION_WINDOW_MIN} min`, status: 'missing' }
  }
  const ok = minutes <= CONNECTION_WINDOW_MIN
  return {
    id: 'connection',
    label,
    detail: `${minutes} min (need ${CONNECTION_WINDOW_MIN})`,
    status: ok ? 'ok' : 'missing',
  }
}

/** Same sentence diplomacy already uses when someone else holds the hub. */
export function primaryTakenSentence(name: string): string {
  return `${name} is already the Hub (one at a time).`
}

function primaryLines(airline: HubCarrier, world: HubFacilities): ChecklistLine[] {
  const blockers = airline.hubBlockers ?? []
  if (blockers.length > 0) {
    return blockers.map((text, index) => ({
      id: blockers.length === 1 ? 'primary' : `primary-${index}`,
      label: text,
      detail: text,
      status: 'missing' as const,
    }))
  }
  if (world.primaryHolderId && world.primaryHolderId !== airline.id) {
    const sentence = primaryTakenSentence(world.primaryHolderName ?? world.primaryHolderId)
    return [{ id: 'primary', label: sentence, detail: sentence, status: 'missing' }]
  }
  return [{ id: 'primary', label: 'One Primary hub', detail: 'The slot is open', status: 'ok' }]
}

function asksConnection(type: HubArchetype, tier: HubOfferTier): boolean {
  return (CONNECTION_AT[type] ?? []).includes(tier)
}

function perkFor(type: HubArchetype, tier: HubOfferTier): string | null {
  return PERK_AT[type].find((row) => row.tier === tier)?.text ?? null
}

function rewardsFor(type: HubArchetype, tier: HubOfferTier): readonly string[] {
  return ARCHETYPE_REWARDS[type]?.[tier] ?? TIER_REWARDS[tier]
}

function nextAskLabels(type: HubArchetype, tier: HubOfferTier): readonly string[] {
  const after = nextHubTier(type, tier)
  if (!after) return []
  const needs = leasesNeeded(type, after)
  const labels = LEASE_KEY_ORDER.filter((key) => (needs[key] ?? 0) > 0).map((key) =>
    facilityLabel(type, after, key, needs[key] ?? 0),
  )
  if (asksConnection(type, after)) labels.push(type === 'cargo' ? 'Sort window' : 'Connection window')
  return labels
}

function offerLines(airline: HubCarrier, world: HubFacilities, tier: HubOfferTier): ChecklistLine[] {
  const gate = HUB_TIER_GATE[tier]
  const lines: ChecklistLine[] = [relationLine(airline.contractTier, gate.minTier)]
  if (airline.diplomacyBand) lines.push(bandLine(airline.diplomacyBand, bandNeeded(airline.type, tier)))
  lines.push(onTimeLine(airline.onTimeRate, airline.onTimeDays, gate.onTime, gate.days))

  const needs = leasesNeeded(airline.type, tier)
  for (const key of LEASE_KEY_ORDER) {
    const need = needs[key] ?? 0
    if (need <= 0) continue
    const waiting = (key === 'desk' || key === 'lane') && !world.deskAllocator
    lines.push(countLine(key, facilityLabel(airline.type, tier, key, need), haveFacility(world, key, tier), need, waiting))
  }
  if (asksConnection(airline.type, tier)) lines.push(connectionLine(airline.type, world.connectionMin))
  if (tier === 'primary') lines.push(...primaryLines(airline, world))
  return lines
}

export function hubChecklist(airline: HubCarrier, world: HubFacilities): HubChecklist {
  if (!airline.signed) {
    const lines: ChecklistLine[] = [{ id: 'signed', label: 'Signed', detail: 'No contract yet', status: 'missing' }]
    return {
      airlineId: airline.id,
      current: 'station',
      next: null,
      lines,
      eligible: false,
      met: 0,
      total: lines.length,
      rewards: [],
      perk: null,
      nextAsk: [],
    }
  }

  const next = nextHubTier(airline.type, airline.tier)
  if (!next) {
    return {
      airlineId: airline.id,
      current: airline.tier,
      next: null,
      lines: [],
      eligible: false,
      met: 0,
      total: 0,
      rewards: [],
      perk: null,
      nextAsk: [],
    }
  }

  const lines = offerLines(airline, world, next)
  const met = lines.filter(lineMet).length
  return {
    airlineId: airline.id,
    current: airline.tier,
    next,
    lines,
    eligible: lines.length > 0 && met === lines.length,
    met,
    total: lines.length,
    rewards: rewardsFor(airline.type, next),
    perk: perkFor(airline.type, next),
    nextAsk: nextAskLabels(airline.type, next),
  }
}
