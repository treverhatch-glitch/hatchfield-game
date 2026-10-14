import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ANIM_PARTS, deployOf, newPartPose, partMatrix, partPose, poseVehicleRig, serviceStateOf, truckDeploy } from './vehicleAnim'
import { MODEL_PARTS, type VehicleModel } from './vehicleModels'
import { disposeVehicleRig, VehicleFleet, vehicleRig } from './vehicles'
import { yardOffsets, minYardClearance } from './vehicleYard'

const lift = (model: VehicleModel, part: string, ext: number, clock = 0, active = false) => {
  const p = newPartPose()
  expect(partPose(model, part, ext, clock, active, p)).toBe(true)
  return p
}

describe('Round B service states', () => {
  it('maps logistics phases to approach / dock / work / undock', () => {
    expect(serviceStateOf('to_stand', 0.5)).toBe('drive')
    expect(serviceStateOf('servicing', 0.05)).toBe('dock')
    expect(serviceStateOf('servicing', 0.5)).toBe('work')
    expect(serviceStateOf('servicing', 0.95)).toBe('undock')
    expect(serviceStateOf('idle', 0)).toBe('idle')
    expect(deployOf('to_stand', 0.9)).toBe(0)
    expect(deployOf('servicing', 0.5)).toBe(1)
    expect(deployOf('servicing', 0.075)).toBeCloseTo(0.5, 5)
    expect(deployOf('servicing', 1)).toBe(0)
  })

  it('ramps legacy truck parts in and out of the dwell', () => {
    expect(truckDeploy(false, 10, 20)).toBe(0)
    expect(truckDeploy(true, 20, 20)).toBe(0)
    expect(truckDeploy(true, 10, 20)).toBe(1)
    expect(truckDeploy(true, 0, 20)).toBe(0)
  })

  it('every animated part is a named model part', () => {
    for (const [model, parts] of Object.entries(ANIM_PARTS)) {
      for (const part of parts!) expect(MODEL_PARTS[model as VehicleModel]).toContain(part)
    }
  })
})

describe('Round B part poses per state', () => {
  it('belt loader belt raises from stowed and bags only run when working', () => {
    expect(lift('belt_loader', 'belt', 1).rz).toBeGreaterThan(lift('belt_loader', 'belt', 0).rz)
    expect(lift('belt_loader', 'belt_bags', 0.5).sx).toBeLessThan(0.01)
    const a = lift('belt_loader', 'belt_bags', 1, 0)
    const b = lift('belt_loader', 'belt_bags', 1, 0.5)
    expect(b.tx).not.toBeCloseTo(a.tx, 3)
  })

  it('catering scissor lifts the box and the deck reaches forward', () => {
    expect(lift('catering_hilift', 'box', 0).ty).toBe(0)
    expect(lift('catering_hilift', 'box', 1).ty).toBeCloseTo(2.4)
    expect(lift('catering_hilift', 'scissor', 1).sy).toBeGreaterThan(3)
    expect(lift('catering_hilift', 'deck', 1).tx).toBeGreaterThan(0.5)
  })

  it('k-loader platforms rise, front higher than rear', () => {
    const f = lift('k_loader', 'front_platform', 1).ty
    const r = lift('k_loader', 'rear_platform', 1).ty
    expect(f).toBeGreaterThan(r)
    expect(r).toBeGreaterThan(0)
    expect(lift('k_loader', 'front_platform', 0).ty).toBe(0)
  })

  it('de-ice boom unfolds and the basket rides its tip', () => {
    expect(lift('deice', 'boom', 1).rz).toBeGreaterThan(0.5)
    const basket = lift('deice', 'basket', 1)
    expect(basket.ty).toBeGreaterThan(1)
    expect(lift('deice', 'basket', 0).ty).toBeCloseTo(0)
  })

  it('fuel hose pays out and the reel turns', () => {
    expect(lift('fuel_tanker', 'hose', 0).sz).toBeLessThan(0.05)
    expect(lift('fuel_tanker', 'hose', 1).sz).toBe(1)
    expect(Math.abs(lift('fuel_tanker', 'hose_reel', 1).rz)).toBeGreaterThan(1)
  })

  it('stairs, bus doors, tugs', () => {
    expect(lift('stairs', 'stair', 0).rz).toBeGreaterThan(0.1)
    expect(lift('stairs', 'stair', 1).rz).toBe(0)
    expect(lift('apron_bus', 'doors', 1).tx).toBeGreaterThan(0.5)
    expect(lift('towbar_tug', 'towbar', 0).rz).toBeGreaterThan(1)
    expect(lift('towbar_tug', 'towbar', 1).rz).toBe(0)
    expect(lift('towbarless_tug', 'cradle', 1).ty).toBeGreaterThan(0.2)
  })

  it('ARFF light bar flashes when active and cannons sweep only while working a call', () => {
    const on = lift('arff', 'lightbar', 0, 0.3, true).sx
    const off = lift('arff', 'lightbar', 0, 0.3 + 0.25, true).sx
    expect(Math.min(on, off)).toBeLessThan(0.01)
    expect(lift('arff', 'lightbar', 0, 0.55, false).sx).toBe(1)
    expect(lift('arff', 'roof_turret', 0, 2, true).ry).toBe(0)
    expect(lift('arff', 'roof_turret', 1, 2, true).ry).not.toBe(0)
  })

  it('is deterministic for the same clock', () => {
    expect(lift('deice', 'boom', 1, 12.5)).toEqual(lift('deice', 'boom', 1, 12.5))
  })

  it('partMatrix keeps the pivot fixed', () => {
    const p = lift('stairs', 'stair', 0)
    const v = new THREE.Vector3(p.px, p.py, p.pz).applyMatrix4(partMatrix(p, new THREE.Matrix4()))
    expect(v.x).toBeCloseTo(p.px)
    expect(v.y).toBeCloseTo(p.py)
  })
})

describe('Round B rig and fleet', () => {
  it('poses a vehicleRig child in place', () => {
    const rig = vehicleRig('catering', '#e07a3d')
    poseVehicleRig(rig, 'catering_hilift', 1, 0)
    const box = rig.getObjectByName('box')!
    expect(box.matrix.elements[13]).toBeCloseTo(2.4)
    disposeVehicleRig(rig)
  })

  it('fleet draws animated parts as their own instanced meshes', () => {
    const fleet = new VehicleFleet()
    fleet.sync([{ kind: 'belt_loader', color: '#f2bf1f', size: [7, 2, 2], x: 0, y: 0, z: 0, yaw: 0, scale: 1, ext: 1, clock: 3 }])
    const names = fleet.root.children.map((c) => c.name)
    expect(names.some((n) => n.startsWith('part:') && n.includes('belt'))).toBe(true)
    fleet.dispose()
  })
})

describe('depot yard spacing', () => {
  it('spreads parked tankers and baggage trains so footprints do not overlap', () => {
    const size = (t: string): [number, number, number] => (t === 'fuel_truck' ? [10, 3.2, 2.5] : [9.6, 1.9, 1.6])
    const poses = Array.from({ length: 8 }, (_, i) => ({ type: i % 2 ? 'fuel_truck' : 'baggage_tug', x: 5, y: 5, heading: 0, phase: 'idle' }))
    poses.push({ type: 'fuel_truck', x: 5, y: 5, heading: 0, phase: 'to_stand' })
    const off = yardOffsets(poses, size)
    expect(off[8]).toEqual({ x: 0, z: 0 })
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        const dx = Math.abs(off[i].x - off[j].x)
        const dz = Math.abs(off[i].z - off[j].z)
        const sideBySide = dz >= minYardClearance(size(poses[i].type), size(poses[j].type)) - 1e-6
        const nose2tail = dx >= 10
        expect(sideBySide || nose2tail).toBe(true)
      }
    }
  })
})
