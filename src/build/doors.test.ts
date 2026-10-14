import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { AnimSystem, siteSignals } from './anim'
import { buildModel } from './models/index'
import { SERVICE_POINTS } from './servicePoints'

const doors = (g: THREE.Object3D) => {
  const out: THREE.Object3D[] = []
  g.traverse((o) => { const a = o.userData.anim; if (a && (a.kind === 'roll' || a.kind === 'slide') && a.point != null) out.push(o) })
  return out
}

describe('round-7 vehicle doors follow service-point state', () => {
  it.each(['fire', 'cargo', 'bags', 'kitchen', 'termbus', 'xferbus'] as const)('%s: one door per service point', (tile) => {
    const pts = SERVICE_POINTS[tile]!.points.length
    const idx = new Set(doors(buildModel(tile)!).map((o) => o.userData.anim.point))
    expect([...idx].sort()).toEqual([...Array(pts).keys()])
  })

  it.each(['fire', 'cargo', 'bags', 'kitchen', 'termbus'] as const)('%s: only the used bay opens, and it closes after the vehicle leaves', (tile) => {
    const g = buildModel(tile)!
    g.userData.cellKey = 'k'
    const root = new THREE.Group()
    root.add(g)
    const sys = new AnimSystem()
    sys.collect(root)
    const n = SERVICE_POINTS[tile]!.points.length
    const ds = doors(g).filter((o) => o.userData.anim.kind === 'roll')
    const rest = ds.map((o) => o.scale.y)
    let pts = Array.from({ length: n }, (_, i) => i === 1)
    for (let i = 0; i < 120; i++) sys.update(1 / 30, { always: 1 }, undefined, () => siteSignals(tile, pts))
    ds.forEach((o, i) => {
      if (o.userData.anim.point === 1) expect(o.scale.y, `${tile} door ${i} open`).toBeLessThan(rest[i] * 0.3)
      else expect(o.scale.y, `${tile} door ${i} shut`).toBeCloseTo(rest[i], 3)
    })
    pts = pts.map(() => false)
    for (let i = 0; i < 240; i++) sys.update(1 / 30, { always: 1 }, undefined, () => siteSignals(tile, pts))
    ds.forEach((o, i) => expect(o.scale.y, `${tile} door ${i} closed again`).toBeGreaterThan(rest[i] * 0.97))
  })

  it('hangar doors open for a tow tug on the door point as well as for maintenance', () => {
    expect(siteSignals('hangar', [true], false)!.hangarBusy).toBe(1)
    expect(siteSignals('hangar', [false], false)!.hangarBusy).toBe(0)
    expect(siteSignals('hangar', [false], true)!.hangarBusy).toBe(1)
  })

  it('door state is pure: the same point history gives the same pose (save/load safe)', () => {
    const run = () => {
      const g = buildModel('fire')!
      g.userData.cellKey = 'k'
      const root = new THREE.Group(); root.add(g)
      const sys = new AnimSystem(); sys.collect(root)
      for (let i = 0; i < 90; i++) sys.update(1 / 30, {}, undefined, () => siteSignals('fire', [i < 45, false, true]))
      return doors(g).map((o) => +o.scale.y.toFixed(6))
    }
    expect(run()).toEqual(run())
  })
})
