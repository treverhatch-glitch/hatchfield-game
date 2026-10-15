/**
 * Bag carts and catering trucks. Speeds and bay counts live here so the
 * engine does not grow its own magic numbers.
 */
export const CART_TUNING = {
  /**
   * Carts on the field before any depot is built.
   * Eight is the fleet that previously cleared a four-stand opening week
   * (the old two starter carts plus six depots). The prefab's two stands,
   * and two more with no depot, each have a cart. A ninth simultaneous load
   * waits, so growing stands without a depot is what strains the fleet.
   * See docs/playtest/cart_starter.md.
   */
  bagCarts: 8,
  /** Hi-lifts on the field before any depot is built. Two stands can load at once. */
  cateringTrucks: 2,
  /** Each vehicle depot adds this many bag carts. One depot covers another pair of stands. */
  bagCartsPerDepot: 2,
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
