import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { WORLD_PER_METER } from './aircraft/specs.ts'
import { LiveTurnaround, socketWorld, type TurnaroundStand, type TurnaroundTruck } from './liveTurnaround.ts'

function stand(over: Partial<TurnaroundStand> = {}): TurnaroundStand {
  return {
    id: 'f1',
    airframeId: 'b738',
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    t: 4,
    servicing: true,
    nose: 19,
    noseGear: 14,
    semiSpan: 18,
    tail: -19,
    ...over,
  }
}

describe('live turnaround uses the stand modules', () => {
  it('places arrival crew, a fuel hose, and bags on the belt at a real stand', () => {
    const root = new THREE.Group()
    const layer = new LiveTurnaround(root)
    const fuel: TurnaroundTruck = {
      id: 'fuel-1',
      kind: 'fuel',
      x: 2,
      y: 0,
      z: 4,
      yaw: Math.PI,
      ext: 1,
      moving: false,
    }
    const belt: TurnaroundTruck = {
      id: 'belt-1',
      kind: 'belt_loader',
      x: -3,
      y: 0,
      z: 3,
      yaw: Math.PI / 2,
      ext: 1,
      moving: false,
    }
    const drawn = layer.sync([stand()], [fuel, belt], 8, null, 0.016)
    expect(drawn.crew).toBeGreaterThan(0)
    expect(drawn.hoses).toBe(1)
    expect(drawn.bags).toBe(3)
    expect(root.getObjectByName('hose:fuel-1')).toBeTruthy()
    expect(root.getObjectByName('bag:belt-1:0')).toBeTruthy()
    expect(root.getObjectByName('live-turnaround')).toBe(layer.group)
    const again = layer.sync([stand({ t: 40, servicing: false })], [], 9, null, 0.016)
    expect(again.hoses).toBe(0)
    expect(again.bags).toBe(0)
    layer.dispose()
  })

  it('draws no stand-in tanker or belt loader while the real trucks are still away', () => {
    const root = new THREE.Group()
    const layer = new LiveTurnaround(root)
    const farAway: TurnaroundTruck = { id: 'fuel-1', kind: 'fuel', x: 80, y: 0, z: 60, yaw: 0, ext: 0, moving: true }
    const drawn = layer.sync([stand({ t: 20 })], [farAway], 3, null, 0.016)
    expect(drawn.hoses).toBe(0)
    expect(drawn.bags).toBe(0)
    expect(drawn.crew).toBeGreaterThan(0)
    const rigs: string[] = []
    root.traverse((obj) => {
      if (obj.name.startsWith('rig:')) rigs.push(obj.name)
    })
    expect(rigs).toEqual([])
    layer.dispose()
  })

  it('builds stand crew at apron scale, not one world unit per metre', () => {
    const root = new THREE.Group()
    const layer = new LiveTurnaround(root)
    layer.sync([stand({ t: 4 })], [], 3, null, 0.016)
    const m = new THREE.Matrix4()
    const at = new THREE.Vector3()
    let top = 0
    let drawn = 0
    root.traverse((obj) => {
      const mesh = obj as THREE.InstancedMesh
      if (!mesh.isInstancedMesh || !mesh.name.startsWith('people-')) return
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m)
        top = Math.max(top, at.setFromMatrixPosition(m).y)
        drawn += 1
      }
    })
    expect(drawn).toBeGreaterThan(0)
    expect(top).toBeLessThan(2 * WORLD_PER_METER)
    layer.dispose()
  })
})

describe('socketWorld', () => {
  it('keeps a local +X offset on the world +X axis when yaw is 0', () => {
    const at = socketWorld(10, 1, 4, 0, 2, [3, 0.5, 0])
    expect(at.x).toBeCloseTo(16)
    expect(at.y).toBeCloseTo(2)
    expect(at.z).toBeCloseTo(4)
  })
})
