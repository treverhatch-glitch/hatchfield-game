/**
 * Full-resolution ground plates in public/art/textures/ground.
 * High keeps every pixel. Med and low are the only downscale
 * (`hatchfield-texture-quality`). Graphics quality does not resize these.
 */
import * as THREE from 'three'
import { DEFAULT_TEXTURE_QUALITY, parseTextureQuality, TEXTURE_QUALITY_KEY, type TextureQuality } from '../aircraft/liveryFiles'

export const GROUND_DIR = 'art/textures/ground'

export const GROUND_FILES = {
  grass: 'grass.jpg',
  tarmac: 'tarmac.jpg',
  concrete: 'concrete.jpg',
  markings: 'markings.jpg',
} as const

export type GroundArtId = keyof typeof GROUND_FILES

/** Native plate is 2048. High does not scale it down. */
export const GROUND_FULL = 2048

export const GROUND_LONG_SIDE: Record<TextureQuality, number> = {
  low: 512,
  med: 1024,
  high: GROUND_FULL,
}

const FILL: Record<GroundArtId, string> = {
  grass: '#6d7a52',
  tarmac: '#4a4d52',
  concrete: '#b7babd',
  markings: '#f3f4f2',
}

export function readGroundQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return DEFAULT_TEXTURE_QUALITY
  }
}

export function groundArtUrl(id: GroundArtId, base = ''): string {
  return `${base}${GROUND_DIR}/${GROUND_FILES[id]}`
}

/** Drawn size. High returns the file's own edge. */
export function groundDrawEdge(fileEdge: number, quality: TextureQuality): number {
  const cap = GROUND_LONG_SIDE[quality]
  return fileEdge > cap ? cap : fileEdge
}

const cache = new Map<string, THREE.Texture>()

function blank(id: GroundArtId): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = FILL[id]
    ctx.fillRect(0, 0, 2, 2)
  }
  return canvas
}

/**
 * Shared repeat-wrapped plate, or null in Node (tests keep the procedural raster).
 * The canvas stands in until the JPEG arrives. Do not dispose it per mesh.
 */
export function groundTexture(id: GroundArtId, anisotropy = 8): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const quality = readGroundQuality()
  const key = `${id}|${quality}`
  const hit = cache.get(key)
  if (hit) {
    hit.anisotropy = Math.max(hit.anisotropy, anisotropy)
    return hit
  }
  const tex = new THREE.Texture()
  tex.image = blank(id)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  const img = new Image()
  img.onload = () => {
    const edge = Math.max(img.naturalWidth, img.naturalHeight)
    const draw = groundDrawEdge(edge, quality)
    if (draw === edge) {
      tex.image = img
    } else {
      const scale = draw / edge
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      tex.image = canvas
    }
    tex.needsUpdate = true
  }
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  img.src = groundArtUrl(id, base)
  cache.set(key, tex)
  return tex
}

export function disposeGroundTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}
