import * as THREE from 'three'
import { lotScale, mPerUnitY } from '../fleet'
import { describe, expect, it } from 'vitest'
import { ConstructionPiece } from '../construction'
import { CELL } from './kit'
import { buildModel, hasModel, MODEL_BUILDERS, standAircraftGhost } from './index'

const PLACEHOLDERS = ['substation', 'hydrant', 'tilt_tray', 'fuel_farm_iii', 'atc_approach', 'remote_screening']

function stats(g: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(g)
  const size = box.getSize(new THREE.Vector3())
  // Static parts are merged per material; count the source parts and triangles.
  let meshes = 0
  let tris = 0
  let draws = 0
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    draws++
    meshes += (m.userData.merged as number | undefined) ?? 1
    const geo = m.geometry
    tris += (geo.index ? geo.index.count : geo.attributes.position!.count) / 3
  })
  return { box, size, meshes, tris, draws }
}

describe('building models', () => {
  it('covers the six former placeholder icons', () => {
    for (const id of PLACEHOLDERS) expect(hasModel(id), id).toBe(true)
  })

  it('every model is detailed and fits its cell', () => {
    for (const id of Object.keys(MODEL_BUILDERS)) {
      const g = buildModel(id)!
      const { box, size, meshes } = stats(g)
      expect(meshes, id).toBeGreaterThanOrEqual(12)
      expect(size.x, id).toBeLessThanOrEqual(CELL * 1.0)
      expect(size.z, id).toBeLessThanOrEqual(CELL * 1.0)
      expect(box.min.y, id).toBeGreaterThanOrEqual(-0.01)
      expect(size.y, id).toBeGreaterThan(0.5)
    }
  })

  it('silhouettes are distinct (bbox + mesh-count signature)', () => {
    const sig = new Map<string, string>()
    const aliases = new Set(['hotel']) // default class = hotel_biz
    for (const id of Object.keys(MODEL_BUILDERS)) {
      if (aliases.has(id)) continue
      const { size, tris } = stats(buildModel(id)!)
      const key = `${size.x.toFixed(1)}|${size.y.toFixed(1)}|${size.z.toFixed(1)}|${tris}`
      expect(sig.has(key), `${id} matches ${sig.get(key)}`).toBe(false)
      sig.set(key, id)
    }
  })

  it('fuel farm III is bigger than fuel farm I; jumbo hangar taller than small', () => {
    expect(stats(buildModel('fuel_farm_iii')!).meshes).toBeGreaterThan(stats(buildModel('fuel')!).meshes)
    const small = stats(buildModel('hangar', { hangarTier: 'small' })!).size.y
    const jumbo = stats(buildModel('hangar', { hangarTier: 'jumbo' })!).size.y
    // Compare real heights: the lots scale the models (small 3 cells, jumbo 5).
    expect(jumbo * mPerUnitY(lotScale('hangar', 'jumbo'))).toBeGreaterThan(small * mPerUnitY(lotScale('hangar', 'small')) * 1.6)
  })

  it('ATC approach towers over the basic tower', () => {
    expect(stats(buildModel('atc_approach')!).size.y).toBeGreaterThan(stats(buildModel('tower')!).size.y)
  })

  it('round-4 detail pass: parapets, plant and lot dressing, merged into few draw calls', () => {
    for (const id of Object.keys(MODEL_BUILDERS)) {
      const { meshes, draws, tris } = stats(buildModel(id)!)
      expect(meshes, id).toBeGreaterThanOrEqual(40)
      expect(tris, id).toBeGreaterThan(800)
      // Merging keeps draw calls well under the part count.
      expect(draws, id).toBeLessThan(meshes / 2)
    }
  })

  it('unknown ids fall through to the legacy builder', () => {
    expect(buildModel('terminal')).toBeNull()
    expect(hasModel('toString')).toBe(false)
  })

  it('construction stages still run on new models', () => {
    for (const id of ['tower', 'substation', 'hangar']) {
      const piece = new ConstructionPiece(buildModel(id)!)
      for (const p of [0.1, 0.5, 0.9, 1]) piece.update(p)
      expect(piece.root.children.length).toBeGreaterThan(0)
      piece.dispose()
    }
  })

  it('stand ghost is an aircraft shape inside the stand box', () => {
    const m = new THREE.MeshBasicMaterial()
    const g = standAircraftGhost(30, 28, m, true)
    const { size, meshes } = stats(g)
    expect(meshes).toBeGreaterThanOrEqual(6)
    expect(size.x).toBeLessThanOrEqual(30)
    expect(size.z).toBeLessThanOrEqual(28)
  })
})
