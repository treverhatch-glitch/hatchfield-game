import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { addFuelRail, addHangar, addOilStation, addPeopleMover, addSkywalk, addTravelator } from '../../scale/placeholders'
import { addMroMesh, addNightHubMesh, MESH_TRIANGLE_BUDGET, meshTriangleCount } from '../../tier3/meshes'
import { CELL } from '../aircraft/specs'
import { FUEL_TILE_SOCKETS } from '../socketLayout'
import { addDepotBuilding, addGuardBuilding, addPoliceBuilding } from './apronBuildings'
import { addAtcApproach, addPrefabPier, addRemoteScreening, addSubstation, addTiltTray } from './progressionBuildings'

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

  it('models the later links and buys without moving the fuel-farm socket', () => {
    expect(FUEL_TILE_SOCKETS.farm_fill).toEqual([1.25, 0.55, 0])
    const oil = new THREE.Group()
    addOilStation(oil)
    const tanks = oil.children.filter((c) => (c as THREE.Mesh).geometry?.type === 'CylinderGeometry')
    expect(tanks.map((t) => [t.position.x, t.position.y, t.position.z])).toEqual([
      [-CELL * 0.18, 1.3, 0],
      [CELL * 0.16, 1.3, 0],
    ])
    const mover = new THREE.Group()
    addPeopleMover(mover)
    const pod = mover.getObjectByName('pod')
    const glass = mover.getObjectByName('pod-glass')
    expect(pod?.parent).toBe(mover)
    expect(glass?.parent).toBe(mover)
    expect(pod?.userData.home).toBe(0)
    const built = [
      ['fuel', addFuelRail],
      ['walk', addTravelator],
      ['link', addSkywalk],
      ['move', addPeopleMover],
      ['remote', addRemoteScreening],
      ['grid', addSubstation],
      ['sort', addTiltTray],
      ['atc', addAtcApproach],
      ['pier', addPrefabPier],
    ] as const
    for (const [label, build] of built) {
      const g = new THREE.Group()
      build(g)
      expect(named(g, 'sign:').length, label).toBeGreaterThan(0)
      expect(meshTriangleCount(g), label).toBeLessThanOrEqual(220)
      signFacesFront(g)
    }
    for (const build of [addRemoteScreening, addSubstation, addTiltTray, addAtcApproach, addFuelRail, addTravelator]) {
      const g = new THREE.Group()
      build(g)
      expect(named(g, 'service-dock')).toHaveLength(1)
    }
  })
})
