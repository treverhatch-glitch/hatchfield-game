import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILDING_TARGET_IDS, MATERIAL_TARGETS } from '../../build/materialTargets'
import { ART_TEXTURE_IDS, artTexture, artTextureUrl, photoTexturesEnabled } from './textureRegistry'

describe('texture registry', () => {
  it('has a packed source for every texture id', () => {
    const manifest = JSON.parse(readFileSync('public/art/textures/buildings/_b64/MANIFEST.json', 'utf8')) as { path: string }[]
    const packed = new Set(manifest.map((m) => m.path))
    for (const id of ART_TEXTURE_IDS) expect(packed.has(`public/${artTextureUrl(id)}`)).toBe(true)
  })

  it('skips photos on Low and without a DOM', () => {
    expect(photoTexturesEnabled('low')).toBe(false)
    expect(photoTexturesEnabled('med')).toBe(true)
    expect(artTexture('apron_concrete')).toBeNull()
  })
})

describe('material targets', () => {
  it('has valid colours, roughness and known textures for each building', () => {
    for (const id of BUILDING_TARGET_IDS) {
      const t = MATERIAL_TARGETS[id]
      for (const c of [t.roof, t.wall, t.trim, t.door]) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
      for (const r of [t.wallRoughness, t.roofRoughness]) expect(r >= 0 && r <= 1).toBe(true)
      expect(ART_TEXTURE_IDS).toContain(t.wallTexture)
      expect(ART_TEXTURE_IDS).toContain(t.roofTexture)
    }
  })
})
