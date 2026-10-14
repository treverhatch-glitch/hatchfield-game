/**
 * Concept sheets for the food and shop counters. The JPEG on disk is the
 * full-resolution original. The panel the counter draws is fitted to the
 * signage quality tier (clamped, not tiled, not mirrored).
 */
import * as THREE from 'three'
import { parseTextureQuality, TEXTURE_QUALITY_KEY, type TextureQuality } from '../aircraft/liveryFiles'
import { SIGNAGE_LONG_SIDE } from '../signage/sheets'
import { fittedSize } from '../signage/load'

export const COUNTER_ORIGINALS = {
  burger: 'shop_burger.jpeg',
  coffee: 'shop_coffee.jpeg',
  dutyfree: 'shop_dutyfree.jpeg',
  news: 'shop_news.jpeg',
} as const

export type CounterArtKind = keyof typeof COUNTER_ORIGINALS

const FILL: Record<CounterArtKind, string> = {
  burger: '#d4402c',
  coffee: '#1f6f78',
  dutyfree: '#1a140c',
  news: '#b0201c',
}

const ANISO: Record<TextureQuality, number> = { low: 2, med: 4, high: 8 }

const cache = new Map<string, THREE.Texture>()

export function counterOriginalUrl(kind: CounterArtKind, base = ''): string {
  const prefix = base && !base.endsWith('/') ? `${base}/` : base
  return `${prefix}art/textures/counters/originals/${COUNTER_ORIGINALS[kind]}`
}

function textureQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return 'high'
  }
}

/** Sign panel. Null outside the browser. The original replaces the fill once it loads. */
export function counterSheetTexture(kind: CounterArtKind): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const quality = textureQuality()
  const key = `${kind}|${quality}`
  const hit = cache.get(key)
  if (hit) return hit
  const cap = SIGNAGE_LONG_SIDE[quality]
  const canvas = document.createElement('canvas')
  canvas.width = cap
  canvas.height = Math.max(1, Math.round(cap * 0.66))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = FILL[kind]
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = ANISO[quality]
  tex.needsUpdate = true
  cache.set(key, tex)
  const img = new Image()
  img.onload = () => {
    const size = fittedSize(img.naturalWidth, img.naturalHeight, quality)
    canvas.width = size.w
    canvas.height = size.h
    const g = canvas.getContext('2d')
    if (!g) return
    g.drawImage(img, 0, 0, size.w, size.h)
    tex.needsUpdate = true
  }
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  img.src = counterOriginalUrl(kind, base)
  return tex
}
