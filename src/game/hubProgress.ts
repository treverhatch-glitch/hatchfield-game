/**
 * Turns a sim snapshot into the pure hub checklist. Rendering reads the result.
 * Desk and lane counts stay at zero until the allocator exports leases.
 */
import type { AirlineBizModel } from './types.ts'
import {
  BAND_RANK,
  emptyHubFacilities,
  hubChecklist,
  HUB_TIERS,
  type HubArchetype,
  type HubBand,
  type HubChecklist,
  type HubTier,
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
  pads: number
  connectionMin: number | null
  primaryHolderId: string | null
  primaryHolderName: string | null
}

export function isHubTier(value: unknown): value is HubTier {
  return typeof value === 'string' && (HUB_TIERS as readonly string[]).includes(value)
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

export function checklistFromFacts(facts: HubFieldFacts): { type: HubArchetype; checklist: HubChecklist } {
  const type = archetypeOf(facts)
  const turns = facts.onTime + facts.delay + facts.cancel
  const facilities = emptyHubFacilities()
  facilities.stands = Math.max(0, facts.stands)
  facilities.pads = Math.max(0, facts.pads)
  facilities.connectionMin = facts.connectionMin
  facilities.primaryHolderId = facts.primaryHolderId
  facilities.primaryHolderName = facts.primaryHolderName
  const checklist = hubChecklist(
    {
      id: facts.id,
      name: facts.name,
      type,
      signed: facts.signed,
      tier: isHubTier(facts.storedTier) ? facts.storedTier : 'station',
      contractTier: facts.contractTier,
      diplomacyBand: bandOf(facts.diplomacyBand),
      onTimeRate: turns > 0 ? facts.onTime / turns : 0,
      onTimeDays: Math.max(0, facts.keptDays),
      hubBlockers: facts.hubBlockers,
    },
    facilities,
  )
  return { type, checklist }
}
