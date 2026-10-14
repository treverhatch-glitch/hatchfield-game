import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SurfaceLibrary } from './library'
import { PACK1_FILES, pack1Edge, pack1Url } from './pack1'
import { DEPARTURES_ROWS } from '../world/textures'
import { partSurface, propParts, type PropPart } from '../world/kit'

describe('texture pack 1', () => {
  it('keeps the full JPEG at high and only shrinks through the quality setting', () => {
    expect(pack1Edge('high')).toBeNull()
    expect(pack1Edge('med')).toBe(256)
    expect(pack1Edge('low')).toBe(128)
  })

  it('points each surface at its pack file', () => {
    expect(pack1Url('wall')).toBe('/assets/pack1/tex_wall_panel_cream_v1.jpg')
    expect(pack1Url('glass')).toContain('tex_glass_curtainwall_v1.jpg')
    expect(pack1Url('oak')).toContain('tex_wood_oak_v1.jpg')
    expect(pack1Url('steel')).toContain('tex_steel_brushed_v1.jpg')
    expect(pack1Url('rubber')).toContain('tex_floor_rubber_studded_v1.jpg')
    expect(pack1Url('shopWood')).toContain('tex_wood_shop_v1.jpg')
    expect(pack1Url('fabric')).toContain('tex_fabric_seat_v1.jpg')
    expect(pack1Url('carpet')).toContain('tex_carpet_gate_navy.jpg')
    expect(new Set(Object.values(PACK1_FILES)).size).toBe(8)
  })

  it('loads the eight files onto the surface library', () => {
    const lib = new SurfaceLibrary(8)
    const urls: string[] = []
    lib.loadPack1('high', '/assets/pack1', {
      load(url, onLoad) {
        urls.push(url)
        onLoad(new THREE.Texture())
      },
    })
    expect(urls).toHaveLength(8)
    expect(urls.every((u) => u.startsWith('/assets/pack1/tex_'))).toBe(true)
    const watched = lib.material('panel', 0xffffff, 'wall') as THREE.MeshLambertMaterial
    expect(watched.map).toBe(lib.maps.wall)
    lib.dispose()
  })
})

describe('coded signs', () => {
  it('lists flights on the departures board instead of a photo', () => {
    expect(DEPARTURES_ROWS.length).toBeGreaterThan(3)
    expect(DEPARTURES_ROWS.some((row) => row[3].startsWith('A'))).toBe(true)
    expect(DEPARTURES_ROWS.map((row) => row[4])).toContain('BOARDING')
  })

  it('puts steel on chrome, fabric on seats, and shop wood on the kiosk shelf', () => {
    const parts = propParts()
    const chrome = parts.bench.find((p) => p.mat === 'chrome') as PropPart
    const seat = parts.bench.find((p) => p.mat === 'seat') as PropPart
    expect(partSurface(chrome)).toBe('steel')
    expect(partSurface(seat)).toBe('fabric')
    expect(parts.kiosk.some((p) => p.surface === 'shop')).toBe(true)
    expect(parts.belt.some((p) => p.surface === 'rubber')).toBe(true)
  })
})
