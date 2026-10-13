import type { BagFlowStage } from './types.ts'
import type { PaxTag } from './guests.ts'

/** Carrier mix used when a flight's bags are estimated, not rolled guest-by-guest. */
export type BagPersona =
  | 'budget'
  | 'business'
  | 'luxury'
  | 'cargo_night'
  | 'military_gov'

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

/**
 * Relative checked-bag load per guest type (aggregate units, not agents).
 * Budget light · premium heavy — drives handling time + claim pressure.
 */
export function bagUnitsForTag(tag: PaxTag): number {
  return tag === 'premium' ? 2.4 : tag === 'family' ? 1.7 : tag === 'business' ? 1.35 : 0.65
}

/**
 * Estimate flight bag units from carrier persona + pax count.
 * Used when we don't simulate every suitcase.
 */
export function estimateFlightBagUnits(persona: BagPersona, pax: number): number {
  if (!Number.isFinite(pax) || pax <= 0) return 0
  // Sample a mix matching rollPaxTag weights without rolling dozens of guests.
  const weights =
    persona === 'luxury'
      ? { premium: 0.5, business: 0.28, family: 0.14, budget: 0.08 }
      : persona === 'business'
        ? { premium: 0.2, business: 0.38, family: 0.24, budget: 0.18 }
        : persona === 'cargo_night' || persona === 'military_gov'
          ? { premium: 0.05, business: 0.15, family: 0.3, budget: 0.5 }
          : { premium: 0.07, business: 0.15, family: 0.28, budget: 0.5 }
  const perPax =
    weights.premium * bagUnitsForTag('premium') +
    weights.business * bagUnitsForTag('business') +
    weights.family * bagUnitsForTag('family') +
    weights.budget * bagUnitsForTag('budget')
  return Math.max(1, Math.round(pax * perPax * 0.55))
}

export type BagWorkKind = 'ramp' | 'sort' | 'deposit'

/** Seconds of visible load/unload/process work from bag units. */
export function bagWorkDuration(units: number, kind: BagWorkKind): number {
  const safeUnits = Number.isFinite(units) ? Math.max(0, units) : 0
  if (kind === 'deposit') return clamp(0.7 + safeUnits * 0.012, 0.7, 3.2)
  if (kind === 'sort') return clamp(1.1 + safeUnits * 0.018, 1.1, 4.5)
  return clamp(1.8 + safeUnits * 0.022, 1.8, 5.5)
}

/** HUD line for the current bag stage. Same wording the sim used inline. */
export function describeBagStage(
  stage: BagFlowStage | undefined,
  claimLane: number | null | undefined,
  bagsDeposited: number | undefined,
  bagUnits: number | undefined,
): string {
  const validLane = claimLane != null && Number.isFinite(claimLane) && claimLane > 0
  const lane = validLane ? ` · claim ${claimLane}` : ''
  const laneLabel = validLane ? String(claimLane) : '?'

  const depStr = bagsDeposited != null && Number.isFinite(bagsDeposited) && bagsDeposited >= 0 ? bagsDeposited : 0
  const unitsStr = bagUnits != null && Number.isFinite(bagUnits) && bagUnits >= 0 ? bagUnits : '?'

  switch (stage) {
    case 'pax_deposit':
      return `Bags: check-in deposit (${depStr}/${unitsStr})`
    case 'hold_screen':
      return 'Bags: screening hold bags'
    case 'outbound_sort':
      return 'Bags: sorting outbound'
    case 'load_aircraft':
      return 'Bags: loading aircraft'
    case 'inflight':
      return `Bags: on board${lane}`
    case 'unload_aircraft':
      return `Bags: unloading${lane}`
    case 'inbound_sort':
      return `Bags: processing → claim ${laneLabel}`
    case 'deliver_claim':
      return `Bags: delivering to claim ${laneLabel}`
    case 'on_claim':
      return `Bags: on claim ${laneLabel}`
    case 'complete':
      return 'Bags: complete'
    default:
      return lane ? `Bags${lane}` : ''
  }
}
