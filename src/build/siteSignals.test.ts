import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { AnimSystem, siteSignals } from './anim'
import { ConstructionPiece } from './construction'
import { buildModel } from './models'
import { onMaterialMap } from './models/kit'

const doors = (root: THREE.Object3D) => {
  const out: THREE.Object3D[] = []
  root.traverse((o) => {
    if (o.userData.anim?.kind === 'roll' && o.userData.anim.point != null) out.push(o)
  })
  return out.sort((a, b) => a.userData.anim.point - b.userData.anim.point)
}

describe('per-building animation signals', () => {
  it('only the cargo dock in use opens, and only at that shed', () => {
    const root = new THREE.Group()
    const a = buildModel('cargo')!
    a.userData.cellKey = '1,1'
    const b = buildModel('cargo')!
    b.userData.cellKey = '5,5'
    root.add(a, b)
    const sys = new AnimSystem()
    sys.collect(root)
    const occ: Record<string, boolean[]> = { '1,1': [false, true, false, false], '5,5': [false, false, false, false] }
    // Global signal says docks are busy everywhere; per-site occupancy must win.
    for (let i = 0; i < 120; i++) sys.update(1 / 30, { dockActive: 1 }, undefined, (k) => siteSignals('cargo', occ[k]!))
    const da = doors(a)
    const db = doors(b)
    expect(da).toHaveLength(4)
    expect(da[1]!.scale.y).toBeLessThan(0.5)
    expect(da[0]!.scale.y).toBeGreaterThan(0.95)
    expect(db.every((d) => d.scale.y > 0.95)).toBe(true)
  })
  it('only the fire bay a tender is leaving opens', () => {
    const root = new THREE.Group()
    const f = buildModel('fire')!
    f.userData.cellKey = '2,2'
    root.add(f)
    const sys = new AnimSystem()
    sys.collect(root)
    for (let i = 0; i < 120; i++) sys.update(1 / 30, {}, undefined, () => siteSignals('fire', [true, false, false]))
    const d = doors(f)
    expect(d[0]!.scale.y).toBeLessThan(0.5)
    expect(d[2]!.scale.y).toBeGreaterThan(0.95)
  })
  it('a hangar only opens when its own line-MX aircraft is using it', () => {
    expect(siteSignals('hangar', [], true)?.hangarBusy).toBe(1)
    expect(siteSignals('hangar', [], false)?.hangarBusy).toBe(0)
  })
})

describe('construction stages pick up photo textures', () => {
  it('stage clones receive the map when it loads later', () => {
    const src = new THREE.MeshStandardMaterial({ color: '#888' })
    const g = new THREE.Group()
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), src))
    const piece = new ConstructionPiece(g)
    const clone = (g.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial
    expect(clone).not.toBe(src)
    expect(clone.map).toBeNull()
    const tex = new THREE.Texture()
    src.map = tex
    for (const cb of src.userData.mapWaiters as Set<(t: THREE.Texture) => void>) cb(tex)
    expect(clone.map).toBe(tex)
    piece.update(0.5)
  })
  it('onMaterialMap fires immediately when the map is already there', () => {
    const tex = new THREE.Texture()
    let got: THREE.Texture | null = null
    onMaterialMap(new THREE.MeshStandardMaterial({ map: tex }), (t) => (got = t))
    expect(got).toBe(tex)
  })
})
