import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INTERIOR_CONCEPTS, INTERIOR_TILES, interiorTexture, interiorTextureUrl, type InteriorTile } from './interiorTex'

/** JPEG baseline size from the SOF marker. Proves the file is a real image. */
function jpegSize(path: string): { w: number; h: number } {
  const buf = readFileSync(path)
  expect(buf[0]).toBe(0xff)
  expect(buf[1]).toBe(0xd8)
  let i = 2
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) break
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  throw new Error(`no SOF in ${path}`)
}

describe('interior texture plates', () => {
  it('names the nine concept studies', () => {
    expect(INTERIOR_CONCEPTS).toEqual([
      'arrivals_hall',
      'baggage_claim',
      'food_court',
      'gate_seating',
      'jet_bridge_int',
      'lounge',
      'restrooms',
      'office',
      'checkin_wide',
    ])
  })

  it('keeps full-resolution plates and loads them as JPEGs', () => {
    for (const id of Object.keys(INTERIOR_TILES) as InteriorTile[]) {
      const path = `public/${interiorTextureUrl(id)}`
      expect(statSync(path).size, path).toBeGreaterThan(20_000)
      const size = jpegSize(path)
      expect(size.w, path).toBeGreaterThanOrEqual(2048)
      expect(size.h, path).toBeGreaterThanOrEqual(2048)
    }
  })

  it('does not decode in Node', () => {
    expect(interiorTexture('floor_terrazzo', [2, 2])).toBeNull()
    expect(interiorTexture('belt_claim')).toBeNull()
  })
})
