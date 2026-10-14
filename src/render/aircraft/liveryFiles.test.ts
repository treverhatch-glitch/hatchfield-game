import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXTURE_QUALITY, LIVERY_LONG_SIDE, jpegLiveryFits, liveryFile, parseTextureQuality } from './liveryFiles'

describe('livery texture files', () => {
  it('defaults to the high-res plate', () => {
    expect(DEFAULT_TEXTURE_QUALITY).toBe('high')
    expect(liveryFile('zoomjet', 'fuselage')).toBe('/textures/liveries/zoomjet/fuselage.jpg')
    expect(liveryFile('zoomjet', 'tail', 'high')).toBe('/textures/liveries/zoomjet/tail.jpg')
  })

  it('scales only by stepping down a quality folder', () => {
    expect(liveryFile('crown_pacific', 'fuselage', 'med')).toBe('/textures/liveries/crown_pacific/med/fuselage.jpg')
    expect(liveryFile('crown_pacific', 'tail', 'low')).toBe('/textures/liveries/crown_pacific/low/tail.jpg')
    expect(LIVERY_LONG_SIDE.high).toBeGreaterThan(LIVERY_LONG_SIDE.med)
    expect(LIVERY_LONG_SIDE.med).toBeGreaterThan(LIVERY_LONG_SIDE.low)
    expect(parseTextureQuality('nope')).toBe('high')
  })

  it('lists the five Grok liveries and the engine colours', () => {
    const manifest = JSON.parse(readFileSync('public/textures/liveries/manifest.json', 'utf8')) as {
      defaultQuality: string
      liveries: { id: string; engine: string; airlines: string[]; types: string[] }[]
    }
    expect(manifest.defaultQuality).toBe('high')
    const byId = new Map(manifest.liveries.map((row) => [row.id, row]))
    expect(byId.get('crown_pacific')?.engine).toBe('#C5A059')
    expect(byId.get('northstar_cargo')?.engine).toBe('#FFC107')
    expect(byId.get('bushline_local')?.engine).toBe('#F5E6C8')
    expect(byId.get('bushline_local')?.airlines).toContain('bushline')
    expect(byId.get('crown_pacific')?.airlines).toContain('crown')
    for (const id of ['bushline_local', 'zoomjet', 'crown_pacific', 'siam_breeze', 'northstar_cargo']) {
      expect(byId.has(id)).toBe(true)
      expect(byId.get(id)?.types.length).toBeGreaterThan(0)
    }
    expect(byId.get('bushline_local')?.types).toEqual(['bn2', 'dhc6'])
    expect(byId.get('crown_pacific')?.types).toEqual(['a380', 'b77w'])
    expect(jpegLiveryFits('bushline', 'bn2')).toBe(true)
    expect(jpegLiveryFits('bushline', 'a380')).toBe(false)
    expect(jpegLiveryFits('crown', 'b77w')).toBe(true)
    expect(jpegLiveryFits('zoomjet', 'b738')).toBe(true)
    expect(jpegLiveryFits('zoomjet', 'a380')).toBe(false)
    expect(jpegLiveryFits('northline', 'b738')).toBe(true)
  })
})
