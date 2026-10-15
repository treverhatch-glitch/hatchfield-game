/**
 * Tileable interior plates in public/art/textures/interiors.
 * The files are full resolution. The only downscale is the texture-quality
 * setting (`hatchfield-texture-quality`). Decode waits on the image, so a
 * test run never uploads a JPEG.
 *
 * Plates follow the nine Gemini interior concepts: arrivals hall, baggage
 * claim, food court, gate seating, jet-bridge interior, lounge, restrooms,
 * staff office, and the wide check-in hall.
 */
import * as THREE from 'three'
import { parseTextureQuality, TEXTURE_QUALITY_KEY, type TextureQuality } from '../aircraft/liveryFiles'

export const INTERIOR_DIR = 'art/textures/interiors'

/** Concept studies these plates were derived from. */
export const INTERIOR_CONCEPTS = [
  'arrivals_hall',
  'baggage_claim',
  'food_court',
  'gate_seating',
  'jet_bridge_int',
  'lounge',
  'restrooms',
  'office',
  'checkin_wide',
] as const

export const INTERIOR_TILES = {
  floor_terrazzo: 'floor_terrazzo.jpg',
  floor_restroom: 'floor_restroom.jpg',
  floor_carpet: 'floor_carpet.jpg',
  wall_tile: 'wall_tile.jpg',
  wall_panel: 'wall_panel.jpg',
  wall_stall: 'wall_stall.jpg',
  counter_front: 'counter_front.jpg',
  belt_claim: 'belt_claim.jpg',
  office_panel: 'office_panel.jpg',
  jetbridge_panel: 'jetbridge_panel.jpg',
  lounge_wood: 'lounge_wood.jpg',
} as const

export type InteriorTile = keyof typeof INTERIOR_TILES

/** Longest side after the texture-quality setting. High keeps the 2048 plate. */
export const INTERIOR_LONG_SIDE: Record<TextureQuality, number> = {
  low: 512,
  med: 1024,
  high: 2048,
}

const ANISO: Record<TextureQuality, number> = { low: 2, med: 4, high: 8 }

const cache = new Map<string, THREE.Texture>()
const images = new Map<string, Promise<HTMLImageElement>>()

function textureQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return 'high'
  }
}

export function interiorTextureUrl(id: InteriorTile, base = ''): string {
  const prefix = base && !base.endsWith('/') ? `${base}/` : base
  return `${prefix}${INTERIOR_DIR}/${INTERIOR_TILES[id]}`
}

function loadImage(id: InteriorTile): Promise<HTMLImageElement> {
  const hit = images.get(id)
  if (hit) return hit
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(id))
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    img.src = interiorTextureUrl(id, base)
  })
  images.set(id, pending)
  return pending
}

/**
 * Repeating plate. Null outside the browser. The canvas is filled at once;
 * the JPEG replaces it after decode, already scaled to the quality tier.
 */
export function interiorTexture(id: InteriorTile, repeat: [number, number] = [1, 1]): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const quality = textureQuality()
  const key = `${id}|${quality}|${repeat[0]}x${repeat[1]}`
  const hit = cache.get(key)
  if (hit) return hit
  const cap = INTERIOR_LONG_SIDE[quality]
  const canvas = document.createElement('canvas')
  canvas.width = cap
  canvas.height = cap
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#c8c2b6'
    ctx.fillRect(0, 0, cap, cap)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = ANISO[quality]
  tex.repeat.set(repeat[0], repeat[1])
  tex.needsUpdate = true
  cache.set(key, tex)
  void loadImage(id).then((img) => {
    const scale = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')
    if (!g) return
    g.drawImage(img, 0, 0, w, h)
    tex.needsUpdate = true
  })
  return tex
}
