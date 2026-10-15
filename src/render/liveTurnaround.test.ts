import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
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

  it('spawns a locked hose and belt when the stand is in service and no truck has arrived', () => {
    const root = new THREE.Group()
    const layer = new LiveTurnaround(root)
    const drawn = layer.sync([stand({ t: 20 })], [], 3, null, 0.016)
    expect(drawn.spawned).toBe(2)
    expect(drawn.hoses).toBe(1)
    expect(drawn.bags).toBe(3)
    expect(drawn.crew).toBeGreaterThan(0)
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
