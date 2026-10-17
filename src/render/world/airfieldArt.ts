import * as THREE from 'three'
import { raiseAnisotropy } from './textureRegistry'

/** Authored 2048px seamless airfield surfaces (albedo + normal). Clear-weather paving only. */
export type AirfieldSurface = 'asphalt' | 'runway' | 'apron'

export const AIRFIELD_DIR = 'art/textures/airfield'

export function airfieldArtUrl(id: AirfieldSurface, map: 'albedo' | 'normal', base = ''): string {
  const prefix = base && !base.endsWith('/') ? `${base}/` : base
  return `${prefix}${AIRFIELD_DIR}/${id}_${map}.jpg`
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

export function disposeAirfieldTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}
