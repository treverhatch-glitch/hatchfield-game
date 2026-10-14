import * as THREE from 'three'
import { GROUND_LOOK } from '../look'
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
    glow: rasterTexture(paintGlow(64, 2.2), { srgb: false, repeat: false }),
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
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** Wayfinding words drawn in code. The photo signs were angled and unusable. */
export function wayfindingTexture(title: string, sub?: string): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = sub ? 512 : 360
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#0e2233'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#f2c14a'
  ctx.fillRect(0, 0, canvas.width, 28)
  ctx.fillRect(0, canvas.height - 18, canvas.width, 18)
  ctx.fillStyle = '#f4f7fb'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${sub ? 168 : 148}px system-ui, sans-serif`
  ctx.fillText(title, canvas.width / 2, sub ? canvas.height * 0.4 : canvas.height * 0.52)
  if (sub) {
    ctx.fillStyle = '#f2c14a'
    ctx.font = '700 120px system-ui, sans-serif'
    ctx.fillText(sub, canvas.width / 2, canvas.height * 0.72)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** Rows on the departures board. Drawn as text, not a photo of a screen. */
export const DEPARTURES_ROWS: readonly (readonly [string, string, string, string, string])[] = [
  ['14:20', 'AA 214', 'BKK', 'A1', 'ON TIME'],
  ['14:35', 'SK 881', 'CPH', 'A2', 'BOARDING'],
  ['14:50', 'TG 402', 'NRT', 'A3', 'GATE OPEN'],
  ['15:10', 'QF 018', 'SYD', 'B2', 'ON TIME'],
  ['15:40', 'BA 010', 'LHR', 'B4', 'DELAYED'],
]

export function departuresBoardTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#071422'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#12304a'
  ctx.fillRect(0, 0, canvas.width, 108)
  ctx.fillStyle = '#f2c14a'
  ctx.font = '700 64px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('DEPARTURES', 36, 54)
  const cols = [36, 240, 500, 700, 820]
  ctx.font = '600 28px system-ui, sans-serif'
  ctx.fillStyle = '#8fb4cc'
  const heads = ['TIME', 'FLIGHT', 'TO', 'GATE', 'STATUS']
  heads.forEach((h, i) => ctx.fillText(h, cols[i], 150))
  DEPARTURES_ROWS.forEach((row, r) => {
    const y = 230 + r * 78
    ctx.fillStyle = r % 2 === 0 ? '#0c1c2e' : '#102438'
    ctx.fillRect(16, y - 32, canvas.width - 32, 68)
    row.forEach((cell, i) => {
      const status = i === 4
      ctx.fillStyle = status ? (cell === 'DELAYED' ? '#e07a5f' : cell === 'BOARDING' ? '#f2c14a' : '#7dcea0') : '#e8f0f6'
      ctx.font = status ? '700 30px system-ui, sans-serif' : '600 34px system-ui, sans-serif'
      ctx.fillText(cell, cols[i], y)
    })
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}
