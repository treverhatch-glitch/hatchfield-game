/**
 * Owner decision #9: fuel outages ground flights. No silent top-up; the
 * player fixes it by ordering fuel / adding farm capacity.
 */
export interface FuelDemand {
  flightId: string
  litres: number
  departAt: number
}

export type FuelOutageEvent =
  | { type: 'flight_grounded'; time: number; flightId: string; needed: number; available: number }
  | { type: 'flight_released'; time: number; flightId: string }

export class FuelOutageMonitor {
  readonly grounded = new Set<string>()
  readonly events: FuelOutageEvent[] = []

  /**
   * Check pending departures in departure order against available farm litres.
   * Returns flights cleared to fuel this tick (litres reserved in order).
   */
  evaluate(now: number, availableLitres: number, demands: FuelDemand[]): string[] {
    let left = availableLitres
    const cleared: string[] = []
    for (const d of [...demands].sort((a, b) => a.departAt - b.departAt)) {
      if (left >= d.litres) {
        left -= d.litres
        cleared.push(d.flightId)
        if (this.grounded.delete(d.flightId)) this.events.push({ type: 'flight_released', time: now, flightId: d.flightId })
      } else if (!this.grounded.has(d.flightId)) {
        this.grounded.add(d.flightId)
        this.events.push({ type: 'flight_grounded', time: now, flightId: d.flightId, needed: d.litres, available: left })
      }
    }
    return cleared
  }

  isGrounded(flightId: string): boolean {
    return this.grounded.has(flightId)
  }
}

/** Negative and non-finite litre inputs count as none. */
function usableLitres(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

/**
 * Litres of flights that cannot be fuelled.
 * Same departure-order reservation as {@link FuelOutageMonitor.evaluate}:
 * earlier departures take a full load or none, and the remainder stays
 * available for a later flight that fits. shortLitres is the total litres
 * of flights that could not be cleared — never negative and never NaN.
 */
export function fuelShortfall(
  availableLitres: number,
  demands: FuelDemand[],
): { shortLitres: number; groundedIds: string[] } {
  let left = usableLitres(availableLitres)
  let shortLitres = 0
  const groundedIds: string[] = []
  for (const d of [...demands].sort((a, b) => a.departAt - b.departAt)) {
    const need = usableLitres(d.litres)
    if (left >= need) left -= need
    else {
      shortLitres += need
      groundedIds.push(d.flightId)
    }
  }
  return { shortLitres, groundedIds }
}
