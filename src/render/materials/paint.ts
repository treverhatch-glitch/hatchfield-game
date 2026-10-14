/**
 * Procedural tileable surfaces. Pixels only, so tests run without a canvas.
 * A browser wraps the same pixels in a canvas texture; a PNG under
 * public/textures/ can replace either one later.
 */

export type SurfaceKind = 'floor' | 'wall' | 'wood'

/** File names under public/textures/. Drop a PNG here to replace the procedural map. */
export const SURFACE_FILES: Record<SurfaceKind, string> = {
  floor: 'floor.png',
  wall: 'wall.png',
  wood: 'wood.png',
}

export function surfacePngUrl(kind: SurfaceKind, root = '/textures'): string {
  const base = root.endsWith('/') ? root.slice(0, -1) : root
  return `${base}/${SURFACE_FILES[kind]}`
}

function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1440677579)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/**
 * Smooth value noise on a torus. `tileNoise(u, v) === tileNoise(u + 1, v + 1)`,
 * so a texture sampled with u = x / period repeats without a seam.
 */
export function tileNoise(u: number, v: number, seed = 1): number {
  const x = u - Math.floor(u)
  const y = v - Math.floor(v)
  const x0 = Math.floor(x * 256)
  const y0 = Math.floor(y * 256)
  const fx = x * 256 - x0
  const fy = y * 256 - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const h = (ix: number, iy: number) => hash(ix & 255, iy & 255, seed)
  const a = h(x0, y0)
  const b = h(x0 + 1, y0)
  const c = h(x0, y0 + 1)
  const d = h(x0 + 1, y0 + 1)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

function mix(base: number, n: number, amp: number): number {
  return Math.max(0, Math.min(255, Math.round(base + (n - 0.5) * amp)))
}

function put(data: Uint8Array, i: number, r: number, g: number, b: number) {
  const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  data[i] = byte(r)
  data[i + 1] = byte(g)
  data[i + 2] = byte(b)
  data[i + 3] = 255
}

/** RGBA pixels. `size` should be a multiple of 8 so grout and planks wrap. */
export function paintSurface(kind: SurfaceKind, size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const period = Math.max(4, Math.floor(size / 8))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (kind === 'floor') {
        const grout = x % period === 0 || y % period === 0
        const n = tileNoise(x / period, y / period, 2)
        const speck = hash(x, y, 4)
        if (grout) put(data, i, 92, 88, 82)
        else {
          const chip = speck > 0.92 ? 28 : 0
          put(data, i, mix(206, n, 18) - chip, mix(198, n, 16) - chip, mix(184, n, 14) - chip)
        }
      } else if (kind === 'wall') {
        const n = tileNoise(x / (period * 2), y / (period * 2), 5)
        const grit = hash(x, y, 6) > 0.97 ? -18 : 0
        put(data, i, mix(230, n, 14) + grit, mix(226, n, 12) + grit, mix(216, n, 12) + grit)
      } else {
        const seam = y % period === 0
        const n = tileNoise(x / (period * 4), y / period, 8 + Math.floor(y / period))
        const grain = tileNoise(x / 6, y / (period * 2), 11)
        if (seam) put(data, i, 78, 52, 32)
        else put(data, i, mix(168, n, 28) + (grain - 0.5) * 10, mix(118, n, 22), mix(72, n, 16))
      }
    }
  }
  return data
}
