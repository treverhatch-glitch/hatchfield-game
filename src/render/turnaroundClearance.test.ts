/**
 * Drawn-mesh clearance for a docked turnaround.
 * Reads VehicleFleet instance matrices (body and animated parts) and the
 * aircraft lod-mid shell, then checks bounding boxes and surface distance.
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SIZE } from '../game/types.ts'
import { reservedSpots, type ServiceSpot } from '../ramp/serviceSpots.ts'
import { createAircraft } from './aircraft/factory.ts'
import { AIRCRAFT_VISUAL_SCALE, CELL, WORLD_PER_METER, getAircraftSpec } from './aircraft/specs.ts'
import { orientAircraft } from './flightPose.ts'
import { standCrew, vehicleCrew, type StandFrame } from './turnaroundCrew.ts'
import { VehicleFleet, type VehicleInstance } from './vehicles.ts'

const CENTER = (SIZE - 1) / 2
const SKIN_M = 0.2
const DOOR_EXEMPT_M = 1.35

function toWorld(c: number, r: number, y = 0) {
  return new THREE.Vector3((c - CENTER) * CELL, y, (r - CENTER) * CELL)
}

type Tri = {
  ax: number; ay: number; az: number
  bx: number; by: number; bz: number
  cx: number; cy: number; cz: number
  minX: number; minY: number; minZ: number
  maxX: number; maxY: number; maxZ: number
}

function pointTri(px: number, py: number, pz: number, t: Tri): number {
  const abx = t.bx - t.ax, aby = t.by - t.ay, abz = t.bz - t.az
  const acx = t.cx - t.ax, acy = t.cy - t.ay, acz = t.cz - t.az
  const apx = px - t.ax, apy = py - t.ay, apz = pz - t.az
  const d1 = abx * apx + aby * apy + abz * apz
  const d2 = acx * apx + acy * apy + acz * apz
  const d3 = abx * abx + aby * aby + abz * abz
  const d4 = abx * acx + aby * acy + abz * acz
  const d5 = acx * acx + acy * acy + acz * acz
  const denom = d3 * d5 - d4 * d4
  let v = denom === 0 ? 0 : (d5 * d1 - d4 * d2) / denom
  let w = denom === 0 ? 0 : (d3 * d2 - d4 * d1) / denom
  const u = 1 - v - w
  if (u < 0 || v < 0 || w < 0) {
    const seg = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0
      const len2 = dx * dx + dy * dy + dz * dz || 1
      const tt = Math.min(1, Math.max(0, ((px - x0) * dx + (py - y0) * dy + (pz - z0) * dz) / len2))
      const qx = x0 + dx * tt - px, qy = y0 + dy * tt - py, qz = z0 + dz * tt - pz
      return qx * qx + qy * qy + qz * qz
    }
    return Math.sqrt(Math.min(
      seg(t.ax, t.ay, t.az, t.bx, t.by, t.bz),
      seg(t.bx, t.by, t.bz, t.cx, t.cy, t.cz),
      seg(t.cx, t.cy, t.cz, t.ax, t.ay, t.az),
    ))
  }
  const qx = t.ax + abx * v + acx * w - px
  const qy = t.ay + aby * v + acy * w - py
  const qz = t.az + abz * v + acz * w - pz
  return Math.sqrt(qx * qx + qy * qy + qz * qz)
}

class Grid {
  cell = 0.45
  map = new Map<string, number[]>()
  tris: Tri[]
  constructor(tris: Tri[]) {
    this.tris = tris
    tris.forEach((t, i) => {
      const x0 = Math.floor(t.minX / this.cell), x1 = Math.floor(t.maxX / this.cell)
      const y0 = Math.floor(t.minY / this.cell), y1 = Math.floor(t.maxY / this.cell)
      const z0 = Math.floor(t.minZ / this.cell), z1 = Math.floor(t.maxZ / this.cell)
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const k = `${x},${y},${z}`
        const bin = this.map.get(k)
        if (bin) bin.push(i)
        else this.map.set(k, [i])
      }
    })
  }
  nearest(px: number, py: number, pz: number, reach: number): number {
    const r = Math.ceil(reach / this.cell)
    const cx = Math.floor(px / this.cell), cy = Math.floor(py / this.cell), cz = Math.floor(pz / this.cell)
    let best = Infinity
    const seen = new Set<number>()
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) {
      const bin = this.map.get(`${x},${y},${z}`)
      if (!bin) continue
      for (const i of bin) {
        if (seen.has(i)) continue
        seen.add(i)
        const d = pointTri(px, py, pz, this.tris[i])
        if (d < best) best = d
      }
    }
    return best
  }
}

function airTris(root: THREE.Object3D): Tri[] {
  const out: Tri[] = []
  const v = new THREE.Vector3()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const mid = root.getObjectByName('lod-mid')
  if (!mid) return out
  mid.updateMatrixWorld(true)
  mid.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const name = `${mesh.name} ${mesh.parent?.name ?? ''}`
    if (!/airframe|nacelle/.test(name)) return
    const pos = mesh.geometry.getAttribute('position')
    if (!pos) return
    const index = mesh.geometry.index
    const n = index ? index.count : pos.count
    for (let i = 0; i < n; i += 3) {
      const ia = index ? index.getX(i) : i
      const ib = index ? index.getX(i + 1) : i + 1
      const ic = index ? index.getX(i + 2) : i + 2
      a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld)
      out.push({
        ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, cx: c.x, cy: c.y, cz: c.z,
        minX: Math.min(a.x, b.x, c.x), minY: Math.min(a.y, b.y, c.y), minZ: Math.min(a.z, b.z, c.z),
        maxX: Math.max(a.x, b.x, c.x), maxY: Math.max(a.y, b.y, c.y), maxZ: Math.max(a.z, b.z, c.z),
      })
    }
    void v
  })
  return out
}

const SKIP = /lights:|beam|beacon|reverse/

function vehicleClouds(fleet: VehicleFleet): Map<string, THREE.Vector3[]> {
  const clouds = new Map<string, THREE.Vector3[]>()
  const mat = new THREE.Matrix4()
  const p = new THREE.Vector3()
  fleet.root.updateMatrixWorld(true)
  fleet.root.traverse((obj) => {
    const mesh = obj as THREE.InstancedMesh
    if (!mesh.isInstancedMesh || mesh.count < 1) return
    if (SKIP.test(mesh.name)) return
    if (!mesh.name.startsWith('fleet:') && !mesh.name.startsWith('part:')) return
    const model = mesh.name.split('|')[0].replace(/^fleet:/, '').replace(/^part:/, '')
    const pos = mesh.geometry.getAttribute('position')
    if (!pos) return
    const bucket = clouds.get(model) ?? []
    const step = Math.max(1, Math.floor(pos.count / 1200))
    for (let n = 0; n < mesh.count; n++) {
      mesh.getMatrixAt(n, mat)
      for (let i = 0; i < pos.count; i += step) {
        p.fromBufferAttribute(pos, i).applyMatrix4(mat)
        bucket.push(p.clone())
      }
    }
    clouds.set(model, bucket)
  })
  return clouds
}

function clearance(grid: Grid, pts: THREE.Vector3[], door: THREE.Vector3) {
  const limit = SKIN_M * WORLD_PER_METER
  const exempt = DOOR_EXEMPT_M * WORLD_PER_METER
  let hits = 0
  let far = Infinity
  let nearDoor = Infinity
  let tipY = 0
  for (const p of pts) {
    const d = grid.nearest(p.x, p.y, p.z, 2.2 * WORLD_PER_METER)
    const doorD = Math.hypot(p.x - door.x, p.z - door.z)
    if (doorD < nearDoor) {
      nearDoor = doorD
      tipY = p.y
    }
    if (doorD < exempt) continue
    if (d < far) far = d
    if (d < limit) hits++
  }
  return { hits, farM: far / WORLD_PER_METER, tipApartM: nearDoor / WORLD_PER_METER, tipY }
}

describe('turnaround mesh clearance', () => {
  it('keeps fuel, bags, the raised belt and crew off the airframe on two stands', () => {
    const stands = [
      { c: 11, r: 6, heading: 0.4 },
      { c: 11, r: 12, heading: 0.4 + 1.7 },
    ] as const
    for (const airframeId of ['crj700', 'b738'] as const) {
      const craft = createAircraft(airframeId, { body: '#2f6f9a', stripe: '#e8eef5', tail: '#1d4e89' })
      const fleet = new VehicleFleet()
      const spec = getAircraftSpec(airframeId)
      const visual = AIRCRAFT_VISUAL_SCALE
      for (const stand of stands) {
        const origin = toWorld(stand.c, stand.r, 0.04)
        craft.position.copy(origin)
        orientAircraft(craft, stand.heading, 0)
        craft.updateMatrixWorld(true)
        const doorObj = craft.getObjectByName('plane_cargo_door_fwd')
        expect(doorObj, airframeId).toBeTruthy()
        const door = new THREE.Vector3()
        doorObj!.getWorldPosition(door)
        const spots = reservedSpots(airframeId, { x: stand.c, y: stand.r, heading: stand.heading })
        const items: VehicleInstance[] = (['fuel', 'bags', 'belt'] as const).map((role) => {
          const spot: ServiceSpot = spots[role]
          const at = toWorld(spot.x, spot.y, 0)
          const kind = role === 'fuel' ? 'fuel' : role === 'bags' ? 'bags' : 'belt_loader'
          return {
            id: `${airframeId}:${role}`,
            kind,
            color: role === 'belt' ? '#f2bf1f' : role === 'fuel' ? '#c9a227' : '#6b7280',
            size: [1, 1, 1],
            x: at.x,
            y: at.y,
            z: at.z,
            yaw: -spot.heading,
            scale: WORLD_PER_METER,
            ext: 1,
            active: true,
            clock: 4,
            deck: spot.deck,
            slide: spot.slide,
          }
        })
        fleet.sync(items)
        const grid = new Grid(airTris(craft))
        expect(grid.tris.length, airframeId).toBeGreaterThan(100)
        const clouds = vehicleClouds(fleet)
        const boxes = new Map<string, THREE.Box3>()
        for (const [model, pts] of clouds) {
          const box = new THREE.Box3()
          for (const p of pts) box.expandByPoint(p)
          boxes.set(model, box)
          const report = clearance(grid, pts, door)
          expect(report.hits, `${airframeId} ${model} ${stand.c},${stand.r}`).toBe(0)
          if (model === 'belt_loader') {
            expect(report.tipApartM, `${airframeId} belt tip`).toBeLessThan(1.2)
            expect(Math.abs(report.tipY - door.y), `${airframeId} belt height`).toBeLessThan(0.45 * WORLD_PER_METER)
            expect(report.farM, `${airframeId} belt skin`).toBeGreaterThan(0.2)
          } else {
            expect(report.farM, `${airframeId} ${model}`).toBeGreaterThan(SKIN_M)
          }
        }
        const models = [...boxes.keys()]
        for (let i = 0; i < models.length; i++) {
          for (let j = i + 1; j < models.length; j++) {
            expect(
              boxes.get(models[i])!.intersectsBox(boxes.get(models[j])!),
              `${airframeId} ${models[i]} overlaps ${models[j]}`,
            ).toBe(false)
          }
        }
        const nose = (spec.lengthM * visual) / 2
        const frame: StandFrame = {
          x: origin.x,
          y: origin.y,
          z: origin.z,
          yaw: -stand.heading,
          nose,
          tail: -nose,
          semiSpan: (spec.spanM * visual) / 2,
          noseGear: nose - spec.lengthM * visual * 0.12,
          skin: spec.rx * visual,
        }
        const people = standCrew(frame, 12, [])
        for (const item of items) {
          vehicleCrew({
            id: item.id ?? item.kind,
            kind: item.kind,
            x: item.x,
            y: item.y,
            z: item.z,
            yaw: item.yaw,
            ext: 1,
            moving: false,
          }, 4, people, WORLD_PER_METER)
        }
        const limit = 0.15 * WORLD_PER_METER
        for (const person of people) {
          const d = grid.nearest(person.x, person.y + 0.9 * WORLD_PER_METER, person.z, 2 * WORLD_PER_METER)
          expect(d, `${airframeId} ${person.id}`).toBeGreaterThan(limit)
        }
      }
      craft.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh && !mesh.userData.shared) mesh.geometry?.dispose()
      })
    }
  }, 60_000)
})
