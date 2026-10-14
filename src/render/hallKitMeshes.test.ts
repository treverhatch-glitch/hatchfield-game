import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ITEMS, type PlacedItem } from '../game/terminal'
import { KIT_MESH, buildKitInstances, disposeKitInstances, hasKitMesh } from './hallKitMeshes'

function placed(def: PlacedItem['def'], id: string): PlacedItem {
  return { id, def, c: 0, r: 0, wear: 0, rot: 0 }
}

describe('hall kit meshes', () => {
  it('gives every catalog item a coloured mesh and shares materials', () => {
    for (const item of ITEMS) {
      expect(hasKitMesh(item.id)).toBe(true)
      const parts = KIT_MESH[item.id]
      expect(parts.length).toBeGreaterThan(0)
      expect(parts.every((part) => part.color !== '#ffffff')).toBe(true)
    }
    expect(hasKitMesh('trash_can_full')).toBe(true)
    const a = buildKitInstances([{ item: placed('kiosk', 'a'), x: 0, z: 0 }])
    const b = buildKitInstances([{ item: placed('kiosk', 'b'), x: 2, z: 0 }])
    const matA = (a.children[0] as THREE.Mesh).material
    const matB = (b.children[0] as THREE.Mesh).material
    expect(matA).toBe(matB)
    disposeKitInstances(a)
    disposeKitInstances(b)
  })
})
