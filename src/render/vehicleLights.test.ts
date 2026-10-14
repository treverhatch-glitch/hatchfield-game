import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { VehicleHeadlights } from './vehicleLights'

function van(x: number, z: number, yaw: number) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = yaw
  g.userData.headlight = { length: 2.6, width: 1.2 }
  return g
}

describe('vehicle headlights', () => {
  it('parks two lamps per vehicle at night and hides them by day', () => {
    const lights = new VehicleHeadlights()
    const roots = [van(0, 0, 0), van(8, 2, Math.PI / 2)]
    lights.sync(roots, 0, true)
    const lamps = lights.group.getObjectByName('vehicle-headlight-lamps') as THREE.InstancedMesh
    expect(lights.group.visible).toBe(false)
    expect(lamps.count).toBe(0)
    expect(lights.group.getObjectByName('vehicle-headlight-pools')).toBeUndefined()

    lights.sync(roots, 1, false)
    expect(lights.group.visible).toBe(true)
    expect(lamps.count).toBe(4)
    expect(lights.group.getObjectByName('vehicle-headlight-pools')).toBeUndefined()

    lights.sync(roots, 1, true)
    const pools = lights.group.getObjectByName('vehicle-headlight-pools') as THREE.InstancedMesh
    expect(pools.count).toBe(2)
    const m = new THREE.Matrix4()
    lamps.getMatrixAt(0, m)
    const p = new THREE.Vector3().setFromMatrixPosition(m)
    expect(p.x).toBeGreaterThan(0.5)
    expect(p.y).toBeGreaterThan(0.2)

    lights.sync(roots, 0.01, true)
    expect(lights.group.visible).toBe(false)
    expect(pools.count).toBe(0)
    lights.dispose()
  })
})
