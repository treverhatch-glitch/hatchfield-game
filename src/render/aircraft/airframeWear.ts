/**
 * Render-only airframe wear, 0 = factory fresh … 1 = tired budget hack.
 *
 * Deterministic: carrier tier and persona set the baseline, a hash of the flight (tail) id
 * nudges it a little so two jets of one carrier differ, and a service stamp resets it.
 * Nothing here feeds the sim, so timing, flights and tests are unchanged.
 *
 * The wear value picks one of WEAR_STEPS shared materials per airline (pool.ts), so there
 * is no per-plane texture work: the same surface-detail maps are scaled by a uniform-free
 * material parameter (roughness, clear coat, grime colour).
 */

/** Days of flying for a freshly serviced or repainted jet to creep back to its tier baseline. */
export const WEAR_RECOVER_DAYS = 6
/** Sim seconds per in-game day (fids/clock.ts). */
const SIM_DAY_SEC = 180
/** Material buckets per airline. 0, 0.1 … 1. */
export const WEAR_STEPS = 11

/** Baseline by carrier tier 0–5 (0 = smallest / budget start-up, 5 = mega flag carrier). */
const TIER_BASE = [0.85, 0.68, 0.5, 0.34, 0.18, 0.04]

const PERSONA_SHIFT: Record<string, number> = {
  budget: 0.12,
  business: -0.04,
  luxury: -0.12,
  cargo_night: 0.1,
  military_gov: 0.05,
}

function hash01(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10007) / 10007
}

export function tierBaseWear(tier: number | undefined, persona?: string): number {
  const t = Math.max(0, Math.min(5, Math.round(Number.isFinite(tier) ? (tier as number) : 2)))
  const base = TIER_BASE[t] + (persona ? (PERSONA_SHIFT[persona] ?? 0) : 0)
  return Math.max(0, Math.min(1, base))
}

/**
 * Wear for one aircraft.
 * `daysSinceService`: in-game days since its last maintenance or repaint; undefined = never
 * serviced here, so it sits at the baseline. Fresh service reads 0 and creeps back linearly.
 */
export function aircraftWear(input: {
  tier?: number
  persona?: string
  seed?: string
  daysSinceService?: number
}): number {
  const base = tierBaseWear(input.tier, input.persona)
  const jitter = input.seed ? (hash01(input.seed) - 0.5) * 0.16 : 0
  const ramp = input.daysSinceService === undefined || !Number.isFinite(input.daysSinceService)
    ? 1
    : Math.max(0, Math.min(1, input.daysSinceService / WEAR_RECOVER_DAYS))
  const wear = Math.max(0, Math.min(1, (base + (base > 0.02 ? jitter : 0)) * ramp))
  return quantizeWear(wear)
}

/** Snap to the shared material buckets. */
export function quantizeWear(w: number): number {
  const k = WEAR_STEPS - 1
  return Math.round(Math.max(0, Math.min(1, w)) * k) / k
}

/** Days since a service stamp in sim seconds (Flight.lastServicedClock). */
export function daysSince(clockNow: number, stamp: number | undefined): number | undefined {
  if (stamp === undefined || !Number.isFinite(stamp)) return undefined
  return Math.max(0, (clockNow - stamp) / SIM_DAY_SEC)
}

/**
 * Paint parameters for a wear level. Fresh: deep gloss and full clear coat.
 * Worn: rougher, chalkier (slightly lighter, desaturated) paint, thinner clear coat,
 * stronger grime in the detail map (soot behind engines, grubby door and hatch seams).
 */
export function wearLook(w: number): {
  roughnessAdd: number
  clearcoat: number
  clearcoatRoughness: number
  chalk: number
  grime: number
  normalScale: number
} {
  return {
    roughnessAdd: 0.26 * w,
    clearcoat: 0.6 * (1 - w) + 0.05,
    clearcoatRoughness: 0.12 + 0.4 * w,
    chalk: 0.1 * w,
    grime: w,
    normalScale: 0.38 + 0.22 * w,
  }
}
