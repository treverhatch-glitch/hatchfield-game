import { describe, expect, it } from 'vitest'
import { makeSeamless } from './groundSeam'

function framed(w: number, h: number): Uint8Array {
  const src = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wave = 120 + Math.round(36 * Math.sin((x / w) * Math.PI * 4) * Math.cos((y / h) * Math.PI * 4))
      const rim = x < 3 || y < 3 || x >= w - 3 || y >= h - 3
      const v = rim ? 12 : wave
      const i = (y * w + x) * 3
      src[i] = v
      src[i + 1] = v
      src[i + 2] = Math.round(v * 0.9)
    }
  }
  return src
}

/** How far the outer column sits from the interior. A dark rim scores high. */
function rimContrast(src: Uint8Array, w: number, h: number): number {
  const inner = Math.floor(w / 4)
  let edge = 0
  let mid = 0
  for (let y = 0; y < h; y++) {
    edge += src[(y * w) * 3]
    mid += src[(y * w + inner) * 3]
  }
  return Math.abs(edge - mid) / h
}

describe('seamless ground plates', () => {
  it('lifts a dark frame so the tile edge matches the field', () => {
    const w = 64
    const h = 64
    const src = framed(w, h)
    const before = rimContrast(src, w, h)
    const out = makeSeamless(src, w, h, 3)
    expect(out.length).toBe(src.length)
    const after = rimContrast(out, w, h)
    expect(before).toBeGreaterThan(60)
    expect(after).toBeLessThan(before * 0.35)
    const half = Math.floor(w / 2)
    let jump = 0
    for (let y = 0; y < h; y++) {
      jump = Math.max(jump, Math.abs(out[(y * w + half) * 3] - out[(y * w + half - 1) * 3]))
    }
    expect(jump).toBeLessThan(18)
    let edge = 0
    for (let y = 0; y < h; y++) edge = Math.max(edge, Math.abs(out[y * w * 3] - out[(y * w + w - 1) * 3]))
    expect(edge).toBeLessThan(8)
  })
})
