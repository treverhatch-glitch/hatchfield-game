import { describe, expect, it } from 'vitest'
import { calmField, liftDarkPlanks, PALE_SAND, repairRim, shiftToward } from './interiorGrade'

function fill(w: number, h: number, rgb: [number, number, number], rim?: [number, number, number]): Uint8Array {
  const src = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = rim && (y === 0 || y === h - 1 || x === 0 || x === w - 1)
      const c = edge ? rim : rgb
      const i = (y * w + x) * 3
      src[i] = c[0]
      src[i + 1] = c[1]
      src[i + 2] = c[2]
    }
  }
  return src
}

function lumaStd(src: Uint8Array): number {
  const n = src.length / 3
  let sum = 0
  const vals = new Float64Array(n)
  for (let p = 0; p < n; p++) {
    const i = p * 3
    vals[p] = 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]
    sum += vals[p]
  }
  const avg = sum / n
  let v = 0
  for (let p = 0; p < n; p++) v += (vals[p] - avg) ** 2
  return Math.sqrt(v / n)
}

describe('interior plate grades', () => {
  it('calms a high-contrast field', () => {
    const w = 8
    const h = 8
    const src = new Uint8Array(w * h * 3)
    for (let i = 0; i < src.length; i += 3) {
      const on = (i / 3) % 2 === 0
      src[i] = on ? 20 : 220
      src[i + 1] = on ? 30 : 180
      src[i + 2] = on ? 80 : 40
    }
    const before = lumaStd(src)
    const out = calmField(src, w, h, 3, 0.4, 0.45)
    expect(lumaStd(out)).toBeLessThan(before * 0.55)
  })

  it('shifts rubber toward pale sand', () => {
    const src = fill(4, 4, [198, 160, 110])
    const out = shiftToward(src, 4, 4, 3, PALE_SAND)
    const n = out.length / 3
    let r = 0
    let g = 0
    let b = 0
    for (let i = 0; i < out.length; i += 3) {
      r += out[i]
      g += out[i + 1]
      b += out[i + 2]
    }
    expect(r / n).toBeGreaterThan(200)
    expect(b / n).toBeGreaterThan(150)
    expect(g / n).toBeGreaterThan(180)
  })

  it('replaces a cropped dark rim with the plank inside it', () => {
    const src = fill(6, 6, [210, 190, 160], [40, 30, 20])
    const out = repairRim(src, 6, 6, 3, 170, 4)
    expect(out[0]).toBe(210)
    expect(out[out.length - 3]).toBe(210)
    const mid = (3 * 6 + 3) * 3
    expect(out[mid]).toBe(210)
  })

  it('lifts a dark plank and leaves a groove', () => {
    const w = 4
    const h = 4
    const src = fill(w, h, [180, 160, 130])
    for (let x = 0; x < w; x++) {
      const i = (1 * w + x) * 3
      src[i] = 40
      src[i + 1] = 30
      src[i + 2] = 20
    }
    const out = liftDarkPlanks(src, w, h, 3, 200)
    expect(out[0]).toBeGreaterThan(180)
    const groove = (1 * w) * 3
    expect(out[groove]).toBe(40)
  })
})
