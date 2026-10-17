/**
 * CC0 asset trial (experiment, branch asset-trial only). Off unless the URL has ?assetTrial=1.
 * Loads free engine-agnostic glTF models from /asset_trial/ and lets a capture rig swap them in
 * for our procedural meshes (same pose, same sun, same blob shadows) or drop them beside ours.
 * Nothing here runs in normal play.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { WORLD_PER_METER, aircraftWorldPerMeter } from './aircraft/specs'

export const ASSET_TRIAL =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('assetTrial') === '1'

type Spec = {
  file: string
  /** Real-world length (m) of the longest horizontal axis, used when no target size is given. */
  lengthM: number
  /** Yaw that turns the model's nose onto our +X forward axis. */
  yawFix: number
  aircraft?: boolean
}

export const TRIAL_SPECS: Record<string, Spec> = {
  airliner: { file: 'passenger-airplane.glb', lengthM: 38.2, yawFix: Math.PI / 2, aircraft: true },
  airliner_real: { file: 'narrow-body-airliner.glb', lengthM: 37.6, yawFix: 0, aircraft: true },
  turboprop: { file: 'cargo-plane.glb', lengthM: 29.7, yawFix: Math.PI / 2, aircraft: true },
  bus: { file: 'city-bus.glb', lengthM: 12.4, yawFix: Math.PI / 2 },
  warehouse: { file: 'warehouse.glb', lengthM: 44, yawFix: 0 },
  palm: { file: 'palm-tree.glb', lengthM: 5.2, yawFix: 0 },
  oak: { file: 'oak-tree.glb', lengthM: 9, yawFix: 0 },
  worker: { file: 'q-worker.glb', lengthM: 0, yawFix: 0 },
  casual: { file: 'q-casual.glb', lengthM: 0, yawFix: 0 },
  businessman: { file: 'q-businessman.glb', lengthM: 0, yawFix: 0 },
}

type Loaded = { root: THREE.Object3D; size: THREE.Vector3; tris: number; meshes: number; materials: number }

const hiddenFlights = new Set<string>()
const hiddenVehicles = new Set<string>()
const HIDE_LAYER = 31

export function trialHidesFlight(id: string): boolean {
  return hiddenFlights.size > 0 && hiddenFlights.has(id)
}

const extraVehicles: Record<string, unknown>[] = []

/** Trial-only: draw extra vehicles of our own kinds (e.g. an apron bus the starter map never spawns). */
export function trialAugmentVehicles<T>(frame: T[]) {
  for (const v of extraVehicles) frame.push(v as T)
}

export function trialFilterVehicles<T extends { id?: string }>(list: T[]): T[] {
  if (!hiddenVehicles.size) return list
  return list.filter((v) => !(v.id && hiddenVehicles.has(v.id)))
}

/** Our live jet meshes are re-posed every frame, so they are hidden by layer, not visibility (keeps the blob shadow). */
export function trialLayerJet(mesh: THREE.Object3D, id: string) {
  const hide = trialHidesFlight(id)
  if (!!mesh.userData.trialHidden === hide) return
  mesh.userData.trialHidden = hide
  mesh.traverse((o) => o.layers.set(hide ? HIDE_LAYER : 0))
}

export function installAssetTrial(scene: THREE.Scene) {
  if (!ASSET_TRIAL) return
  const group = new THREE.Group()
  group.name = 'asset-trial'
  scene.add(group)
  const loader = new GLTFLoader()
  const cache = new Map<string, Loaded>()
  const spawned: THREE.Object3D[] = []

  async function load(name: string): Promise<Loaded> {
    const hit = cache.get(name)
    if (hit) return hit
    const spec = TRIAL_SPECS[name]
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}asset_trial/${spec.file}`)
    const root = gltf.scene
    let tris = 0
    let meshes = 0
    const mats = new Set<THREE.Material>()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      meshes++
      m.castShadow = true
      m.receiveShadow = true
      const g = m.geometry
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mt)
    })
    root.rotation.y = spec.yawFix
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    // Re-centre on the footprint and drop to y=0 so poses line up with ours.
    const c = box.getCenter(new THREE.Vector3())
    const pivot = new THREE.Group()
    root.position.set(-c.x, -box.min.y, -c.z)
    pivot.add(root)
    const out = { root: pivot, size, tris, meshes, materials: mats.size }
    cache.set(name, out)
    return out
  }

  async function spawn(
    name: string,
    opts: { x: number; y?: number; z: number; yaw?: number; length?: number; height?: number; scale?: number },
  ) {
    const spec = TRIAL_SPECS[name]
    const l = await load(name)
    // SkeletonUtils keeps rigged characters bound to their own bones (plain clone() breaks skinning).
    const obj = skeletonClone(l.root)
    const horiz = Math.max(l.size.x, l.size.z)
    let s = opts.scale ?? 1
    if (opts.scale == null) {
      if (opts.length) s = opts.length / l.size.x
      else if (opts.height) s = opts.height / l.size.y
      else if (spec.lengthM) s = (spec.lengthM * (spec.aircraft ? aircraftWorldPerMeter() : WORLD_PER_METER)) / horiz
      else s = (1.75 * WORLD_PER_METER) / l.size.y
    }
    obj.scale.setScalar(s)
    obj.position.set(opts.x, opts.y ?? 0.04, opts.z)
    obj.rotation.y = opts.yaw ?? 0
    obj.name = `asset-trial-${name}`
    group.add(obj)
    spawned.push(obj)
    return { scale: s, size: l.size.clone().multiplyScalar(s).toArray() }
  }

  function clear() {
    for (const o of spawned) group.remove(o)
    spawned.length = 0
    hiddenFlights.clear()
    hiddenVehicles.clear()
  }

  async function stats() {
    const r: Record<string, unknown> = {}
    for (const n of Object.keys(TRIAL_SPECS)) {
      const l = await load(n)
      r[n] = { tris: l.tris, meshes: l.meshes, materials: l.materials, size: l.size.toArray().map((v) => +v.toFixed(2)) }
    }
    return r
  }

  ;(window as unknown as { __assetTrial: unknown }).__assetTrial = {
    group,
    load: (n: string) => load(n).then((l) => ({ tris: l.tris, meshes: l.meshes, size: l.size.toArray() })),
    spawn,
    clear,
    stats,
    hideFlight: (id: string) => hiddenFlights.add(id),
    hideVehicle: (id: string) => hiddenVehicles.add(id),
    addVehicle: (v: Record<string, unknown>) => extraVehicles.push(v),
    unhideAll: () => {
      hiddenFlights.clear()
      hiddenVehicles.clear()
    },
    setVisible: (v: boolean) => {
      group.visible = v
    },
  }
}
