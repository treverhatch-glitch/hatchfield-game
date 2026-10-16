import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildHallDetail, hallDetailPlacements, hallPickMesh, pickedFacilityId } from './hallKitDetail.ts'
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
    const lane = laid.find((row) => row.item.def === 'security_small')!
    const lanePick = hallPickMesh(lane.item, lane.x, lane.z)
    const laneGeo = lanePick.geometry as THREE.BoxGeometry
    expect(lanePick.userData.servicePick).toBe(true)
    expect(laneGeo.parameters.width).toBeGreaterThan(10)
    lanePick.updateMatrixWorld()
    const belt = new THREE.Raycaster(new THREE.Vector3(lane.x + 5, 8, lane.z), new THREE.Vector3(0, -1, 0))
    expect(belt.intersectObject(lanePick).length, 'a click on the lane body must hit').toBeGreaterThan(0)
    lanePick.geometry.dispose()
    ;(lanePick.material as THREE.Material).dispose()
    const bench = laid.find((row) => row.item.def === 'bench')!
    const benchPick = hallPickMesh(bench.item, bench.x, bench.z)
    expect(benchPick.userData.servicePick).toBe(false)
    benchPick.geometry.dispose()
    ;(benchPick.material as THREE.Material).dispose()
    const bags = hallPickMesh({ id: 'bags', def: 'bag_system', rot: 0 }, 0, 0)
    expect(bags.userData.servicePick).toBe(true)
    expect((bags.geometry as THREE.BoxGeometry).parameters.width).toBeGreaterThan(5)
    bags.geometry.dispose()
    ;(bags.material as THREE.Material).dispose()
    expect(pickedFacilityId([
      { id: 'item:lane-1', fromCenter: 0.2 },
      { id: 'lane-0', fromCenter: 4 },
    ])).toBe('lane-0')
    expect(pickedFacilityId([
      { id: 'item:claim-1', fromCenter: 6 },
      { id: 'item:bags', fromCenter: 0.4 },
    ])).toBe('item:bags')
    expect(pickedFacilityId([])).toBeNull()
  })
})
