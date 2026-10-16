import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { split1f } from '../terminalbuild/starter/split1f.ts'
import { buildFittingMeshes, fittingPickMesh } from './interior/fittings.ts'
import { pickedFacilityId } from './interior/picking.ts'

describe('hall kit placement', () => {
  it('gives a placed desk, lane, toilet and bench a mesh and a pick box at scale 1', () => {
    const layout = split1f()
    const want = ['checkin_desk', 'security_lane', 'wc_block', 'bench']
    const group = buildFittingMeshes(layout)
    expect(group.children.length).toBeGreaterThan(0)
    group.traverse((obj) => {
      expect(obj.scale.x, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.y, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.z, obj.name).toBeCloseTo(1, 5)
    })
    for (const kind of want) {
      const fitting = layout.fittings?.find((f) => f.kind === kind)
      expect(fitting, kind).toBeTruthy()
      const pick = fittingPickMesh(layout, fitting!)
      expect(pick.name).toBe('hall-pick')
      expect(pick.userData.facilityId).toBe(fitting!.id)
      const mat = pick.material as THREE.MeshBasicMaterial
      expect(mat.visible, 'pick box must never draw').toBe(false)
      pick.updateMatrixWorld()
      const ray = new THREE.Raycaster(new THREE.Vector3(pick.position.x, 20, pick.position.z), new THREE.Vector3(0, -1, 0))
      expect(ray.intersectObject(pick).length, `${kind} pick box must still be hit`).toBeGreaterThan(0)
      pick.geometry.dispose()
      mat.dispose()
    }
    const lane = layout.fittings!.find((f) => f.kind === 'security_lane')!
    const lanePick = fittingPickMesh(layout, lane)
    expect(lanePick.userData.servicePick).toBe(true)
    expect((lanePick.geometry as THREE.BoxGeometry).parameters.depth).toBeGreaterThanOrEqual(10)
    lanePick.geometry.dispose()
    ;(lanePick.material as THREE.Material).dispose()
    const bench = layout.fittings!.find((f) => f.kind === 'bench')!
    const benchPick = fittingPickMesh(layout, bench)
    expect(benchPick.userData.servicePick).toBe(false)
    benchPick.geometry.dispose()
    ;(benchPick.material as THREE.Material).dispose()
    expect(
      pickedFacilityId([
        { id: 'item:lane-1', fromCenter: 0.2 },
        { id: 'lane-0', fromCenter: 4 },
      ]),
    ).toBe('lane-0')
    expect(
      pickedFacilityId([
        { id: 'item:claim-1', fromCenter: 6 },
        { id: 'item:bags', fromCenter: 0.4 },
      ]),
    ).toBe('item:bags')
    expect(pickedFacilityId([])).toBeNull()
  })
})
