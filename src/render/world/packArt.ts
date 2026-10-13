/**
 * SVG asset pack (textures, signs, shop logos, tail decals, thought bubbles).
 * Loaded only when a preset asks for it. The auto low preset never calls in.
 */
import * as THREE from 'three'
import {
  LIVERIES,
  SHOP_LOGOS,
  SIGN_ICONS,
  TEXTURES,
  THOUGHT_BUBBLES,
  loadAssetCanvas,
} from '../../assets/manifest'

const textures = new Map<string, THREE.Texture>()
const images = new Map<string, HTMLImageElement>()
let enabled = false
let started = false
const ready = new Set<() => void>()

export function setPackArt(on: boolean) {
  enabled = on
  if (on) void ensurePack()
}

export function packArtEnabled(): boolean {
  return enabled
}

export function onPackReady(fn: () => void): () => void {
  ready.add(fn)
  if (textures.size) fn()
  return () => ready.delete(fn)
}

export function packTexture(name: string): THREE.Texture | null {
  if (!enabled) return null
  return textures.get(name) ?? null
}

export function packImage(path: string): HTMLImageElement | null {
  const img = images.get(path)
  return img && img.complete && img.naturalWidth > 0 ? img : null
}

/** Stable tail decal for an airline body colour. Null until the pack has decoded. */
export function tailForBody(color: string): THREE.Texture | null {
  if (!enabled || textures.size === 0) return null
  const list = Object.keys(LIVERIES)
    .map((id) => textures.get(`tail:${id}`))
    .filter((t): t is THREE.Texture => Boolean(t))
  if (!list.length) return null
  let h = 0
  for (let i = 0; i < color.length; i++) h = (h * 33 + color.charCodeAt(i)) >>> 0
  return list[h % list.length] ?? null
}

export function signIconPaths(): Record<string, string> {
  return SIGN_ICONS
}

export function shopLogoPaths(): string[] {
  return Object.values(SHOP_LOGOS)
}

async function ensurePack() {
  if (started || typeof document === 'undefined') return
  started = true
  const jobs: Promise<void>[] = []
  for (const [name, tex] of Object.entries(TEXTURES)) {
    jobs.push(loadTexture(name, tex.albedo, tex.size, true))
  }
  for (const [id, livery] of Object.entries(LIVERIES)) {
    jobs.push(loadTexture(`tail:${id}`, livery.tailDecal, 256, false))
  }
  for (const path of [...Object.values(SIGN_ICONS), ...Object.values(SHOP_LOGOS), ...Object.values(THOUGHT_BUBBLES)]) {
    jobs.push(loadImage(path))
  }
  await Promise.all(jobs)
  if (!enabled) return
  for (const fn of ready) fn()
}

async function loadTexture(name: string, path: string, size: number, repeat: boolean) {
  try {
    const canvas = await loadAssetCanvas(path, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    if (repeat) {
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
    }
    tex.needsUpdate = true
    textures.set(name, tex)
  } catch {
    /* keep the procedural map */
  }
}

function loadImage(path: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      images.set(path, img)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = path
  })
}
