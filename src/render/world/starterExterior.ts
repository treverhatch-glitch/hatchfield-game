/**
 * Starter terminal exterior: the outside shell of the prefab hall as the airport
 * view sees it. Seamless full-res plates from scripts/build-starter-terminal-textures.py
 * (public/art/textures/exteriors/starter), PBR roughness / normal detail, studio
 * reflections on glass and metal, and a night interior glow.
 *
 * Visual only. Nothing here moves the footprint, the door or the curb: every piece
 * hangs off positions TerminalBuilding already computes. Texture quality follows the
 * player's own texture setting (High keeps every pixel). Graphics tier never resizes.
 */
import * as THREE from 'three'
import { DEFAULT_TEXTURE_QUALITY, parseTextureQuality, TEXTURE_QUALITY_KEY, type TextureQuality } from '../aircraft/liveryFiles'
import { WORLD_PER_METER } from '../aircraft/specs'
import { attachBuildingMaterial, detachBuildingMaterial } from '../reflections'
import { exteriorDrawEdge } from './exteriorArt'
import { raiseAnisotropy } from './textureRegistry'

export const STARTER_DIR = 'art/textures/exteriors/starter'

export const STARTER_FILES = {
  clad_albedo: 'clad_albedo.jpg',
  clad_normal: 'clad_normal.jpg',
  clad_rough: 'clad_rough.jpg',
  roof_albedo: 'roof_albedo.jpg',
  roof_normal: 'roof_normal.jpg',
  roof_rough: 'roof_rough.jpg',
  concrete_albedo: 'concrete_albedo.jpg',
  concrete_normal: 'concrete_normal.jpg',
  glass_albedo: 'glass_albedo.jpg',
  glass_glow: 'glass_glow.jpg',
  soffit_albedo: 'soffit_albedo.jpg',
  soffit_glow: 'soffit_glow.jpg',
  unit_albedo: 'unit_albedo.jpg',
  unit_normal: 'unit_normal.jpg',
} as const

export type StarterArtId = keyof typeof STARTER_FILES

/** Plate edge in metres (world UVs divide by this). Glass is per pane, not metres. */
export const STARTER_TILE_M = {
  clad: 3,
  roof: 8,
  concrete: 4,
  soffit: 3,
  unit: 2,
} as const

/** Colour plates are sRGB. Normal and roughness plates are data. */
const COLOR: ReadonlySet<StarterArtId> = new Set(['clad_albedo', 'roof_albedo', 'concrete_albedo', 'glass_albedo', 'glass_glow', 'soffit_albedo', 'soffit_glow', 'unit_albedo'])

function readQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return DEFAULT_TEXTURE_QUALITY
  }
}

const cache = new Map<string, THREE.Texture>()

export function starterArtUrl(id: StarterArtId, base = ''): string {
  return `${base}${STARTER_DIR}/${STARTER_FILES[id]}`
}

/** Shared plate, or null in Node. A 2 px stand-in draws until the file lands. */
export function starterTexture(id: StarterArtId, anisotropy = 8): THREE.Texture | null {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  const quality = readQuality()
  const key = `${id}|${quality}`
  const hit = cache.get(key)
  if (hit) {
    raiseAnisotropy(hit, anisotropy)
    return hit
  }
  const tex = new THREE.Texture()
  const blank = document.createElement('canvas')
  blank.width = 2
  blank.height = 2
  const ctx = blank.getContext('2d')
  if (ctx) {
    ctx.fillStyle = id.endsWith('_normal') ? '#8080ff' : id.endsWith('_glow') ? '#000000' : id.endsWith('_rough') ? '#999999' : '#c9ced2'
    ctx.fillRect(0, 0, 2, 2)
  }
  tex.image = blank
  tex.colorSpace = COLOR.has(id) ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.name = `starter:${id}`
  raiseAnisotropy(tex, anisotropy)
  const img = new Image()
  img.onload = () => {
    const edge = Math.max(img.naturalWidth, img.naturalHeight)
    const draw = exteriorDrawEdge(edge, quality)
    if (draw === edge) tex.image = img
    else {
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
  img.src = starterArtUrl(id, base)
  cache.set(key, tex)
  return tex
}

/**
 * Box-projected UVs in metres from baked world positions: tops read x/z, the
 * two wall orientations read along-wall/height. Seamless plates hide the seams.
 */
export function metreUv(geo: THREE.BufferGeometry, tileM: number): THREE.BufferGeometry {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  const k = 1 / (WORLD_PER_METER * tileM)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * k
    const y = pos.getY(i) * k
    const z = pos.getZ(i) * k
    const nx = Math.abs(nor ? nor.getX(i) : 0)
    const ny = Math.abs(nor ? nor.getY(i) : 1)
    const nz = Math.abs(nor ? nor.getZ(i) : 0)
    if (ny >= nx && ny >= nz) {
      uv[i * 2] = x
      uv[i * 2 + 1] = z
    } else if (nx >= nz) {
      uv[i * 2] = z
      uv[i * 2 + 1] = y
    } else {
      uv[i * 2] = x
      uv[i * 2 + 1] = y
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

type Std = THREE.MeshStandardMaterial

/** Every exterior material for one building. Night drives glow and dims reflections. */
export class StarterExteriorMats {
  readonly clad: Std
  readonly frame: Std
  readonly steel: Std
  readonly concrete: Std
  readonly soffit: Std
  readonly deck: Std
  readonly skylight: Std
  readonly unit: Std
  readonly fan: Std
  readonly glass: Std
  readonly door: Std
  readonly halo: THREE.MeshBasicMaterial
  /** Parapet and coping copies: they sit in the roof group, so the cutaway can fade them. */
  readonly cladRoof: Std
  readonly frameRoof: Std
  /** Roof-group materials: the cutaway fades these with the roof. */
  readonly roof: THREE.Material[]
  readonly all: THREE.Material[]
  private envBase = new Map<Std, number>()
  private night = -1

  constructor(anisotropy = 8) {
    const t = (id: StarterArtId) => starterTexture(id, anisotropy)
    const std = (p: THREE.MeshStandardMaterialParameters, name: string, env = 1) => {
      const mat = new THREE.MeshStandardMaterial(p)
      mat.name = `starter:${name}`
      mat.envMapIntensity = env
      this.envBase.set(mat, env)
      attachBuildingMaterial(mat)
      return mat
    }
    const cladMap = t('clad_albedo')
    this.clad = std(
      { color: 0xffffff, map: cladMap, normalMap: t('clad_normal'), roughnessMap: t('clad_rough'), roughness: cladMap ? 1 : 0.4, metalness: 0.35, normalScale: new THREE.Vector2(0.9, 0.9) },
      'clad',
      0.7,
    )
    this.frame = std({ color: 0x39424b, roughness: 0.32, metalness: 0.8 }, 'frame', 0.9)
    this.cladRoof = std({ color: 0xffffff, map: cladMap, normalMap: this.clad.normalMap, roughnessMap: this.clad.roughnessMap, roughness: this.clad.roughness, metalness: 0.35, normalScale: new THREE.Vector2(0.9, 0.9) }, 'clad-roof', 0.7)
    this.frameRoof = std({ color: 0x39424b, roughness: 0.32, metalness: 0.8 }, 'frame-roof', 0.9)
    this.steel = std({ color: 0xd9dee2, roughness: 0.38, metalness: 0.55 }, 'steel', 0.8)
    const conc = t('concrete_albedo')
    this.concrete = std({ color: conc ? 0xffffff : 0xb0ada6, map: conc, normalMap: t('concrete_normal'), roughness: 0.88, metalness: 0 }, 'concrete', 0.25)
    const soff = t('soffit_albedo')
    const soffGlow = t('soffit_glow')
    this.soffit = std(
      { color: soff ? 0xffffff : 0xc6cacd, map: soff, roughness: 0.45, metalness: 0.5, emissive: soffGlow ? 0xffffff : 0xffe2b0, emissiveMap: soffGlow, emissiveIntensity: 0.05 },
      'soffit',
      0.6,
    )
    const roof = t('roof_albedo')
    this.deck = std({ color: roof ? 0xffffff : 0xb9bec2, map: roof, normalMap: t('roof_normal'), roughnessMap: t('roof_rough'), roughness: roof ? 1 : 0.8, metalness: 0 }, 'deck', 0.3)
    this.skylight = std({ color: 0x86a6bb, roughness: 0.1, metalness: 0.2, emissive: 0xffd9a0, emissiveIntensity: 0 }, 'skylight', 1.4)
    const unit = t('unit_albedo')
    this.unit = std({ color: unit ? 0xffffff : 0xa8afb5, map: unit, normalMap: t('unit_normal'), roughness: 0.5, metalness: 0.15 }, 'unit', 0.6)
    this.fan = std({ color: 0x2a2f35, roughness: 0.5, metalness: 0.6 }, 'fan', 0.5)
    const glass = t('glass_albedo')
    const glow = t('glass_glow')
    // Node keeps the warm flat glow the day/night tests read; the browser paints the hall plate.
    this.glass = std(
      { color: 0xffffff, map: glass, roughness: 0.07, metalness: glass ? 0.35 : 0.4, emissive: glow ? 0xffffff : 0xffc070, emissiveMap: glow, emissiveIntensity: 0 },
      'glass',
      1.35,
    )
    this.door = std({ color: 0x24323c, roughness: 0.04, metalness: 0.65, emissive: 0xffd6a0, emissiveIntensity: 0 }, 'door', 1.3)
    this.halo = new THREE.MeshBasicMaterial({ color: 0xbfe4ff })
    this.halo.name = 'starter:halo'
    this.roof = [this.deck, this.skylight, this.unit, this.fan, this.cladRoof, this.frameRoof]
    this.all = [this.clad, this.frame, this.cladRoof, this.frameRoof, this.steel, this.concrete, this.soffit, this.deck, this.skylight, this.unit, this.fan, this.glass, this.door, this.halo]
    this.setNight(0)
  }

  /** 0 day .. 1 night. Interior and soffit lights come up; studio reflections dim. */
  setNight(night: number) {
    const n = Math.max(0, Math.min(1, night))
    if (Math.abs(n - this.night) < 1e-3) return
    this.night = n
    this.glass.emissiveIntensity = this.glass.emissiveMap ? n * 1.25 : n * 1.15
    this.door.emissiveIntensity = n * 0.55
    this.skylight.emissiveIntensity = n * 1.15
    this.soffit.emissiveIntensity = this.soffit.emissiveMap ? 0.05 + n * 2.4 : n * 0.6
    const halo = 0.55 + n * 0.45
    this.halo.color.setRGB(0.75 * halo, 0.89 * halo, 1.0 * halo)
    const env = 1 - n * 0.82
    for (const [mat, base] of this.envBase) mat.envMapIntensity = base * env
  }

  dispose() {
    for (const mat of this.all) {
      if ((mat as Std).isMeshStandardMaterial) detachBuildingMaterial(mat as Std)
      mat.dispose()
    }
  }
}

/** Backlit fascia name panel: navy face, white caps, a thin light rule. Null in Node. */
export function nameSignTexture(text: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 1536
  canvas.height = 172
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
  g.addColorStop(0, '#1d3d5a')
  g.addColorStop(1, '#10263a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#7fc4ff'
  ctx.fillRect(0, canvas.height - 10, canvas.width, 4)
  ctx.fillStyle = '#f4f7fa'
  ctx.font = '700 104px "Inter", "Helvetica Neue", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = '18px'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 4)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Unit cylinder, base at y = 0 (posts and fan shrouds). */
export function unitPost(sides = 16): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, sides)
  g.translate(0, 0.5, 0)
  return g
}
