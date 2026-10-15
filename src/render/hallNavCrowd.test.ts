import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { HallNav } from '../game/hallNav'
import type { CrewRole } from '../paxnav/crew.ts'
import { HallNavCrowd } from './hallNavCrowd'

function fake(n: number, phase: (i: number) => number, role: (i: number) => CrewRole | null = () => null): HallNav {
  return {
    live: true,
    nav: null,
    count: n,
    roster: 1,
    originX: 0,
    originZ: 0,
    writePoses(out: Float32Array) {
      for (let i = 0; i < n; i++) {
        out[i * 4] = i * 1.4
        out[i * 4 + 1] = 0
        out[i * 4 + 2] = 1
        out[i * 4 + 3] = 0
      }
      return n
    },
    writePhases(out: Uint8Array) {
      for (let i = 0; i < n; i++) out[i] = phase(i)
      return n
    },
    writeFlags(out: Uint8Array) {
      out.fill(0, 0, n)
      return n
    },
    idAt: (i: number) => `w${i}`,
    crewRole: role,
    origin: () => ({ x: 0, z: 0 }),
    metrics: () => [],
    loads: () => [],
  } as unknown as HallNav
}

describe('hall walker figures', () => {
  it('draws limbs for every walker and keeps the waist on the floor band', () => {
    const crowd = new HallNavCrowd()
    const n = 12
    expect(crowd.sync(fake(n, () => 0), 0.2)).toBe(n)
    const body = crowd.group.getObjectByName('hall-nav-body') as THREE.InstancedMesh
    const legs = crowd.group.getObjectByName('hall-nav-leg') as THREE.InstancedMesh
    const arms = crowd.group.getObjectByName('hall-nav-arm') as THREE.InstancedMesh
    expect(body.count).toBe(n)
    expect(legs.count).toBe(n * 2)
    expect(arms.count).toBe(n * 2)
    const y = (body.instanceMatrix.array as Float32Array)[13]
    expect(y).toBeGreaterThan(0.5)
    expect(y).toBeLessThan(0.8)
    const drawn = crowd.group.children.filter((c) => c instanceof THREE.InstancedMesh && c.count > 0)
    expect(drawn.length).toBeLessThanOrEqual(8)
    crowd.dispose()
  })

  it('swings a walking leg farther than an idle one, and mixes roller, backpack and none', () => {
    const crowd = new HallNavCrowd()
    const nav = fake(40, (i) => (i % 2 === 0 ? 0 : 1))
    let walkMax = 0
    let idleMax = 0
    for (let step = 0; step < 8; step++) {
      crowd.sync(nav, step * 0.2)
      const legs = crowd.group.getObjectByName('hall-nav-leg') as THREE.InstancedMesh
      const arr = legs.instanceMatrix.array as Float32Array
      for (let i = 0; i < 40; i++) {
        const v = Math.abs(arr[i * 2 * 16 + 9])
        if (i % 2 === 0) walkMax = Math.max(walkMax, v)
        else idleMax = Math.max(idleMax, v)
      }
    }
    expect(walkMax).toBeGreaterThan(0.2)
    expect(walkMax).toBeGreaterThan(idleMax)
    const bag = crowd.group.getObjectByName('hall-nav-bag') as THREE.InstancedMesh
    const ys = new Set<number>()
    const gm = bag.instanceMatrix.array as Float32Array
    for (let i = 0; i < bag.count; i++) ys.add(gm[i * 16 + 13] < 0.4 ? 0 : 1)
    expect(bag.count).toBeGreaterThan(0)
    expect(bag.count).toBeLessThan(40)
    expect(ys.size).toBe(2)
    crowd.dispose()
  })

  it('paints check-in, security and hi-vis as different shirts', () => {
    const crowd = new HallNavCrowd()
    crowd.sync(
      fake(3, () => 1, (i) => (['agent', 'screener', 'cleaner'] as const)[i]),
      0,
    )
    const body = crowd.group.getObjectByName('hall-nav-body') as THREE.InstancedMesh
    const col = body.instanceColor!.array as Float32Array
    const key = (i: number) => `${col[i * 3].toFixed(3)}:${col[i * 3 + 1].toFixed(3)}:${col[i * 3 + 2].toFixed(3)}`
    expect(new Set([key(0), key(1), key(2)]).size).toBe(3)
    const bag = crowd.group.getObjectByName('hall-nav-bag') as THREE.InstancedMesh
    expect(bag.count).toBe(0)
    crowd.dispose()
  })
})