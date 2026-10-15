import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LANDING_FILES,
  LANDING_NATIVE,
  landingArtUrl,
  landingDrawEdge,
  landingSkyUrl,
  landingTexture,
  seasonApronId,
  seasonGrassId,
  seasonPavedId,
  SPRITE_GRID,
  type LandingId,
} from './landingArt'

function jpegSize(path: string): { w: number; h: number } {
  const data = readFileSync(path)
  let i = 2
  while (i < data.length - 8) {
    if (data[i] !== 0xff) {
      i++
      continue
    }
    const marker = data[i + 1]
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x00) {
      i += 2
      continue
    }
    const len = data.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: data.readUInt16BE(i + 5), w: data.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  throw new Error(`no jpeg frame in ${path}`)
}

describe('landing art store', () => {
  it('keeps every plate at its own resolution', () => {
    expect(landingDrawEdge(2912)).toBe(2912)
    expect(landingDrawEdge(2752)).toBe(2752)
    expect(landingDrawEdge(450)).toBe(450)
    expect(landingTexture('runway_paint')).toBeNull()
    for (const id of Object.keys(LANDING_FILES) as LandingId[]) {
      const size = jpegSize(`public/${landingArtUrl(id)}`)
      expect(size, id).toEqual(LANDING_NATIVE[id])
      const edge = Math.max(size.w, size.h)
      expect(landingDrawEdge(edge)).toBe(edge)
    }
  })

  it('points the dome at the 2912×1440 panoramas', () => {
    expect(landingSkyUrl('sky_dawn')).toBe('/art/textures/landing/sky/dawn.jpeg')
    expect(LANDING_NATIVE.sky_night).toEqual({ w: 2912, h: 1440 })
    expect(SPRITE_GRID).toEqual({ cols: 2, rows: 2 })
  })

  it('swaps grass, apron and pavement with the season', () => {
    expect(seasonGrassId('spring', 0)).toBe('grass_spring')
    expect(seasonGrassId('summer', 0)).toBe('grass_spring')
    expect(seasonGrassId('autumn', 0)).toBe('grass_autumn')
    expect(seasonGrassId('winter', 0)).toBe('snow_grass')
    expect(seasonGrassId('summer', 0.8)).toBe('snow_grass')
    expect(seasonApronId('summer', 0)).toBe('wet_asphalt')
    expect(seasonApronId('winter', 0.4)).toBe('snow_apron')
    expect(seasonPavedId('summer', 0, 0)).toBe('runway_paint')
    expect(seasonPavedId('summer', 0, 0.4)).toBe('wet_asphalt')
    expect(seasonPavedId('winter', 0.5, 0)).toBe('snow_asphalt')
  })
})
