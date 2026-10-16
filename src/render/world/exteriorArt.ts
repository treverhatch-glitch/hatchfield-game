/**
 * Full-resolution exterior plates in public/art/textures/exteriors.
 * High keeps every pixel. Med and low are the only downscale
 * (`hatchfield-texture-quality`). Graphics quality does not resize these.
 */
import * as THREE from 'three'
import { DEFAULT_TEXTURE_QUALITY, parseTextureQuality, TEXTURE_QUALITY_KEY, type TextureQuality } from '../aircraft/liveryFiles'
import { raiseAnisotropy } from './textureRegistry'

export const EXTERIOR_DIR = 'art/textures/exteriors'

export const EXTERIOR_FILES = {
  curtain: 'curtain.jpg',
  cladding: 'cladding.jpg',
  tank: 'tank.jpg',
  masonry: 'masonry.jpg',
  bay: 'bay.jpg',
  shaft: 'shaft.jpg',
  membrane: 'membrane.jpg',
} as const

export type ExteriorArtId = keyof typeof EXTERIOR_FILES

/** Native plate is 2048. High does not scale it down. */
export const EXTERIOR_FULL = 2048

export const EXTERIOR_LONG_SIDE: Record<TextureQuality, number> = {
  low: 512,
  med: 1024,
  high: EXTERIOR_FULL,
}

const FILL: Record<ExteriorArtId, string> = {
  curtain: '#d5e3ee',
  cladding: '#d0d4d8',
  tank: '#e4e8eb',
  masonry: '#e4d9cc',
  bay: '#c8262b',
  shaft: '#e7ebef',
  membrane: '#8e98a0',
}

export function exteriorArtUrl(id: ExteriorArtId, base = ''): string {
  return `${base}${EXTERIOR_DIR}/${EXTERIOR_FILES[id]}`
}

/** Drawn size. High returns the file's own edge. */
export function exteriorDrawEdge(fileEdge: number, quality: TextureQuality): number {
  const cap = EXTERIOR_LONG_SIDE[quality]
  return fileEdge > cap ? cap : fileEdge
}

function readQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return DEFAULT_TEXTURE_QUALITY
  }
}

const cache = new Map<string, THREE.Texture>()

function blank(id: ExteriorArtId): HTMLCanvasElement {
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
 * Shared plate, or null in Node (tests keep flat colours).
 * The canvas stands in until the file arrives. Do not dispose it per mesh.
 */
export function exteriorTexture(id: ExteriorArtId, anisotropy = 8): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const quality = readQuality()
  const key = `${id}|${quality}`
  const hit = cache.get(key)
  if (hit) {
    raiseAnisotropy(hit, anisotropy)
    return hit
  }
  const tex = new THREE.Texture()
  tex.image = blank(id)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  raiseAnisotropy(tex, anisotropy)
  const img = new Image()
  img.onload = () => {
    const edge = Math.max(img.naturalWidth, img.naturalHeight)
    const draw = exteriorDrawEdge(edge, quality)
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
  img.src = exteriorArtUrl(id, base)
  cache.set(key, tex)
  return tex
}

export function disposeExteriorTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}
