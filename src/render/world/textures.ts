import * as THREE from 'three'
import { BLOOM_LOOK, GROUND_LOOK } from '../look'
import {
  paintAsphalt,
  paintBoard,
  paintConcrete,
  paintGlow,
  paintGrass,
  paintRoad,
  paintRoof,
  paintTerrazzo,
  type Raster,
} from './raster'
import { artTexture, GROUND_PHOTO } from './textureRegistry'

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
  grass: THREE.Texture
  asphalt: THREE.Texture
  runway: THREE.Texture
  road: THREE.Texture
  concrete: THREE.Texture
  terrazzo: THREE.Texture
  roof: THREE.Texture
  glow: THREE.DataTexture
  /** Wider falloff for the second bloom halo (Medium / High). */
  glowHalo: THREE.DataTexture
  pool: THREE.DataTexture
  board: THREE.DataTexture
  dispose(): void
}

/**
 * `photos` swaps the Gemini photo textures (shared, from the registry) in for the procedural
 * ground, roof and terrazzo rasters. Off on Low and in Node, where the rasters stay.
 */
export function makeTextures(size: number, anisotropy: number, photos = false): WorldTextures {
  const a = { anisotropy }
  const t: Omit<WorldTextures, 'dispose'> = {
    grass: rasterTexture(paintGrass(size), a),
    asphalt: rasterTexture(paintAsphalt(size, 2, GROUND_LOOK.taxiAsphalt), a),
    runway: rasterTexture(paintAsphalt(size, 8, GROUND_LOOK.runwayAsphalt), a),
    road: rasterTexture(paintRoad(size), a),
    concrete: rasterTexture(paintConcrete(size), a),
    terrazzo: rasterTexture(paintTerrazzo(Math.min(size, 256)), a),
    roof: rasterTexture(paintRoof(Math.min(size, 256)), a),
    glow: rasterTexture(paintGlow(64, BLOOM_LOOK.glowPower), { srgb: false, repeat: false }),
    glowHalo: rasterTexture(paintGlow(64, BLOOM_LOOK.haloPower), { srgb: false, repeat: false }),
    pool: rasterTexture(paintGlow(64, 1.4), { srgb: false, repeat: false }),
    board: rasterTexture(paintBoard(64, 32), { repeat: false }),
  }
  const out: Omit<WorldTextures, 'dispose'> = { ...t }
  if (photos) {
    for (const k of Object.keys(GROUND_PHOTO) as (keyof typeof GROUND_PHOTO)[]) {
      const photo = artTexture(GROUND_PHOTO[k], anisotropy)
      if (!photo) continue
      out[k] = photo
    }
  }
  return {
    ...out,
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

/** Gate boards are wider so the airline mark sits on the sign, left of the words. */
export const GATE_SIGN = { w: 1536, h: 512, logo: 440, pad: 28 } as const

const inkCache = new WeakMap<object, { sx: number; sy: number; sw: number; sh: number } | null>()

function sourceSize(image: CanvasImageSource): { w: number; h: number } {
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return { w: image.naturalWidth || image.width, h: image.naturalHeight || image.height }
  }
  const box = image as { width?: number; height?: number }
  return { w: box.width ?? 0, h: box.height ?? 0 }
}

/** Drop the white paper around a logo so the mark fills the slot. */
function inkBox(image: CanvasImageSource): { sx: number; sy: number; sw: number; sh: number } | null {
  if (inkCache.has(image as object)) return inkCache.get(image as object) ?? null
  const { w, h } = sourceSize(image)
  if (w < 8 || h < 8 || typeof document === 'undefined') return null
  const scratch = document.createElement('canvas')
  scratch.width = w
  scratch.height = h
  const g = scratch.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  try {
    g.drawImage(image, 0, 0, w, h)
  } catch {
    inkCache.set(image as object, null)
    return null
  }
  let data: Uint8ClampedArray
  try {
    data = g.getImageData(0, 0, w, h).data
  } catch {
    inkCache.set(image as object, null)
    return null
  }
  let minx = w
  let miny = h
  let maxx = 0
  let maxy = 0
  const step = 2
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      if (data[i] < 230 || data[i + 1] < 230 || data[i + 2] < 230) {
        if (x < minx) minx = x
        if (y < miny) miny = y
        if (x > maxx) maxx = x
        if (y > maxy) maxy = y
      }
    }
  }
  if (maxx <= minx || maxy <= miny) {
    inkCache.set(image as object, null)
    return null
  }
  const pad = 6
  minx = Math.max(0, minx - pad)
  miny = Math.max(0, miny - pad)
  maxx = Math.min(w - 1, maxx + pad)
  maxy = Math.min(h - 1, maxy + pad)
  const box = { sx: minx, sy: miny, sw: maxx - minx + 1, sh: maxy - miny + 1 }
  inkCache.set(image as object, box)
  return box
}

function paintWayfinding(canvas: HTMLCanvasElement, title: string, sub?: string, logo?: CanvasImageSource | null) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const gate = title === 'GATES' && !!sub
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0e2233'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const bar = gate ? 18 : 28
  ctx.fillStyle = '#f2c14a'
  ctx.fillRect(0, 0, canvas.width, bar)
  ctx.fillRect(0, canvas.height - (gate ? 14 : 18), canvas.width, gate ? 14 : 18)
  let textCx = canvas.width / 2
  if (gate) {
    const x = GATE_SIGN.pad
    const y = (canvas.height - GATE_SIGN.logo) / 2
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, GATE_SIGN.logo, GATE_SIGN.logo)
    if (logo) {
      const { w, h } = sourceSize(logo)
      const crop = w > 8 ? inkBox(logo) : null
      const sx = crop?.sx ?? 0
      const sy = crop?.sy ?? 0
      const sw = crop?.sw ?? w
      const sh = crop?.sh ?? h
      if (sw > 0 && sh > 0) {
        const inner = GATE_SIGN.logo - 16
        const scale = Math.min(inner / sw, inner / sh)
        const dw = sw * scale
        const dh = sh * scale
        ctx.drawImage(logo, sx, sy, sw, sh, x + 8 + (inner - dw) / 2, y + 8 + (inner - dh) / 2, dw, dh)
      }
    }
    textCx = GATE_SIGN.pad + GATE_SIGN.logo + (canvas.width - GATE_SIGN.pad - GATE_SIGN.logo) / 2
  }
  ctx.fillStyle = '#f4f7fb'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${sub ? (gate ? 132 : 168) : 148}px system-ui, sans-serif`
  ctx.fillText(title, textCx, sub ? canvas.height * 0.4 : canvas.height * 0.52)
  if (sub) {
    ctx.fillStyle = '#f2c14a'
    ctx.font = `700 ${gate ? 108 : 120}px system-ui, sans-serif`
    ctx.fillText(sub, textCx, canvas.height * 0.74)
  }
}

/** Wayfinding words drawn in code. The photo signs were angled and unusable. */
export function wayfindingTexture(title: string, sub?: string): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const gate = title === 'GATES' && !!sub
  canvas.width = gate ? GATE_SIGN.w : 1024
  canvas.height = gate ? GATE_SIGN.h : sub ? 512 : 360
  paintWayfinding(canvas, title, sub)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** Draw an airline mark into an existing gate board once the JPEG has arrived. */
export function stampWayfindingLogo(tex: THREE.Texture, title: string, sub: string, logo: CanvasImageSource) {
  const canvas = tex.image as HTMLCanvasElement | undefined
  if (!canvas || typeof canvas.getContext !== 'function') return
  paintWayfinding(canvas, title, sub, logo)
  tex.needsUpdate = true
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
