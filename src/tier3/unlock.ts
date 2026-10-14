import { MRO_RESEARCH_ID, NIGHT_HUB_RESEARCH_ID, TIER3_MIN_FIELD_LEVEL } from './config.ts'

export interface UnlockContext {
  fieldLevel: number
  unlockedTech: ReadonlySet<string>
  research: readonly string[]
}

export interface UnlockResult {
  ok: boolean
  why: string
}

/**
 * Late gate. Field level 4, then the one Growth-tree node (MRO bay / night bank).
 * Economy tech ids are not a second research wallet.
 */
export function mroUnlock(ctx: UnlockContext): UnlockResult {
  if (ctx.fieldLevel < TIER3_MIN_FIELD_LEVEL) {
    return { ok: false, why: `MRO hangar needs Field level ${TIER3_MIN_FIELD_LEVEL}.` }
  }
  if (ctx.research.includes(MRO_RESEARCH_ID)) return { ok: true, why: '' }
  return { ok: false, why: 'Research the MRO bay first.' }
}

export function nightHubUnlock(ctx: UnlockContext): UnlockResult {
  if (ctx.fieldLevel < TIER3_MIN_FIELD_LEVEL) {
    return { ok: false, why: `Cargo night hub needs Field level ${TIER3_MIN_FIELD_LEVEL}.` }
  }
  if (ctx.research.includes(NIGHT_HUB_RESEARCH_ID)) return { ok: true, why: '' }
  return { ok: false, why: 'Research the cargo night hub first.' }
}
