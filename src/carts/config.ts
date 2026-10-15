/**
 * Bag carts and catering trucks. Speeds and bay counts live here so the
 * engine does not grow its own magic numbers.
 */
export const CART_TUNING = {
  /** Carts on the field before any depot is built. */
  bagCarts: 2,
  /** Hi-lifts on the field before any depot is built. */
  cateringTrucks: 1,
  /** Each vehicle depot adds this many of each. */
  bagCartsPerDepot: 1,
  cateringTrucksPerDepot: 1,
  /** Bays that can load or unload at once. Loader and door counts are per stand. */
  bays: {
    drop: 1,
    sort: 2,
    loader: 1,
    claim: 1,
    kitchen: 1,
    door: 1,
  },
  /** Metres per second along the socket path. */
  speedMps: 6,
  /** Seconds a cart spends locked to a socket while it loads or unloads. */
  dockSec: 6,
  /** Metres between carts waiting on a busy bay. */
  queueGapM: 8,
  /** Bag units one cart carries. */
  bagUnitsPerCart: 40,
  /** Galley loads one hi-lift carries. */
  cateringLoadsPerTruck: 4,
} as const

export type CartTuning = {
  bagCarts: number
  cateringTrucks: number
  bagCartsPerDepot: number
  cateringTrucksPerDepot: number
  bays: {
    drop: number
    sort: number
    loader: number
    claim: number
    kitchen: number
    door: number
  }
  speedMps: number
  dockSec: number
  queueGapM: number
  bagUnitsPerCart: number
  cateringLoadsPerTruck: number
}
