import * as THREE from 'three'
import { buildAircraft, createWindowMesh } from './build'
import { CrossfadeLOD, type LodBuckets } from './lod'
import type { PaintedMesh } from './pool'
import type { AircraftMotion } from './motion'
import { aircraftWorldPerMeter, getAircraftSpec, type Livery, type ModelSpec } from './specs'
import { aircraftSocketTable } from '../socketLayout'
import { mountSockets } from '../socketMount'

export {
  LOD_DIST,
  LOD_RESPONSE,
  lodWeights,
  cameraDistance,
  CrossfadeLOD,
  getAircraftQuality,
  setAircraftQuality,
  loadAircraftQuality,
  setAircraftNight,
  setAircraftLamp,
  aircraftIsNight,
  aircraftLamp,
} from './lod'
export type { AircraftQuality } from './lod'
export { disposeAircraftLibrary, libraryStats, releaseAircraft } from './pool'
export {
  AIRCRAFT_VISUAL_SCALE,
  CELL,
  METERS_PER_CELL,
  MODEL_SPECS,
  WING_GAP_M,
  WORLD_PER_METER,
  aircraftWorldPerMeter,
  getAircraftSpec,
} from './specs'
export type { Livery, ModelSpec } from './specs'
export { motionForPhase, MOTION_IDLE, MOTION_RUNNING } from './motion'
export type { AircraftMotion } from './motion'

const SKIP_MEASURE = new Set(['light', 'strobe', 'beacon'])

export interface AircraftSize {
  length: number
  span: number
  height: number
}

function expandMesh(box: THREE.Box3, mesh: THREE.Mesh) {
  if (SKIP_MEASURE.has(mesh.userData.kind as string)) return
  const inst = mesh as THREE.InstancedMesh
  if (inst.isInstancedMesh) {
    if (inst.boundingBox === null) inst.computeBoundingBox()
    _box.copy(inst.boundingBox!).applyMatrix4(mesh.matrixWorld)
    box.union(_box)
    return
  }
  const geo = mesh.geometry
  if (!geo) return
  if (geo.boundingBox === null) geo.computeBoundingBox()
  _box.copy(geo.boundingBox!).applyMatrix4(mesh.matrixWorld)
  box.union(_box)
}

const _box = new THREE.Box3()

function expandGroup(box: THREE.Box3, root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) expandMesh(box, mesh)
  })
}

/** World-unit size of the mid/high airframe, ignoring nav lamps. */
export function measureAircraft(root: THREE.Object3D): AircraftSize {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const mid = root.getObjectByName('lod-mid')
  const high = root.getObjectByName('lod-high')
  if (mid) expandGroup(box, mid)
  if (high) expandGroup(box, high)
  return {
    length: box.max.x - box.min.x,
    span: box.max.z - box.min.z,
    height: box.max.y - box.min.y,
  }
}

export function triangleCount(root: THREE.Object3D): number {
  let tris = 0
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const pos = mesh.geometry.getAttribute('position')
    if (!pos) return
    const base = mesh.geometry.index ? mesh.geometry.index.count / 3 : pos.count / 3
    const copies = (mesh as THREE.InstancedMesh).isInstancedMesh
      ? (mesh as THREE.InstancedMesh).count
      : 1
    tris += base * copies
  })
  return tris
}

export function drawCount(root: THREE.Object3D): number {
  let draws = 0
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) draws += 1
  })
  return draws
}

export function createAircraft(airframeId: string, livery: Livery): THREE.Group {
  const spec = getAircraftSpec(airframeId)
  const root = new THREE.Group()
  root.name = 'aircraft'
  root.userData.airframeId = spec.id
  root.userData.gearDown = true

  const lod = new CrossfadeLOD()
  lod.name = 'lod'
  lod.scale.setScalar(aircraftWorldPerMeter())

  const low = buildAircraft(spec, 'low', livery)
  const mid = buildAircraft(spec, 'mid', livery)
  const high = buildAircraft(spec, 'high', livery)
  low.group.name = 'lod-low'
  low.group.scale.setScalar(0.99)
  mid.group.name = 'lod-mid'
  high.group.name = 'lod-high'

  const buckets: LodBuckets = {
    lowGroup: low.group,
    midGroup: mid.group,
    highGroup: high.group,
    low: low.meshes,
    mid: mid.meshes,
    high: high.meshes,
    spinners: [...low.spinners, ...mid.spinners, ...high.spinners],
    gears: [...low.gears, ...mid.gears, ...high.gears],
    strobes: [...low.strobes, ...mid.strobes, ...high.strobes],
    beacons: [...low.beacons, ...mid.beacons, ...high.beacons],
    lamps: [...low.lamps, ...mid.lamps, ...high.lamps],
    rigs: [...mid.rigs, ...high.rigs],
  }
  lod.requestWindows = () => {
    const mesh = createWindowMesh(spec, livery)
    if (!mesh) return
    high.group.add(mesh)
    buckets.high.push(mesh as unknown as PaintedMesh)
  }
  lod.buckets = buckets
  lod.add(low.group)
  lod.add(mid.group)
  lod.add(high.group)
  mountSockets(lod, aircraftSocketTable(spec))
  // Renderer snaps the real mix on the first frame. Until then show the mid mesh.
  low.group.visible = false
  high.group.visible = false
  root.add(lod)
  return root
}

/**
 * Gear state read by the LOD on the next rendered frame.
 * `bridged` is true while a jet bridge is off its rotunda toward this airframe.
 * The fuselage then stays on opaque materials, so the bridge never shows through a fading skin.
 */
export function updateAircraft(root: THREE.Object3D, gearDown: boolean, motion?: AircraftMotion, bridged = false) {
  root.userData.gearDown = gearDown
  root.userData.bridged = bridged
  if (motion) root.userData.motion = motion
}

export function specOf(root: THREE.Object3D): ModelSpec {
  return getAircraftSpec(String(root.userData.airframeId ?? ''))
}
