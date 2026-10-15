/**
 * Grades for the Gemini interior plates before they are made seamless.
 * Gate carpet is busy and high-contrast. Shop planks are cut off on the
 * rim and some boards are dark. Security rubber reads orange; it should
 * sit on pale sand. The seam pass itself is makeSeamless in groundSeam.
 */

function lumaAt(src: Uint8Array, i: number): number {
  return 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]
}

function mean(src: Uint8Array, ch: number): number[] {
  const acc = new Array<number>(ch).fill(0)
  const n = src.length / ch
  for (let i = 0; i < src.length; i += ch) {
    for (let k = 0; k < ch; k++) acc[k] += src[i + k]
  }
  return acc.map((v) => v / n)
}

/** Pull contrast toward the average, then fade colour toward grey. */
export function calmField(src: Uint8Array, w: number, h: number, ch = 3, keep = 0.4, sat = 0.45): Uint8Array {
  const avg = mean(src, ch)
  const out = new Uint8Array(src.length)
  const n = w * h
  for (let p = 0; p < n; p++) {
    const i = p * ch
    let l = 0
    for (let k = 0; k < ch; k++) {
      out[i + k] = avg[k] + (src[i + k] - avg[k]) * keep
      l += (k === 0 ? 0.2126 : k === 1 ? 0.7152 : 0.0722) * out[i + k]
    }
    for (let k = 0; k < ch; k++) {
      const mixed = out[i + k] * sat + l * (1 - sat)
      out[i + k] = Math.max(0, Math.min(255, Math.round(mixed)))
    }
  }
  return out
}

/** Move the average colour onto a target and keep the studs. */
export function shiftToward(src: Uint8Array, w: number, h: number, ch: number, target: number[]): Uint8Array {
  const avg = mean(src, ch)
  const out = new Uint8Array(src.length)
  const n = w * h
  for (let p = 0; p < n; p++) {
    const i = p * ch
    let l = 0
    const shifted: number[] = []
    for (let k = 0; k < ch; k++) {
      const v = src[i + k] + (target[k] - avg[k])
      shifted.push(v)
      l += (k === 0 ? 0.2126 : k === 1 ? 0.7152 : 0.0722) * v
    }
    for (let k = 0; k < ch; k++) {
      const mixed = shifted[k] * 0.82 + l * 0.18
      out[i + k] = Math.max(0, Math.min(255, Math.round(mixed)))
    }
  }
  return out
}

/** Pale sand for the security-lane rubber. */
export const PALE_SAND = [214, 198, 170]

/**
 * Copy a dark cropped rim inward from the first healthy row or column.
 * Interior grooves stay. Only a short run on the outer edge is replaced.
 */
export function repairRim(src: Uint8Array, w: number, h: number, ch = 3, cut = 170, max = 16): Uint8Array {
  const rowMean = (y: number) => {
    let s = 0
    const i0 = y * w * ch
    for (let x = 0; x < w; x++) s += lumaAt(src, i0 + x * ch)
    return s / w
  }
  const colMean = (x: number) => {
    let s = 0
    for (let y = 0; y < h; y++) s += lumaAt(src, (y * w + x) * ch)
    return s / h
  }
  let top = 0
  while (top < max && top < h && rowMean(top) < cut) top++
  let bot = 0
  while (bot < max && bot < h - top && rowMean(h - 1 - bot) < cut) bot++
  let left = 0
  while (left < max && left < w && colMean(left) < cut) left++
  let right = 0
  while (right < max && right < w - left && colMean(w - 1 - right) < cut) right++
  if (!top && !bot && !left && !right) return new Uint8Array(src)
  const out = new Uint8Array(src)
  const copyRow = (from: number, to: number) => {
    out.set(src.subarray(from * w * ch, (from + 1) * w * ch), to * w * ch)
  }
  const srcRow = top < h ? top : 0
  for (let y = 0; y < top; y++) copyRow(srcRow, y)
  const srcBot = h - 1 - bot
  for (let y = 0; y < bot; y++) copyRow(srcBot, h - 1 - y)
  const srcLeft = left < w ? left : 0
  const srcRight = w - 1 - right
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < left; x++) {
      const di = (y * w + x) * ch
      const si = (y * w + srcLeft) * ch
      for (let k = 0; k < ch; k++) out[di + k] = out[si + k]
    }
    for (let x = 0; x < right; x++) {
      const di = (y * w + (w - 1 - x)) * ch
      const si = (y * w + srcRight) * ch
      for (let k = 0; k < ch; k++) out[di + k] = out[si + k]
    }
  }
  return out
}

/**
 * Lighten plank bodies that sit under `floor` luma. Grooves (a dark row)
 * stay dark so the boards still separate.
 */
export function liftDarkPlanks(src: Uint8Array, w: number, h: number, ch = 3, floor = 204): Uint8Array {
  const rows = new Float64Array(h)
  for (let y = 0; y < h; y++) {
    let s = 0
    const i0 = y * w * ch
    for (let x = 0; x < w; x++) s += lumaAt(src, i0 + x * ch)
    rows[y] = s / w
  }
  const out = new Uint8Array(src.length)
  for (let y = 0; y < h; y++) {
    const m = rows[y]
    const add = m >= 150 && m < floor ? (floor - m) * 0.9 : 0
    const i0 = y * w * ch
    for (let x = 0; x < w; x++) {
      const i = i0 + x * ch
      for (let k = 0; k < ch; k++) out[i + k] = Math.max(0, Math.min(255, Math.round(src[i + k] + add)))
    }
  }
  return out
}
