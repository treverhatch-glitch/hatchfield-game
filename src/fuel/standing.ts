/**
 * Fuel-supplier standing and the spot index.
 * This meter is not airline diplomacy. A higher standing cuts the differential.
 * The index swings the spot price only.
 */
import { SPOT_OFFER } from './offerData.ts'

export const SUPPLIER_STANDING = {
  /** Dollars per litre for each block of standing. */
  stepPerLitre: 0.001,
  /** Standing points in one price step. */
  stepPoints: 20,
  /** Best differential. A good customer pays less. */
  floor: -0.004,
  /** Worst differential. A poor customer pays more. */
  cap: 0.006,
  /** Covered the promised band. */
  tookBand: 20,
  /** Paid the midnight shortfall. */
  paidShortfall: 10,
  /** Dropped a signed term. */
  brokeTerm: -40,
  /** Let a shortage card expire or declined it. */
  ignoredShortage: -20,
  /** Spot index, as a fraction of the rack price. Term prices do not use this. */
  indexSwing: 0.1,
} as const

export function standingBounds(): { min: number; max: number } {
  const { stepPerLitre, stepPoints, floor, cap } = SUPPLIER_STANDING
  return {
    min: Math.round((-cap / stepPerLitre) * stepPoints),
    max: Math.round((-floor / stepPerLitre) * stepPoints),
  }
}

export function clampStanding(standing: number): number {
  const { min, max } = standingBounds()
  if (!Number.isFinite(standing)) return 0
  return Math.min(max, Math.max(min, Math.round(standing)))
}

/** Signed standing lowers the price. The result stays inside the floor and the cap. */
export function standingDifferential(standing: number): number {
  const points = clampStanding(standing)
  const steps = Math.trunc(points / SUPPLIER_STANDING.stepPoints)
  if (steps === 0) return 0
  const raw = -steps * SUPPLIER_STANDING.stepPerLitre
  return Math.min(SUPPLIER_STANDING.cap, Math.max(SUPPLIER_STANDING.floor, raw))
}

function perLitre(n: number): number {
  return Math.round(Math.max(0.001, n) * 1000) / 1000
}

export function termPerLitre(base: number, standing: number): number {
  return perLitre(base + standingDifferential(standing))
}

export function spotPerLitre(base: number, index: number, standing: number): number {
  const swing = SUPPLIER_STANDING.indexSwing
  const clamped = Math.min(swing, Math.max(-swing, Number.isFinite(index) ? index : 0))
  return perLitre(base * (1 + clamped) + standingDifferential(standing))
}

/** Walk the index one step. Spot cards freeze the price they opened with. */
export function nextFuelIndex(index: number): number {
  const swing = SUPPLIER_STANDING.indexSwing
  const step = swing / 5
  const current = Number.isFinite(index) ? index : 0
  const next = current >= swing - 1e-9 ? -swing : current + step
  return Math.round(Math.min(swing, Math.max(-swing, next)) * 1000) / 1000
}

export function leadSupplier<T extends { id: string }>(
  standing: Readonly<Record<string, number>>,
  roster: readonly T[],
): T {
  let best = roster[0]!
  let score = standing[best.id] ?? 0
  for (const row of roster) {
    const next = standing[row.id] ?? 0
    if (next > score) {
      best = row
      score = next
    }
  }
  return best
}

export function rackSpotPerLitre(index: number, standing: number): number {
  return spotPerLitre(SPOT_OFFER.perLitre, index, standing)
}
