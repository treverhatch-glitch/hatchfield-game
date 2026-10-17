/**
 * Fake airframe surface detail: one tiling height field turned into a normal map and a
 * roughness map. Panel joints, rivet rows, a hatch outline and faint grime streaks live
 * in the textures, never in geometry. Mipmapped with full anisotropy, so the detail fades
 * smoothly to flat paint with distance instead of popping.
 *
 * Tile = PANEL_U_M × PANEL_V_M metres of skin (see the shell UVs in merge.ts).
 */
import * as THREE from 'three'

export const PANEL_U_M = 4.2
export const PANEL_V_M = 2.1
/** Roughness-map value on clean skin; material roughness is divided by this. */
export const DETAIL_ROUGH_CLEAN = 0.6
const N = 512

let cache: { normal: THREE.DataTexture; roughness: THREE.DataTexture } | null = null

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const w = (a: number, b: number) => hash(((a % 64) + 64) % 64, ((b % 64) + 64) % 64)
  const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** Height (0 flat, negative grooves, positive rivet heads) and grime (0–1) per texel. */
export function surfaceHeight(): { height: Float32Array; grime: Float32Array } {
  const height = new Float32Array(N * N)
  const grime = new Float32Array(N * N)
  const groove = (d: number, w: number) => (d < w ? -(1 - d / w) : 0)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Distances to the tile's joints (wrapping), in texels.
      const dx = Math.min(x, N - x)
      const dy = Math.min(y, N - y)
      let h = Math.min(0, groove(dx, 3.4) + groove(dy, 3.4))
      // A mid-panel lap joint along the length, lighter than the frame joints.
      h = Math.min(h, 0.5 * groove(Math.abs(y - N / 2), 1.6))
      // Rivet rows: small domes 7 texels either side of every joint, one every 9 texels.
      const rivet = (along: number, across: number) => {
        const a = ((along % 9) + 9) % 9 - 4.5
        const r = Math.hypot(a, across)
        return r < 1.6 ? 0.45 * (1 - r / 1.6) : 0
      }
      for (const off of [7, -7]) {
        h = Math.max(h, rivet(y, ((x + off + N) % N) - 0) * (dx > 4 ? 1 : 0) * (Math.abs(((x + N) % N) - ((N - off) % N)) < 2 ? 1 : 0))
      }
      if (Math.abs(dx - 7) < 1.6) h = Math.max(h, rivet(y, dx - 7))
      if (Math.abs(dy - 7) < 1.6) h = Math.max(h, rivet(x, dy - 7))
      // One hatch outline per tile (access panel), offset so it never sits on a joint.
      const hx0 = N * 0.62, hx1 = N * 0.78, hy0 = N * 0.18, hy1 = N * 0.3
      const inX = x > hx0 - 1.2 && x < hx1 + 1.2, inY = y > hy0 - 1.2 && y < hy1 + 1.2
      if (inX && inY) {
        const e = Math.min(Math.abs(x - hx0), Math.abs(x - hx1), Math.abs(y - hy0), Math.abs(y - hy1))
        if (e < 1.2) h = Math.min(h, -0.6 * (1 - e / 1.2))
      }
      height[y * N + x] = h
      // Grime: soft streaks running aft along the skin, gathered in the joints.
      // Roughness only: a faint large-scale mottle plus slightly duller joints. Visible wear is
      // localised per vertex (airframeWear mask), not a tiled streak pattern.
      const mottle = valueNoise(x / 128, y / 128)
      grime[y * N + x] = (mottle - 0.5) * 0.12 + (h < -0.2 ? 0.25 : 0)
    }
  }
  return { height, grime }
}

/** Shared normal + roughness maps for every airframe shell. */
export function surfaceDetailMaps(): { normal: THREE.DataTexture; roughness: THREE.DataTexture } {
  if (cache) return cache
  const { height, grime } = surfaceHeight()
  const nrm = new Uint8Array(N * N * 4)
  const rgh = new Uint8Array(N * N * 4)
  const at = (x: number, y: number) => height[((y + N) % N) * N + ((x + N) % N)]
  const strength = 3
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const sx = (at(x + 1, y) - at(x - 1, y)) * strength
      const sy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(sx, sy, 1)
      const i = (y * N + x) * 4
      nrm[i] = Math.round(((-sx / len) * 0.5 + 0.5) * 255)
      nrm[i + 1] = Math.round(((-sy / len) * 0.5 + 0.5) * 255)
      nrm[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
      nrm[i + 3] = 255
      // R: grime occlusion (aoMap; strength per wear level is the material's aoMapIntensity).
      // G: roughness multiplier (roughnessMap): DETAIL_ROUGH_CLEAN on clean paint, rougher in grime.
      const g = grime[y * N + x]
      rgh[i] = 255
      rgh[i + 1] = Math.max(0, Math.min(255, Math.round((DETAIL_ROUGH_CLEAN + g * 0.3) * 255)))
      rgh[i + 2] = 255
      rgh[i + 3] = 255
    }
  }
  const make = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.anisotropy = 16
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    tex.needsUpdate = true
    return tex
  }
  cache = { normal: make(nrm, false), roughness: make(rgh, false) }
  return cache
}

/** Normal map strength on the painted skin. Subtle: the joints catch the sun, they do not shout. */
export const SURFACE_NORMAL_SCALE = 0.45
