/**
 * Public reputation. The sim score stays in 0–100. The HUD eases toward it
 * so a boarding wave cannot flash 100%, a miss, and a single digit in one frame.
 */
export const REPUTATION = {
  min: 0,
  max: 100,
  /** Points of queued passenger drift applied per sim second. */
  tickCap: 1.25,
  /** Display chase rate per sim second. 1 snaps, lower eases. */
  displayRate: 1.6,
} as const

export function clampReputation(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(REPUTATION.min, Math.min(REPUTATION.max, n))
}

/** Ease `shown` toward `actual`. Both ends are clamped. */
export function smoothReputation(shown: number, actual: number, dt: number): number {
  const target = clampReputation(actual)
  const from = Number.isFinite(shown) ? shown : target
  const t = Math.max(0, Math.min(1, REPUTATION.displayRate * Math.max(0, dt)))
  const next = from + (target - from) * t
  return Math.abs(next - target) < 0.05 ? target : next
}

/** Apply at most `tickCap * dt` of a queued passenger delta. Returns the leftover queue. */
export function takeReputationDrift(queued: number, dt: number): { apply: number; left: number } {
  if (!Number.isFinite(queued) || queued === 0) return { apply: 0, left: 0 }
  const cap = REPUTATION.tickCap * Math.max(0, dt)
  const apply = Math.max(-cap, Math.min(cap, queued))
  return { apply, left: queued - apply }
}
