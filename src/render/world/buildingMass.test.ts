import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { HANGAR_DESIGN, HANGAR_HEAD_CLEAR_M, HANGAR_SIDE_CLEAR_M } from '../../scale/data'
import { addCargoShed, addControlTower, addDeicePad, addFireStation, addFuelFarm } from './airsideMass'
import { addFuelRail, addHangar, addOilStation, addPeopleMover, addSkywalk, addTravelator } from '../../scale/placeholders'
import { hangarClearsDesign, hangarOpeningM } from './hangarMass'
import { MODEL_SIZE } from '../vehicleModels'
import { addMroMesh, addNightHubMesh, MESH_TRIANGLE_BUDGET, meshTriangleCount } from '../../tier3/meshes'
import { CELL, WORLD_PER_METER } from '../aircraft/specs'
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
      expect(named(g, 'hangar-leaf').length, tier).toBeGreaterThanOrEqual(4)
      const mats: string[] = []
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m?.name) mats.push(m.name)
      })
      expect(mats).toEqual(expect.arrayContaining(['skin:hangar:wall', 'skin:hangar:roof', 'skin:hangar:door']))
      expect(meshTriangleCount(g), tier).toBeLessThanOrEqual(2800)
      expect(hangarClearsDesign(tier), tier).toBe(true)
      const design = HANGAR_DESIGN[tier]
      const open = hangarOpeningM(tier)
      expect(open.widthM, tier).toBeGreaterThanOrEqual(design.spanM + HANGAR_SIDE_CLEAR_M * 2)
      expect(open.heightM, tier).toBeGreaterThanOrEqual(design.tailM + HANGAR_HEAD_CLEAR_M)
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
      expect(meshTriangleCount(g)).toBeLessThanOrEqual(900)
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

  it('gives airside support a named bay a vehicle can path to', () => {
    const fuel = new THREE.Group()
    addFuelFarm(fuel)
    const tank = fuel.getObjectByName('fuel-tank')!
    expect(tank.position.toArray()).toEqual([0, 1.8, -2.9])
    const bay = fuel.getObjectByName('service-bay:fill') as THREE.Mesh
    expect(bay).toBeTruthy()
    const [tankerL, , tankerW] = MODEL_SIZE.fuel_tanker
    const geo = bay.geometry as THREE.PlaneGeometry
    expect(geo.parameters.width).toBeGreaterThanOrEqual(tankerW * WORLD_PER_METER * 0.9)
    expect(geo.parameters.height).toBeGreaterThanOrEqual(tankerL * WORLD_PER_METER * 0.9)
    expect(named(fuel, 'sign:FUEL')).toHaveLength(1)
    expect(fuel.children.filter((c) => c.name === 'fuel-tank' || (c as THREE.Mesh).geometry?.type === 'CylinderGeometry').length).toBeGreaterThan(4)
    expect(meshTriangleCount(fuel)).toBeLessThanOrEqual(4500)
    const fire = new THREE.Group()
    addFireStation(fire)
    expect(fire.getObjectByName('service-bay:1')).toBeTruthy()
    expect(fire.getObjectByName('service-bay:2')).toBeTruthy()
    expect(named(fire, 'sign:FIRE')).toHaveLength(1)
    const cargo = new THREE.Group()
    addCargoShed(cargo)
    for (const id of ['1', '2', '3']) expect(cargo.getObjectByName(`service-bay:${id}`), id).toBeTruthy()
    expect(named(cargo, 'sign:CARGO')).toHaveLength(1)
    const deice = new THREE.Group()
    addDeicePad(deice)
    expect(deice.getObjectByName('service-bay:pad')).toBeTruthy()
    expect(deice.getObjectByName('service-bay:truck')).toBeTruthy()
    const tower = new THREE.Group()
    addControlTower(tower)
    expect(tower.getObjectByName('service-bay:ramp')).toBeTruthy()
    expect(named(tower, 'sign:TOWER')).toHaveLength(1)
    const oil = new THREE.Group()
    addOilStation(oil)
    expect(oil.getObjectByName('service-bay:transfer')).toBeTruthy()
    const hangar = new THREE.Group()
    addHangar(hangar, 'small')
    expect(hangar.getObjectByName('service-bay:nose')).toBeTruthy()
    const mro = new THREE.Group()
    addMroMesh(mro, CELL)
    for (const id of ['narrow', 'wide', 'jumbo']) expect(mro.getObjectByName(`service-bay:${id}`), id).toBeTruthy()
    for (const g of [fire, cargo, deice, tower]) {
      expect(meshTriangleCount(g)).toBeLessThanOrEqual(1200)
      signFacesFront(g)
    }
    signFacesFront(fuel)
    signFacesFront(oil)
  })
})
