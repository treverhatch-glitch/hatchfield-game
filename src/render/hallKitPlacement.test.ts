import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildHallDetail, hallDetailPlacements, hallPickMesh } from './hallKitDetail.ts'
import { layoutItems } from './hallKitMeshes.ts'

describe('hall kit placement', () => {
  it('gives a placed desk, lane, toilet and bench a mesh and a pick box at scale 1', () => {
    const specs = [
      { id: 'desk-1', def: 'checkin_belt' },
      { id: 'lane-1', def: 'security_small' },
      { id: 'wc-1', def: 'toilet' },
      { id: 'bench-1', def: 'bench' },
    ] as const
    const items = specs.map((spec, i) => ({
      id: spec.id,
      def: spec.def,
      c: i,
      r: 0,
      wear: 0,
      rot: 0,
    }))
    const laid = layoutItems(items, 8, 5)
    const { group } = buildHallDetail(laid, 8, 5)
    expect(group.children.length).toBeGreaterThan(0)
    group.traverse((obj) => {
      expect(obj.scale.x).toBeCloseTo(1, 5)
      expect(obj.scale.y).toBeCloseTo(1, 5)
      expect(obj.scale.z).toBeCloseTo(1, 5)
    })
    const placements = hallDetailPlacements(laid, 8, 5)
    expect(placements.map((p) => p.type)).toEqual([
      'checkin_pair',
      'security_lane',
      'restroom_block',
      'seat_row',
    ])
    expect(placements.every((p) => p.scale === 1)).toBe(true)
    const squeezed = hallDetailPlacements(laid, 1, 1)
    expect(squeezed.every((p) => p.scale === 1)).toBe(true)
    for (const { item, x, z } of laid) {
      const pick = hallPickMesh(item, x, z)
      expect(pick.name).toBe('hall-pick')
      expect(pick.userData.facilityId).toBe(`item:${item.id}`)
      const mat = pick.material as THREE.MeshBasicMaterial
      expect(mat.visible, 'pick box must never draw').toBe(false)
      pick.updateMatrixWorld()
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0))
      expect(ray.intersectObject(pick).length, 'pick box must still be hit').toBeGreaterThan(0)
      pick.geometry.dispose()
      mat.dispose()
    }
  })
})
