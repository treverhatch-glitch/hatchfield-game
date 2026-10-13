import {
  MRO_RESEARCH_ID,
  MRO_TECH_IDS,
  NIGHT_HUB_RESEARCH_ID,
  NIGHT_HUB_TECH_IDS,
  TIER3_MIN_FIELD_LEVEL,
} from './config.ts'

export interface UnlockContext {
  fieldLevel: number
  unlockedTech: ReadonlySet<string>
  research: readonly string[]
}

export interface UnlockResult {
  ok: boolean
  why: string
}

function hasAny(tech: ReadonlySet<string>, ids: readonly string[]): boolean {
  return ids.some((id) => tech.has(id))
}

/**
 * Late gate. Field level 4 is the live T5 band. The economy tree's tier III
 * nodes (or the matching research desk projects) are the other half.
 * Early game fails both checks.
 */
export function mroUnlock(ctx: UnlockContext): UnlockResult {
  if (ctx.fieldLevel < TIER3_MIN_FIELD_LEVEL) {
    return { ok: false, why: `MRO hangar needs Field level ${TIER3_MIN_FIELD_LEVEL}.` }
  }
  if (ctx.research.includes(MRO_RESEARCH_ID) || hasAny(ctx.unlockedTech, MRO_TECH_IDS)) {
    return { ok: true, why: '' }
  }
  return { ok: false, why: 'Research Hangar MRO first.' }
}

export function nightHubUnlock(ctx: UnlockContext): UnlockResult {
  if (ctx.fieldLevel < TIER3_MIN_FIELD_LEVEL) {
    return { ok: false, why: `Cargo night hub needs Field level ${TIER3_MIN_FIELD_LEVEL}.` }
  }
  if (ctx.research.includes(NIGHT_HUB_RESEARCH_ID) || hasAny(ctx.unlockedTech, NIGHT_HUB_TECH_IDS)) {
    return { ok: true, why: '' }
  }
  return { ok: false, why: 'Research the cargo night hub first.' }
}
