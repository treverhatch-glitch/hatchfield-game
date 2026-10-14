import { afterAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  ALL_MODELS,
  disposeVehicleLibrary,
  disposeVehicleRig,
  MODEL_PARTS,
  MODEL_SIZE,
  poseVehicleRig,
  VEHICLE_LOD_M,
  LIVERY_CELL_ASPECT,
  VehicleFleet,
  vehicleFarGeometry,
  vehicleGeometry,
  vehicleLibrarySize,
  vehicleLitGeometry,
  vehicleMesh,
  vehicleModel,
  vehiclePartGeometry,
  vehicleRig,
  ANIM_PARTS,
} from './vehicles'

afterAll(() => disposeVehicleLibrary())

const PLACARD_KINDS = [
  'fuel_truck', 'catering_truck', 'belt_loader', 'pushback_tug', 'pax_bus',
  'lav', 'water', 'gpu', 'stairs', 'cart', 'bags', 'dolly', 'cargo', 'deice', 'fire', 'police', 'delivery',
] as const

const SIM_KINDS = [
  'lav', 'water',
  'fuel', 'fuel_truck', 'bags', 'baggage_tug', 'belt_loader', 'catering', 'catering_truck', 'fire', 'deice',
  'termbus', 'pax_bus', 'coach', 'citycargo', 'tow', 'pushback_tug', 'gpu', 'stairs', 'cart', 'cargo', 'uld_loader',
]

describe('ground vehicle models', () => {
  it('maps every sim kind to its own builder', () => {
    expect(vehicleModel('fuel_truck')).toBe('fuel_tanker')
    expect(vehicleModel('pax_bus')).toBe('apron_bus')
    expect(vehicleModel('termbus')).toBe('apron_bus')
    expect(vehicleModel('fire')).toBe('arff')
    expect(vehicleModel('pushback_tug')).toBe('towbarless_tug')
    expect(vehicleModel('tow')).toBe('towbar_tug')
    expect(vehicleModel('cargo')).toBe('k_loader')
    expect(vehicleModel('citycargo')).toBe('box_truck')
    expect(vehicleModel('police')).toBe('police')
    expect(vehicleModel('delivery')).toBe('van')
    expect(vehicleModel('mystery')).toBe('van')
    const models = new Set(SIM_KINDS.map(vehicleModel))
    expect(models.size).toBeGreaterThanOrEqual(15)
  })

  it.each(ALL_MODELS)('%s builds at its real size with lights and named parts', (model) => {
    const [L, H, W] = MODEL_SIZE[model]
    const geo = vehicleGeometry(model === 'van' ? 'delivery' : kindFor(model), '#3a7bd5')
    geo.computeBoundingBox()
    const span = new THREE.Vector3()
    geo.boundingBox!.getSize(span)
    expect(span.x).toBeGreaterThan(L * 0.9)
    expect(span.x).toBeLessThan(L * 1.15)
    expect(span.z).toBeLessThan(W * 1.4)
    expect(geo.boundingBox!.min.y).toBeGreaterThanOrEqual(-1e-6)
    expect(geo.boundingBox!.max.y).toBeLessThan(H + 0.6)
    expect(fullCount(model)).toBeGreaterThan(300)
    const rig = vehicleRig(kindFor(model), '#3a7bd5')
    for (const name of MODEL_PARTS[model]) expect(rig.getObjectByName(name), `${model}.${name}`).toBeDefined()
    expect(rig.getObjectByName('body')).toBeDefined()
    disposeVehicleRig(rig)
    if (model !== 'uld_dolly' && model !== 'baggage_cart') {
      expect(vehicleLitGeometry(kindFor(model), '#3a7bd5').getAttribute('position').count).toBeGreaterThan(0)
    }
  })

  it('distinct models do not share a silhouette', () => {
    const counts = new Set(ALL_MODELS.map((m) => fullCount(m, '#fff')))
    expect(counts.size).toBeGreaterThan(ALL_MODELS.length - 3)
  })

  it('names the fuel tanker cab, tank, hose reel and wheels for the hose animation', () => {
    const rig = vehicleRig('fuel', '#c9a227')
    for (const name of ['cab', 'tank', 'hoseReel', 'wheels']) expect(rig.getObjectByName(name), name).toBeTruthy()
    const reel = rig.getObjectByName('hose_reel')!
    expect(reel.getObjectByName('hoseReel')?.parent).toBe(reel)
    expect(rig.getObjectByName('wheels_front')?.parent?.name).toBe('wheels')
    expect(rig.getObjectByName('wheels_rear_2')?.parent?.name).toBe('wheels')
    poseVehicleRig(rig, 'fuel_tanker', 1, 0, false, 3)
    const spun = reel.matrix.elements.some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-3)
    expect(spun).toBe(true)
    const alias = reel.getObjectByName('hoseReel')!
    expect(alias.matrix.elements[0]).toBeCloseTo(1)
    expect(alias.matrix.elements[5]).toBeCloseTo(1)
    const front = rig.getObjectByName('wheels_front')!
    expect(front.matrix.elements.some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-3)).toBe(true)
    disposeVehicleRig(rig)
  })

  it('reads placard text left to right from the outside of both sides', () => {
    for (const kind of PLACARD_KINDS) {
      const model = vehicleModel(kind)
      const geos = [vehicleGeometry(kind, '#3a7bd5')]
      for (const part of MODEL_PARTS[model]) geos.push(vehiclePartGeometry(kind, '#3a7bd5', part))
      let sides = 0
      for (const geo of geos) sides += placardSides(geo)
      expect(sides, kind).toBe(2)
    }
  })

  it('scales each placard to the livery cell so the brand is not cropped', () => {
    for (const kind of PLACARD_KINDS) {
      const model = vehicleModel(kind)
      const geos = [vehicleGeometry(kind, '#3a7bd5')]
      for (const part of MODEL_PARTS[model]) geos.push(vehiclePartGeometry(kind, '#3a7bd5', part))
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      let n = 0
      for (const geo of geos) {
        const pos = geo.getAttribute('position')
        const tid = geo.getAttribute('tid')
        if (!pos || !tid) continue
        for (let i = 0; i < tid.count; i++) {
          if (tid.getX(i) !== 6) continue
          n++
          minX = Math.min(minX, pos.getX(i))
          maxX = Math.max(maxX, pos.getX(i))
          minY = Math.min(minY, pos.getY(i))
          maxY = Math.max(maxY, pos.getY(i))
        }
      }
      expect(n, kind).toBeGreaterThan(8)
      const aspect = (maxX - minX) / Math.max(1e-4, maxY - minY)
      expect(aspect, kind).toBeCloseTo(LIVERY_CELL_ASPECT, 1)
    }
  })

  it('paints a fictional side livery on each turnaround vehicle', () => {
    for (const kind of PLACARD_KINDS) {
      const model = vehicleModel(kind)
      const geos = [vehicleGeometry(kind, '#3a7bd5')]
      for (const part of MODEL_PARTS[model]) geos.push(vehiclePartGeometry(kind, '#3a7bd5', part))
      let painted = 0
      for (const geo of geos) {
        const tid = geo.getAttribute('tid')
        if (!tid) continue
        for (let i = 0; i < tid.count; i++) if (tid.getX(i) === 6) painted++
      }
      expect(painted, kind).toBeGreaterThan(8)
    }
  })

  it('shares geometry per model and colour', () => {
    const before = vehicleLibrarySize()
    const a = vehicleGeometry('gpu', '#5b8c5a', [3.2, 1.6, 1.4])
    const b = vehicleGeometry('gpu', '#5b8c5a', [9, 9, 9])
    const c = vehicleGeometry('gpu', '#ffffff')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(vehicleLibrarySize()).toBeGreaterThanOrEqual(before)
    expect(vehicleMesh('gpu', '#5b8c5a', [3.2, 1.6, 1.4], 1).material).toBe(
      vehicleMesh('pax_bus', '#3d6a8a', [12, 3, 2.5], 1).material,
    )
  })

  it('instances a fleet: one body + one lights draw per model, plus one per animated part', () => {
    const fleet = new VehicleFleet()
    const size = [8, 3, 2.5] as const
    fleet.sync([
      { kind: 'fuel_truck', color: '#c9a227', size, x: 0, y: 0, z: 0, yaw: 0, scale: 1 },
      { kind: 'fuel', color: '#c9a227', size, x: 4, y: 0, z: 1, yaw: 0.4, scale: 1 },
      { kind: 'pax_bus', color: '#3d6a8a', size: [12, 3, 2.5], x: 8, y: 0, z: 2, yaw: 1, scale: 1 },
    ])
    const meshes = fleet.root.children.filter((child) => (child as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[]
    const shells = meshes.filter((mesh) => !mesh.name.startsWith('part:'))
    expect(shells).toHaveLength(4)
    expect(shells.filter((mesh) => mesh.count === 2)).toHaveLength(2)
    // Animated parts (wheels, beacons, hose, doors...) draw as their own instanced meshes.
    const parts = meshes.filter((mesh) => mesh.name.startsWith('part:')).map((m) => m.name)
    expect(parts.some((n) => n.endsWith('|hose'))).toBe(true)
    expect(parts.some((n) => n.endsWith('|doors'))).toBe(true)
    expect(parts.some((n) => n.includes('|wheels_front'))).toBe(true)
    fleet.sync([])
    expect(meshes.every((mesh) => mesh.count === 0)).toBe(true)
    fleet.dispose()
  })

  it('instances one cheap shell per model past the lod distance', () => {
    const fleet = new VehicleFleet()
    const size = [8, 3, 2.5] as const
    const list = Array.from({ length: 60 }, (_, i) => ({
      kind: i % 2 === 0 ? 'fuel' : 'pax_bus',
      color: '#c9a227',
      size,
      x: (i % 10) * 6,
      y: 0,
      z: Math.floor(i / 10) * 8,
      yaw: 0,
      scale: 1,
    }))
    const camera = { x: 0, y: 4, z: -(VEHICLE_LOD_M + 40) }
    fleet.sync(list, camera)
    const meshes = fleet.root.children.filter((child) => (child as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[]
    const far = meshes.filter((mesh) => mesh.name.startsWith('far:') && mesh.count > 0)
    const near = meshes.filter((mesh) => mesh.name.startsWith('fleet:') && mesh.count > 0)
    expect(near).toHaveLength(0)
    expect(far).toHaveLength(2)
    expect(far.reduce((n, mesh) => n + mesh.count, 0)).toBe(60)
    const close = vehicleGeometry('fuel', '#c9a227').getAttribute('position').count
    const cheap = vehicleFarGeometry('fuel', '#c9a227').getAttribute('position').count
    expect(cheap).toBeLessThan(close / 8)
    expect(cheap).toBeGreaterThan(8)
    fleet.sync(list.slice(0, 4))
    expect(far.every((mesh) => mesh.count === 0)).toBe(true)
    fleet.dispose()
  })
})

/**
 * How many outward placard faces read left-to-right and right-side-up.
 * U must increase toward the viewer's right; V must increase upward
 * (texture v = 1 is the top of the atlas, where the words start).
 */
function placardSides(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uvm')
  const tid = geo.getAttribute('tid')
  if (!pos || !uv || !tid) return 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const n = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const seen = new Set<number>()
  let sides = 0
  for (let i = 0; i + 2 < pos.count; i += 3) {
    if (tid.getX(i) !== 6) continue
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    n.crossVectors(ab, ac)
    if (n.lengthSq() < 1e-8 || Math.abs(n.z) < Math.abs(n.y)) continue
    n.normalize()
    const sign = n.z > 0 ? 1 : -1
    if (seen.has(sign)) continue
    right.crossVectors(n.clone().negate(), up).normalize()
    const sample = [a, b, c]
    const us = [uv.getX(i), uv.getX(i + 1), uv.getX(i + 2)]
    const vs = [uv.getY(i), uv.getY(i + 1), uv.getY(i + 2)]
    let left = 0
    let rightI = 0
    let low = 0
    let high = 0
    for (let k = 1; k < 3; k++) {
      if (sample[k].dot(right) < sample[left].dot(right)) left = k
      if (sample[k].dot(right) > sample[rightI].dot(right)) rightI = k
      if (sample[k].y < sample[low].y) low = k
      if (sample[k].y > sample[high].y) high = k
    }
    expect(us[rightI], `u ${sign > 0 ? '+' : '-'}Z`).toBeGreaterThan(us[left] + 1e-4)
    expect(vs[high], `v ${sign > 0 ? '+' : '-'}Z`).toBeGreaterThan(vs[low] + 1e-4)
    seen.add(sign)
    sides++
  }
  return sides
}

/** Vertices in the whole model: static shell plus every animated part. */
function fullCount(model: (typeof ALL_MODELS)[number], color = '#3a7bd5'): number {
  const kind = model === 'van' ? 'delivery' : kindFor(model)
  let n = vehicleGeometry(kind, color).getAttribute('position').count
  for (const part of ANIM_PARTS[model]) n += vehiclePartGeometry(kind, color, part).getAttribute('position')?.count ?? 0
  return n
}

function kindFor(model: string): string {
  const back: Record<string, string> = {
    fuel_tanker: 'fuel', hydrant_cart: 'hydrant', baggage_train: 'bags', baggage_cart: 'cart', belt_loader: 'belt_loader',
    catering_hilift: 'catering', arff: 'fire', deice: 'deice', apron_bus: 'termbus', coach: 'coach', box_truck: 'citycargo',
    van: 'delivery', towbar_tug: 'tow', towbarless_tug: 'pushback_tug', gpu: 'gpu', stairs: 'stairs', k_loader: 'cargo', uld_dolly: 'dolly',
    lavatory_truck: 'lav', water_truck: 'water', police: 'police',
  }
  return back[model]
}
