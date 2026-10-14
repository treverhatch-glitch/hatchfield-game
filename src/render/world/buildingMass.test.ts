import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { addHangar } from '../../scale/placeholders'
import { addMroMesh, addNightHubMesh, MESH_TRIANGLE_BUDGET, meshTriangleCount } from '../../tier3/meshes'
import { CELL } from '../aircraft/specs'
import { addDepotBuilding, addGuardBuilding, addPoliceBuilding } from './apronBuildings'

function named(root: THREE.Object3D, prefix: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = []
  root.traverse((obj) => {
    if (obj.name.startsWith(prefix)) found.push(obj)
  })
  return found
}

function signFacesFront(root: THREE.Object3D) {
  for (const obj of named(root, 'sign:')) {
    const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial
    expect(mat.side, obj.name).toBe(THREE.FrontSide)
    expect(obj.scale.x, obj.name).toBeGreaterThan(0)
    if (mat.map) {
      expect(mat.map.wrapS).toBe(THREE.ClampToEdgeWrapping)
      expect(mat.map.wrapT).toBe(THREE.ClampToEdgeWrapping)
    }
  }
}

describe('concept building massing', () => {
  it('builds a hangar with a door, a word, and a dock', () => {
    for (const tier of ['small', 'wide', 'jumbo'] as const) {
      const g = new THREE.Group()
      addHangar(g, tier)
      expect(named(g, 'sign:').length, tier).toBe(1)
      expect(named(g, 'service-dock').length, tier).toBe(1)
      const mats: string[] = []
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m?.name) mats.push(m.name)
      })
      expect(mats).toEqual(expect.arrayContaining(['skin:hangar:wall', 'skin:hangar:roof', 'skin:hangar:door']))
      expect(meshTriangleCount(g), tier).toBeLessThanOrEqual(220)
      signFacesFront(g)
    }
  })

  it('gives the depot, police station and guard booth a sign and a dock', () => {
    const depot = new THREE.Group()
    addDepotBuilding(depot)
    expect(named(depot, 'sign:DEPOT')).toHaveLength(1)
    expect(named(depot, 'service-dock')).toHaveLength(1)
    const police = new THREE.Group()
    addPoliceBuilding(police)
    expect(named(police, 'sign:POLICE')).toHaveLength(1)
    expect(named(police, 'service-dock')).toHaveLength(1)
    const guard = new THREE.Group()
    addGuardBuilding(guard)
    expect(named(guard, 'sign:GUARD')).toHaveLength(1)
    expect(named(guard, 'service-dock')).toHaveLength(1)
    for (const g of [depot, police, guard]) {
      signFacesFront(g)
      expect(meshTriangleCount(g)).toBeLessThanOrEqual(220)
    }
  })

  it('keeps MRO doors and the night hub inside the triangle budget', () => {
    const mro = new THREE.Group()
    addMroMesh(mro, CELL)
    expect(mro.children.filter((c) => c.name === 'mro-door')).toHaveLength(3)
    expect(named(mro, 'sign:MRO')).toHaveLength(1)
    expect(named(mro, 'service-dock')).toHaveLength(1)
    expect(meshTriangleCount(mro)).toBeLessThanOrEqual(MESH_TRIANGLE_BUDGET)
    const hub = new THREE.Group()
    addNightHubMesh(hub, CELL)
    expect(named(hub, 'sign:NIGHT')).toHaveLength(1)
    expect(named(hub, 'service-dock')).toHaveLength(1)
    expect(meshTriangleCount(hub)).toBeLessThanOrEqual(MESH_TRIANGLE_BUDGET)
    signFacesFront(mro)
    signFacesFront(hub)
  })

  it('does not ship concept JPEGs or flat facade plates', () => {
    expect(existsSync('public/art/concepts')).toBe(false)
  })
})
