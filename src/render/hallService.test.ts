import { describe, expect, it } from 'vitest'
import type { HallNav } from '../game/hallNav'
import type { FacilityMetrics } from '../paxnav/paxnav.ts'
import type { CrewRole } from '../paxnav/crew.ts'
import { barrierPosts, HallServiceFx, servicePoint, type DeskBrand } from './hallService'

function facility(id: string, kind: FacilityMetrics['kind'], line: { x: number; z: number }[], serving = false, served = 0, queueLength = 0): FacilityMetrics {
  return { id, kind, roomId: null, queueLength, serving, incoming: 0, avgWaitSec: 0, longestWaitSec: 0, estWaitSec: 0, staffed: true, inUse: serving || queueLength > 0, serviceSec: 30, served, leftQueue: 0, stock: null, line }
}

function fakeNav(metrics: () => FacilityMetrics[], crew: (CrewRole | null)[] = []) {
  const nav = { revision: 1 }
  return {
    live: true,
    nav,
    metrics,
    originX: 0,
    originZ: 0,
    crewRole: (i: number) => crew[i] ?? null,
    idAt: (i: number) => `crew${i}`,
  } as unknown as HallNav
}

const line = (n: number) => Array.from({ length: n }, (_, i) => ({ x: 0, z: i * 0.5 }))
const brands: DeskBrand[] = [
  { id: 'a', name: 'Alpine Swift', code: 'ASW', primary: '#1f4e9c', secondary: '#ffffff' },
  { id: 'b', name: 'Andaman Hop', code: 'ADH', primary: '#0f7a5a', secondary: '#f2c200' },
]

describe('hall service geometry', () => {
  it('faces the desk from the queue', () => {
    const sp = servicePoint({ line: line(4) })!
    expect(sp.dz).toBeCloseTo(-1)
    expect(sp.dx).toBeCloseTo(0)
  })

  it('places barrier posts on both sides of the line, not at the service point', () => {
    const posts = barrierPosts(line(13), 1.5, 0.55)
    expect(posts.length).toBe(8)
    expect(posts.every((p) => Math.abs(Math.abs(p.x) - 0.55) < 1e-6)).toBe(true)
    expect(Math.min(...posts.map((p) => p.z))).toBeGreaterThan(0.5)
  })
})

describe('check-in and security interiors', () => {
  it('signs each desk with an airline and shows a bag only while serving', () => {
    let serving = false
    let served = 0
    const metrics = () => [facility('d1', 'checkin_desk', line(8), serving, served), facility('d2', 'checkin_desk', line(8).map((p) => ({ x: p.x + 4, z: p.z })))]
    const fx = new HallServiceFx()
    const nav = fakeNav(metrics)
    fx.sync(nav, 0, null, brands)
    expect(fx.stats.desks).toBe(2)
    const signs = fx.group.getObjectByName('hall-desk-signs')!.children.filter((c) => c.name.startsWith('desk-sign:'))
    expect(signs.map((s) => s.userData.brand)).toEqual(['a', 'b'])
    const third = () => [
      facility('d1', 'checkin_desk', line(8)),
      facility('d2', 'checkin_desk', line(8).map((p) => ({ x: p.x + 4, z: p.z }))),
      facility('d3', 'checkin_desk', line(8).map((p) => ({ x: p.x + 8, z: p.z }))),
    ]
    const idle = new HallServiceFx()
    idle.sync(fakeNav(third), 0, null, brands)
    const idleSigns = idle.group.getObjectByName('hall-desk-signs')!.children.filter((c) => c.name.startsWith('desk-sign:'))
    expect(idleSigns.map((s) => s.userData.brand)).toEqual(['a', 'b', 'neutral'])
    expect(fx.stats.bags).toBe(0)
    serving = true
    fx.sync(nav, 1, null, brands)
    expect(fx.stats.bags).toBe(1)
    // Service completes: the weighed bag slides off, then it is gone.
    serving = false
    served = 1
    fx.sync(nav, 2, null, brands)
    expect(fx.stats.bags).toBe(1)
    fx.sync(nav, 5, null, brands)
    expect(fx.stats.bags).toBe(0)
    expect(fx.stats.posts).toBeGreaterThan(4)
  })

  it('rolls X-ray trays only while the lane is screening', () => {
    let serving = false
    const metrics = () => [facility('s1', 'security_lane', line(10), serving, 0, serving ? 3 : 0)]
    const fx = new HallServiceFx()
    const nav = fakeNav(metrics)
    fx.sync(nav, 0, null, [])
    const tray = fx.group.getObjectByName('hall-xray-trays') as import('three').InstancedMesh
    const pos = () => {
      const m = new (tray.instanceMatrix.array.constructor as Float32ArrayConstructor)(tray.instanceMatrix.array)
      return m[14]
    }
    fx.sync(nav, 0.2, null, [])
    const idle = pos()
    fx.sync(nav, 0.4, null, [])
    expect(pos()).toBeCloseTo(idle)
    serving = true
    fx.sync(nav, 0.7, null, [])
    fx.sync(nav, 0.9, null, [])
    expect(pos()).not.toBeCloseTo(idle)
    expect(fx.stats.trays).toBeGreaterThan(0)
  })

  it('draws desk agents and officers as figures, other crew stay with the crowd', () => {
    const fx = new HallServiceFx()
    const nav = fakeNav(() => [facility('d1', 'checkin_desk', line(6), true)], ['agent', 'screener', 'cleaner'])
    const poses = new Float32Array([0, 0, -1.8, 0, 3, 0, 3, 0, 6, 0, 6, 0])
    fx.sync(nav, 0, null, brands, poses, 3)
    expect(fx.stats.staff).toBe(2)
    expect(HallServiceFx.drawsRole('agent')).toBe(true)
    expect(HallServiceFx.drawsRole('cleaner')).toBe(false)
    expect(HallServiceFx.drawsRole(null)).toBe(false)
  })
})
