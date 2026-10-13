import type { Bottleneck, ChainHealthInput, FailureEvent, FailureKind } from './types'

function severity(utilization: number, shortfall: number): Bottleneck['severity'] {
  if (shortfall > 0 || !Number.isFinite(utilization)) return 'blocked'
  if (utilization >= 0.9) return 'strained'
  return 'watch'
}

/**
 * Reports actual capacity pressure without tutorial suppression. A zero-capacity
 * demanded link is always the weakest link.
 */
export function analyzeChains(chains: readonly ChainHealthInput[]): Bottleneck[] {
  const result: Bottleneck[] = []
  for (const chain of chains) {
    const links = chain.links.map((link) => {
      const demand = Math.max(0, link.demand)
      const capacity = Math.max(0, link.capacity)
      const utilization = capacity === 0 ? (demand > 0 ? Infinity : 0) : demand / capacity
      return { link, utilization, shortfall: Math.max(0, demand - capacity) }
    })
    const weakest = links.reduce<(typeof links)[number] | null>(
      (current, candidate) => (!current || candidate.utilization > current.utilization ? candidate : current),
      null,
    )
    if (!weakest || weakest.utilization < 0.75) continue
    result.push({
      chain: chain.chain,
      linkId: weakest.link.id,
      label: weakest.link.label,
      utilization: weakest.utilization,
      shortfall: weakest.shortfall,
      severity: severity(weakest.utilization, weakest.shortfall),
      fixes: [...(weakest.link.fixHints ?? ['Build more capacity', 'Upgrade the building tier', 'Research an efficiency tech'])],
    })
  }
  return result.sort((left, right) => right.utilization - left.utilization)
}

const FAILURE_DEFAULTS: Readonly<Record<FailureKind, { delay: number; rating: number }>> = {
  fuel_outage: { delay: 0, rating: 0 },
  staff_shortage: { delay: 12, rating: 1 },
  power_brownout: { delay: 10, rating: 1 },
  storage_empty: { delay: 8, rating: 1 },
  equipment_failure: { delay: 18, rating: 2 },
  capacity_overload: { delay: 7, rating: 1 },
}

/**
 * Fuel is the sole hard grounding rule. Every other failure is represented as a
 * delay and rating hit so the host can apply it to flights and reputation.
 */
export function createFailure(
  kind: FailureKind,
  sourceId: string,
  chain: FailureEvent['chain'],
  message: string,
  overrides: Partial<Pick<FailureEvent, 'delayMinutes' | 'ratingHit'>> = {},
): FailureEvent {
  const defaults = FAILURE_DEFAULTS[kind]
  return {
    kind,
    sourceId,
    chain,
    grounded: kind === 'fuel_outage',
    delayMinutes: overrides.delayMinutes ?? defaults.delay,
    ratingHit: overrides.ratingHit ?? defaults.rating,
    message,
  }
}
