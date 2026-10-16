/**
 * Full-resolution apron prop plates in public/art/textures/props.
 * High keeps every pixel. Med and low are the only downscale
 * (`hatchfield-texture-quality`). Graphics quality does not resize these.
 */
import * as THREE from 'three'
import { DEFAULT_TEXTURE_QUALITY, parseTextureQuality, TEXTURE_QUALITY_KEY, type TextureQuality } from '../aircraft/liveryFiles'
import { raiseAnisotropy } from './textureRegistry'

export const PROP_DIR = 'art/textures/props'

export const PROP_FILES = {
  corrugation: 'corrugation.jpg',
  chainlink: 'chainlink.png',
  hatch: 'hatch.jpg',
} as const

export type PropArtId = keyof typeof PROP_FILES

/** Native plate is 2048. High does not scale it down. */
export const PROP_FULL = 2048

export const PROP_LONG_SIDE: Record<TextureQuality, number> = {
  low: 512,
  med: 1024,
  high: PROP_FULL,
}

const FILL: Record<PropArtId, string> = {
  corrugation: '#c5c9ce',
  chainlink: '#b7bec4',
  hatch: '#c42828',
}

export function propArtUrl(id: PropArtId, base = ''): string {
  return `${base}${PROP_DIR}/${PROP_FILES[id]}`
}

/** Drawn size. High returns the file's own edge. */
export function propDrawEdge(fileEdge: number, quality: TextureQuality): number {
  const cap = PROP_LONG_SIDE[quality]
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

function blank(id: PropArtId): HTMLCanvasElement {
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
export function propTexture(id: PropArtId, anisotropy = 8): THREE.Texture | null {
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
    const draw = propDrawEdge(edge, quality)
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
  img.src = propArtUrl(id, base)
  cache.set(key, tex)
  return tex
}

export function disposePropTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}
