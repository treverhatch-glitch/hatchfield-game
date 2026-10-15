/**
 * Turns a sim snapshot into the pure hub checklist. Rendering reads the result.
 * Desk and lane counts come from the allocator's leases. The checklist
 * treats that export as present.
 */
import type { AirlineBizModel } from './types.ts'
import {
  BAND_RANK,
  emptyHubFacilities,
  hubChecklist,
  HUB_TIERS,
  isFacilityLeaseKind,
  isVehicleRole,
  offerChecklistLines,
  type ChecklistLine,
  type FacilityLease,
  type HubArchetype,
  type HubBand,
  type HubChecklist,
  type HubFacilities,
  type HubOfferTier,
  type HubTier,
  type VehicleLease,
  type VehicleRole,
} from '../hubprogress/index.ts'

export interface HubFieldFacts {
  id: string
  name: string
  signed: boolean
  rosterType: HubArchetype | null
  kind: 'pax' | 'cargo'
  bizModel: AirlineBizModel
  storedTier: unknown
  contractTier: number
  onTime: number
  delay: number
  cancel: number
  keptDays: number
  diplomacyBand?: string
  /** Pass undefined when diplomacy has no record. An empty list is a clear record. */
  hubBlockers?: readonly string[]
  stands: number
  /** Helipad tiles, used when no dedicated pad count is stored. */
  pads: number
  /** Dedicated counts. Desk and lane counts are the allocator's leases. */
  overnight: number
  dedicatedDesks: number
  /** Preferred desks. Dedicated desks also count toward a preferred ask. */
  preferredDesks: number
  dedicatedLanes: number
  lounges: number
  hangars: number
  fuel: number
  pier: number
  ramp: number
  /** When set, replaces the airport pad count. */
  dedicatedPads: number | null
  connectionMin: number | null
  primaryHolderId: string | null
  primaryHolderName: string | null
  /** Days already held at the stored tier. */
  daysAtTier: number
  vehicles: Partial<Record<VehicleRole, number>>
}

export function isHubTier(value: unknown): value is HubTier {
  return typeof value === 'string' && (HUB_TIERS as readonly string[]).includes(value)
}

export interface HubDedicatedCounts {
  overnight?: number
  lounges?: number
  hangars?: number
  fuel?: number
  pier?: number
  ramp?: number
  pads?: number
}

function whole(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined
}

export function readHubDedicated(raw: unknown): Record<string, HubDedicatedCounts> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, HubDedicatedCounts> = {}
  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!row || typeof row !== 'object') continue
    const src = row as Record<string, unknown>
    const counts: HubDedicatedCounts = {}
    for (const key of ['overnight', 'lounges', 'hangars', 'fuel', 'pier', 'ramp', 'pads'] as const) {
      const value = whole(src[key])
      if (value != null) counts[key] = value
    }
    if (Object.keys(counts).length) out[id] = counts
  }
  return out
}

const OFFER_TIERS = ['focus', 'base', 'hub', 'primary'] as const

export function readHubOffered(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string[]> = {}
  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(row)) continue
    const tiers = row.filter((tier): tier is string => typeof tier === 'string' && (OFFER_TIERS as readonly string[]).includes(tier))
    if (tiers.length) out[id] = tiers
  }
  return out
}

export function readHubLeases(raw: unknown): FacilityLease[] {
  if (!Array.isArray(raw)) return []
  const out: FacilityLease[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const src = row as Record<string, unknown>
    const id = typeof src.id === 'string' ? src.id : ''
    const airlineId = typeof src.airlineId === 'string' ? src.airlineId : ''
    if (!id || !airlineId || !isFacilityLeaseKind(src.kind) || seen.has(id)) continue
    seen.add(id)
    out.push({ id, airlineId, kind: src.kind })
  }
  return out
}

export function readHubLeaseWarnings(raw: unknown): Record<string, { tier: HubTier; untilDay: number }> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, { tier: HubTier; untilDay: number }> = {}
  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!row || typeof row !== 'object') continue
    const src = row as Record<string, unknown>
    const untilDay = src.untilDay
    if (!isHubTier(src.tier) || src.tier === 'station') continue
    if (typeof untilDay !== 'number' || !Number.isFinite(untilDay)) continue
    out[id] = { tier: src.tier, untilDay: Math.max(0, Math.floor(untilDay)) }
  }
  return out
}

export function readHubVehicleLeases(raw: unknown): VehicleLease[] {
  if (!Array.isArray(raw)) return []
  const out: VehicleLease[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const src = row as Record<string, unknown>
    const id = typeof src.id === 'string' ? src.id : ''
    const airlineId = typeof src.airlineId === 'string' ? src.airlineId : ''
    const type = typeof src.type === 'string' ? src.type : ''
    const primary = typeof src.primary === 'string' ? src.primary : '#888888'
    const secondary = typeof src.secondary === 'string' ? src.secondary : '#f0f0f0'
    if (!id || !airlineId || !type || !isVehicleRole(src.role) || seen.has(id)) continue
    seen.add(id)
    out.push({ id, airlineId, type, role: src.role, primary, secondary })
  }
  return out
}

export function readHubDayMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[id] = Math.floor(value)
  }
  return out
}

export function readHubTiers(raw: unknown): Record<string, HubTier> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, HubTier> = {}
  for (const [id, tier] of Object.entries(raw as Record<string, unknown>)) {
    if (isHubTier(tier)) out[id] = tier
  }
  return out
}

export function archetypeOf(facts: Pick<HubFieldFacts, 'rosterType' | 'kind' | 'bizModel'>): HubArchetype {
  if (facts.rosterType) return facts.rosterType
  if (facts.kind === 'cargo' || facts.bizModel === 'cargo') return 'cargo'
  if (facts.bizModel === 'lcc') return 'budget'
  if (facts.bizModel === 'charter') return 'charter'
  return 'flag'
}

function bandOf(value: string | undefined): HubBand | undefined {
  if (value && value in BAND_RANK) return value as HubBand
  return undefined
}

function wholeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function facilitiesFrom(facts: HubFieldFacts): HubFacilities {
  const facilities = emptyHubFacilities()
  facilities.deskAllocator = true
  facilities.stands = Math.max(0, facts.stands)
  facilities.pads = Math.max(0, facts.dedicatedPads ?? facts.pads)
  facilities.overnight = Math.max(0, facts.overnight)
  facilities.lounges = Math.max(0, facts.lounges)
  facilities.hangars = Math.max(0, facts.hangars)
  facilities.fuel = Math.max(0, facts.fuel)
  facilities.pier = Math.max(0, facts.pier)
  facilities.ramp = Math.max(0, facts.ramp)
  facilities.connectionMin = facts.connectionMin
  facilities.primaryHolderId = facts.primaryHolderId
  facilities.primaryHolderName = facts.primaryHolderName
  facilities.daysAtTier = Math.max(0, Math.floor(facts.daysAtTier))
  facilities.dedicatedDesks = wholeCount(facts.dedicatedDesks)
  facilities.preferredDesks = wholeCount(facts.preferredDesks)
  facilities.dedicatedLanes = wholeCount(facts.dedicatedLanes)
  facilities.vehicles = facts.vehicles
  return facilities
}

function carrierFrom(facts: HubFieldFacts, type: HubArchetype) {
  const turns = facts.onTime + facts.delay + facts.cancel
  return {
    id: facts.id,
    name: facts.name,
    type,
    signed: facts.signed,
    tier: isHubTier(facts.storedTier) ? facts.storedTier : ('station' as const),
    contractTier: facts.contractTier,
    diplomacyBand: bandOf(facts.diplomacyBand),
    onTimeRate: turns > 0 ? facts.onTime / turns : 0,
    onTimeDays: Math.max(0, facts.keptDays),
    hubBlockers: facts.hubBlockers,
  }
}

export function checklistFromFacts(facts: HubFieldFacts): { type: HubArchetype; checklist: HubChecklist } {
  const type = archetypeOf(facts)
  return { type, checklist: hubChecklist(carrierFrom(facts, type), facilitiesFrom(facts)) }
}

/** Lines for one warmth rung, including desk and lane counts from the allocator. */
export function linesForAsk(facts: HubFieldFacts, step: HubOfferTier): ChecklistLine[] {
  const type = archetypeOf(facts)
  return offerChecklistLines(carrierFrom(facts, type), facilitiesFrom(facts), step)
}
