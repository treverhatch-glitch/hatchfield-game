import type { Tile } from './types'

/**
 * Physical placement tunables. Distances that are already runway clearance
 * live in catalog.ts (RUNWAY_CLEARANCE_SIDE / RUNWAY_CLEARANCE_END). One cell
 * is 22 m, so the end clearance is a 44 m RESA and the side clearance is the
 * runway strip.
 */

/** Buildings and other stamps that occupy a volume. A road or taxiway may not share their cells. */
export const SOLID_TILES: readonly Tile[] = [
  'terminal',
  'snack',
  'bags',
  'fuel',
  'fire',
  'police',
  'cargo',
  'guard',
  'tower',
  'hangar',
  'hotel',
  'park_s',
  'park_l',
  'park_g',
  'park_u',
  'bus',
  'curb_lane',
  'taxi_rank',
  'rail',
  'termbus',
  'kitchen',
  'depot',
  'mro',
  'nighthub',
  'oil',
  'manifold',
  'late_hotel',
  'late_rail',
  'saf',
  'helipad',
  'deice',
  'mover',
  'xferbus',
]

/**
 * Tall enough to hide a runway threshold from the tower cab.
 * Kiosks, booths, and pads stay out of the line-of-sight check.
 */
export const LOS_BLOCK_TILES: readonly Tile[] = [
  'terminal',
  'hangar',
  'hotel',
  'tower',
  'cargo',
  'mro',
  'nighthub',
  'late_hotel',
  'rail',
  'late_rail',
  'park_g',
  'park_u',
]

/** Short names for ghost text. Product names stay on the tool button. */
export const TILE_LABEL: Partial<Record<Tile, string>> = {
  terminal: 'terminal',
  snack: 'snack bar',
  bags: 'bag hall',
  fuel: 'fuel farm',
  fire: 'fire station',
  police: 'police post',
  cargo: 'cargo shed',
  guard: 'guard post',
  tower: 'tower',
  hangar: 'hangar',
  hotel: 'hotel',
  road: 'road',
  taxi: 'taxiway',
  runway: 'runway',
  stand: 'stand',
  park_s: 'car park',
  park_l: 'car park',
  park_g: 'car park',
  park_u: 'car park',
  bus: 'bus bay',
  curb_lane: 'curb lane',
  taxi_rank: 'taxi rank',
  rail: 'rail station',
  termbus: 'terminal bus depot',
  kitchen: 'catering kitchen',
  depot: 'vehicle depot',
  mro: 'MRO hangar',
  nighthub: 'night hub',
  oil: 'oil station',
  late_hotel: 'hotel',
  late_rail: 'rail station',
  saf: 'SAF plant',
  helipad: 'helipad',
  deice: 'de-ice pad',
  mover: 'people mover',
  xferbus: 'transfer bus depot',
  belt: 'bag belt',
}

export function tileLabel(tile: Tile): string {
  return TILE_LABEL[tile] ?? tile.replaceAll('_', ' ')
}
