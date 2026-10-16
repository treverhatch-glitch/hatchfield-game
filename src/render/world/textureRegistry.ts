/**
 * One registry for the Gemini photo textures in public/art/textures/buildings.
 * sRGB, repeat wrapping, mipmaps, anisotropy by quality tier, one texture per id shared
 * across every mesh. Low tier and Node (tests) get null so callers keep flat colours.
 */
import * as THREE from 'three'
import type { QualityLevel } from './quality'

export const ART_TEXTURE_IDS = [
  'hangar_cladding',
  'warehouse_panels',
  'terminal_glass',
  'dock_floor',
  'tank_steel',
  'roof_membrane',
  'gravel_yard',
  'terrazzo_floor',
  'chevron_stripe',
  'apron_concrete',
  'asphalt_road',
  'airport_grass',
  'gse_yellow_paint',
  'truck_white_panel',
  'conveyor_belt',
  'diamond_plate',
] as const

export type ArtTextureId = (typeof ART_TEXTURE_IDS)[number]

export const ART_TEXTURE_DIR = 'art/textures/buildings'

/** Photo plates stay on at every graphics tier. */
export function photoTexturesEnabled(_level: QualityLevel): boolean {
  return true
}

export function artTextureUrl(id: ArtTextureId, base = ''): string {
  return `${base}${ART_TEXTURE_DIR}/${id}.jpg`
}

const cache = new Map<ArtTextureId, THREE.Texture>()
let loader: THREE.TextureLoader | null = null

/** Shared photo texture, or null when there is no DOM (Node/vitest). Never dispose it per mesh. */
export function artTexture(id: ArtTextureId, anisotropy = 4): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  let tex = cache.get(id)
  if (!tex) {
    loader ??= new THREE.TextureLoader()
    tex = loader.load(artTextureUrl(id, import.meta.env?.BASE_URL ?? '/'))
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    cache.set(id, tex)
  }
  raiseAnisotropy(tex, anisotropy)
  return tex
}

/** Full-res repeat plates. A later anisotropy bump has to re-upload or the GPU keeps the first value. */
export function raiseAnisotropy(tex: THREE.Texture, anisotropy: number): void {
  const next = Math.max(tex.anisotropy || 1, anisotropy)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  if (tex.anisotropy === next && tex.userData.anisoStamped === next) return
  tex.anisotropy = next
  tex.userData.anisoStamped = next
  tex.needsUpdate = true
}

export function disposeArtTextures() {
  for (const t of cache.values()) t.dispose()
  cache.clear()
}

/** Ground surfaces and the photo each one swaps in for the procedural raster. */
export const GROUND_PHOTO = {
  grass: 'airport_grass',
  asphalt: 'asphalt_road',
  runway: 'asphalt_road',
  road: 'asphalt_road',
  concrete: 'apron_concrete',
  terrazzo: 'terrazzo_floor',
  roof: 'roof_membrane',
} as const satisfies Record<string, ArtTextureId>
