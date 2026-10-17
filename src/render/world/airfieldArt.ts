import * as THREE from 'three'
import { raiseAnisotropy } from './textureRegistry'

/**
 * 2048px seamless airfield surfaces (albedo + normal). Clear-weather paving only.
 * runway / apron: the authored plates (JPEG), unchanged.
 * asphalt (taxiways): Poly Haven asphalt_02 (CC0). road (service roads, retired belt cells):
 * Poly Haven worn_asphalt (CC0, colour 0.25 / brightness 1.1). Albedo as WebP q95 (>43 dB PSNR,
 * visually lossless); normals are the original Poly Haven JPEG bytes (WebP's 4:2:0 chroma would
 * smear the normal channels). Concrete grain for runway/apron/stands: ambientCG Concrete047A (CC0)
 * luminance high-pass, lossless WebP, multiplied over the authored slab plates (joints kept).
 * See THIRD_PARTY_NOTICES.md.
 */
export type AirfieldSurface = 'asphalt' | 'runway' | 'apron' | 'road'

/** Albedo file type per surface. Normals are always JPEG. */
export const AIRFIELD_EXT: Record<AirfieldSurface, 'jpg' | 'webp'> = { runway: 'jpg', apron: 'jpg', asphalt: 'webp', road: 'webp' }

/**
 * Metres one plate repeat covers. runway/apron keep their authored scale (one repeat per
 * surface UV unit). CC0 plates are tuned for the tycoon camera: true 2-4 m scale averages to flat colour.
 */
export const AIRFIELD_TILE_M: Record<AirfieldSurface, number> = { runway: 10 / 0.45, apron: 6.2 / 0.45, asphalt: 12, road: 12 }

/** Rotated-sample anti-tiling. Off for slab-jointed plates, where a rotated copy would cross the joints. */
export const AIRFIELD_ANTI_TILE: Record<AirfieldSurface, number> = { runway: 0, apron: 0, asphalt: 1, road: 1 }

export const AIRFIELD_DIR = 'art/textures/airfield'

export function airfieldArtUrl(id: AirfieldSurface, map: 'albedo' | 'normal', base = ''): string {
  const prefix = base && !base.endsWith('/') ? `${base}/` : base
  return `${prefix}${AIRFIELD_DIR}/${id}_${map}.${map === 'albedo' ? AIRFIELD_EXT[id] : 'jpg'}`
}

function baseUrl(): string {
  return (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
}

const cache = new Map<string, THREE.Texture>()

function load(id: AirfieldSurface, map: 'albedo' | 'normal', anisotropy: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const key = `${id}:${map}`
  let tex = cache.get(key)
  if (!tex) {
    tex = new THREE.TextureLoader().load(airfieldArtUrl(id, map, baseUrl()))
    tex.colorSpace = map === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    cache.set(key, tex)
  }
  raiseAnisotropy(tex, anisotropy)
  return tex
}

export function airfieldTextures(id: AirfieldSurface, anisotropy = 16): { map: THREE.Texture; normalMap: THREE.Texture | null } | null {
  const map = load(id, 'albedo', anisotropy)
  if (!map) return null
  return { map, normalMap: load(id, 'normal', anisotropy) }
}

/** Metres one concrete grain repeat covers (Concrete047A is a ~2.5 m sample). */
export const CONCRETE_DETAIL_M = 3

/** Strength of the concrete grain over the slab plates (0 = off). */
export const CONCRETE_DETAIL_AMT = 0.55

export function concreteDetailUrl(base = ''): string {
  const prefix = base && !base.endsWith('/') ? `${base}/` : base
  return `${prefix}${AIRFIELD_DIR}/concrete_detail.webp`
}

/** High-pass concrete grain (centred on mid grey), multiplied over runway/apron albedo. */
export function concreteDetailTexture(anisotropy = 16): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  let tex = cache.get('concrete:detail')
  if (!tex) {
    tex = new THREE.TextureLoader().load(concreteDetailUrl(baseUrl()))
    tex.colorSpace = THREE.NoColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    cache.set('concrete:detail', tex)
  }
  raiseAnisotropy(tex, anisotropy)
  return tex
}

export function disposeAirfieldTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}
