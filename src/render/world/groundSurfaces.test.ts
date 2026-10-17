import { describe, expect, it } from 'vitest'
import { surfaceOf } from './surfaces'
import { AIRFIELD_TILE_M, airfieldArtUrl, CONCRETE_DETAIL_AMT, concreteDetailUrl } from './airfieldArt'
import { applyAntiTile, concreteScale, detailScale, setConcreteDetail } from './groundTiling'
import * as THREE from 'three'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

describe('ground surfaces', () => {
  it('draws retired belt cells as service road, not a grey plate', () => {
    expect(surfaceOf('belt')).toBe('road')
    expect(surfaceOf('road')).toBe('road')
    expect(surfaceOf('grass')).toBe('grass')
  })

  it('ships every paved plate: CC0 albedo as WebP, normals as JPEG (no 4:2:0 chroma on normals)', () => {
    for (const id of Object.keys(AIRFIELD_TILE_M) as (keyof typeof AIRFIELD_TILE_M)[]) {
      for (const map of ['albedo', 'normal'] as const) {
        const url = airfieldArtUrl(id, map)
        if (map === 'albedo' && (id === 'asphalt' || id === 'road')) expect(url.endsWith('.webp')).toBe(true)
        if (map === 'normal') expect(url.endsWith('.jpg')).toBe(true)
        const file = join(process.cwd(), 'public', url)
        expect(existsSync(file)).toBe(true)
        expect(statSync(file).size).toBeLessThan(8 * 1024 * 1024)
      }
    }
    expect(existsSync(join(process.cwd(), 'public', concreteDetailUrl()))).toBe(true)
  })

  it('concrete grain is real-scale and switches off without a texture', () => {
    expect(concreteScale(6.2)).toBeGreaterThan(3)
    const mat = new THREE.MeshLambertMaterial()
    const u = applyAntiTile(mat)
    setConcreteDetail(mat, new THREE.Texture(), concreteScale(6.2), CONCRETE_DETAIL_AMT)
    expect(u.uAfConcAmt.value).toBeCloseTo(CONCRETE_DETAIL_AMT)
    setConcreteDetail(mat, null, 1, CONCRETE_DETAIL_AMT)
    expect(u.uAfConcAmt.value).toBe(0)
  })

  it('ground materials stay Lambert and keep receiving shadows after the shader patch', () => {
    const mat = new THREE.MeshLambertMaterial()
    applyAntiTile(mat)
    const shader = { uniforms: {} as Record<string, unknown>, fragmentShader: '#include <common>\n#include <map_fragment>\n#include <shadowmap_pars_fragment>\n#include <lights_fragment_begin>', vertexShader: '' }
    mat.onBeforeCompile(shader as never, undefined as never)
    expect(shader.fragmentShader).toContain('#include <shadowmap_pars_fragment>')
    expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>')
    expect(shader.fragmentShader).toContain('uAfConc')
    expect(Object.keys(shader.uniforms)).toEqual(expect.arrayContaining(['uAfDetail', 'uAfMix', 'uAfConc', 'uAfConcScale', 'uAfConcAmt']))
  })

  it('maps plates at real-world scale (several repeats per UV unit)', () => {
    expect(detailScale(10, 'runway')).toBeCloseTo(1, 5)
    expect(detailScale(6.2, 'apron')).toBeCloseTo(1, 5)
    expect(detailScale(8, 'asphalt')).toBeGreaterThan(1)
    expect(detailScale(8, 'road')).toBeGreaterThan(1)
  })
})
