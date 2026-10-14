import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GHOST_BAD, GHOST_OK, ghostMaterials, ghostify } from './ghost'

describe('ghost', () => {
  it('tints green when valid and red when not', () => {
    expect(ghostMaterials(true).body.color.getHex()).toBe(GHOST_OK)
    expect(ghostMaterials(false).body.color.getHex()).toBe(GHOST_BAD)
    expect(ghostMaterials(true).body.transparent).toBe(true)
  })
  it('keeps the real model geometry and footprint, swaps materials, adds outlines', () => {
    const g = new THREE.Group()
    const geo = new THREE.BoxGeometry(3, 2, 5)
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 'blue' }))
    g.add(mesh)
    const before = new THREE.Box3().setFromObject(g)
    const mats = ghostMaterials(true)
    ghostify(g, mats)
    expect(mesh.geometry).toBe(geo)
    expect(mesh.material).toBe(mats.body)
    expect(mesh.children.some((c) => c instanceof THREE.LineSegments)).toBe(true)
    const after = new THREE.Box3().setFromObject(mesh)
    expect(after.getSize(new THREE.Vector3()).x).toBeCloseTo(before.getSize(new THREE.Vector3()).x)
  })
})
