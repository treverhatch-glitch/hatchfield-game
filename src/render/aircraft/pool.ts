import * as THREE from 'three'
import { AIRCRAFT_LOOK } from '../look'
import { quantizeWear, wearLook } from './airframeWear'
import { DETAIL_ROUGH_CLEAN, surfaceDetailMaps } from './surfaceDetail'
import { bindLiveryUniforms, disposeLiveryTextures, hookLiveryMaterial, resolveLiveryAirline } from './liveryTex'
import type { Livery } from './specs'

const geos = new Map<string, THREE.BufferGeometry>()
const mats = new Map<string, THREE.Material>()

export function sharedGeo(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = geos.get(key)
  if (!geo) {
    geo = build()
    geo.name = key
    geos.set(key, geo)
  }
  return geo
}

let envMap: THREE.Texture | null = null
let envScale = 1

function applyEnv(mat: THREE.Material) {
  const m = mat as THREE.MeshStandardMaterial
  if (!m.isMeshStandardMaterial) return
  if (m.userData.envBase === undefined) m.userData.envBase = m.envMapIntensity ?? 1
  m.envMap = envMap
  m.envMapIntensity = (m.userData.envBase as number) * envScale
  m.needsUpdate = true
}

/** Reflection probe for every aircraft material (see env.ts). */
export function setAircraftEnvMap(tex: THREE.Texture | null) {
  envMap = tex
  for (const mat of mats.values()) applyEnv(mat)
}

/** Dim reflections with the daylight so jets do not glow at night (0..1). */
export function setAircraftEnvIntensity(k: number) {
  const next = Math.max(0.04, Math.min(1, k))
  if (Math.abs(next - envScale) < 0.01) return
  envScale = next
  for (const mat of mats.values()) {
    const m = mat as THREE.MeshStandardMaterial
    if (m.isMeshStandardMaterial && m.userData.envBase !== undefined) m.envMapIntensity = (m.userData.envBase as number) * envScale
  }
}

export function sharedMat(key: string, build: () => THREE.Material): THREE.Material {
  let mat = mats.get(key)
  if (!mat) {
    mat = build()
    mat.name = key
    mats.set(key, mat)
    if (envMap) applyEnv(mat)
  }
  return mat
}

export function unitBox(): THREE.BufferGeometry {
  return sharedGeo('box', () => new THREE.BoxGeometry(1, 1, 1))
}

export function unitCylinder(sides: number): THREE.BufferGeometry {
  return sharedGeo(`cyl:${sides}`, () => new THREE.CylinderGeometry(1, 1, 1, sides))
}

export function unitSphere(): THREE.BufferGeometry {
  return sharedGeo('sphere', () => new THREE.SphereGeometry(1, 6, 5))
}

export function unitPlane(): THREE.BufferGeometry {
  return sharedGeo('plane', () => new THREE.PlaneGeometry(1, 1))
}

/** Prop disc lies in YZ so it can spin on local X. Rotor disc lies in XZ. */
export function unitDisc(kind: 'prop' | 'rotor' | 'prop-blur'): THREE.BufferGeometry {
  return sharedGeo(`disc:${kind}`, () => {
    const geo = new THREE.CircleGeometry(1, kind === 'rotor' ? 10 : kind === 'prop-blur' ? 40 : 7)
    if (kind !== 'rotor') geo.rotateY(Math.PI / 2)
    else geo.rotateX(-Math.PI / 2)
    return geo
  })
}

export type PaintSlot =
  | 'body'
  | 'wing'
  | 'stripe'
  | 'tail'
  | 'belly'
  | 'metal'
  | 'dark'
  | 'fan'
  | 'duct'
  | 'chrome'
  | 'lip'
  | 'glass'
  | 'rubber'
  | 'navRed'
  | 'navGreen'
  | 'navWhite'
  | 'beacon'

/** Cache key for everything a livery paints: body, cheatline, fin and scheme. */
export function liveryKey(livery: Livery): string {
  return `${livery.body}|${livery.stripe}|${livery.tail ?? ''}|${livery.scheme ?? 'twotone'}|${livery.airline ?? ''}|${livery.wing ?? ''}|${livery.crown ?? ''}`
}

function shade(hex: string, factor: number): string {
  const color = new THREE.Color(hex)
  color.multiplyScalar(factor)
  return `#${color.getHexString()}`
}

/**
 * Real wings are painted grey or white. Keep a livery's wing colour only when it is
 * already a neutral (grey, white, silver, dark grey); a saturated brand colour gets the default grey.
 */
export function neutralWing(hex: string): string {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(hex).getHSL(hsl)
  return hsl.s > 0.18 ? AIRCRAFT_LOOK.wing : hex
}

export function slotColor(slot: PaintSlot, livery: Livery): string {
  switch (slot) {
    case 'body':
      return livery.body
    case 'wing':
      // Solid schemes (military, medevac, freighters) paint the wing with the body.
      return livery.scheme === 'solid' ? livery.wing ?? livery.body : neutralWing(livery.wing ?? AIRCRAFT_LOOK.wing)
    case 'stripe':
      return livery.stripe
    case 'tail':
      return livery.tail || livery.stripe
    case 'belly':
      return shade(livery.body, 0.58)
    case 'metal':
      return AIRCRAFT_LOOK.metal
    case 'dark':
      return '#14181d'
    case 'fan':
      // Titanium fan blades: light enough that the intake reads as a fan, not a black hole.
      return '#9ea4ac'
    case 'duct':
      return '#3f454d'
    case 'chrome':
      return '#d9dde2'
    case 'lip':
      return '#c8cdd3'
    case 'glass':
      // Dark smoked glazing: deep blue-grey so the sky probe reads as a glint, not a black hole.
      return '#1c2b3a'
    case 'rubber':
      return '#1a1c1e'
    case 'navRed':
      return '#ff2a2a'
    case 'navGreen':
      return '#39f07a'
    case 'navWhite':
      return '#f5f8ff'
    case 'beacon':
      return '#ff4036'
    default:
      return '#888888'
  }
}

/** [metalness, roughness]: gloss paint, bare alloy, rubber, glazing. */
const SLOT_PBR: Partial<Record<PaintSlot, [number, number]>> = {
  body: [0.08, 0.34],
  stripe: [0.08, 0.34],
  tail: [0.08, 0.34],
  belly: [0.1, 0.45],
  wing: [0.25, 0.5],
  metal: [0.45, 0.38],
  dark: [0.4, 0.55],
  fan: [0.85, 0.32],
  duct: [0.55, 0.5],
  chrome: [0.95, 0.16],
  lip: [0.8, 0.24],
  glass: [0.55, 0.06],
  rubber: [0, 0.92],
}

/** Painted skin slots that get the clear-coat sheen. */
const CLEARCOAT_SLOTS = new Set<PaintSlot>(['body', 'stripe', 'tail', 'glass'])

/** Gloss airline paint: PBR base plus a thin clear coat that catches the sun and sky probe. */
export function clearcoatPaint(params: THREE.MeshPhysicalMaterialParameters): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    clearcoat: AIRCRAFT_LOOK.clearcoat.amount,
    clearcoatRoughness: AIRCRAFT_LOOK.clearcoat.roughness,
    ...params,
  })
}

function isLamp(slot: PaintSlot): boolean {
  return slot === 'beacon' || slot.startsWith('nav')
}

export interface PaintedMesh extends THREE.Mesh {
  userData: THREE.Mesh['userData'] & {
    opaqueMat: THREE.Material
    fadeMat: THREE.Material
    lodOpacity: number
    kind: string
    tier: string
  }
}

/**
 * Far shells stay unlit. The mid shell is one standard material (paint or bare metal).
 * Gear, lamps, and control surfaces stay Lambert so the close view does not compile a shader per part.
 * A bump map for panel lines cost about 3 FPS on SwiftShader, so the shell stays smooth.
 */
/**
 * Landing gear: physical material whose roughness and metalness come per vertex from a
 * `pbr` attribute, so chrome pistons, rubber, painted struts and brakes share one draw.
 * No livery hook: gear is never in airline paint.
 */
function pbrHook(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 pbr;\nvarying vec2 vPbr;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = pbr;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPbr;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vPbr.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vPbr.y;')
  }
  mat.customProgramCacheKey = () => 'aircraft-gear-pbr'
  return mat
}

export function gearMaterials(tier: 'low' | 'mid'): { opaque: THREE.Material; fade: THREE.Material } {
  if (tier === 'low') return vertexMaterials('low', 'metal')
  const opaque = sharedMat('vc:gear', () => pbrHook(new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 1.2 })))
  const fade = sharedMat('fade:vc:gear', () => {
    const m = pbrHook(new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 1.2 }))
    m.transparent = true
    return m
  })
  return { opaque, fade }
}

/**
 * Baked-shell materials. Livery plates are bound as uniforms in onBeforeRender, and
 * three only re-uploads material uniforms when the material changes between draws, so
 * two airlines sharing one material could draw each other's plates (or a blank engine
 * plate). Each airline therefore gets its own material; the program stays shared.
 */
export function vertexMaterials(
  tier: 'low' | 'mid',
  finish: 'paint' | 'metal' = 'paint',
  airline?: string,
  wearIn = 0,
  /** 'door': instanced door leaves that shift the fuselage plate UV per instance. */
  variant: '' | 'door' = '',
): { opaque: THREE.Material; fade: THREE.Material } {
  const unlit = tier === 'low'
  const metal = !unlit && finish === 'metal'
  const wear = quantizeWear(wearIn)
  const base = unlit ? 'vc:basic' : metal ? 'vc:metal' : 'vc:standard'
  const key = `${airline ? `${base}@${airline}` : base}${unlit ? '' : `#w${wear.toFixed(1)}`}${variant ? `:${variant}` : ''}`
  const make = () => {
    const m = makeBase()
    if (variant === 'door') m.defines = { ...(m.defines ?? {}), LIVERY_SHIFT: 1 }
    return m
  }
  const makeBase = () => {
    if (unlit) return new THREE.MeshBasicMaterial({ vertexColors: true })
    const look = wearLook(wear)
    const detail = surfaceDetailMaps()
    // Fake skin detail (panel joints, rivet rows, hatch seams, grime) from shared maps; no geometry.
    const skin = {
      vertexColors: true,
      normalMap: detail.normal,
      normalScale: new THREE.Vector2(look.normalScale, look.normalScale),
      roughnessMap: detail.roughness,
    }
    if (metal) {
      // Bare cowls and plugs: soot builds faster than on paint.
      return new THREE.MeshStandardMaterial({
        ...skin,
        metalness: 0.45,
        roughness: (0.38 + look.roughnessAdd * 0.6) / DETAIL_ROUGH_CLEAN,
      })
    }
    return clearcoatPaint({
      ...skin,
      metalness: AIRCRAFT_LOOK.paint.metalness,
      roughness: (AIRCRAFT_LOOK.paint.roughness + look.roughnessAdd) / DETAIL_ROUGH_CLEAN,
      clearcoat: look.clearcoat,
      clearcoatRoughness: look.clearcoatRoughness,
    })
  }
  const mat = sharedMat(key, make)
  mat.userData.airframeWear = unlit ? 0 : wear
  if (!mat.userData.liveryHook) {
    hookLiveryMaterial(mat)
    mat.userData.liveryHook = true
  }
  const fade = sharedMat(`fade:${key}`, () => {
    // Built fresh, not cloned: a clone would copy the livery flags but not the shader hook.
    const copy = make()
    copy.transparent = true
    copy.opacity = 1
    copy.depthWrite = true
    copy.userData.airframeWear = unlit ? 0 : wear
    return copy
  })
  if (!fade.userData.liveryHook) {
    hookLiveryMaterial(fade)
    fade.userData.liveryHook = true
  }
  return { opaque: mat, fade }
}

export function paintMesh(
  mesh: THREE.Mesh,
  slot: PaintSlot,
  livery: Livery,
  kind: string,
  tier: string,
): PaintedMesh {
  const color = slotColor(slot, livery)
  const unlit = tier === 'low' || isLamp(slot)
  const key = `${unlit ? 'basic' : 'pbr'}:${slot}:${color}`
  const mat = sharedMat(key, () => {
    if (unlit) return new THREE.MeshBasicMaterial({ color })
    const [metalness, roughness] = SLOT_PBR[slot] ?? [0.08, 0.4]
    if (CLEARCOAT_SLOTS.has(slot)) return clearcoatPaint({ color, metalness, roughness })
    return new THREE.MeshStandardMaterial({ color, metalness, roughness })
  })
  mesh.userData.paint = color
  mesh.userData.slot = slot
  if (isLamp(slot)) mesh.frustumCulled = true
  const fade = sharedMat(`fade:${key}`, () => {
    const copy = mat.clone()
    copy.transparent = true
    copy.opacity = 1
    copy.depthWrite = true
    return copy
  }) as THREE.Material & { opacity: number }
  mesh.material = mat
  mesh.userData.opaqueMat = mat
  mesh.userData.fadeMat = fade
  mesh.userData.lodOpacity = 1
  mesh.userData.kind = kind
  mesh.userData.tier = tier
  mesh.onBeforeRender = () => {
    if (mesh.material === fade) fade.opacity = mesh.userData.lodOpacity as number
  }
  return mesh as PaintedMesh
}

/** One shared material for a baked shell. Colors live on the geometry. */
export function paintVertexMesh(
  mesh: THREE.Mesh,
  tier: 'low' | 'mid',
  kind: string,
  finish: 'paint' | 'metal' | 'gear' = 'paint',
  airline?: string,
  wear = 0,
  variant: '' | 'door' = '',
): PaintedMesh {
  const { opaque, fade } = finish === 'gear' ? gearMaterials(tier) : vertexMaterials(tier, finish, airline, wear, variant)
  const fadeMat = fade as THREE.Material & { opacity: number }
  mesh.material = opaque
  mesh.userData.opaqueMat = opaque
  mesh.userData.fadeMat = fadeMat
  mesh.userData.lodOpacity = 1
  mesh.userData.kind = kind
  mesh.userData.tier = tier
  mesh.onBeforeRender = () => {
    const current = mesh.material as THREE.Material
    bindLiveryUniforms(current, resolveLiveryAirline(mesh.userData.airline as string | undefined))
    if (current === fadeMat) fadeMat.opacity = mesh.userData.lodOpacity as number
  }
  return mesh as PaintedMesh
}

export function libraryStats(): { geometries: number; materials: number } {
  return { geometries: geos.size, materials: mats.size }
}

/** Drop pooled GPU buffers. Safe after every aircraft has been released. */
export function disposeAircraftLibrary() {
  for (const geo of geos.values()) geo.dispose()
  geos.clear()
  for (const mat of mats.values()) mat.dispose()
  mats.clear()
  disposeLiveryTextures()
}

/**
 * Detach an aircraft without disposing shared geometries or materials.
 * Instanced meshes still release their own instance buffers, and meshes
 * marked `ownGeo` free the geometry that was merged for this airframe only.
 */
export function releaseAircraft(root: THREE.Object3D) {
  root.traverse((obj) => {
    obj.onBeforeRender = () => {}
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      ;(obj as THREE.InstancedMesh).dispose()
    } else if (obj.userData.ownGeo && (obj as THREE.Mesh).isMesh) {
      ;(obj as THREE.Mesh).geometry.dispose()
    }
  })
  root.removeFromParent()
}
