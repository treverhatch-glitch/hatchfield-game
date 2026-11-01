import { finite } from './num.ts'
import { detCos, detLog } from '../game/detMath.ts'

/**
 * Mulberry32. Same seed, same stream. State is a plain uint32 so a save can
 * replay the passenger mix.
 */
export interface PaxRng {
  next(): number
  state(): number
}

const FALLBACK_SEED = 0x9e3779b9

export function sanitizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return FALLBACK_SEED
  return (seed >>> 0) || FALLBACK_SEED
}

export function createPaxRng(seed: number): PaxRng {
  let s = sanitizeSeed(seed)
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    return Number.isFinite(u) ? u : 0
  }
  return {
    next,
    state: () => s,
  }
}

/** Box–Muller. Two uniforms become one standard normal. Always consumes two draws. */
export function sampleStandardNormal(rng: PaxRng): number {
  const u1 = Math.max(finite(rng.next(), 0), 1e-12)
  const u2 = finite(rng.next(), 0)
  const z = Math.sqrt(-2 * detLog(u1)) * detCos(2 * Math.PI * u2)
  return Number.isFinite(z) ? z : 0
}
