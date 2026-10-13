/**
 * The rival airport is another workstream. This module only talks to it through
 * this interface. When nothing is bound, a price war uses the internal fee band.
 */
export interface RivalAirport {
  id: string
  name: string
  /**
   * Advertised fees versus the catalog. 1 matches you.
   * Below 1 undercuts you. Non-finite values are ignored.
   */
  feeIndex(): number
}

let bound: RivalAirport | null = null

export function bindRivalAirport(rival: RivalAirport | null): void {
  bound = rival
}

export function boundRival(): RivalAirport | null {
  return bound
}

export function rivalFeeIndex(): number | null {
  if (!bound) return null
  const n = bound.feeIndex()
  return Number.isFinite(n) ? n : null
}

export function rivalName(): string {
  return bound?.name ?? ''
}
