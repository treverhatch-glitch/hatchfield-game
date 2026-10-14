import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ConstructionLayer, ConstructionPiece, siteProgress, stageAt } from './construction'

const tower = () => {
  const g = new THREE.Group()
  const m = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshStandardMaterial())
  m.position.y = 2
  g.add(m)
  return g
}

describe('construction stages', () => {
  it('walks foundation → frame → finish → done', () => {
    expect(stageAt(0).stage).toBe('foundation')
    expect(stageAt(0.3).stage).toBe('frame')
    expect(stageAt(0.7).stage).toBe('finish')
    expect(stageAt(1).stage).toBe('done')
    expect(stageAt(Number.NaN).stage).toBe('foundation')
  })
  it('reveal fractions are monotonic', () => {
    let prev = stageAt(0)
    for (let p = 0.01; p <= 1; p += 0.01) {
      const s = stageAt(p)
      expect(s.frame).toBeGreaterThanOrEqual(prev.frame)
      expect(s.finish).toBeGreaterThanOrEqual(prev.finish)
      prev = s
    }
  })
  it('siteProgress is safe', () => {
    expect(siteProgress(5, 10)).toBe(0.5)
    expect(siteProgress(5, 0)).toBe(1)
    expect(siteProgress(50, 10)).toBe(1)
  })
})

describe('ConstructionPiece', () => {
  it('clips a cloned material and leaves the source untouched', () => {
    const model = tower()
    const src = (model.children[0] as THREE.Mesh).material as THREE.Material
    const piece = new ConstructionPiece(model)
    const used = (model.children[0] as THREE.Mesh).material as THREE.Material
    expect(used).not.toBe(src)
    expect(used.clippingPlanes?.length).toBe(1)
    expect(src.clippingPlanes ?? null).toBeNull()
    expect(piece.height).toBeCloseTo(4)
  })
  it('hides the model during foundation and reveals it while finishing', () => {
    const model = tower()
    const piece = new ConstructionPiece(model)
    piece.update(0.1)
    expect(model.visible).toBe(false)
    piece.update(0.8)
    expect(model.visible).toBe(true)
    const plane = ((model.children[0] as THREE.Mesh).material as THREE.Material).clippingPlanes![0]
    expect(plane.constant).toBeGreaterThan(0)
    expect(plane.constant).toBeLessThan(4)
  })
})

describe('ConstructionLayer', () => {
  it('adds a piece per site cell and drops it when the site completes', () => {
    const layer = new ConstructionLayer(() => tower())
    const site = { id: 's1', tile: 'tower', cells: [{ c: 1, r: 1 }, { c: 2, r: 1 }], elapsed: 1, duration: 4 }
    layer.sync([site])
    expect(layer.size).toBe(2)
    layer.sync([{ ...site, elapsed: 3 }])
    expect(layer.size).toBe(2)
    layer.sync([])
    expect(layer.size).toBe(0)
    expect(layer.group.children.length).toBe(0)
  })
  it('skips cells with no mesh', () => {
    const layer = new ConstructionLayer(() => null)
    layer.sync([{ id: 'x', tile: 'grass', cells: [{ c: 0, r: 0 }], elapsed: 0, duration: 1 }])
    expect(layer.size).toBe(0)
  })
})
