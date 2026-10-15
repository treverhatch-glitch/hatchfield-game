import type { ResearchId } from '../game/types.ts'
import { RUNG_LABEL, rungStepCost } from './catalog.ts'
import type { StandRung, StandSize } from './types.ts'

/** First reason the next surface cannot be bought. Null when the pour is legal. */
export function rungRefusal(
  size: StandSize,
  rung: StandRung,
  fieldLevel: number,
  research: ReadonlySet<ResearchId | string>,
): string | null {
  if (rung >= 2) return 'This stand is already on the top surface.'
  const next = rung + 1
  if (size === 'light' && next === 2 && fieldLevel < 3) return 'Finished concrete needs Field level 3.'
  if (size === 'narrow' && next === 2 && fieldLevel < 3) return 'Reinforced concrete needs Field level 3.'
  if (size === 'heavy' && next === 1) {
    if (fieldLevel < 4) return 'Widebody slab needs Field level 4.'
    if (!research.has('widebody_ops')) return 'Research widebody ops first.'
  }
  if (size === 'heavy' && next === 2) {
    if (fieldLevel < 5) return 'Heavy slab needs Field level 5.'
    if (!research.has('heavy_pack')) return 'Research the heavy pack first.'
  }
  return null
}

export function upgradeLabel(size: StandSize, rung: StandRung, cash: number, refusal: string | null): {
  label: string
  disabled: boolean
} {
  if (refusal) return { label: refusal, disabled: true }
  const next = (rung + 1) as StandRung
  const cost = rungStepCost(size, next)
  if (cash < cost) return { label: `Need $${cost.toLocaleString('en-US')}.`, disabled: true }
  return { label: `${RUNG_LABEL[size][next]} · $${cost.toLocaleString('en-US')}`, disabled: false }
}
