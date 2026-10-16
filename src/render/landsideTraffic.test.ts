import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { penetration, type Body } from '../bodies/index.ts'
import { SIZE } from '../game/types.ts'
import { LANDSIDE } from '../landside/config.ts'
import { LandsideTraffic } from '../landside/engine.ts'
import { starterField } from '../landside/fixtures.test-util.ts'
import { buildLanes, pointAt } from '../landside/lanes.ts'
import { buildNetwork } from '../landside/network.ts'
import type { Cell, LandsideField, VehicleRead } from '../landside/types.ts'
import { CELL } from './aircraft/specs.ts'
import { LandsideLayer } from './landsideTraffic.ts'

function worldOf(c: number, r: number): THREE.Vector3 {
  return new THREE.Vector3((c - (SIZE - 1) / 2) * CELL, 0, (r - (SIZE - 1) / 2) * CELL)
}

function instanced(layer: LandsideLayer): THREE.InstancedMesh[] {
  return layer.group.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)
}

describe('landside layer', () => {
  it('draws a long queue in a fixed handful of instanced meshes', () => {
    const sim = new LandsideTraffic()
    const field = starterField({ departures: 14, paxPerDay: 2400, busBays: [{ c: 18, r: 8 }] })
    let view = sim.snapshot()
    for (let t = 0; t < 2400; t++) view = sim.tick(0.25, field)
    expect(view.vehicles.length).toBeGreaterThan(16)
    const layer = new LandsideLayer()
    layer.sync(view, false, null)
    const meshes = instanced(layer)
    // Body, cabin and taxi sign per kind, plus the people.
    expect(meshes.length).toBeLessThanOrEqual(8)
    const drawn = meshes.filter((mesh) => mesh.visible)
    const bodies = drawn.filter((mesh) => mesh.instanceColor && mesh.castShadow && mesh.geometry.type === 'BoxGeometry')
    expect(bodies.reduce((n, mesh) => n + mesh.count, 0)).toBe(view.vehicles.length)
    const got: THREE.Vector3[] = []
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const matrix = new THREE.Matrix4()
    for (const mesh of bodies) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix)
        matrix.decompose(pos, quat, scl)
        got.push(pos.clone())
      }
    }
    for (const vehicle of view.vehicles) {
      const at = worldOf(vehicle.c, vehicle.r)
      expect(got.some((p) => p.distanceTo(at) < 0.02), vehicle.id).toBe(true)
    }
    layer.dispose()
    expect(instanced(layer)).toHaveLength(0)
  })
})

const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const scl = new THREE.Vector3()
const mat = new THREE.Matrix4()
const local = new THREE.Vector3()
const world = new THREE.Vector3()

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/** Metres off a pure north-south heading. Zero is aligned with the road. */
function offNorthSouth(heading: number): number {
  return Math.acos(Math.min(1, Math.abs(Math.sin(heading))))
}

function matrixCorners(matrix: THREE.Matrix4, halfL: number, halfW: number): { x: number; y: number }[] {
  const pts = []
  for (const sl of [1, -1] as const) {
    for (const sw of [1, -1] as const) {
      local.set(sl * halfL, 0, sw * halfW)
      world.copy(local).applyMatrix4(matrix)
      const c = world.x / CELL + (SIZE - 1) / 2
      const r = world.z / CELL + (SIZE - 1) / 2
      pts.push({ x: c * LANDSIDE.cellM, y: r * LANDSIDE.cellM })
    }
  }
  return pts
}

interface Mouth {
  x: number
  y: number
  dx: number
  dy: number
  lx: number
  ly: number
}

/** Road-cell squares, plus a short mouth at each open end of the loop so a car can arrive from the city. */
function pavement(field: LandsideField): { cells: Set<string>; mouths: Mouth[] } {
  const cells = new Set<string>()
  for (const cell of [...field.roads, ...(field.connectors ?? [])]) cells.add(`${cell.c},${cell.r}`)
  const geo = buildLanes(buildNetwork(field))
  const mouths: Mouth[] = []
  if (!geo) return { cells, mouths }
  for (const [i0, i1] of [
    [0, 1],
    [geo.count - 1, geo.count - 2],
  ] as const) {
    const a = pointAt(geo, i0, 0)
    const b = pointAt(geo, i1, 0)
    const dx = a.x - b.x
    const dy = a.y - b.y
    const len = Math.hypot(dx, dy) || 1
    mouths.push({ x: a.x, y: a.y, dx: dx / len, dy: dy / len, lx: -dy / len, ly: dx / len })
  }
  return { cells, mouths }
}

function offPavement(p: { x: number; y: number }, cells: Set<string>, mouths: Mouth[]): number {
  let best = Infinity
  for (const id of cells) {
    const [c, r] = id.split(',').map(Number)
    const dx = Math.max(0, Math.abs(p.x - c * LANDSIDE.cellM) - LANDSIDE.cellM / 2)
    const dy = Math.max(0, Math.abs(p.y - r * LANDSIDE.cellM) - LANDSIDE.cellM / 2)
    best = Math.min(best, Math.hypot(dx, dy))
  }
  for (const mouth of mouths) {
    const along = (p.x - mouth.x) * mouth.dx + (p.y - mouth.y) * mouth.dy
    const across = (p.x - mouth.x) * mouth.lx + (p.y - mouth.y) * mouth.ly
    if (along < -0.05 || along > LANDSIDE.bodies.bus.lengthM) continue
    best = Math.min(best, Math.max(0, Math.abs(across) - LANDSIDE.cellM / 2))
  }
  return best
}

interface Probe {
  maxStepDeg: number
  maxStepAt: string
  offRoad: number
  offAt: string
  overlapM: number
  overlapAt: string
  leaned: number
  pullYaw: number
  /** Nose more across the road than along it, beside the dead-end cell. */
  across: number
  drawn: number
}

function probe(field: LandsideField, seconds: number): Probe {
  const sim = new LandsideTraffic()
  const layer = new LandsideLayer()
  const { cells, mouths } = pavement(field)
  const prev = new Map<string, number>()
  const out: Probe = {
    maxStepDeg: 0,
    maxStepAt: '',
    offRoad: 0,
    offAt: '',
    overlapM: 0,
    overlapAt: '',
    leaned: 0,
    pullYaw: 0,
    across: 0,
    drawn: 0,
  }
  const dt = 1 / 12
  for (let t = 0; t < seconds / dt; t++) {
    const view = sim.tick(dt, field)
    layer.sync(view, false, null)
    const meshes = instanced(layer).filter(
      (mesh) => mesh.visible && mesh.instanceColor && mesh.castShadow && mesh.geometry.type === 'BoxGeometry',
    )
    const used = new Set<string>()
    const bodies: Body[] = []
    for (const mesh of meshes) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, mat)
        mat.decompose(pos, quat, scl)
        const c = pos.x / CELL + (SIZE - 1) / 2
        const r = pos.z / CELL + (SIZE - 1) / 2
        let best: VehicleRead | null = null
        let bestD = 1e9
        for (const vehicle of view.vehicles) {
          if (used.has(vehicle.id)) continue
          const d = Math.hypot(vehicle.c - c, vehicle.r - r)
          if (d < bestD) {
            bestD = d
            best = vehicle
          }
        }
        expect(best, 'every drawn body matches a sim vehicle').not.toBeNull()
        if (!best || bestD > 0.05) continue
        used.add(best.id)
        const yaw = new THREE.Euler().setFromQuaternion(quat, 'YXZ').y
        expect(Math.abs(wrap(-yaw - best.heading)), best.id).toBeLessThan(1e-4)
        const size = LANDSIDE.bodies[best.kind]
        const corners = matrixCorners(mat, size.lengthM / 2, size.widthM / 2)
        const was = prev.get(best.id)
        if (was != null) {
          const step = Math.abs(wrap(yaw - was))
          if (step > out.maxStepDeg) {
            out.maxStepDeg = (step * 180) / Math.PI
            out.maxStepAt = `${best.id} ${best.kind} at ${(t * dt).toFixed(1)}s`
          }
        }
        prev.set(best.id, yaw)
        const heading = best.heading
        const lean = offNorthSouth(heading)
        const lateral = Math.abs(c * LANDSIDE.cellM - 17 * LANDSIDE.cellM)
        if (r > 1.5 && r < 11 && lean > (18 * Math.PI) / 180 && lateral > 1.5 && lateral < 6.6) out.leaned++
        if (r > 1.5 && r < 11.2 && lean > (18 * Math.PI) / 180 && lateral > 6.6 && lateral < 10) out.pullYaw++
        if (r > 11.2 && Math.abs(Math.cos(heading)) > 0.7) out.across++
        for (const corner of corners) {
          const off = offPavement(corner, cells, mouths)
          if (off > out.offRoad) {
            out.offRoad = off
            out.offAt = `${best.id} ${best.kind} ${(corner.x / LANDSIDE.cellM).toFixed(2)},${(corner.y / LANDSIDE.cellM).toFixed(2)}`
          }
        }
        bodies.push({
          id: best.id,
          owner: 'landside',
          kind: best.kind,
          x: best.c * LANDSIDE.cellM,
          y: best.r * LANDSIDE.cellM,
          heading,
          halfLength: size.lengthM / 2,
          halfWidth: size.widthM / 2,
          speed: best.speed,
        })
      }
    }
    out.drawn += bodies.length
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const depth = penetration(bodies[i], bodies[j])
        if (depth > out.overlapM) {
          out.overlapM = depth
          out.overlapAt = `${bodies[i].id}/${bodies[j].id}`
        }
      }
    }
    const live = new Set(view.vehicles.map((vehicle) => vehicle.id))
    for (const id of prev.keys()) if (!live.has(id)) prev.delete(id)
  }
  layer.dispose()
  return out
}

describe('drawn landside bodies', () => {
  it('yaws the nose through lane changes and U-turns, stays on the pavement, and does not overlap', () => {
    const busy = starterField({
      departures: 14,
      paxPerDay: 2400,
      busBays: [{ c: 18, r: 8 }],
      curbLanes: [{ c: 18, r: 9 }],
      taxiRanks: [{ c: 18, r: 10 }],
    })
    const straight = probe(busy, 90)
    expect(straight.drawn).toBeGreaterThan(500)
    expect(straight.maxStepDeg, straight.maxStepAt).toBeLessThan(30)
    expect(straight.offRoad, straight.offAt).toBeLessThan(0.05)
    expect(straight.overlapM, straight.overlapAt).toBeLessThanOrEqual(0.01)
    expect(straight.leaned, 'lane changes turn the drawn nose').toBeGreaterThan(20)
    expect(straight.pullYaw, 'curb pull-outs turn the drawn nose').toBeGreaterThan(5)
    expect(straight.across, 'the dead-end loop turns the nose across the road').toBeGreaterThan(10)

    const roads: Cell[] = []
    for (let r = 0; r <= 6; r++) roads.push({ c: 7, r })
    for (let c = 8; c <= 12; c++) roads.push({ c, r: 6 })
    const terminals: Cell[] = []
    for (let c = 4; c <= 6; c++) for (let r = 3; r <= 5; r++) terminals.push({ c, r })
    const corner = probe(
      {
        roads,
        terminals,
        busBays: [{ c: 10, r: 7 }],
        taxiRanks: [{ c: 9, r: 5 }],
        parks: [{ c: 11, r: 5, kind: 'park_s' }],
        rail: false,
        paxPerDay: 2400,
        departures: 14,
      },
      70,
    )
    expect(corner.maxStepDeg, corner.maxStepAt).toBeLessThan(30)
    expect(corner.offRoad, corner.offAt).toBeLessThan(0.05)
    expect(corner.overlapM, corner.overlapAt).toBeLessThanOrEqual(0.01)
  })
})
