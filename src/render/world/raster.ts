/**
 * Tiny RGBA software raster for procedural textures. Runs in Node (tests) and the
 * browser with no canvas dependency; output feeds THREE.DataTexture.
 */
import { GROUND_LOOK } from '../look'

export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Value noise that tiles with `period` lattice cells. */
export function tileNoise(x: number, y: number, period: number, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const wrap = (v: number) => ((v % period) + period) % period
  const a = hash2(wrap(xi), wrap(yi), seed)
  const b = hash2(wrap(xi + 1), wrap(yi), seed)
  const c = hash2(wrap(xi), wrap(yi + 1), seed)
  const d = hash2(wrap(xi + 1), wrap(yi + 1), seed)
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** Tileable fbm in 0..1 for texture coordinates u, v in 0..1. */
export function fbm(u: number, v: number, base: number, octaves: number, seed = 0): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let p = base
  for (let o = 0; o < octaves; o++) {
    sum += tileNoise(u * p, v * p, p, seed + o * 17) * amp
    norm += amp
    amp *= 0.5
    p *= 2
  }
  return sum / norm
}

export type RGB = readonly [number, number, number]

export function hexRgb(hex: number): RGB {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

export class Raster {
  readonly w: number
  readonly h: number
  readonly data: Uint8Array

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.data = new Uint8Array(w * h * 4)
  }

  set(x: number, y: number, c: RGB, a = 255) {
    const xi = ((x % this.w) + this.w) % this.w
    const yi = ((y % this.h) + this.h) % this.h
    const i = (yi * this.w + xi) * 4
    this.data[i] = c[0]
    this.data[i + 1] = c[1]
    this.data[i + 2] = c[2]
    this.data[i + 3] = a
  }

  get(x: number, y: number): [number, number, number, number] {
    const xi = ((x % this.w) + this.w) % this.w
    const yi = ((y % this.h) + this.h) % this.h
    const i = (yi * this.w + xi) * 4
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
  }

  /** Blend `c` over the pixel by alpha 0..1 (wraps at the edges so tiles stay seamless). */
  blend(x: number, y: number, c: RGB, alpha: number) {
    const [r, g, b, a] = this.get(x, y)
    const k = Math.max(0, Math.min(1, alpha))
    this.set(x, y, [r + (c[0] - r) * k, g + (c[1] - g) * k, b + (c[2] - b) * k], a)
  }

  fill(fn: (u: number, v: number, x: number, y: number) => RGB) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) this.set(x, y, fn(x / this.w, y / this.h, x, y))
    }
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, alpha = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.blend(x + i, y + j, c, alpha)
  }

  /** Mean luminance 0..255, handy for tests. */
  meanLuma(): number {
    let s = 0
    for (let i = 0; i < this.data.length; i += 4) {
      s += 0.2126 * this.data[i] + 0.7152 * this.data[i + 1] + 0.0722 * this.data[i + 2]
    }
    return s / (this.w * this.h)
  }
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t))
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

function shade(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k]
}

export function paintGrass(size: number, seed = 1): Raster {
  const r = new Raster(size, size)
  const dark = hexRgb(GROUND_LOOK.grassDark)
  const mid = hexRgb(GROUND_LOOK.grassMid)
  const dry = hexRgb(GROUND_LOOK.grassDry)
  const worn = hexRgb(GROUND_LOOK.grassWorn)
  const mow = GROUND_LOOK.mowStripe
  r.fill((u, v) => {
    const n = fbm(u, v, 4, 4, seed)
    const d = fbm(u, v, 2, 2, seed + 9)
    const patch = fbm(u, v, 2, 3, seed + 21)
    // Two mowing bands per tile with soft edges; seamless because the tile wraps at u = 0 / 1.
    const band = 1 + mow * Math.max(-1, Math.min(1, Math.sin(u * Math.PI * 2) * 4))
    const base = shade(mix(mix(dark, mid, n * 1.3), dry, Math.max(0, d - 0.62) * 2.2), band)
    return mix(base, worn, Math.max(0, patch - 0.62) * 1.6)
  })
  const rand = rng(seed * 31 + 7)
  // Blade strokes: short vertical dashes, lighter tips.
  const strokes = size * size * 0.18
  for (let i = 0; i < strokes; i++) {
    const x = Math.floor(rand() * size)
    const y = Math.floor(rand() * size)
    const len = 1 + Math.floor(rand() * Math.max(2, size / 64))
    const tone = rand() < 0.5 ? hexRgb(GROUND_LOOK.grassBladeLight) : hexRgb(GROUND_LOOK.grassBladeDark)
    for (let k = 0; k < len; k++) r.blend(x, y - k, tone, 0.55 - k * 0.1)
  }
  // Clover / weed specks.
  for (let i = 0; i < size * 0.6; i++) {
    r.blend(Math.floor(rand() * size), Math.floor(rand() * size), hexRgb(0xd8d27a), 0.6)
  }
  return r
}

export function paintAsphalt(size: number, seed = 2, base = 0x3b3e44): Raster {
  const r = new Raster(size, size)
  const c0 = hexRgb(base)
  r.fill((u, v, x, y) => {
    const n = fbm(u, v, 8, 3, seed)
    const grain = hash2(x, y, seed) - 0.5
    return shade(c0, 0.86 + n * 0.22 + grain * 0.14)
  })
  const rand = rng(seed * 13 + 3)
  // Aggregate flecks + tar patches.
  for (let i = 0; i < size * size * 0.05; i++) {
    const tone = rand() < 0.6 ? hexRgb(0x6a6e74) : hexRgb(0x24262a)
    r.blend(Math.floor(rand() * size), Math.floor(rand() * size), tone, 0.5)
  }
  for (let i = 0; i < 3; i++) {
    let x = rand() * size
    let y = rand() * size
    let a = rand() * Math.PI * 2
    const steps = size * 0.35
    for (let k = 0; k < steps; k++) {
      r.blend(Math.floor(x), Math.floor(y), hexRgb(0x1c1e22), 0.55)
      a += (rand() - 0.5) * 0.6
      x += Math.cos(a)
      y += Math.sin(a)
    }
  }
  // Fine grooves and rubber touchdown stains. Direction follows the texture tile.
  const groove = hexRgb(0x2c2e32)
  const step = Math.max(4, Math.round(size / 40))
  for (let x = 0; x < size; x += step) r.rect(x, 0, 1, size, groove, 0.16)
  const rubber = hexRgb(0x16181c)
  for (const band of [0.18, 0.42, 0.7]) {
    const y = Math.floor(band * size)
    r.rect(0, y, size, Math.max(2, Math.round(size * 0.035)), rubber, 0.32)
  }
  return r
}

/** Concrete apron slabs with sealed joints. The grid repeats with the texture tile. */
export function paintConcrete(size: number, seed = 3, base: number = GROUND_LOOK.concrete): Raster {
  const r = new Raster(size, size)
  const c0 = hexRgb(base)
  const slabs = Math.max(2, GROUND_LOOK.slabCount)
  r.fill((u, v, x, y) => {
    const n = fbm(u, v, 6, 3, seed)
    const slab = hash2(Math.floor(u * slabs), Math.floor(v * slabs), seed) * 0.1
    const grain = hash2(x, y, seed + 1) - 0.5
    return shade(c0, 0.86 + n * 0.16 + slab + grain * 0.06)
  })
  const joint = hexRgb(GROUND_LOOK.joint)
  const lip = hexRgb(0xd8dbde)
  const lw = Math.max(1, Math.round(size / 96))
  for (let s = 0; s < slabs; s++) {
    const p = Math.floor((s * size) / slabs)
    r.rect(p, 0, lw, size, joint, 0.92)
    r.rect(0, p, size, lw, joint, 0.92)
    r.rect(p + lw, 0, 1, size, lip, 0.4)
    r.rect(0, p + lw, size, 1, lip, 0.4)
  }
  const rand = rng(seed * 7 + 1)
  // Oil / rubber stains.
  for (let i = 0; i < 4; i++) {
    const cx = rand() * size
    const cy = rand() * size
    const rad = size * (0.03 + rand() * 0.06)
    for (let y = -rad; y <= rad; y++) {
      for (let x = -rad; x <= rad; x++) {
        const d = Math.hypot(x, y) / rad
        if (d < 1) r.blend(Math.floor(cx + x), Math.floor(cy + y), hexRgb(0x5a5c60), (1 - d) * 0.25)
      }
    }
  }
  return r
}

/** Landside road asphalt: darker than taxiways, with a pair of wheel-track bands. */
export function paintRoad(size: number, seed = 11): Raster {
  const r = paintAsphalt(size, seed, GROUND_LOOK.roadAsphalt)
  const wear = hexRgb(0x2a2c30)
  const band = Math.max(2, Math.round(size * 0.055))
  for (const t of [0.3, 0.7]) {
    const y = Math.floor(t * size - band / 2)
    r.rect(0, y, size, band, wear, 0.4)
    const x = Math.floor(t * size - band / 2)
    r.rect(x, 0, band, size, wear, 0.22)
  }
  return r
}

/** Polished terrazzo for terminal floors. */
export function paintTerrazzo(size: number, seed = 4): Raster {
  const r = new Raster(size, size)
  const c0 = hexRgb(0xd9d4ca)
  r.fill((u, v, x, y) => shade(c0, 0.94 + fbm(u, v, 4, 2, seed) * 0.08 + (hash2(x, y, seed) - 0.5) * 0.05))
  const rand = rng(seed * 5)
  const chips = [hexRgb(0x8a8478), hexRgb(0xb0a690), hexRgb(0x6a7682)]
  for (let i = 0; i < size * size * 0.03; i++) {
    r.blend(Math.floor(rand() * size), Math.floor(rand() * size), chips[i % 3], 0.6)
  }
  const lw = Math.max(1, Math.round(size / 160))
  r.rect(0, 0, size, lw, hexRgb(0xa8a296), 0.7)
  r.rect(0, 0, lw, size, hexRgb(0xa8a296), 0.7)
  return r
}

/** Gravel roof membrane with a faint seam grid. */
export function paintRoof(size: number, seed = 5): Raster {
  const r = new Raster(size, size)
  const c0 = hexRgb(0x9aa0a6)
  r.fill((u, v, x, y) => shade(c0, 0.85 + fbm(u, v, 8, 2, seed) * 0.15 + (hash2(x, y, seed) - 0.5) * 0.18))
  const lw = Math.max(1, Math.round(size / 128))
  for (let k = 0; k < 4; k++) r.rect(Math.floor((k * size) / 4), 0, lw, size, hexRgb(0x80868c), 0.6)
  return r
}

/** Radial falloff used for light glows and ground light pools (alpha channel). */
export function paintGlow(size: number, power = 2): Raster {
  const r = new Raster(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      const a = Math.pow(Math.max(0, 1 - d), power)
      r.set(x, y, [255, 255, 255], Math.round(a * 255))
    }
  }
  return r
}

/** Flight information display: rows of amber / white "text" blocks on navy. */
export function paintBoard(w: number, h: number, seed = 6): Raster {
  const r = new Raster(w, h)
  r.fill(() => hexRgb(0x0c1828))
  const rand = rng(seed)
  const rows = Math.max(4, Math.floor(h / 6))
  for (let i = 0; i < rows; i++) {
    const y = 2 + Math.floor((i * (h - 4)) / rows)
    let x = 2
    while (x < w - 4) {
      const len = 2 + Math.floor(rand() * 6)
      const tone = rand() < 0.7 ? hexRgb(0xf2c14a) : rand() < 0.5 ? hexRgb(0xe8f0f8) : hexRgb(0x6ad48a)
      r.rect(x, y, Math.min(len, w - x - 2), 2, tone, 1)
      x += len + 2
    }
  }
  return r
}
