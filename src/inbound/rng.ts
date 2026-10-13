/** Seeded mulberry32. The state lives on the save so a replay matches. */

export interface RngState {
  rngState: number
}

export function nextFloat(holder: RngState): number {
  holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0
  let t = holder.rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function rollInt(holder: RngState, min: number, maxInclusive: number): number {
  const span = maxInclusive - min + 1
  if (span <= 1) return min
  return min + Math.floor(nextFloat(holder) * span)
}

export function pickWeighted<T>(holder: RngState, items: readonly T[], weightOf: (item: T) => number): T | null {
  let sum = 0
  const weights = items.map((item) => {
    const w = Math.max(0, weightOf(item))
    sum += w
    return w
  })
  if (sum <= 0) return null
  let r = nextFloat(holder) * sum
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0 && weights[i] > 0) return items[i]
  }
  for (let i = items.length - 1; i >= 0; i--) if (weights[i] > 0) return items[i]
  return null
}
