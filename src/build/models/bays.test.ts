import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SERVICE_POINTS } from '../servicePoints'
import { FLEET_M, HANGAR_DESIGN, HEAD_CLEAR_M, LARGEST, SIDE_CLEAR_M, fromM, lotScale, mPerUnit, mPerUnitY } from '../fleet'
import { HALF } from './kit'
import { buildModel } from './index'

interface Bay { id: string; x: number; z: number; fx: number; fz: number; hl: number; hw: number; top: number }

const inBay = (q: THREE.Vector3, b: Bay) => {
  if (q.y < 0.17 || q.y > 0.12 + b.top) return false
  const dx = q.x - b.x, dz = q.z - b.z
  return Math.abs(dx * b.fx + dz * b.fz) < b.hl && Math.abs(-dx * b.fz + dz * b.fx) < b.hw
}

/** First static (non-animated) surface sample inside each bay box, model-local. */
function firstHits(g: THREE.Group, bays: Bay[]): Map<string, THREE.Vector3> {
  g.updateMatrixWorld(true)
  const found = new Map<string, THREE.Vector3>()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), q = new THREE.Vector3()
  const tri = new THREE.Box3()
  const boxes = bays.map((y) => { const r = Math.hypot(y.hl, y.hw); return new THREE.Box3(new THREE.Vector3(y.x - r, 0.17, y.z - r), new THREE.Vector3(y.x + r, 0.12 + y.top, y.z + r)) })
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return
    for (let p: THREE.Object3D | null = m; p && p !== g; p = p.parent) if (p.userData?.anim || p.userData?.fleet) return
    const pos = m.geometry.getAttribute('position')
    if (!pos) return
    const idx = m.geometry.index
    const n = idx ? idx.count : pos.count
    for (let t = 0; t + 2 < n; t += 3) {
      a.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(m.matrixWorld)
      b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(m.matrixWorld)
      c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(m.matrixWorld)
      tri.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c)
      const live = bays.filter((y, i) => !found.has(y.id) && boxes[i].intersectsBox(tri))
      if (!live.length) continue
      const k = Math.min(60, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 0.06))
      for (let u = 0; u <= k; u++) for (let v = 0; v <= k - u; v++) {
        q.set(0, 0, 0).addScaledVector(a, u / k).addScaledVector(b, v / k).addScaledVector(c, (k - u - v) / k)
        for (const y of live) if (!found.has(y.id) && inBay(q, y)) found.set(y.id, q.clone())
      }
    }
  })
  return found
}

export interface BayHit { tile: string; point: string; x: number; y: number; z: number }

/** Every bay whose clearance box (largest vehicle + 1 m sides, 0.5 m ends, 1 m headroom) hits static geometry. */
export function bayHits(tile: string): BayHit[] {
  const spec = SERVICE_POINTS[tile as keyof typeof SERVICE_POINTS]!
  const s = lotScale(tile)
  const bays: Bay[] = []
  for (const kind of spec.serves) {
    const [L, H, W] = FLEET_M[LARGEST[kind]]
    for (const p of spec.points) bays.push({
      id: p.id, x: p.x, z: p.z, fx: Math.sin(p.heading), fz: Math.cos(p.heading),
      hl: (L / 2 + 0.5) / mPerUnit(s), hw: (W / 2 + SIDE_CLEAR_M) / mPerUnit(s), top: (H + HEAD_CLEAR_M) / mPerUnitY(s),
    })
  }
  const f = firstHits(buildModel(tile, { noMerge: true })!, bays)
  return [...f].map(([point, q]) => ({ tile, point, x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(2) }))
}

const TILES = Object.keys(SERVICE_POINTS)

describe('round-6 bays fit the real vehicles', () => {
  it.each(TILES)('%s: every bay clears its largest vehicle (1 m sides, 1 m headroom)', (tile) => {
    expect(bayHits(tile)).toEqual([])
  })

  it.each(TILES)('%s: bays and queue slots do not overlap', (tile) => {
    const spec = SERVICE_POINTS[tile as keyof typeof SERVICE_POINTS]!
    const s = lotScale(tile)
    const [L, , W] = spec.serves.map((k) => FLEET_M[LARGEST[k]]).sort((a, b) => b[0] - a[0])[0]
    const pts = spec.points
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j]
      const dx = (b.x - a.x) * mPerUnit(s), dz = (b.z - a.z) * mPerUnit(s)
      const along = Math.abs(dx * Math.sin(a.heading) + dz * Math.cos(a.heading))
      const across = Math.abs(-dx * Math.cos(a.heading) + dz * Math.sin(a.heading))
      // Nose-to-tail needs length + 2 m; side-by-side needs width + 2 m.
      expect(along >= L + 2 - 0.01 || across >= W + 2 - 0.01, `${tile} ${a.id}-${b.id}`).toBe(true)
    }
    for (let i = 1; i < spec.queue.length; i++) {
      const d = Math.hypot(spec.queue[i].x - spec.queue[i - 1].x, spec.queue[i].z - spec.queue[i - 1].z) * mPerUnit(s)
      expect(d, `${tile} queue ${i}`).toBeGreaterThanOrEqual(L + 2 - 0.01)
    }
  })

  it('fuel: the tanker drive-through lane is clear end to end (room to swing in and out)', () => {
    // A 10 m tanker runs the whole loading lane (z 3.4) from lot edge to lot edge.
    const save = SERVICE_POINTS.fuel!
    const lanePt = { ...save.points[0], id: 'lane', x: 0 }
    ;(SERVICE_POINTS as Record<string, unknown>).fuel = { ...save, points: [lanePt] }
    try {
      const s = lotScale('fuel')
      const hl = HALF - 0.25 - fromM(5.5, s) // anywhere the truck fits inside the lot-edge kerb
      const hits: string[] = []
      for (let x = -hl; x <= hl; x += 0.25) {
        lanePt.x = x
        hits.push(...bayHits('fuel').map((h) => `${x.toFixed(2)}: ${h.x},${h.y},${h.z}`))
      }
      expect(hits).toEqual([])
    } finally {
      ;(SERVICE_POINTS as Record<string, unknown>).fuel = save
    }
  })

  it.each(['small', 'wide', 'jumbo'] as const)('hangar %s: doors clear the design aircraft (span + 2 m, tail + 1 m)', (tier) => {
    const g = buildModel('hangar', { hangarTier: tier, noMerge: true })!
    const door = g.userData.hangarDoor as { w: number; h: number }
    const s = lotScale('hangar', tier)
    const [span, tail] = HANGAR_DESIGN[tier]
    expect(door.w * mPerUnit(s)).toBeGreaterThanOrEqual(span + 2)
    expect(door.h * mPerUnitY(s)).toBeGreaterThanOrEqual(tail + 1)
  })
})
