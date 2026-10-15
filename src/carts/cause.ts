/**
 * Player-facing lines when a turn is held because no bag cart or catering
 * truck is free. The yard decides when that is true. This file only names it.
 */

export const BAG_CART_WAIT = 'Waiting on bag cart'
export const CATERING_CART_WAIT = 'Waiting on catering'

export function cartWaitLine(kind: 'bag' | 'catering'): string {
  return kind === 'bag' ? BAG_CART_WAIT : CATERING_CART_WAIT
}

/** Build-menu hint. Empty when the depot stamp is not in the catalog. */
export function cartDepotFix(stampName: string | null | undefined): string {
  const name = stampName?.trim()
  if (!name) return ''
  return `Build → ${name}`
}
