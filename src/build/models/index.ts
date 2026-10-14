/**
 * Building model registry. One procedural model per placeable type, keyed by
 * world tile (for map buildings) or progression id (commissioned capstones).
 * World#building and the build-menu thumbs both read from here, so ghosts,
 * construction stages and menu icons all show the same silhouette.
 */
import * as THREE from 'three'
import type { SizeTier } from '../../scale/types'
import { bagSort, tiltTray } from './baggage'
import { cargo } from './cargo'
import { atcApproach, tower } from './control'
import { fuelFarm, hydrant } from './fuel'
import { hangar } from './hangar'
import { substation } from './power'
import { guard, police, remoteScreening } from './security'
import { depot, fireStation, kitchen, snack } from './services'
import { checkinHall, concourse, pierII, prefabII, prestigeLandmark, satellite, securityHall } from './terminal'
import { hotel } from './hotel'
import { parking } from './parking'
import { busCurb, busDepot, railStation } from './transit'
import { deicePad, helipad, mro, nightHub } from './aviation'
import { enrich, mergeStatic } from './detail'
import { fuelRail, oilTransfer, peopleMover, skywalk, travelator } from './links'
import type { HotelClass, ParkTerm } from '../../game/types'

export { standAircraftGhost } from './stand'

export interface ModelOpts {
  hangarTier?: SizeTier
  hotelClass?: HotelClass
  parkTerm?: ParkTerm
}

type Builder = (g: THREE.Group, o: ModelOpts) => void

export const MODEL_BUILDERS: Record<string, Builder> = {
  // Map tiles
  fuel: (g) => fuelFarm(g, false),
  fire: (g) => fireStation(g),
  police: (g) => police(g),
  cargo: (g) => cargo(g),
  guard: (g) => guard(g),
  tower: (g) => tower(g),
  hangar: (g, o) => hangar(g, o.hangarTier ?? 'small'),
  hangar_w: (g) => hangar(g, 'wide'),
  hangar_j: (g) => hangar(g, 'jumbo'),
  snack: (g) => snack(g),
  bags: (g) => bagSort(g),
  kitchen: (g) => kitchen(g),
  depot: (g) => depot(g),
  // Commissioned capstones (menu icons)
  substation: (g) => substation(g),
  hydrant: (g) => hydrant(g),
  tilt_tray: (g) => tiltTray(g),
  fuel_farm_iii: (g) => fuelFarm(g, true),
  atc_approach: (g) => atcApproach(g),
  remote_screening: (g) => remoteScreening(g),
  // Terminal upgrades (menu icons)
  prefab_ii: (g) => prefabII(g),
  checkin_hall: (g) => checkinHall(g),
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
  bus: (g) => busCurb(g),
  rail: (g) => railStation(g),
  termbus: (g) => busDepot(g, false),
  xferbus: (g) => busDepot(g, true),
  // Airside support
  helipad: (g) => helipad(g),
  deice: (g) => deicePad(g),
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
  mergeStatic(g)
  return g
}
