import { existsSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { BUILDING_TARGET_IDS } from '../../build/materialTargets'
import { WORLD_PER_METER } from '../aircraft/specs'
import { SKIN_PLATE_FOR, skinMaterial, skinToneGain } from './buildingSkin'
import { applySkinProjection, SKIN_PLATE_IDS, SKIN_PLATES, SKIN_PROGRAM_KEY, skinPlateTextures, skinPlateUrl, skinUvScale } from './skinArt'

function compiled(mat: THREE.MeshStandardMaterial) {
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  } as unknown as THREE.WebGLProgramParametersWithUniforms
  mat.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
  return shader
}

describe('building skin plates (PBR, CC0)', () => {
  it('ships albedo, normal and roughness for every plate', () => {
    for (const id of SKIN_PLATE_IDS) {
      for (const kind of ['albedo', 'normal', 'rough'] as const) {
        const file = `public/${skinPlateUrl(id, kind)}`
        expect(existsSync(file), file).toBe(true)
        expect(statSync(file).size, file).toBeGreaterThan(100_000)
      }
    }
  })

  it('repeats each plate at real-world size (bricks ~225 x 75 mm, 333 mm cladding ribs)', () => {
    // Bricks105: 16 courses per plate height; random bond, ~10.7 bricks per row.
    expect(SKIN_PLATES.brick.tileM[1] / 16).toBeCloseTo(0.075, 3)
    expect(SKIN_PLATES.brick.tileM[0] / 10.67).toBeGreaterThan(0.2)
    expect(SKIN_PLATES.brick.tileM[0] / 10.67).toBeLessThan(0.25)
    expect(SKIN_PLATES.cladding.tileM[0] / 4).toBeCloseTo(0.333, 2)
    const [u, v] = skinUvScale('brick')
    expect(u).toBeCloseTo(1 / (2.4 * WORLD_PER_METER), 6)
    expect(v).toBeCloseTo(1 / (1.2 * WORLD_PER_METER), 6)
  })

  it('leaves the approved terminal, tower, transit, hotel, fuel farm and de-ice looks alone', () => {
    for (const t of ['terminal', 'control_tower', 'transit_station', 'hotel', 'fuel_farm', 'deice_pad'] as const) {
      expect(SKIN_PLATE_FOR[t], t).toBeUndefined()
    }
    for (const [target, parts] of Object.entries(SKIN_PLATE_FOR)) {
      expect(BUILDING_TARGET_IDS).toContain(target)
      for (const id of Object.values(parts ?? {})) expect(SKIN_PLATE_IDS).toContain(id)
      expect(parts?.trim, `${target} trim stays flat`).toBeUndefined()
    }
  })

  it('keeps each part near its old tone', () => {
    for (const target of BUILDING_TARGET_IDS) {
      for (const part of ['wall', 'roof', 'trim', 'door'] as const) {
        const g = skinToneGain(target, part)
        expect(g, `${target}:${part}`).toBeGreaterThan(0.7)
        expect(g, `${target}:${part}`).toBeLessThan(1.15)
      }
    }
    expect(skinToneGain('terminal', 'wall')).toBe(1)
  })

  it('stays flat and unpatched in Node (no DOM)', () => {
    expect(skinPlateTextures('brick')).toBeNull()
    const wall = skinMaterial('fire_station', 'wall')
    expect(wall.map).toBeNull()
    expect(wall.normalMap).toBeNull()
    expect(wall.userData.skinPlate).toBeUndefined()
  })

  it('swaps only map / normal-map / roughness sampling; lights and shadows are untouched', () => {
    const mat = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), normalMap: new THREE.Texture(), roughnessMap: new THREE.Texture() })
    const before = compiled(new THREE.MeshStandardMaterial())
    applySkinProjection(mat, 'brick')
    applySkinProjection(mat, 'brick') // idempotent
    expect(mat.customProgramCacheKey()).toContain(SKIN_PROGRAM_KEY)
    const sh = compiled(mat)
    expect(sh.fragmentShader).not.toContain('#include <map_fragment>')
    expect(sh.fragmentShader).not.toContain('#include <roughnessmap_fragment>')
    expect(sh.fragmentShader).toContain('textureGrad(map, skUv')
    expect(sh.fragmentShader).toContain('textureGrad(normalMap, skUv')
    expect(sh.fragmentShader).toContain('textureGrad(roughnessMap, skUv')
    expect(sh.vertexShader).toContain('vSkP = transformed * skS')
    for (const chunk of [
      '#include <lights_fragment_begin>',
      '#include <lights_fragment_maps>',
      '#include <lights_fragment_end>',
      '#include <shadowmap_pars_fragment>',
      '#include <aomap_fragment>',
      '#include <emissivemap_fragment>',
      '#include <fog_fragment>',
      '#include <tonemapping_fragment>',
    ]) {
      expect(before.fragmentShader).toContain(chunk)
      expect(sh.fragmentShader).toContain(chunk)
    }
    for (const chunk of ['#include <shadowmap_vertex>', '#include <worldpos_vertex>', '#include <project_vertex>']) expect(sh.vertexShader).toContain(chunk)
    expect((sh.uniforms as Record<string, { value: unknown }>).uSkScale.value).toBeInstanceOf(THREE.Vector2)
  })

  it('chains an earlier shader patch', () => {
    const mat = new THREE.MeshStandardMaterial({ map: new THREE.Texture() })
    let ran = 0
    mat.onBeforeCompile = () => {
      ran++
    }
    applySkinProjection(mat, 'cladding')
    compiled(mat)
    expect(ran).toBe(1)
  })
})
