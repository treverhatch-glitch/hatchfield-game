/** Finite cash and counts. Never lets NaN into a ledger or a badge. */

export function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback
}

export function nonNegative(n: number, fallback = 0): number {
  const v = finite(n, fallback)
  return v > 0 ? v : 0
}

export function cash(n: number): number {
  const v = finite(n, 0)
  return Math.round(v)
}
