import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GROUND_FILES, GROUND_FULL, GROUND_LONG_SIDE, groundArtUrl, groundDrawEdge, groundTexture } from './groundArt'

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

describe('ground art plates', () => {
  it('keeps 2048 at high and only scales for the texture-quality setting', () => {
    expect(GROUND_LONG_SIDE.high).toBe(GROUND_FULL)
    expect(GROUND_FULL).toBe(2048)
    expect(groundDrawEdge(2048, 'high')).toBe(2048)
    expect(groundDrawEdge(2048, 'med')).toBe(1024)
    expect(groundDrawEdge(2048, 'low')).toBe(512)
    expect(groundTexture('grass')).toBeNull()
  })

  it('ships a full-res seamless file for grass, tarmac, concrete and paint', () => {
    for (const id of Object.keys(GROUND_FILES) as (keyof typeof GROUND_FILES)[]) {
      const url = groundArtUrl(id)
      expect(url).toBe(`art/textures/ground/${GROUND_FILES[id]}`)
      const size = jpegSize(`public/${url}`)
      expect(size).toEqual({ w: GROUND_FULL, h: GROUND_FULL })
    }
  })
})
