import { afterAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  ALL_MODELS,
  disposeVehicleLibrary,
  disposeVehicleRig,
  MODEL_PARTS,
  MODEL_SIZE,
  VehicleFleet,
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

  it('paints a fictional side livery on each turnaround vehicle', () => {
    const kinds = ['fuel_truck', 'catering_truck', 'belt_loader', 'pushback_tug', 'pax_bus'] as const
    for (const kind of kinds) {
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
})

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
    lavatory_truck: 'lav', water_truck: 'water',
  }
  return back[model]
}
