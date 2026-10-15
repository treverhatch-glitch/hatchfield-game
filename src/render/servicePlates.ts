/**
 * Full-resolution service-point concept plates.
 * Decode goes straight to the GPU. There is no canvas downscale.
 */
import * as THREE from 'three'
import { SERVICE_PLATES, SERVICE_PLATE_NATIVE, type ServicePlateId } from '../assets/manifest'

const cache = new Map<ServicePlateId, THREE.Texture>()

function plateUrl(id: ServicePlateId): string {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${SERVICE_PLATES[id].replace(/^\//, '')}`
}

/**
 * Shared plate at the file's own resolution, or null in Node.
 * Do not dispose it per mesh.
 */
export function servicePlateTexture(id: ServicePlateId, anisotropy = 8): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const hit = cache.get(id)
  if (hit) {
    hit.anisotropy = Math.max(hit.anisotropy, anisotropy)
    return hit
  }
  const tex = new THREE.TextureLoader().load(plateUrl(id))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = anisotropy
  tex.userData.servicePlate = id
  tex.userData.native = SERVICE_PLATE_NATIVE
  cache.set(id, tex)
  return tex
}
