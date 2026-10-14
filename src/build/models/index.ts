/**
 * Building model registry. One procedural model per placeable type, keyed by
 * world tile (for map buildings) or progression id (commissioned capstones).
 * World#building and the build-menu thumbs both read from here, so ghosts,
 * construction stages and menu icons all show the same silhouette.
 */
import * as THREE from 'three'
import type { SizeTier } from '../../scale/types'
import { tiltTray } from './baggage'
import { atcApproach } from './control'
import { hydrant } from './fuel'
import { substation } from './power'
import { guard, police, remoteScreening } from './security'
import { depot, snack } from './services'
import { concourse, pierII, prefabII, prestigeLandmark, satellite, securityHall } from './terminal'
import { hotel } from './hotel'
import { parking } from './parking'
import { busDepot, railStation } from './transit'
import { helipad, mro, nightHub } from './aviation'
import { enrich, mergeStatic } from './detail'
import { dressYard } from './yard'
import { bagSortR5, busStationR5, cargoR5, cateringR5, checkinHallR5, deiceR5, fireStationR5, fuelFarmR5, hangarR5, towerR5 } from './r5'
import { fuelRail, oilTransfer, peopleMover, skywalk, travelator } from './links'
import type { HotelClass, ParkTerm } from '../../game/types'

export { standAircraftGhost } from './stand'

export interface ModelOpts {
  hangarTier?: SizeTier
  hotelClass?: HotelClass
  parkTerm?: ParkTerm
  /** Lot key: when set, the yard gets its deterministic instanced clutter. */
  yardSeed?: string
  /** Tests: keep every mesh separate (no static merge) so parts can be measured. */
  noMerge?: boolean
}

type Builder = (g: THREE.Group, o: ModelOpts) => void

export const MODEL_BUILDERS: Record<string, Builder> = {
  // Map tiles
  fuel: (g) => fuelFarmR5(g),
  fire: (g) => fireStationR5(g),
  police: (g) => police(g),
  cargo: (g) => cargoR5(g),
  guard: (g) => guard(g),
  tower: (g) => towerR5(g),
  hangar: (g, o) => hangarR5(g, o.hangarTier ?? 'small'),
  hangar_w: (g) => hangarR5(g, 'wide'),
  hangar_j: (g) => hangarR5(g, 'jumbo'),
  snack: (g) => snack(g),
  bags: (g) => bagSortR5(g),
  kitchen: (g) => cateringR5(g),
  depot: (g) => depot(g),
  // Commissioned capstones (menu icons)
  substation: (g) => substation(g),
  hydrant: (g) => hydrant(g),
  tilt_tray: (g) => tiltTray(g),
  fuel_farm_iii: (g) => fuelFarmR5(g, true),
  atc_approach: (g) => atcApproach(g),
  remote_screening: (g) => remoteScreening(g),
  // Terminal upgrades (menu icons)
  prefab_ii: (g) => prefabII(g),
  checkin_hall: (g) => checkinHallR5(g),
  security_hall: (g) => securityHall(g),
  concourse: (g) => concourse(g),
  pier_ii: (g) => pierII(g),
  satellite: (g) => satellite(g),
  prestige_landmark: (g) => prestigeLandmark(g),
  // Landside
  hotel: (g, o) => hotel(g, o.hotelClass ?? 'business'),
  hotel_inn: (g) => hotel(g, 'inn'),
  hotel_biz: (g) => hotel(g, 'business'),
  hotel_resort: (g) => hotel(g, 'resort'),
  park_s: (g, o) => parking(g, 'park_s', o.parkTerm),
  park_l: (g, o) => parking(g, 'park_l', o.parkTerm),
  park_g: (g, o) => parking(g, 'park_g', o.parkTerm),
  park_u: (g, o) => parking(g, 'park_u', o.parkTerm),
  bus: (g) => busStationR5(g),
  rail: (g) => railStation(g),
  termbus: (g) => busDepot(g, false),
  xferbus: (g) => busDepot(g, true),
  // Airside support
  helipad: (g) => helipad(g),
  deice: (g) => deiceR5(g),
  mro: (g) => mro(g),
  nighthub: (g) => nightHub(g),
  // Links
  fuel_rail: (g) => fuelRail(g),
  oil: (g) => oilTransfer(g),
  travelator: (g) => travelator(g),
  skywalk: (g) => skywalk(g),
  mover: (g) => peopleMover(g),
}

export function hasModel(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(MODEL_BUILDERS, id)
}

/** Build the model for an id, or null when this registry does not own it. */
export function buildModel(id: string, opts: ModelOpts = {}): THREE.Group | null {
  const fn = hasModel(id) ? MODEL_BUILDERS[id] : undefined
  if (!fn) return null
  const g = new THREE.Group()
  g.name = `model:${id}`
  fn(g, opts)
  enrich(g, id)
  if (opts.yardSeed !== undefined) dressYard(g, id, opts.yardSeed)
  if (!opts.noMerge) mergeStatic(g)
  return g
}
