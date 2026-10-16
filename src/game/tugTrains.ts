/**
 * Cart trains from the bag room to the stand.
 * One tug takes up to its cap. A second free tug splits the rest.
 * Otherwise the same tug drives the leftover as another trip.
 */

/** Tugs that ship with one bag room. Not a buy screen. */
export const BAG_ROOM_TUGS = 2
/** Carts behind a standard tug. */
export const CARTS_PER_TUG = 4
/** Carts behind a heavy tug (widebody / large stand). */
export const CARTS_PER_HEAVY_TUG = 6
/** Bag units that fill one cart. The same type still varies with the load. */
export const BAG_UNITS_PER_CART = 22

export interface TugTrain {
  carts: number
  /** Trips this tug owes, including the one it is about to drive. */
  runs: number
}

export function heavyBagLoad(kind: string | undefined, standClass: string | undefined): boolean {
  return kind === 'widebody' || standClass === 'L'
}

/**
 * Split a load into trains.
 * `freeTugs` is how many tugs can take this flight right now (at least 1).
 */
export function planTugTrains(units: number, heavy: boolean, freeTugs: number): TugTrain[] {
  const cap = heavy ? CARTS_PER_HEAVY_TUG : CARTS_PER_TUG
  const cartsNeeded = Math.max(1, Math.ceil(Math.max(0, units) / BAG_UNITS_PER_CART))
  const slots = Math.max(1, Math.floor(freeTugs))
  if (cartsNeeded <= cap || slots < 2) {
    return [{ carts: Math.min(cap, cartsNeeded), runs: Math.ceil(cartsNeeded / cap) }]
  }
  const first = Math.min(cap, Math.ceil(cartsNeeded / 2))
  const second = Math.min(cap, cartsNeeded - first)
  return [
    { carts: first, runs: 1 },
    { carts: Math.max(1, second), runs: 1 },
  ]
}
