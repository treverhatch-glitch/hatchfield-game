/**
 * Sign and screen panels. Each crop is its own texture: clamped, not tiled,
 * drawn left to right. Node tests have no canvas, so callers keep their
 * flat-colour fallback.
 */
import * as THREE from 'three'
import { parseTextureQuality, TEXTURE_QUALITY_KEY, type TextureQuality } from '../aircraft/liveryFiles'
import {
  DEDICATED_WAYFINDING,
  DESK_HEADER_CROPS,
  DESK_HEADER_SHEET,
  FIDS_CROP,
  FIDS_SHEET,
  fullBleed,
  SIGNAGE_DIR,
  SIGNAGE_LONG_SIDE,
  WAYFINDING_CROPS,
  WAYFINDING_SHEET,
  type SignCrop,
  type SignSheet,
  type WayfindingPanel,
} from './sheets'

const cache = new Map<string, THREE.Texture>()
const images = new Map<string, Promise<HTMLImageElement>>()

function textureQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return 'high'
  }
}

export function signageUrl(file: string, base = ''): string {
  return `${base}${SIGNAGE_DIR}/${file}`
}

export function fittedSize(width: number, height: number, quality: TextureQuality): { w: number; h: number } {
  const cap = SIGNAGE_LONG_SIDE[quality]
  const scale = Math.min(1, cap / Math.max(width, height))
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  }
}

function loadImage(file: string): Promise<HTMLImageElement> {
  const hit = images.get(file)
  if (hit) return hit
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(file))
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    img.src = signageUrl(file, base)
  })
  images.set(file, pending)
  return pending
}

/** One clamped panel. The canvas is filled immediately; the JPEG replaces it. */
export function signageTexture(sheet: SignSheet, crop: SignCrop): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const quality = textureQuality()
  const key = `${sheet.file}|${crop.x},${crop.y},${crop.w},${crop.h}|${quality}`
  const hit = cache.get(key)
  if (hit) return hit
  const size = fittedSize(crop.w, crop.h, quality)
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = sheet.fill
    ctx.fillRect(0, 0, size.w, size.h)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  tex.needsUpdate = true
  cache.set(key, tex)
  void loadImage(sheet.file).then((img) => {
    const g = canvas.getContext('2d')
    if (!g) return
    g.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, size.w, size.h)
    tex.needsUpdate = true
  })
  return tex
}

/** Desk lightbox 1–6. */
export function deskHeaderTexture(n: number): THREE.Texture | null {
  const crop = DESK_HEADER_CROPS[n - 1]
  if (!crop) return null
  return signageTexture(DESK_HEADER_SHEET, crop)
}

/** Dedicated Batch 11 banner when one exists; otherwise the old sheet crop. */
export function wayfindingSource(panel: WayfindingPanel): { sheet: SignSheet; crop: SignCrop } {
  const dedicated = DEDICATED_WAYFINDING[panel]
  if (dedicated) return { sheet: dedicated, crop: fullBleed(dedicated) }
  return { sheet: WAYFINDING_SHEET, crop: WAYFINDING_CROPS[panel] }
}

export function wayfindingSheetTexture(panel: WayfindingPanel): THREE.Texture | null {
  const source = wayfindingSource(panel)
  return signageTexture(source.sheet, source.crop)
}

export function fidsBoardTexture(): THREE.Texture | null {
  return signageTexture(FIDS_SHEET, FIDS_CROP)
}

/** A flat panel that faces the camera. FrontSide so the words are not mirrored. */
export function signPanelMaterial(map: THREE.Texture | null, fallback: number): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: map ? 0xffffff : fallback,
    map,
    side: THREE.FrontSide,
    toneMapped: false,
  })
  if (map) {
    map.wrapS = THREE.ClampToEdgeWrapping
    map.wrapT = THREE.ClampToEdgeWrapping
  }
  return mat
}
