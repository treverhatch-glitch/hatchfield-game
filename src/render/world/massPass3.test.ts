import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { footprintCells } from '../../game/buildingFootprint'
import { CELL, WORLD_PER_METER } from '../aircraft/specs'
import { MASS3_SOCKETS, vehicleSocket, type Mass3Socket } from '../socketLayout'
import { MODEL_SIZE, type VehicleModel } from '../vehicleModels'
import { meshTriangleCount } from '../../tier3/meshes'
import {
  addBagSort,
  addBusStation,
  addCateringKitchen,
  addHelipad,
  addHotelMass,
  addHydrantPit,
  addRailStation,
} from './massPass3'

function named(root: THREE.Object3D, prefix: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = []
  root.traverse((obj) => {
    if (obj.name.startsWith(prefix)) found.push(obj)
  })
  return found
}

function signFacesFront(root: THREE.Object3D) {
  for (const obj of named(root, 'sign:')) {
    const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial
    expect(mat.side, obj.name).toBe(THREE.FrontSide)
    expect(obj.scale.x, obj.name).toBeGreaterThan(0)
    if (mat.map) {
      expect(mat.map.wrapS).toBe(THREE.ClampToEdgeWrapping)
      expect(mat.map.wrapT).toBe(THREE.ClampToEdgeWrapping)
    }
  }
}

function build(id: string): THREE.Group {
  const g = new THREE.Group()
  if (id === 'hydrant') addHydrantPit(g)
  else if (id === 'kitchen') addCateringKitchen(g)
  else if (id === 'bags') addBagSort(g)
  else if (id === 'bus') addBusStation(g)
  else if (id === 'rail') addRailStation(g)
  else if (id === 'helipad') addHelipad(g)
  else if (id === 'hotel_inn') addHotelMass(g, 'inn')
  else if (id === 'hotel_biz') addHotelMass(g, 'business')
  else if (id === 'hotel_resort') addHotelMass(g, 'resort')
  return g
}

/** Yaw that points the vehicle's +X nose at the building origin. */
function yawTowardOrigin(x: number, z: number): number {
  const len = Math.hypot(x, z) || 1
  const dx = -x / len
  const dz = -z / len
  return Math.atan2(-dz, dx)
}

function dockLands(model: VehicleModel, at: readonly [number, number, number]) {
  const dock = vehicleSocket(model, 'dock')
  expect(dock, model).toBeTruthy()
  const yaw = yawTowardOrigin(at[0], at[2])
  const s = WORLD_PER_METER
  const lx = dock![0] * s
  const ly = dock![1] * s
  const lz = dock![2] * s
  const rx = lx * Math.cos(yaw) + lz * Math.sin(yaw)
  const rz = -lx * Math.sin(yaw) + lz * Math.cos(yaw)
  const originY = at[1] - ly
  expect(originY, model).toBeCloseTo(0, 5)
  expect(at[0] - rx + rx, model).toBeCloseTo(at[0], 5)
  expect(at[2] - rz + rz, model).toBeCloseTo(at[2], 5)
  const widthAlongX = Math.abs(Math.sin(yaw)) >= Math.abs(Math.cos(yaw))
  return { yaw, widthAlongX }
}

describe('massing pass 3 sockets', () => {
  it('keeps these stamps on a single cell, the same cells an old save stored', () => {
    for (const tile of ['kitchen', 'bags', 'bus', 'rail', 'helipad', 'hotel'] as const) {
      expect(footprintCells(tile, { c: 8, r: 11 })).toEqual([{ c: 8, r: 11 }])
    }
  })

  it('names every bay and docks the vehicle that uses it', () => {
    for (const [building, rows] of Object.entries(MASS3_SOCKETS)) {
      const g = build(building)
      expect(named(g, 'sign:').length, building).toBeGreaterThan(0)
      signFacesFront(g)
      const cap = building.startsWith('hotel') ? 260 : building === 'rail' ? 420 : building === 'helipad' ? 360 : 220
      expect(meshTriangleCount(g), building).toBeLessThanOrEqual(cap)
      const box = new THREE.Box3().setFromObject(g)
      expect(box.min.x, building).toBeGreaterThan(-CELL * 0.62)
      expect(box.max.x, building).toBeLessThan(CELL * 0.62)
      expect(box.max.z, building).toBeLessThan(CELL * 0.7)
      for (const [id, bay] of Object.entries(rows) as [string, Mass3Socket][]) {
        const mark = g.getObjectByName(`service-bay:${id}`) as THREE.Mesh
        expect(mark, `${building}:${id}`).toBeTruthy()
        expect(mark.position.x, id).toBeCloseTo(bay.at[0], 2)
        expect(mark.position.z, id).toBeCloseTo(bay.at[2], 2)
        const socket = g.getObjectByName(id)
        expect(socket?.position.toArray(), id).toEqual([bay.at[0], bay.at[1], bay.at[2]])
        if (building === 'rail') {
          const train = g.getObjectByName(`train:${id}`)
          expect(train, id).toBeTruthy()
          expect(train!.position.x).toBeCloseTo(bay.at[0], 2)
          expect(train!.position.z).toBeCloseTo(bay.at[2], 2)
        }
        if (building === 'helipad' && id === 'pad') {
          const heli = g.getObjectByName('heli:pad')
          expect(heli).toBeTruthy()
          expect(heli!.position.x).toBeCloseTo(bay.at[0], 2)
          expect(heli!.position.z).toBeCloseTo(bay.at[2], 2)
        }
        if (!bay.vehicle) continue
        const { widthAlongX } = dockLands(bay.vehicle, bay.at)
        const geo = mark.geometry as THREE.PlaneGeometry
        const across = widthAlongX ? geo.parameters.width : geo.parameters.height
        const [, , vehW] = MODEL_SIZE[bay.vehicle]
        expect(across, `${building}:${id}`).toBeGreaterThanOrEqual(vehW * WORLD_PER_METER * 0.9)
      }
    }
  })
})
