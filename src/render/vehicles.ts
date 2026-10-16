/**
 * Ground vehicles as low-poly meshes built in code. Each kind is one merged,
 * vertex-coloured geometry. A VehicleFleet draws every live copy of that
 * geometry with a single InstancedMesh.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { VEHICLE_LOOK } from './look'
import { buildVehicleFarParts, buildVehicleParts, MODEL_SIZE, VEHICLE_LOD_M, vehicleModel, type VehicleModel } from './vehicleModels'
import { ANIM_PARTS, newPartPose, partMatrix, partPose, poseInput } from './vehicleAnim'
import { vehicleSocketTable } from './socketLayout'
import { mountSockets } from './socketMount'
import { applyVehicleSurface } from './vehicleSurface'

export { ANIM_PARTS, deployOf, partPose, poseInput, poseVehicleRig, serviceStateOf, truckDeploy, type PoseInput } from './vehicleAnim'
export { setVehicleSurfaceTime, setVehicleWear } from './vehicleSurface'
export { vehicleModel, MODEL_SIZE, MODEL_PARTS, ALL_MODELS, VEHICLE_LOD_M, LIVERY_CELL_ASPECT, type VehicleModel } from './vehicleModels'

const geos = new Map<string, THREE.BufferGeometry>()
let material: THREE.MeshLambertMaterial | null = null
let litMaterial: THREE.MeshBasicMaterial | null = null

/** Lambert, not standard: a physical shader on every truck cost frames on SwiftShader. */
function sharedMaterial(): THREE.MeshLambertMaterial {
  material ??= applyVehicleSurface(new THREE.MeshLambertMaterial({ vertexColors: true }))
  return material
}

/** Unlit vertex colours: head/tail lights, beacons and light bars read as glowing. */
function sharedLitMaterial(): THREE.MeshBasicMaterial {
  litMaterial ??= new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  return litMaterial
}

let beamMaterial: THREE.MeshBasicMaterial | null = null
/** Headlight cones: faint additive glow, no depth write so they never hide the apron. */
function sharedBeamMaterial(): THREE.MeshBasicMaterial {
  beamMaterial ??= new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  })
  return beamMaterial
}

/** Real model size in metres (length, height, width). */
export function vehicleSize(kind: string): readonly [number, number, number] {
  return MODEL_SIZE[vehicleModel(kind)]
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = parts.length ? mergeGeometries(parts)! : new THREE.BufferGeometry()
  if (parts.length) merged.computeVertexNormals()
  merged.computeBoundingSphere()
  return merged
}

function buildCached(kind: string, color: string) {
  const model = vehicleModel(kind)
  const key = `${model}|${color}`
  const hit = geos.get(key)
  if (hit) return { body: hit, lit: geos.get(key + '|lit')! }
  const parts = buildVehicleParts(model, color)
  const anim = new Set(ANIM_PARTS[model] ?? [])
  const shell = parts.filter((p) => !anim.has(p.name))
  const body = merge(shell.filter((p) => !p.lit).map((p) => p.geo))
  const lit = merge(shell.filter((p) => p.lit).map((p) => p.geo))
  for (const name of anim) {
    const mine = parts.filter((p) => p.name === name)
    geos.set(`${key}|part:${name}`, merge(mine.filter((p) => !p.lit).map((p) => p.geo)))
    geos.set(`${key}|part:${name}|lit`, merge(mine.filter((p) => p.lit).map((p) => p.geo)))
  }
  for (const p of parts) p.geo.dispose()
  geos.set(key, body)
  geos.set(key + '|lit', lit)
  return { body, lit }
}

/** Geometry of one animated part (Round B), cached beside the shell. Empty if the part has none. */
export function vehiclePartGeometry(kind: string, color: string, part: string, lit = false): THREE.BufferGeometry {
  const model = vehicleModel(kind)
  buildCached(kind, color)
  return geos.get(`${model}|${color}|part:${part}${lit ? '|lit' : ''}`) ?? EMPTY
}

const EMPTY = new THREE.BufferGeometry()

/**
 * Vehicle body geometry in metres: +X forward, ground at y = 0, centred on the footprint.
 * Cached per model + accent colour. `size` is accepted for older callers; the
 * model now carries its own real dimensions (see MODEL_SIZE).
 */
export function vehicleGeometry(kind: string, color: string, _size?: readonly [number, number, number]): THREE.BufferGeometry {
  return buildCached(kind, color).body
}

/** Emissive parts (lights, beacons, light bars) for the same model, drawn unlit. */
export function vehicleLitGeometry(kind: string, color: string): THREE.BufferGeometry {
  return buildCached(kind, color).lit
}

function buildFarCached(kind: string, color: string): THREE.BufferGeometry {
  const model = vehicleModel(kind)
  const key = `${model}|${color}|far`
  const hit = geos.get(key)
  if (hit) return hit
  const parts = buildVehicleFarParts(model, color)
  const body = merge(parts.map((p) => p.geo))
  for (const p of parts) p.geo.dispose()
  geos.set(key, body)
  return body
}

/** Cheap stand-in used past VEHICLE_LOD_M. Shared per model and colour, same as the close shell. */
export function vehicleFarGeometry(kind: string, color: string): THREE.BufferGeometry {
  return buildFarCached(kind, color)
}

/** True when this copy should draw the cheap shell. Distance is in metres. */
export function vehicleIsFar(item: { x: number; y: number; z: number; scale: number }, camera: { x: number; y: number; z: number }): boolean {
  const metres = Math.hypot(item.x - camera.x, item.y - camera.y, item.z - camera.z) / (item.scale || 1)
  return metres > VEHICLE_LOD_M
}

/**
 * Posable rig for Round B: a Group with a static `body` + `lights` shell and one
 * child per named moving part (see MODEL_PARTS). Not cached; dispose with disposeVehicleRig.
 */
export function vehicleRig(kind: string, color: string, worldPerMeter = 1): THREE.Group {
  const model = vehicleModel(kind)
  const parts = buildVehicleParts(model, color)
  const g = new THREE.Group()
  g.name = `rig:${model}`
  const buckets = new Map<string, { body: THREE.BufferGeometry[]; lit: THREE.BufferGeometry[] }>()
  for (const p of parts) {
    const b = buckets.get(p.name) ?? { body: [], lit: [] }
    ;(p.lit ? b.lit : b.body).push(p.geo)
    buckets.set(p.name, b)
  }
  for (const [name, b] of buckets) {
    const holder = name ? new THREE.Group() : g
    if (name) {
      holder.name = name
      g.add(holder)
    }
    if (b.body.length) {
      const m = new THREE.Mesh(merge(b.body), sharedMaterial())
      m.name = name ? `${name}:body` : 'body'
      m.castShadow = true
      holder.add(m)
    }
    if (b.lit.length) {
      const m = new THREE.Mesh(merge(b.lit), name === 'beam' ? sharedBeamMaterial() : sharedLitMaterial())
      m.name = name ? `${name}:lights` : 'lights'
      holder.add(m)
    }
  }
  for (const p of parts) p.geo.dispose()
  mountSockets(g, vehicleSocketTable(model))
  // Fuel tanker keeps the group names the hose animation looks up. Wheel axles
  // stay wheels_front / wheels_rear so they can spin and steer on their own;
  // hoseReel rides inside hose_reel so the coil and the payout share one spin.
  if (model === 'fuel_tanker') {
    const wheels = new THREE.Group()
    wheels.name = 'wheels'
    g.add(wheels)
    for (const child of [...g.children]) {
      if (child !== wheels && child.name.startsWith('wheels')) wheels.attach(child)
    }
    const reel = g.getObjectByName('hose_reel')
    if (reel && !reel.getObjectByName('hoseReel')) {
      const alias = new THREE.Group()
      alias.name = 'hoseReel'
      reel.add(alias)
    }
  }
  g.scale.setScalar(worldPerMeter)
  return g
}

export function disposeVehicleRig(rig: THREE.Object3D) {
  rig.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
}

const _c = new THREE.Color()

function box(hex: string, w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed()
  geo.deleteAttribute('uv')
  const n = geo.getAttribute('position').count
  const colors = new Float32Array(n * 3)
  _c.set(hex)
  for (let i = 0; i < n; i++) colors.set([_c.r, _c.g, _c.b], i * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function cargoGeometry(mode: 'crates' | 'suitcases', size: readonly [number, number, number]): THREE.BufferGeometry {
  const [L, H, W] = size
  const key = `cargo:${mode}|${L}|${H}|${W}`
  const hit = geos.get(key)
  if (hit) return hit
  const look = VEHICLE_LOOK
  const cabL = L * look.cabShare
  const bodyL = L - cabL - 0.28
  const bodyX = -L / 2 + bodyL / 2 + 0.02
  const parts: THREE.BufferGeometry[] = []
  if (mode === 'crates') {
    parts.push(box('#9a7a40', bodyL * 0.62, H * 0.32, W * 0.7, bodyX, H + H * 0.16, 0))
  } else {
    parts.push(box('#8a7348', bodyL * 0.4, H * 0.22, W * 0.55, bodyX, H + H * 0.1, 0))
    for (const [i, hex] of [[-1, '#ffb703'], [0, '#3ec6ff'], [1, '#ffb703']] as const) {
      parts.push(box(hex, 0.55, 0.4, 0.32, bodyX + i * 0.7, H + 0.28, 0))
    }
  }
  const merged = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
  merged.computeVertexNormals()
  geos.set(key, merged)
  return merged
}

/** One-draw vehicle mesh, scaled from meters to world units. Shared GPU data: never dispose it. */
export function vehicleMesh(kind: string, color: string, size: readonly [number, number, number], worldPerMeter: number): THREE.Mesh {
  void size
  const mesh = new THREE.Mesh(vehicleGeometry(kind, color), sharedMaterial())
  mesh.scale.setScalar(worldPerMeter)
  mesh.castShadow = true
  mesh.name = 'body'
  mesh.userData.shared = true
  return mesh
}

export interface VehicleInstance {
  /** Stable sim id, when the pose came from a truck or a service job. */
  id?: string
  kind: string
  color: string
  size: readonly [number, number, number]
  x: number
  y: number
  z: number
  yaw: number
  scale: number
  cargo?: 'crates' | 'suitcases'
  cargoScale?: number
  /** Round B: 0 stowed .. 1 deployed at the aircraft. */
  ext?: number
  /** Light bar / beacons running (ARFF call, etc.). */
  active?: boolean
  /** Sim clock in seconds for running parts (belts, turrets, flashing). */
  clock?: number
  /** Distance driven, metres: wheel spin. */
  odo?: number
  /** Backing onto a stand: reverse lights. */
  reversing?: boolean
  /** Front-wheel steer, radians. */
  steer?: number
  /** Headlight beams on (night / dusk, moving). */
  beams?: boolean
  /** Baggage-train carts. Omitted draws the two-cart train. */
  carts?: number
}

export class VehicleFleet {
  readonly root = new THREE.Group()
  private bodies = new Map<string, THREE.InstancedMesh>()
  private lights = new Map<string, THREE.InstancedMesh>()
  private cargo = new Map<string, THREE.InstancedMesh>()
  private parts = new Map<string, THREE.InstancedMesh>()
  private farBodies = new Map<string, THREE.InstancedMesh>()
  private dummy = new THREE.Object3D()
  private pose = newPartPose()
  private local = new THREE.Matrix4()
  private input = poseInput()

  sync(list: readonly VehicleInstance[], camera?: { x: number; y: number; z: number }) {
    const near: VehicleInstance[] = []
    const far: VehicleInstance[] = []
    for (const item of list) {
      if (camera && vehicleIsFar(item, camera)) far.push(item)
      else near.push(item)
    }
    const groups = new Map<string, VehicleInstance[]>()
    const loads = new Map<string, VehicleInstance[]>()
    for (const item of near) {
      const model = vehicleModel(item.kind)
      const key = `${model}|${item.color}`
      const arr = groups.get(key) ?? []
      arr.push(item)
      groups.set(key, arr)
      // Baggage trains and box trucks carry their load in the model now.
      if (item.cargo && model !== 'baggage_train' && model !== 'box_truck') {
        const ck = `${item.cargo}|${item.size[0]}|${item.size[1]}|${item.size[2]}`
        const bin = loads.get(ck) ?? []
        bin.push(item)
        loads.set(ck, bin)
      }
    }
    const seen = new Set<string>()
    for (const [key, items] of groups) {
      seen.add(key)
      this.write(this.bodies, key, items, (sample) => vehicleGeometry(sample.kind, sample.color), false)
      this.write(this.lights, key, items, (sample) => vehicleLitGeometry(sample.kind, sample.color), false, sharedLitMaterial())
    }
    const seenParts = new Set<string>()
    for (const [key, items] of groups) {
      const sample = items[0]
      const model = vehicleModel(sample.kind)
      for (const part of ANIM_PARTS[model] ?? []) {
        for (const lit of [false, true]) {
          const geo = vehiclePartGeometry(sample.kind, sample.color, part, lit)
          if (!geo.getAttribute('position')) continue
          const pk = `${key}|${part}${lit ? '|lit' : ''}`
          seenParts.add(pk)
          this.write(this.parts, pk, items, () => geo, false, lit ? (part === 'beam' ? sharedBeamMaterial() : sharedLitMaterial()) : sharedMaterial(), model, part)
        }
      }
    }
    for (const [key, mesh] of this.parts) {
      if (!seenParts.has(key)) mesh.count = 0
    }
    for (const bucket of [this.bodies, this.lights]) {
      for (const [key, mesh] of bucket) {
        if (!seen.has(key)) mesh.count = 0
      }
    }
    const seenCargo = new Set<string>()
    for (const [key, items] of loads) {
      seenCargo.add(key)
      const mode = key.startsWith('suitcases') ? 'suitcases' : 'crates'
      this.write(this.cargo, key, items, (sample) => cargoGeometry(mode, sample.size), true)
    }
    for (const [key, mesh] of this.cargo) {
      if (!seenCargo.has(key)) mesh.count = 0
    }
    const farGroups = new Map<string, VehicleInstance[]>()
    for (const item of far) {
      const key = `${vehicleModel(item.kind)}|${item.color}`
      const arr = farGroups.get(key) ?? []
      arr.push(item)
      farGroups.set(key, arr)
    }
    const seenFar = new Set<string>()
    for (const [key, items] of farGroups) {
      seenFar.add(key)
      this.write(this.farBodies, key, items, (sample) => vehicleFarGeometry(sample.kind, sample.color), false)
      const mesh = this.farBodies.get(key)
      if (mesh) {
        mesh.name = `far:${key}`
        mesh.castShadow = false
      }
    }
    for (const [key, mesh] of this.farBodies) {
      if (!seenFar.has(key)) mesh.count = 0
    }
  }

  private write(
    bucket: Map<string, THREE.InstancedMesh>,
    key: string,
    items: VehicleInstance[],
    geometry: (sample: VehicleInstance) => THREE.BufferGeometry,
    asCargo: boolean,
    mat: THREE.Material = sharedMaterial(),
    model?: VehicleModel,
    part?: string,
  ) {
    let mesh = bucket.get(key)
    if (!mesh || mesh.instanceMatrix.count < items.length) {
      mesh?.removeFromParent()
      mesh?.dispose()
      mesh = new THREE.InstancedMesh(geometry(items[0]), mat, Math.max(8, items.length))
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.castShadow = mat === sharedMaterial()
      mesh.frustumCulled = false
      mesh.userData.shared = true
      mesh.name = part ? `part:${key}` : asCargo ? `cargo:${key}` : mat === sharedMaterial() ? `fleet:${key}` : `lights:${key}`
      this.root.add(mesh)
      bucket.set(key, mesh)
    }
    items.forEach((item, i) => {
      const s = item.scale * (asCargo ? item.cargoScale ?? 1 : 1)
      this.dummy.position.set(item.x, item.y, item.z)
      this.dummy.rotation.set(0, item.yaw, 0)
      this.dummy.scale.setScalar(s)
      this.dummy.updateMatrix()
      const inp = this.input
      inp.ext = item.ext ?? 0
      inp.clock = item.clock ?? 0
      inp.active = item.active ?? false
      inp.odo = item.odo ?? 0
      inp.reversing = item.reversing ?? false
      inp.steer = item.steer ?? 0
      inp.beams = item.beams ?? false
      inp.carts = item.carts
      if (model && part && partPose(model, part, inp, this.pose)) {
        this.dummy.matrix.multiply(partMatrix(this.pose, this.local))
      }
      mesh!.setMatrixAt(i, this.dummy.matrix)
    })
    mesh.count = items.length
    mesh.instanceMatrix.needsUpdate = true
    if (part === 'belt') {
      let run = mesh.geometry.getAttribute('iRun') as THREE.InstancedBufferAttribute | undefined
      if (!run || run.count < mesh.instanceMatrix.count) {
        run = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count), 1)
        run.setUsage(THREE.DynamicDrawUsage)
        mesh.geometry.setAttribute('iRun', run)
      }
      items.forEach((item, i) => run!.setX(i, (item.ext ?? 0) >= 0.999 ? 1 : 0))
      run.needsUpdate = true
    }
  }

  dispose() {
    for (const mesh of this.bodies.values()) mesh.dispose()
    for (const mesh of this.cargo.values()) mesh.dispose()
    for (const mesh of this.lights.values()) mesh.dispose()
    for (const mesh of this.parts.values()) mesh.dispose()
    for (const mesh of this.farBodies.values()) mesh.dispose()
    this.parts.clear()
    this.farBodies.clear()
    this.lights.clear()
    this.bodies.clear()
    this.cargo.clear()
    this.root.clear()
  }
}

export function vehicleLibrarySize(): number {
  return geos.size
}

export function disposeVehicleLibrary() {
  for (const g of geos.values()) g.dispose()
  geos.clear()
  material?.dispose()
  material = null
  litMaterial?.dispose()
  litMaterial = null
}
