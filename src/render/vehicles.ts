/**
 * Ground vehicles as one merged, vertex-coloured mesh each: chassis, cab with
 * glazing, load body (box, tank or bus shell), wheels, hi-vis band, roof beacon.
 * Geometry is cached per kind + colour and one material is shared, so a vehicle
 * still costs a single draw call.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { VEHICLE_LOOK } from './look'

export type VehicleShape = 'truck' | 'tanker' | 'bus' | 'tug'

/** Silhouette per vehicle kind. Unknown kinds read as a small van/truck. */
export function vehicleShape(kind: string): VehicleShape {
  if (kind === 'fuel' || kind === 'fuel_truck' || kind === 'deice') return 'tanker'
  if (kind === 'pax_bus' || kind === 'termbus' || kind === 'coach') return 'bus'
  if (kind === 'pushback_tug' || kind === 'baggage_tug' || kind === 'belt_loader' || kind === 'gpu') return 'tug'
  // Bag runs and city trucks carry their load on the roof line, so they keep a full-height body.
  return 'truck'
}

const geos = new Map<string, THREE.BufferGeometry>()
let material: THREE.MeshStandardMaterial | null = null

function sharedMaterial(): THREE.MeshStandardMaterial {
  material ??= new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: VEHICLE_LOOK.material.metalness,
    roughness: VEHICLE_LOOK.material.roughness,
  })
  return material
}

const _c = new THREE.Color()

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

/** Vehicle geometry in meters: +X forward, ground at y = 0, centred on the footprint. */
export function vehicleGeometry(kind: string, color: string, size: readonly [number, number, number]): THREE.BufferGeometry {
  const [L, H, W] = size
  const key = `${kind}|${color}|${L}|${H}|${W}`
  const hit = geos.get(key)
  if (hit) return hit
  const look = VEHICLE_LOOK
  const shape = vehicleShape(kind)
  const r = shape === 'tug' ? Math.min(look.wheelM * 0.75, H * 0.22) : look.wheelM
  const deck = r * 1.15
  const parts: THREE.BufferGeometry[] = []
  // Chassis rail under everything.
  parts.push(box(look.chassis, L * 0.96, r * 0.7, W * 0.9, 0, deck - r * 0.1, 0))
  // Wheels: two axles, a third on long rigs.
  const axles = L > 9 ? [0.36, -0.2, -0.36] : [0.33, -0.33]
  for (const k of axles) {
    for (const side of [1, -1]) {
      const z = side * (W / 2 - r * 0.32)
      parts.push(part(new THREE.CylinderGeometry(r, r, r * 0.62, 10), look.tyre, k * L, r, z, 'z'))
      parts.push(part(new THREE.CylinderGeometry(r * 0.48, r * 0.48, r * 0.66, 8), look.hub, k * L, r, z, 'z'))
    }
  }
  const top = H
  if (shape === 'bus') {
    const h = top - deck
    parts.push(box(color, L, h, W, 0, deck + h / 2, 0))
    // Window band on both sides and a deep windscreen.
    parts.push(box(look.glass, L * 0.86, h * 0.34, W * 1.02, -L * 0.03, deck + h * 0.62, 0))
    parts.push(box(look.glass, 0.08, h * 0.45, W * 0.86, L / 2 + 0.02, deck + h * 0.6, 0))
    parts.push(box(look.stripe, L * 1.004, h * 0.07, W * 1.01, 0, deck + h * 0.2, 0))
  } else if (shape === 'tug') {
    const h = Math.max(0.3, (top - deck) * 0.55)
    parts.push(box(color, L, h, W, 0, deck + h / 2, 0))
    // Open driver's cab at the front: roof on four posts, dark screen, beacon.
    const cabL = L * 0.3
    const cabH = top - deck - h
    parts.push(box(color, cabL, cabH * 0.12, W * 0.9, L / 2 - cabL / 2, top - cabH * 0.06, 0))
    for (const side of [1, -1]) {
      parts.push(box(look.chassis, 0.08, cabH, 0.08, L / 2 - cabL * 0.1, deck + h + cabH / 2, side * W * 0.4))
      parts.push(box(look.chassis, 0.08, cabH, 0.08, L / 2 - cabL * 0.9, deck + h + cabH / 2, side * W * 0.4))
    }
    parts.push(box(look.glass, 0.06, cabH * 0.7, W * 0.8, L / 2 - cabL * 0.08, deck + h + cabH * 0.45, 0))
    parts.push(box(look.beacon, 0.22, 0.14, 0.22, L / 2 - cabL / 2, top + 0.07, 0))
    parts.push(box(look.stripe, L * 1.004, Math.min(0.12, h * 0.25), W * 1.01, 0, deck + h * 0.35, 0))
  } else {
    // Cab forward, load body behind.
    const cabL = L * look.cabShare
    const cabH = (top - deck) * 0.82
    const cabX = L / 2 - cabL / 2
    parts.push(box(color, cabL, cabH, W * 0.96, cabX, deck + cabH / 2, 0))
    parts.push(box(look.glass, 0.08, cabH * 0.42, W * 0.82, L / 2 + 0.02, deck + cabH * 0.68, 0))
    parts.push(box(look.glass, cabL * 0.55, cabH * 0.36, W * 0.98, cabX + cabL * 0.12, deck + cabH * 0.68, 0))
    parts.push(box(look.beacon, 0.24, 0.16, 0.24, cabX, deck + cabH + 0.08, 0))
    const bodyL = L - cabL - 0.2
    const bodyX = -L / 2 + bodyL / 2
    if (shape === 'tanker') {
      const tr = Math.min(W / 2, (top - deck) / 2) * 0.96
      parts.push(part(new THREE.CylinderGeometry(tr, tr, bodyL, 14), color, bodyX, deck + tr, 0, 'x'))
      parts.push(box(look.stripe, bodyL * 0.98, 0.14, W * 0.98, bodyX, deck + tr * 0.55, 0))
    } else {
      const h = top - deck
      parts.push(box(color, bodyL, h, W, bodyX, deck + h / 2, 0))
      parts.push(box(look.stripe, bodyL * 1.004, 0.14, W * 1.01, bodyX, deck + h * 0.14, 0))
    }
  }
  const merged = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
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

export function vehicleLibrarySize(): number {
  return geos.size
}

export function disposeVehicleLibrary() {
  for (const g of geos.values()) g.dispose()
  geos.clear()
  material?.dispose()
  material = null
}
