import { afterAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyBridge, createBridges } from './bridges'
import { createAircraft, disposeAircraftLibrary, getAircraftSpec, LOD_DIST, releaseAircraft, updateAircraft } from './factory'
import type { CrossfadeLOD } from './lod'
import type { PaintedMesh } from './pool'

const LIVERY = { body: '#2f6f9a', stripe: '#e8eef5' }

/** Visible meshes still drawing a transparent fade copy. */
function fading(root: THREE.Object3D, dist: number): number {
  const lod = root.getObjectByName('lod') as CrossfadeLOD
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 0, dist)
  camera.updateMatrixWorld()
  root.updateMatrixWorld(true)
  lod.update(camera)
  const b = lod.buckets!
  const groups: [THREE.Group, PaintedMesh[]][] = [
    [b.lowGroup, b.low],
    [b.midGroup, b.mid],
    [b.highGroup, b.high],
  ]
  let n = 0
  for (const [group, meshes] of groups) {
    if (!group.visible) continue
    for (const mesh of meshes) if (mesh.visible && mesh.material === mesh.userData.fadeMat) n++
  }
  return n
}

afterAll(() => {
  disposeAircraftLibrary()
})

describe('jet bridge and the fuselage fade', () => {
  const crossfade = (LOD_DIST.mid + LOD_DIST.low) / 2

  it('fades the skin in the crossfade band when no bridge is out', () => {
    const craft = createAircraft('b738', LIVERY)
    updateAircraft(craft, true)
    expect(fading(craft, crossfade)).toBeGreaterThan(0)
    releaseAircraft(craft)
  })

  it('keeps the skin opaque while a bridge is out, at every distance', () => {
    for (const dist of [20, 88, LOD_DIST.highBlend - 100, crossfade, LOD_DIST.low + 50]) {
      const craft = createAircraft('b738', LIVERY)
      updateAircraft(craft, true, undefined, true)
      expect(fading(craft, dist)).toBe(0)
      releaseAircraft(craft)
    }
  })

  it('moves the aircraft-space cab with applyBridge and never into the skin', () => {
    for (const id of ['crj700', 'e175', 'b738', 'a320', 'b789']) {
      const skin = getAircraftSpec(id).rx
      for (const side of [1, -1] as const) {
        const group = createBridges(id, side)
        const cabs = group.children.filter((o) => o.name === 'bridge' || o.name === 'bridge-upper')
        expect(cabs.length).toBeGreaterThan(0)
        let last = Infinity
        for (const u of [0, 0.25, 0.5, 0.75, 1]) {
          applyBridge(group, u)
          for (const cab of cabs) {
            const inner = Math.abs(cab.position.z) - cab.scale.z / 2
            expect(inner).toBeGreaterThan(skin)
          }
          const reach = Math.abs(cabs[0]!.position.z)
          expect(reach).toBeLessThan(last + 1e-9)
          last = reach
        }
      }
    }
  })
})
