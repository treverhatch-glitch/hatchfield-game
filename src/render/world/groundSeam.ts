/**
 * Makes a photo tile. The reference plates have a dark edge, so the border is
 * lifted first, then the picture is rolled by half so that edge sits in the
 * middle and the two sides of it are blended together. The outer pixels stay
 * a neighbouring pair from the original middle, which is what lets the tile repeat.
 */

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

function luma(src: Uint8Array, i: number): number {
  return 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]
}

/** Lift a darker rim so a vignette does not print as a grid. */
export function devignette(src: Uint8Array, w: number, h: number, ch = 3): Uint8Array {
  const bins = 24
  const sum = new Float64Array(bins)
  const cnt = new Float64Array(bins)
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const maxR = Math.max(1, Math.hypot(cx, cy))
  const step = Math.max(1, Math.floor(Math.min(w, h) / 128))
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const bin = Math.min(bins - 1, Math.floor((Math.hypot(x - cx, y - cy) / maxR) * bins))
      sum[bin] += luma(src, (y * w + x) * ch)
      cnt[bin]++
    }
  }
  const avg = new Float64Array(bins)
  let center = 0
  for (let i = 0; i < bins; i++) {
    avg[i] = cnt[i] ? sum[i] / cnt[i] : 0
    if (!center && avg[i]) center = avg[i]
  }
  if (!center) return new Uint8Array(src)
  for (let i = 1; i < bins; i++) if (!avg[i]) avg[i] = avg[i - 1]
  const gain = new Float64Array(bins)
  for (let i = 0; i < bins; i++) {
    const g = center / (avg[i] || center)
    gain[i] = Math.max(0.96, Math.min(1.18, g))
  }
  const out = new Uint8Array(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rf = (Math.hypot(x - cx, y - cy) / maxR) * (bins - 1)
      const i0 = Math.min(bins - 1, Math.floor(rf))
      const i1 = Math.min(bins - 1, i0 + 1)
      const t = rf - i0
      const g = gain[i0] * (1 - t) + gain[i1] * t
      const i = (y * w + x) * ch
      for (let k = 0; k < ch; k++) out[i + k] = Math.max(0, Math.min(255, Math.round(src[i + k] * g)))
    }
  }
  return out
}

export function roll(src: Uint8Array, w: number, h: number, ch: number, dx: number, dy: number): Uint8Array {
  const out = new Uint8Array(src.length)
  for (let y = 0; y < h; y++) {
    const sy = mod(y + dy, h)
    const row = sy * w
    for (let x = 0; x < w; x++) {
      const si = (row + mod(x + dx, w)) * ch
      const di = (y * w + x) * ch
      for (let k = 0; k < ch; k++) out[di + k] = src[si + k]
    }
  }
  return out
}

function smooth(t: number): number {
  const s = Math.max(0, Math.min(1, t))
  return s * s * (3 - 2 * s)
}

/**
 * The rolled border sits between `half - 1` and `half`. Each pair mirrored
 * across that line fades to the same average, so the two sides meet.
 */
function healAxis(
  src: Uint8Array,
  out: Uint8Array,
  w: number,
  h: number,
  ch: number,
  vertical: boolean,
) {
  const span = vertical ? w : h
  const band = Math.max(1, Math.floor(span * 0.16))
  const half = Math.floor(span / 2)
  const along = vertical ? h : w
  for (let t = 0; t < along; t++) {
    for (let i = 0; i < band; i++) {
      const left = mod(half - 1 - i, span)
      const right = mod(half + i, span)
      const s = smooth((i + 0.5) / band)
      const li = (vertical ? t * w + left : left * w + t) * ch
      const ri = (vertical ? t * w + right : right * w + t) * ch
      for (let k = 0; k < ch; k++) {
        const a = src[li + k]
        const b = src[ri + k]
        const avg = (a + b) * 0.5
        out[li + k] = Math.round(a * s + avg * (1 - s))
        out[ri + k] = Math.round(b * s + avg * (1 - s))
      }
    }
  }
}

/** Blend both sides of the centre cross so the rolled border meets. */
export function healSeams(src: Uint8Array, w: number, h: number, ch = 3): Uint8Array {
  const across = new Uint8Array(src)
  healAxis(src, across, w, h, ch, true)
  const out = new Uint8Array(across)
  healAxis(across, out, w, h, ch, false)
  return out
}

/** Force the outer pixels to agree so the tile repeats, feathering inward. */
export function blendWrap(src: Uint8Array, w: number, h: number, ch = 3): Uint8Array {
  const across = new Uint8Array(src)
  const bandX = Math.max(1, Math.floor(w * 0.03))
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < bandX; i++) {
      const s = smooth((i + 0.5) / bandX)
      const li = (y * w + i) * ch
      const ri = (y * w + (w - 1 - i)) * ch
      for (let k = 0; k < ch; k++) {
        const a = src[li + k]
        const b = src[ri + k]
        const avg = (a + b) * 0.5
        across[li + k] = Math.round(a * s + avg * (1 - s))
        across[ri + k] = Math.round(b * s + avg * (1 - s))
      }
    }
  }
  const out = new Uint8Array(across)
  const bandY = Math.max(1, Math.floor(h * 0.03))
  for (let x = 0; x < w; x++) {
    for (let i = 0; i < bandY; i++) {
      const s = smooth((i + 0.5) / bandY)
      const ti = (i * w + x) * ch
      const bi = ((h - 1 - i) * w + x) * ch
      for (let k = 0; k < ch; k++) {
        const a = across[ti + k]
        const b = across[bi + k]
        const avg = (a + b) * 0.5
        out[ti + k] = Math.round(a * s + avg * (1 - s))
        out[bi + k] = Math.round(b * s + avg * (1 - s))
      }
    }
  }
  return out
}

/** Full-frame tile: lift the rim, roll, heal the cross, then match the outer edge. */
export function makeSeamless(src: Uint8Array, w: number, h: number, ch = 3): Uint8Array {
  const flat = devignette(src, w, h, ch)
  const rolled = roll(flat, w, h, ch, Math.floor(w / 2), Math.floor(h / 2))
  return blendWrap(healSeams(rolled, w, h, ch), w, h, ch)
}
