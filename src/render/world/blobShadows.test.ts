import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { BLOB_LOOK, BlobShadows } from './blobShadows'

const at = (b: BlobShadows, i = 0) => {
  const m = new THREE.Matrix4()
  b.mesh.getMatrixAt(i, m)
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  m.decompose(p, q, s)
  return { p, s }
}

describe('BlobShadows', () => {
  const truck = { x: 0, y: 0, z: 0, yaw: 0, length: 4, width: 1.2, height: 1.5 }

  it('is strong by day and soft but visible at night', () => {
    const b = new BlobShadows('t', 4)
    b.sync([truck], new THREE.Vector3(0.3, 1, 0.2), 1)
    expect((b.mesh.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(BLOB_LOOK.day)
    b.sync([truck], new THREE.Vector3(0.3, 1, 0.2), 0)
    const night = (b.mesh.material as THREE.MeshBasicMaterial).opacity
    expect(night).toBeCloseTo(BLOB_LOOK.night)
    expect(night).toBeGreaterThanOrEqual(0.45)
    expect(BLOB_LOOK.day).toBeGreaterThan(night)
  })

  it('still spills out beside the body under an overhead sun', () => {
    const b = new BlobShadows('t', 4)
    b.sync([truck], new THREE.Vector3(0, 1, 0), 1)
    const { p } = at(b)
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(BLOB_LOOK.minSpill * truck.height - 1e-6)
  })

  it('falls away from the sun', () => {
    const b = new BlobShadows('t', 4)
    b.sync([truck], new THREE.Vector3(1, 1, 0), 1)
    expect(at(b).p.x).toBeLessThan(0)
  })

  it('shrinks and slides further as the caster lifts', () => {
    const b = new BlobShadows('t', 4)
    b.sync([truck, { ...truck, y: 10, lift: 10 }], new THREE.Vector3(1, 1, 0), 1)
    const g = at(b, 0)
    const air = at(b, 1)
    expect(air.s.x).toBeLessThan(g.s.x)
    expect(Math.abs(air.p.x)).toBeGreaterThan(Math.abs(g.p.x))
    expect(air.p.y).toBeCloseTo(BLOB_LOOK.y, 5)
  })
})
