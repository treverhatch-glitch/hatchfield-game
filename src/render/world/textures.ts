import * as THREE from 'three'
import { BLOOM_LOOK, GROUND_LOOK } from '../look'
import {
  paintAsphalt,
  paintBoard,
  paintConcrete,
  paintGlow,
  paintGrass,
  paintRoof,
  paintTerrazzo,
  type Raster,
} from './raster'

export function rasterTexture(r: Raster, opts: { srgb?: boolean; anisotropy?: number; repeat?: boolean } = {}) {
  const tex = new THREE.DataTexture(r.data, r.w, r.h, THREE.RGBAFormat)
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace
  if (opts.repeat !== false) {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
  }
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = opts.anisotropy ?? 4
  tex.needsUpdate = true
  return tex
}

export interface WorldTextures {
  grass: THREE.DataTexture
  asphalt: THREE.DataTexture
  runway: THREE.DataTexture
  concrete: THREE.DataTexture
  terrazzo: THREE.DataTexture
  roof: THREE.DataTexture
  glow: THREE.DataTexture
  /** Wider falloff for the second bloom halo (Medium / High). */
  glowHalo: THREE.DataTexture
  pool: THREE.DataTexture
  board: THREE.DataTexture
  dispose(): void
}

export function makeTextures(size: number, anisotropy: number): WorldTextures {
  const a = { anisotropy }
  const t: Omit<WorldTextures, 'dispose'> = {
    grass: rasterTexture(paintGrass(size), a),
    asphalt: rasterTexture(paintAsphalt(size, 2, GROUND_LOOK.taxiAsphalt), a),
    runway: rasterTexture(paintAsphalt(size, 8, GROUND_LOOK.runwayAsphalt), a),
    concrete: rasterTexture(paintConcrete(size), a),
    terrazzo: rasterTexture(paintTerrazzo(Math.min(size, 256)), a),
    roof: rasterTexture(paintRoof(Math.min(size, 256)), a),
    glow: rasterTexture(paintGlow(64, BLOOM_LOOK.glowPower), { srgb: false, repeat: false }),
    glowHalo: rasterTexture(paintGlow(64, BLOOM_LOOK.haloPower), { srgb: false, repeat: false }),
    pool: rasterTexture(paintGlow(64, 1.4), { srgb: false, repeat: false }),
    board: rasterTexture(paintBoard(64, 32), { repeat: false }),
  }
  return {
    ...t,
    dispose() {
      for (const tex of Object.values(t)) tex.dispose()
    },
  }
}

/**
 * Text signage needs a 2D canvas; in Node (tests) we fall back to null and callers
 * use a plain panel.
 */
export function textTexture(
  text: string,
  opts: { w?: number; h?: number; fg?: string; bg?: string; font?: string } = {},
): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = opts.w ?? 512
  canvas.height = opts.h ?? 96
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = opts.bg ?? '#13293d'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = opts.fg ?? '#f4f6f8'
  ctx.font = opts.font ?? `600 ${Math.round(canvas.height * 0.56)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}
