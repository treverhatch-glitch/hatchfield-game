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

export { standAircraftGhost } from './stand'

export interface ModelOpts {
  hangarTier?: SizeTier
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
  return g
}
