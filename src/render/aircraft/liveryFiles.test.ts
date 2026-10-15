import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { selectLivery } from './airlineArt'
import {
  DEFAULT_TEXTURE_QUALITY,
  LIVERY_LONG_SIDE,
  jpegLiveryFits,
  liveryFile,
  parseTextureQuality,
  resolveLivery,
} from './liveryFiles'

const PLATE_IDS = ['bushline_local', 'zoomjet', 'crown_pacific', 'siam_breeze', 'northstar_cargo'] as const

function jpegSize(buf: Buffer): { width: number; height: number } {
  for (let i = 2; i < buf.length - 8; i++) {
    if (buf[i] !== 0xff) continue
    const marker = buf[i + 1]
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 1
      continue
    }
    i += 1 + buf.readUInt16BE(i + 2)
  }
  throw new Error('jpeg size not found')
}

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

  it('resolves every plate id to a full-resolution livery on disk', () => {
    for (const id of PLATE_IDS) {
      const row = resolveLivery(id)
      expect(row?.id).toBe(id)
      expect(row?.types.length).toBeGreaterThan(0)
      expect(existsSync(`public${row!.fuselage}`)).toBe(true)
      expect(existsSync(`public${row!.tail}`)).toBe(true)
      for (const slot of ['fuselage', 'tail'] as const) {
        const high = jpegSize(readFileSync(`public/textures/liveries/${id}/${slot}.jpg`))
        const med = jpegSize(readFileSync(`public/textures/liveries/${id}/med/${slot}.jpg`))
        const long = Math.max(high.width, high.height)
        expect(long).toBeGreaterThan(LIVERY_LONG_SIDE.med)
        expect(long).toBeGreaterThan(Math.max(med.width, med.height))
        expect(long).toBeLessThanOrEqual(LIVERY_LONG_SIDE.high)
      }
      for (const airline of row!.airlines) {
        for (const model of row!.types) {
          expect(jpegLiveryFits(airline, model)).toBe(true)
          expect(selectLivery({ body: '#111111', stripe: '#eeeeee', airline }, model).airline).toBe(airline)
        }
      }
    }
    expect(resolveLivery('bushline')?.id).toBe('bushline_local')
    expect(resolveLivery('crown')?.id).toBe('crown_pacific')
    expect(resolveLivery('zoomjet')?.fuselage).toBe('/textures/liveries/zoomjet/fuselage.jpg')
    expect(resolveLivery('siam_breeze')?.id).toBe('siam_breeze')
    expect(resolveLivery('northstar_cargo')?.id).toBe('northstar_cargo')
    expect(resolveLivery('nobody')).toBeNull()
    expect(resolveLivery('air_regional_1')).toBeNull()
  })
})
