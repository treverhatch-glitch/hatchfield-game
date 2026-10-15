import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXTERIOR_FILES, EXTERIOR_FULL, EXTERIOR_LONG_SIDE, exteriorArtUrl, exteriorDrawEdge, exteriorTexture } from './exteriorArt'

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

describe('exterior building plates', () => {
  it('keeps 2048 at high and only scales for the texture-quality setting', () => {
    expect(EXTERIOR_LONG_SIDE.high).toBe(EXTERIOR_FULL)
    expect(exteriorDrawEdge(2048, 'high')).toBe(2048)
    expect(exteriorDrawEdge(2048, 'med')).toBe(1024)
    expect(exteriorDrawEdge(2048, 'low')).toBe(512)
    expect(exteriorTexture('curtain')).toBeNull()
  })

  it('ships a full-res plate for each playtest exterior', () => {
    for (const id of Object.keys(EXTERIOR_FILES) as (keyof typeof EXTERIOR_FILES)[]) {
      const size = jpegSize(`public/${exteriorArtUrl(id)}`)
      expect(size, id).toEqual({ w: EXTERIOR_FULL, h: EXTERIOR_FULL })
    }
  })
})
