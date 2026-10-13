/** Finite-number guards. Bad inputs collapse to a fallback so a NaN never reaches the sim. */

export function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function clamp(value: number, lo: number, hi: number): number {
  const a = finite(lo, 0)
  const b = finite(hi, a)
  const min = Math.min(a, b)
  const max = Math.max(a, b)
  if (value === Number.POSITIVE_INFINITY) return max
  if (value === Number.NEGATIVE_INFINITY) return min
  const v = finite(value, min)
  if (v < min) return min
  if (v > max) return max
  return v
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

/** Non-negative integer dollars. */
export function dollars(value: number): number {
  return Math.max(0, Math.round(finite(value, 0)))
}
