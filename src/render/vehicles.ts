/**
 * Ground vehicles as low-poly meshes built in code. Each kind is one merged,
 * vertex-coloured geometry. A VehicleFleet draws every live copy of that
 * geometry with a single InstancedMesh.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { VEHICLE_LOOK } from './look'
import { artTexture } from './world/textureRegistry'

export type VehicleShape = 'truck' | 'tanker' | 'bus' | 'tug' | 'catering' | 'train'

/** Silhouette per vehicle kind. Unknown kinds read as a small van/truck. */
export function vehicleShape(kind: string): VehicleShape {
  if (kind === 'fuel' || kind === 'fuel_truck' || kind === 'deice') return 'tanker'
  if (kind === 'pax_bus' || kind === 'termbus') return 'bus'
  if (kind === 'catering_truck') return 'catering'
  if (kind === 'baggage_tug') return 'train'
  if (kind === 'pushback_tug' || kind === 'belt_loader' || kind === 'gpu') return 'tug'
  return 'truck'
}

const geos = new Map<string, THREE.BufferGeometry>()
let material: THREE.MeshLambertMaterial | null = null

/** Lambert, not standard: a physical shader on every truck cost frames on SwiftShader. */
function sharedMaterial(): THREE.MeshLambertMaterial {
  material ??= new THREE.MeshLambertMaterial({ vertexColors: true })
  return material
}

const _c = new THREE.Color()

/** Side-on planar UVs (one tile per UV_TILE_M metres) so the shared photo map has coordinates. */
const UV_TILE_M = 2.4
function planarUv(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + pos.getZ(i) * 0.5) / UV_TILE_M
    uv[i * 2 + 1] = pos.getY(i) / UV_TILE_M
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/** Truck-panel photo on every GSE body (Medium and up). It multiplies the vertex colours. */
export function setVehiclePhotos(on: boolean, anisotropy = 4) {
  const m = sharedMaterial()
  const map = on ? artTexture('truck_white_panel', anisotropy) : null
  if (m.map === map) return
  m.map = map
  m.needsUpdate = true
}

/** Colour a primitive and place it. `lay` turns a Y-axis cylinder onto the X (length) or Z (axle) axis. */
function part(geo: THREE.BufferGeometry, hex: string, x: number, y: number, z: number, lay?: 'x' | 'z'): THREE.BufferGeometry {
  if (lay === 'z') geo.rotateX(Math.PI / 2)
  else if (lay === 'x') geo.rotateZ(Math.PI / 2)
  geo.translate(x, y, z)
  const flat = geo.index ? geo.toNonIndexed() : geo
  if (flat !== geo) geo.dispose()
  flat.deleteAttribute('uv')
  const n = flat.getAttribute('position').count
  const colors = new Float32Array(n * 3)
  _c.set(hex)
  for (let i = 0; i < n; i++) {
    colors[i * 3] = _c.r
    colors[i * 3 + 1] = _c.g
    colors[i * 3 + 2] = _c.b
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return flat
}

function box(hex: string, w: number, h: number, d: number, x: number, y: number, z: number) {
  return part(new THREE.BoxGeometry(w, h, d), hex, x, y, z)
}

function addWheels(parts: THREE.BufferGeometry[], L: number, W: number, r: number, fracs: readonly number[]) {
  const look = VEHICLE_LOOK
  for (const k of fracs) {
    for (const side of [1, -1]) {
      const z = side * (W / 2 - r * 0.55)
      parts.push(part(new THREE.CylinderGeometry(r, r, r * 0.5, 8), look.tyre, k * L, r, z, 'z'))
      parts.push(part(new THREE.CylinderGeometry(r * 0.45, r * 0.45, r * 0.56, 6), look.hub, k * L, r, z, 'z'))
    }
  }
}

function cab(parts: THREE.BufferGeometry[], color: string, L: number, W: number, deck: number, top: number) {
  const look = VEHICLE_LOOK
  const cabL = L * look.cabShare
  const cabH = Math.max(0.4, (top - deck) * 0.78)
  const cabX = L / 2 - cabL / 2 - 0.02
  parts.push(box(color, cabL, cabH, W * 0.92, cabX, deck + cabH / 2, 0))
  parts.push(box(look.glass, 0.06, cabH * 0.38, W * 0.72, L / 2 - 0.02, deck + cabH * 0.66, 0))
  parts.push(box(look.glass, cabL * 0.48, cabH * 0.32, W * 0.96, cabX + cabL * 0.1, deck + cabH * 0.66, 0))
  parts.push(box(look.beacon, 0.18, 0.1, 0.18, cabX, deck + cabH + 0.05, 0))
  return { cabL, cabH, cabX, bodyL: L - cabL - 0.28, bodyX: -L / 2 + (L - cabL - 0.28) / 2 + 0.02 }
}

/** Vehicle geometry in meters: +X forward, ground at y = 0, centred on the footprint. */
export function vehicleGeometry(kind: string, color: string, size: readonly [number, number, number]): THREE.BufferGeometry {
  const [L, H, W] = size
  const key = `${kind}|${color}|${L}|${H}|${W}`
  const hit = geos.get(key)
  if (hit) return hit
  const look = VEHICLE_LOOK
  const shape = vehicleShape(kind)
  const r = shape === 'tug' || shape === 'train' ? Math.min(look.wheelM * 0.72, H * 0.22) : look.wheelM
  const deck = r * 1.15
  const parts: THREE.BufferGeometry[] = []
  parts.push(box(look.chassis, L * 0.98, r * 0.55, W * 0.82, 0, deck * 0.45, 0))

  if (shape === 'bus') {
    addWheels(parts, L, W, r, [0.34, -0.02, -0.36])
    const h = H - deck
    parts.push(box(color, L * 0.98, h, W * 0.98, 0, deck + h / 2, 0))
    parts.push(box(look.glass, L * 0.78, h * 0.32, W * 1.01, -L * 0.02, deck + h * 0.62, 0))
    parts.push(box(look.glass, 0.06, h * 0.42, W * 0.7, L / 2, deck + h * 0.58, 0))
    parts.push(box(look.chassis, 0.08, h * 0.55, W * 0.2, L * 0.28, deck + h * 0.4, W * 0.5))
    parts.push(box(look.stripe, L * 0.99, h * 0.06, W * 1.01, 0, deck + h * 0.22, 0))
  } else if (shape === 'tug') {
    addWheels(parts, L, W, r, kind === 'pushback_tug' ? [0.22, -0.28] : [0.28, -0.28])
    const h = Math.max(0.28, (H - deck) * (kind === 'pushback_tug' ? 0.42 : 0.5))
    parts.push(box(color, L * 0.72, h, W * 0.96, -L * 0.06, deck + h / 2, 0))
    const cabL = L * 0.28
    const cabH = Math.max(0.2, H - deck - h)
    const cabX = L / 2 - cabL / 2 - L * 0.04
    parts.push(box(color, cabL, cabH * 0.12, W * 0.84, cabX, H - cabH * 0.06, 0))
    parts.push(box(look.glass, 0.05, cabH * 0.55, W * 0.7, cabX + cabL * 0.35, deck + h + cabH * 0.4, 0))
    parts.push(box(look.beacon, 0.16, 0.1, 0.16, cabX, H + 0.04, 0))
    parts.push(box(look.stripe, L * 0.7, Math.min(0.1, h * 0.3), W * 1.01, -L * 0.06, deck + h * 0.35, 0))
    if (kind === 'pushback_tug') {
      parts.push(box(look.chassis, L * 0.22, 0.08, 0.08, L * 0.38, r * 0.9, 0))
    } else if (kind === 'belt_loader') {
      parts.push(box(look.chassis, L * 0.46, 0.08, W * 0.55, -L * 0.16, deck + h + 0.12, 0))
    } else {
      parts.push(box(look.hose, L * 0.18, H * 0.35, W * 0.55, -L * 0.28, deck + h * 0.7, 0))
    }
  } else if (shape === 'train') {
    // Tractor in front, two baggage carts behind, all inside the footprint.
    addWheels(parts, L, W, r, [0.4, 0.22, -0.08, -0.36])
    const tugL = L * 0.32
    const tugX = L / 2 - tugL / 2 - 0.04
    const h = Math.max(0.32, (H - deck) * 0.62)
    parts.push(box(color, tugL, h, W * 0.9, tugX, deck + h / 2, 0))
    parts.push(box(look.glass, 0.05, h * 0.4, W * 0.62, L / 2 - 0.06, deck + h * 0.62, 0))
    parts.push(box(look.beacon, 0.14, 0.08, 0.14, tugX, deck + h + 0.04, 0))
    const cartL = L * 0.26
    const cartH = Math.max(0.16, h * 0.28)
    for (const [i, bagColor] of [[0, look.bag], [1, '#2f4a6a']] as const) {
      const cx = L * 0.02 - i * (cartL + L * 0.06)
      parts.push(box(look.cart, cartL, cartH, W * 0.86, cx, deck + cartH / 2, 0))
      parts.push(box(bagColor, cartL * 0.7, H * 0.28, W * 0.55, cx, deck + cartH + H * 0.14, 0))
    }
  } else if (shape === 'tanker') {
    addWheels(parts, L, W, r, L > 9 ? [0.34, -0.08, -0.36] : [0.32, -0.32])
    const fitted = cab(parts, color, L, W, deck, H)
    const tr = Math.min(W * 0.42, (H - deck) * 0.42)
    parts.push(part(new THREE.CylinderGeometry(tr, tr, fitted.bodyL * 0.92, 10), color, fitted.bodyX, deck + tr, 0, 'x'))
    parts.push(box(look.stripe, fitted.bodyL * 0.9, 0.1, W * 0.9, fitted.bodyX, deck + tr * 0.35, 0))
    parts.push(part(new THREE.CylinderGeometry(tr * 0.28, tr * 0.28, tr * 0.2, 8), look.hose, fitted.bodyX - fitted.bodyL * 0.22, deck + tr * 1.7, 0))
    parts.push(box(look.hose, 0.22, tr * 0.7, 0.22, fitted.bodyX - fitted.bodyL * 0.46, deck + tr * 0.45, W * 0.28))
  } else if (shape === 'catering') {
    addWheels(parts, L, W, r, [0.32, -0.3])
    const fitted = cab(parts, color, L, W, deck, H * 0.82)
    const h = H - deck
    parts.push(box(color, fitted.bodyL, h, W * 0.96, fitted.bodyX, deck + h / 2, 0))
    parts.push(box(look.stripe, fitted.bodyL * 1.01, 0.1, W * 1.01, fitted.bodyX, deck + h * 0.18, 0))
    parts.push(box('#d5dbe3', fitted.bodyL * 0.22, 0.08, W * 0.7, fitted.bodyX - fitted.bodyL * 0.38, deck + h * 0.72, 0))
    parts.push(box(look.chassis, 0.08, h * 0.55, 0.08, fitted.bodyX - fitted.bodyL * 0.3, deck + h * 0.4, W * 0.42))
  } else {
    addWheels(parts, L, W, r, L > 9 ? [0.34, -0.08, -0.36] : [0.32, -0.32])
    const fitted = cab(parts, color, L, W, deck, H)
    const h = H - deck
    parts.push(box(color, fitted.bodyL, h, W * 0.98, fitted.bodyX, deck + h / 2, 0))
    parts.push(box(look.stripe, fitted.bodyL * 1.01, 0.12, W * 1.01, fitted.bodyX, deck + h * 0.16, 0))
  }

  const merged = mergeGeometries(parts)!
  planarUv(merged)
  for (const p of parts) p.dispose()
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  geos.set(key, merged)
  return merged
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
  planarUv(merged)
  for (const p of parts) p.dispose()
  merged.computeVertexNormals()
  geos.set(key, merged)
  return merged
}

/** One-draw vehicle mesh, scaled from meters to world units. Shared GPU data: never dispose it. */
export function vehicleMesh(kind: string, color: string, size: readonly [number, number, number], worldPerMeter: number): THREE.Mesh {
  const mesh = new THREE.Mesh(vehicleGeometry(kind, color, size), sharedMaterial())
  mesh.scale.setScalar(worldPerMeter)
  mesh.castShadow = true
  mesh.name = 'body'
  mesh.userData.shared = true
  return mesh
}

export interface VehicleInstance {
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
}

export class VehicleFleet {
  readonly root = new THREE.Group()
  private bodies = new Map<string, THREE.InstancedMesh>()
  private cargo = new Map<string, THREE.InstancedMesh>()
  private dummy = new THREE.Object3D()

  sync(list: readonly VehicleInstance[]) {
    const groups = new Map<string, VehicleInstance[]>()
    const loads = new Map<string, VehicleInstance[]>()
    for (const item of list) {
      const key = `${item.kind}|${item.color}|${item.size[0]}|${item.size[1]}|${item.size[2]}`
      const arr = groups.get(key) ?? []
      arr.push(item)
      groups.set(key, arr)
      if (item.cargo) {
        const ck = `${item.cargo}|${item.size[0]}|${item.size[1]}|${item.size[2]}`
        const bin = loads.get(ck) ?? []
        bin.push(item)
        loads.set(ck, bin)
      }
    }
    const seen = new Set<string>()
    for (const [key, items] of groups) {
      seen.add(key)
      this.write(this.bodies, key, items, (sample) => vehicleGeometry(sample.kind, sample.color, sample.size), false)
    }
    for (const [key, mesh] of this.bodies) {
      if (!seen.has(key)) mesh.count = 0
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
  }

  private write(
    bucket: Map<string, THREE.InstancedMesh>,
    key: string,
    items: VehicleInstance[],
    geometry: (sample: VehicleInstance) => THREE.BufferGeometry,
    asCargo: boolean,
  ) {
    let mesh = bucket.get(key)
    if (!mesh || mesh.instanceMatrix.count < items.length) {
      mesh?.removeFromParent()
      mesh?.dispose()
      mesh = new THREE.InstancedMesh(geometry(items[0]), sharedMaterial(), Math.max(8, items.length))
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.castShadow = true
      mesh.frustumCulled = false
      mesh.userData.shared = true
      mesh.name = asCargo ? `cargo:${key}` : `fleet:${key}`
      this.root.add(mesh)
      bucket.set(key, mesh)
    }
    items.forEach((item, i) => {
      const s = item.scale * (asCargo ? item.cargoScale ?? 1 : 1)
      this.dummy.position.set(item.x, item.y, item.z)
      this.dummy.rotation.set(0, item.yaw, 0)
      this.dummy.scale.setScalar(s)
      this.dummy.updateMatrix()
      mesh!.setMatrixAt(i, this.dummy.matrix)
    })
    mesh.count = items.length
    mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    for (const mesh of this.bodies.values()) mesh.dispose()
    for (const mesh of this.cargo.values()) mesh.dispose()
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
}
