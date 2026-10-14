/**
 * Real ground-vehicle sizes (metres) the buildings are laid out around.
 * Mirrors MODEL_SIZE in src/render/vehicleModels.ts on vehicle-visuals
 * (length, height, width); keep the two in sync.
 *
 * Model units → metres: a building model spans one CELL and is scaled by the
 * lot (`lotFrame().scale` across, `0.55 + 0.45 * scale` up), so the factors
 * differ per tile. `toM` / `fromM` do that conversion for service points.
 */
import { WORLD_PER_METER } from '../render/aircraft/specs'
import { lotSize } from './footprints'
import type { Tile } from '../game/types'
import type { VehicleKind } from './servicePoints'

export type FleetModel =
  | 'fuel_tanker' | 'hydrant_cart' | 'baggage_train' | 'belt_loader' | 'catering_hilift' | 'arff' | 'deice'
  | 'apron_bus' | 'coach' | 'box_truck' | 'van' | 'towbar_tug' | 'towbarless_tug' | 'k_loader'

/** [length, height, width] in metres. */
export const FLEET_M: Record<FleetModel, readonly [number, number, number]> = {
  fuel_tanker: [10, 3.2, 2.5],
  hydrant_cart: [6.2, 2.5, 2.4],
  baggage_train: [9.6, 1.9, 1.6],
  belt_loader: [7.6, 2.4, 2.1],
  catering_hilift: [8.6, 3.7, 2.5],
  arff: [12, 3.6, 3],
  deice: [9.2, 3.5, 2.5],
  apron_bus: [14, 3.1, 3],
  coach: [12.4, 3.6, 2.55],
  box_truck: [8.5, 3.4, 2.5],
  van: [6, 2.6, 2.1],
  towbar_tug: [6, 1.6, 2.5],
  towbarless_tug: [7.8, 1.7, 3.2],
  k_loader: [9, 2.5, 3.4],
}

/** Largest vehicle each service kind sends to a building bay. */
export const LARGEST: Record<VehicleKind, FleetModel> = {
  fuel: 'fuel_tanker',
  bags: 'baggage_train',
  catering: 'catering_hilift',
  fire: 'arff',
  deice: 'deice',
  termbus: 'apron_bus',
  citycargo: 'box_truck',
  coach: 'coach',
  tow: 'towbarless_tug',
}

/** Hangar design aircraft per tier: [span, tail height] m (A320, A350-900, A380). */
export const HANGAR_DESIGN: Record<'small' | 'wide' | 'jumbo', readonly [number, number]> = {
  small: [35.8, 11.8],
  wide: [64.8, 17.1],
  jumbo: [79.8, 24.1],
}

/** Bay clearance each side and door headroom, metres. */
export const SIDE_CLEAR_M = 1
export const HEAD_CLEAR_M = 1

/** Lot scale of a tile (hangars: small tier unless given). */
export function lotScale(tile: Tile | string, tier?: 'small' | 'wide' | 'jumbo'): number {
  const l = lotSize(tile as Tile, tier ?? null)
  return l ? Math.min(l.w, l.d) : 1
}
/** Metres per model unit, horizontal. */
export const mPerUnit = (scale: number) => scale / WORLD_PER_METER
/** Metres per model unit, vertical (lots are squashed vertically). */
export const mPerUnitY = (scale: number) => (0.55 + 0.45 * scale) / WORLD_PER_METER
/** Metres → model units across, for a lot scale. */
export const fromM = (m: number, scale: number) => m / mPerUnit(scale)
