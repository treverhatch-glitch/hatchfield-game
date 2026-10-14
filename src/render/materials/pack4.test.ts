import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { propParts } from '../world/kit'
import { SurfaceLibrary } from './library'
import { AIRLINE_LOGOS, BRAND_LOGO, CARPET_ROOMS, PACK4_FILES, TERRAZZO_ROOMS, pack4Edge, pack4Url } from './pack4'

describe('texture pack 4', () => {
  it('keeps the files full size unless the quality setting asks for less', () => {
    expect(pack4Edge('high')).toBeNull()
    expect(pack4Edge('med')).toBe(256)
    expect(pack4Edge('low')).toBe(128)
  })

  it('maps halls to terrazzo and gates and offices to grey carpet', () => {
    expect(TERRAZZO_ROOMS).toContain('checkin')
    expect(TERRAZZO_ROOMS).toContain('security')
    expect(CARPET_ROOMS).toEqual(['gate', 'office'])
    expect(pack4Url(PACK4_FILES.terrazzo)).toBe('/assets/pack4/tex_terrazzo.jpg')
    expect(pack4Url(PACK4_FILES.carpetGrey)).toContain('tex_carpet_grey.jpg')
    expect(pack4Url(PACK4_FILES.ceiling)).toContain('tex_ceiling_tiles.jpg')
    expect(pack4Url(PACK4_FILES.granite)).toContain('tex_granite_dark.jpg')
  })

  it('loads the tiles, five airline marks, and the Hatchfield mark', () => {
    const lib = new SurfaceLibrary(8)
    const urls: string[] = []
    lib.loadPack4('high', '/assets/pack4', {
      load(url, onLoad) {
        urls.push(url)
        onLoad(new THREE.Texture())
      },
    })
    expect(urls).toHaveLength(4 + AIRLINE_LOGOS.length + 1)
    expect(urls).toContain(pack4Url(BRAND_LOGO))
    expect(urls.filter((u) => u.includes('logo_'))).toHaveLength(6)
    const desk = lib.logoMaterial(0)
    expect(desk.map).toBe(lib.airline[0])
    const brand = lib.brandMaterial()
    expect(brand.map).toBe(lib.brand)
    lib.dispose()
  })

  it('tells a gate sign when its airline image arrives', () => {
    const lib = new SurfaceLibrary(8)
    const seen: unknown[] = []
    lib.onLogo(0, (image) => seen.push(image))
    const tex = new THREE.Texture()
    tex.image = { width: 960, height: 960 }
    lib.loadPack4('high', '/assets/pack4', {
      load(url, onLoad) {
        onLoad(url.includes('bushline') ? tex : new THREE.Texture())
      },
    })
    expect(seen).toEqual([tex.image])
    lib.dispose()
  })

  it('puts granite on counter tops and a logo slot on the check-in desk', () => {
    const parts = propParts()
    expect(parts.counter.some((p) => p.surface === 'granite')).toBe(true)
    expect(parts.counter.some((p) => p.mat === 'logo')).toBe(true)
    expect(parts.kiosk.some((p) => p.surface === 'granite')).toBe(true)
  })
})
