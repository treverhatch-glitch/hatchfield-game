/**
 * Full-resolution PBR wall and roof plates for the photo-skinned and brick
 * buildings (public/art/textures/skins): albedo (sRGB), normal (OpenGL) and
 * roughness, all seamless, built from ambientCG CC0 sources (CREDITS.md).
 *
 * The plates are mapped in the shader, not by the mesh UVs: every fragment
 * box-projects its object-space position (in metres) onto the face's dominant
 * axis, so each plate repeats at its real size on any box, bevel, vault or
 * scaled group, and wide walls never stretch. Sampling uses analytic gradients
 * (textureGrad), so the projection seam on a bevel does not pick a wrong mip,
 * and the tangent frame comes from the same gradients. A low-frequency tone
 * drift plus (on plates that allow it) a pattern-aligned second sample break up
 * the repeat. Lighting, shadow casting/receiving and the depth pass are untouched:
 * only map, normal-map and roughness-map sampling are swapped.
 *
 * High keeps every pixel; Med/Low (`hatchfield-texture-quality`) are the only downscale.
 */
import * as THREE from 'three'
import { DEFAULT_TEXTURE_QUALITY, parseTextureQuality, TEXTURE_QUALITY_KEY, type TextureQuality } from '../aircraft/liveryFiles'
import { WORLD_PER_METER } from '../aircraft/specs'
import { exteriorDrawEdge } from './exteriorArt'
import { raiseAnisotropy } from './textureRegistry'

export const SKIN_DIR = 'art/textures/skins'

export type SkinPlateId = 'brick' | 'cladding' | 'panel' | 'block' | 'membrane'
export type SkinMapKind = 'albedo' | 'normal' | 'rough'

export interface SkinPlate {
  /** Real-world metres one plate repeat covers, [across, up]. */
  tileM: readonly [number, number]
  /** Normal-map strength. */
  normalScale: number
  /** Second-sample offset in plate repeats; chosen so joints and ribs stay aligned. Zero = no blend. */
  shift: readonly [number, number]
  /** Low-frequency tone drift amplitude (0 = off). */
  macro: number
  /** Mean luminance of the albedo plate (tone match against the plate it replaces). */
  albedoLum: number
}

/** Mean of every roughness plate; material roughness is divided by it so the average stays on target. */
export const SKIN_ROUGH_MEAN = 0.85

export const SKIN_PLATES: Record<SkinPlateId, SkinPlate> = {
  // ambientCG Bricks105: 16 courses of 75 mm, ~225 mm bricks. Random bond, so no second sample.
  brick: { tileM: [2.4, 1.2], normalScale: 1.0, shift: [0, 0], macro: 0.09, albedoLum: 0.7 },
  // ambientCG CorrugatedSteel007A: trapezoidal sheet, 4 ribs (333 mm pitch) per plate.
  cladding: { tileM: [1.33, 1.33], normalScale: 1.1, shift: [0.5, 0.37], macro: 0.07, albedoLum: 0.74 },
  // Precast / insulated panel: joints every 1.0 m, one vertical joint per 3 m.
  panel: { tileM: [3, 3], normalScale: 1.0, shift: [0, 1 / 3], macro: 0.05, albedoLum: 0.68 },
  // Concrete masonry units: 400 x 200 mm, running bond.
  block: { tileM: [2.4, 2.4], normalScale: 1.0, shift: [0, 0], macro: 0.07, albedoLum: 0.62 },
  // Roof membrane: lapped seams every 1.0 m.
  membrane: { tileM: [4, 4], normalScale: 0.8, shift: [0.5, 0.41], macro: 0.08, albedoLum: 0.5 },
}

export const SKIN_PLATE_IDS = Object.keys(SKIN_PLATES) as SkinPlateId[]

export function skinPlateUrl(id: SkinPlateId, kind: SkinMapKind, base = ''): string {
  return `${base}${SKIN_DIR}/${id}_${kind}.jpg`
}

/** Repeats per world unit across and up the face. */
export function skinUvScale(id: SkinPlateId): [number, number] {
  const [u, v] = SKIN_PLATES[id].tileM
  return [1 / (u * WORLD_PER_METER), 1 / (v * WORLD_PER_METER)]
}

function readQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return DEFAULT_TEXTURE_QUALITY
  }
}

const FILL: Record<SkinMapKind, string> = { albedo: '#c8c8c8', normal: '#8080ff', rough: '#d9d9d9' }
const cache = new Map<string, THREE.Texture>()

function plateTexture(id: SkinPlateId, kind: SkinMapKind, anisotropy: number): THREE.Texture {
  const quality = readQuality()
  const key = `${id}|${kind}|${quality}`
  const hit = cache.get(key)
  if (hit) {
    raiseAnisotropy(hit, anisotropy)
    return hit
  }
  const tex = new THREE.Texture()
  const stub = document.createElement('canvas')
  stub.width = 2
  stub.height = 2
  const ctx = stub.getContext('2d')
  if (ctx) {
    ctx.fillStyle = FILL[kind]
    ctx.fillRect(0, 0, 2, 2)
  }
  tex.image = stub
  tex.colorSpace = kind === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
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
  img.src = skinPlateUrl(id, kind, base)
  cache.set(key, tex)
  return tex
}

export interface SkinPlateSet {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

/** Shared albedo/normal/roughness for a plate, or null in Node (tests keep flat colours). Never dispose per mesh. */
export function skinPlateTextures(id: SkinPlateId, anisotropy = 8): SkinPlateSet | null {
  if (typeof document === 'undefined') return null
  return {
    map: plateTexture(id, 'albedo', anisotropy),
    normalMap: plateTexture(id, 'normal', anisotropy),
    roughnessMap: plateTexture(id, 'rough', anisotropy),
  }
}

export function disposeSkinTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}

export const SKIN_VERTEX_PARS = /* glsl */ `
varying vec3 vSkP;
varying vec3 vSkN;
`

export const SKIN_VERTEX = /* glsl */ `
{
  vec3 skS = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
  vSkP = transformed * skS;
  vSkN = objectNormal / max(skS, vec3(1e-5));
}
`

export const SKIN_FRAGMENT_PARS = /* glsl */ `
uniform vec2 uSkScale;
uniform vec2 uSkShift;
uniform float uSkMacro;
uniform float uSkMetre;
varying vec3 vSkP;
varying vec3 vSkN;
float skHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float skNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(skHash(i), skHash(i + vec2(1.0, 0.0)), u.x), mix(skHash(i + vec2(0.0, 1.0)), skHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 skProj(vec3 p, vec3 a) {
  if (a.y >= a.x && a.y >= a.z) return p.xz;
  if (a.x >= a.z) return p.zy;
  return p.xy;
}
`

/** Replaces <map_fragment>: projected UV + gradients (reused by roughness and normal below), anti-tiling. */
export const SKIN_MAP_FRAGMENT = /* glsl */ `
vec3 skA3 = abs(vSkN);
vec2 skM = skProj(vSkP, skA3);
vec2 skUv = skM * uSkScale;
vec2 skDx = skProj(dFdx(vSkP), skA3) * uSkScale;
vec2 skDy = skProj(dFdy(vSkP), skA3) * uSkScale;
vec2 skMm = skM * uSkMetre;
#ifdef USE_MAP
  vec4 skTex = textureGrad(map, skUv, skDx, skDy);
  if (uSkShift.x + uSkShift.y > 0.0) {
    float skT = smoothstep(0.38, 0.62, skNoise(skMm * 0.37 + 5.3) * 0.7 + skNoise(skMm * 1.1 + 1.7) * 0.3);
    skTex = mix(skTex, textureGrad(map, skUv + uSkShift, skDx, skDy), skT);
  }
  float skTone = (skNoise(skMm * 0.29 + 11.0) - 0.5) + (skNoise(skMm * 0.083 + 3.0) - 0.5) * 0.8;
  skTex.rgb *= 1.0 + skTone * uSkMacro;
  diffuseColor *= skTex;
#endif
`

export const SKIN_ROUGHNESS_FRAGMENT = /* glsl */ `
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= textureGrad(roughnessMap, skUv, skDx, skDy).g;
#endif
`

export const SKIN_NORMAL_FRAGMENT = /* glsl */ `
#ifdef USE_NORMALMAP_TANGENTSPACE
{
  vec3 skQ0 = dFdx(-vViewPosition);
  vec3 skQ1 = dFdy(-vViewPosition);
  vec3 skQ1p = cross(skQ1, normal);
  vec3 skQ0p = cross(normal, skQ0);
  vec3 skTa = skQ1p * skDx.x + skQ0p * skDy.x;
  vec3 skBi = skQ1p * skDx.y + skQ0p * skDy.y;
  float skDet = max(dot(skTa, skTa), dot(skBi, skBi));
  float skSc = skDet == 0.0 ? 0.0 : inversesqrt(skDet);
  #ifdef DOUBLE_SIDED
    skTa *= faceDirection;
    skBi *= faceDirection;
  #endif
  vec3 skMapN = textureGrad(normalMap, skUv, skDx, skDy).xyz * 2.0 - 1.0;
  skMapN.xy *= normalScale;
  normal = normalize(mat3(skTa * skSc, skBi * skSc, normal) * skMapN);
}
#else
#include <normal_fragment_maps>
#endif
`

export const SKIN_PROGRAM_KEY = 'hatch-skin-proj-v1'

/**
 * Patch a skin material so its plates are box-projected in metres in the shader.
 * Chains any earlier onBeforeCompile and extends the program cache key.
 */
export function applySkinProjection(mat: THREE.MeshStandardMaterial, id: SkinPlateId): void {
  if (mat.userData.skinPlate) return
  mat.userData.skinPlate = id
  const plate = SKIN_PLATES[id]
  const [su, sv] = skinUvScale(id)
  const uniforms = {
    uSkScale: { value: new THREE.Vector2(su, sv) },
    uSkShift: { value: new THREE.Vector2(plate.shift[0], plate.shift[1]) },
    uSkMacro: { value: plate.macro },
    uSkMetre: { value: 1 / WORLD_PER_METER },
  }
  mat.userData.skinUniforms = uniforms
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer)
    if (shader.fragmentShader.includes('uSkScale')) return
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SKIN_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SKIN_VERTEX}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SKIN_FRAGMENT_PARS}`)
      .replace('#include <map_fragment>', SKIN_MAP_FRAGMENT)
      .replace('#include <roughnessmap_fragment>', SKIN_ROUGHNESS_FRAGMENT)
      .replace('#include <normal_fragment_maps>', SKIN_NORMAL_FRAGMENT)
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|${SKIN_PROGRAM_KEY}`
}
