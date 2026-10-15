/**
 * Lounge, gate, and hangar leases. Pure. The sim names the building ids
 * and stores the rows. Desk and lane leases stay with the allocator.
 */
import { offerLadder } from './checklist.ts'
import {
  LEASE_NEED,
  LEASE_SCORE_CAP,
  SCORE_PER_LEASE,
  type HubArchetype,
  type HubOfferTier,
  type HubTier,
  type LeaseKey,
} from './config.ts'

export const FACILITY_LEASE_KINDS = ['lounge', 'gate', 'hangar'] as const

export type FacilityLeaseKind = (typeof FACILITY_LEASE_KINDS)[number]

export interface FacilityLease {
  id: string
  kind: FacilityLeaseKind
  airlineId: string
}

export function isFacilityLeaseKind(value: unknown): value is FacilityLeaseKind {
  return typeof value === 'string' && (FACILITY_LEASE_KINDS as readonly string[]).includes(value)
}

export function loungeLeaseId(c: number, r: number, index: number): string {
  return `lounge:${c},${r}:${index}`
}

export function gateLeaseId(c: number, r: number): string {
  return `stand:${c},${r}`
}

export function hangarLeaseId(c: number, r: number): string {
  return `hangar:${c},${r}`
}

/** Checklist key a lease of this kind fills. A gate is a pier stand. */
export function leaseAskKey(kind: FacilityLeaseKind): 'lounge' | 'pier' | 'hangar' {
  if (kind === 'gate') return 'pier'
  if (kind === 'hangar') return 'hangar'
  return 'lounge'
}

/** Daily relationship credit for this many live dedicated leases, already capped. */
export function leaseCredit(count: number): number {
  if (!(count > 0)) return 0
  const raw = Math.round(count * SCORE_PER_LEASE.dedicated * 1000) / 1000
  return Math.min(LEASE_SCORE_CAP, raw)
}

export function tierBelow(type: HubArchetype, tier: HubTier): HubTier {
  const ladder: HubTier[] = ['station', ...offerLadder(type)]
  const index = ladder.indexOf(tier)
  if (index <= 0) return 'station'
  return ladder[index - 1] ?? 'station'
}

function askAt(type: HubArchetype, tier: HubTier): Partial<Record<LeaseKey, number>> {
  if (tier === 'station') return {}
  const row = LEASE_NEED[type] as Partial<Record<HubOfferTier, Partial<Record<LeaseKey, number>>>>
  return row[tier] ?? {}
}

/** True when this release leaves the current tier short of the facility it names. */
export function releaseBreaksTier(
  type: HubArchetype,
  tier: HubTier,
  kind: FacilityLeaseKind,
  haveAfter: number,
): boolean {
  const need = askAt(type, tier)[leaseAskKey(kind)] ?? 0
  return need > 0 && haveAfter < need
}

/** Lounge, pier, and hangar asks on the stored tier are all met. */
export function facilityAskMet(
  type: HubArchetype,
  tier: HubTier,
  counts: { lounge: number; pier: number; hangar: number },
): boolean {
  const ask = askAt(type, tier)
  return (
    counts.lounge >= (ask.lounge ?? 0) &&
    counts.pier >= (ask.pier ?? 0) &&
    counts.hangar >= (ask.hangar ?? 0)
  )
}

export function dedicateLabel(kind: FacilityLeaseKind): string {
  if (kind === 'lounge') return 'Dedicate a lounge'
  if (kind === 'gate') return 'Dedicate a gate'
  return 'Dedicate a hangar bay'
}

export function dedicateBlock(kind: FacilityLeaseKind, built: number, free: number): string | null {
  if (built > 0 && free > 0) return null
  if (kind === 'lounge') return built > 0 ? 'Every lounge is already dedicated' : 'No lounge is built'
  if (kind === 'gate') return built > 0 ? 'Every gate is already dedicated' : 'No gate is built'
  return built > 0 ? 'Every hangar bay is already dedicated' : 'No hangar bay is built'
}

export function releaseLabel(kind: FacilityLeaseKind, id: string, total: number): string {
  const noun = kind === 'lounge' ? 'lounge' : kind === 'gate' ? 'gate' : 'hangar bay'
  if (total <= 1) return `Release the ${noun}`
  return `Release the ${noun} ${id.split(':').slice(1).join(' ')}`
}
