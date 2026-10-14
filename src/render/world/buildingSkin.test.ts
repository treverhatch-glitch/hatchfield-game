import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { BUILDING_TARGET_IDS, MATERIAL_TARGETS } from '../../build/materialTargets'
import { addHangar, addOilStation } from '../../scale/placeholders'
import { addMroMesh, addNightHubMesh } from '../../tier3/meshes'
import { CELL } from '../aircraft/specs'
import { metreUv, setBuildingSkinQuality, skinMaterial, tankUv, TILE_TARGET } from './buildingSkin'

function skinned(g: THREE.Object3D): string[] {
  const names: string[] = []
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined
    if (m?.name) names.push(m.name)
  })
  return names
}

describe('building skin', () => {
  it('maps every building tile to a material target that exists', () => {
    for (const [tile, target] of Object.entries(TILE_TARGET)) {
      expect(BUILDING_TARGET_IDS, tile).toContain(target)
      expect(MATERIAL_TARGETS[target!]).toBeTruthy()
    }
  })

  it('reads colour and roughness from the target, flat on Low', () => {
    setBuildingSkinQuality('low', 2)
    const wall = skinMaterial('hangar', 'wall')
    expect(`#${wall.color.getHexString()}`).toBe(MATERIAL_TARGETS.hangar.wall)
    expect(wall.roughness).toBe(MATERIAL_TARGETS.hangar.wallRoughness)
    expect(wall.map).toBeNull()
    const roof = skinMaterial('fire_station', 'roof')
    expect(roof.roughness).toBe(MATERIAL_TARGETS.fire_station.roofRoughness)
    setBuildingSkinQuality('high', 8)
  })

  it('tiles UVs in metres on boxes and tanks', () => {
    const box = metreUv(new THREE.BoxGeometry(8, 4, 2), 4)
    const uv = box.getAttribute('uv')
    let maxU = 0
    for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, Math.abs(uv.getX(i)))
    // 8 m wide box, 4 m per repeat: the face spans one repeat each side of centre.
    expect(maxU).toBeCloseTo(1, 5)
    const tank = tankUv(new THREE.CylinderGeometry(1, 1, 6, 12), 3)
    const tu = tank.getAttribute('uv')
    let maxV = 0
    for (let i = 0; i < tu.count; i++) maxV = Math.max(maxV, tu.getY(i))
    expect(maxV).toBeCloseTo(2, 5)
  })

  it('skins the hangar, MRO, night hub and oil station from their targets', () => {
    const hangar = new THREE.Group()
    addHangar(hangar, 'small')
    expect(skinned(hangar)).toEqual(expect.arrayContaining(['skin:hangar:wall', 'skin:hangar:roof', 'skin:hangar:door']))
    const mro = new THREE.Group()
    addMroMesh(mro, CELL)
    expect(skinned(mro)).toEqual(expect.arrayContaining(['skin:maintenance_shed:wall', 'skin:maintenance_shed:roof', 'skin:maintenance_shed:door']))
    // The MRO doors still animate by name.
    expect(mro.children.filter((c) => c.name === 'mro-door')).toHaveLength(3)
    const hub = new THREE.Group()
    addNightHubMesh(hub, CELL)
    expect(skinned(hub)).toContain('skin:warehouse:wall')
    const oil = new THREE.Group()
    addOilStation(oil)
    expect(skinned(oil)).toEqual(expect.arrayContaining(['skin:fuel_farm:wall', 'yard:gravel']))
  })
})
