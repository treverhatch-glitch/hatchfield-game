import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PROP_FILES, PROP_FULL, PROP_LONG_SIDE, propArtUrl, propDrawEdge, propTexture } from './propArt'

function jpegSize(path: string): { w: number; h: number } {
  const data = readFileSync(path)
  let i = 2
  while (i < data.length - 8) {
    if (data[i] !== 0xff) {
      i++
      continue
    }
    const marker = data[i + 1]
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: data.readUInt16BE(i + 5), w: data.readUInt16BE(i + 7) }
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2
      continue
    }
    i += 2 + data.readUInt16BE(i + 2)
  }
  throw new Error(`no jpeg frame in ${path}`)
}

function pngSize(path: string): { w: number; h: number; color: number } {
  const data = readFileSync(path)
  return { w: data.readUInt32BE(16), h: data.readUInt32BE(20), color: data[25] }
}

describe('apron prop plates', () => {
  it('keeps 2048 at high and only scales for the texture-quality setting', () => {
    expect(PROP_LONG_SIDE.high).toBe(PROP_FULL)
    expect(propDrawEdge(2048, 'high')).toBe(2048)
    expect(propDrawEdge(2048, 'med')).toBe(1024)
    expect(propDrawEdge(2048, 'low')).toBe(512)
    expect(propTexture('hatch')).toBeNull()
  })

  it('ships full-res corrugation, chain-link with holes, and the stand hatch', () => {
    for (const id of ['corrugation', 'hatch'] as const) {
      const size = jpegSize(`public/${propArtUrl(id)}`)
      expect(size).toEqual({ w: PROP_FULL, h: PROP_FULL })
    }
    const link = pngSize(`public/${propArtUrl('chainlink')}`)
    expect(link.w).toBe(PROP_FULL)
    expect(link.h).toBe(PROP_FULL)
    expect(link.color).toBe(6)
    expect(PROP_FILES.chainlink).toBe('chainlink.png')
  })
})
