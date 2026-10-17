/**
 * Anti-tiling for the paved ground plates. The merged surfaces carry world UVs
 * (world / uvSize); this samples the CC0 plate at true real-world scale (detail),
 * blends a second rotated, rescaled sample through low-frequency world noise, and
 * adds a gentle macro brightness drift so no repeat reads at any zoom.
 * Lambert lighting, shadows, vertex colours and tint are untouched.
 */
import * as THREE from 'three'
import { WORLD_PER_METER } from '../aircraft/specs'
import { AIRFIELD_TILE_M, CONCRETE_DETAIL_M, type AirfieldSurface } from './airfieldArt'

/** UV repeat multiplier for the concrete grain overlay on a surface with this uvSize. */
export function concreteScale(uvSize: number): number {
  return uvSize / (CONCRETE_DETAIL_M * WORLD_PER_METER)
}

/** UV repeat multiplier so one plate repeat covers its real-world metres. */
export function detailScale(uvSize: number, surface: AirfieldSurface): number {
  return uvSize / (AIRFIELD_TILE_M[surface] * WORLD_PER_METER)
}

const NOISE = /* glsl */ `
uniform float uAfDetail;
uniform float uAfMix;
uniform sampler2D uAfConc;
uniform float uAfConcScale;
uniform float uAfConcAmt;
float afHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float afNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(afHash(i), afHash(i + vec2(1.0, 0.0)), u.x), mix(afHash(i + vec2(0.0, 1.0)), afHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 afRot(vec2 uv) { return mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.43 + vec2(0.37, 0.71); }
float afBlend(vec2 w) { return smoothstep(0.3, 0.7, afNoise(w * 0.35) * 0.7 + afNoise(w * 1.3 + 7.0) * 0.3) * uAfMix; }
`

const MAP = /* glsl */ `
#ifdef USE_MAP
  vec2 afUv = vMapUv * uAfDetail;
  float afT = afBlend(vMapUv);
  vec4 sampledDiffuseColor = mix(texture2D(map, afUv), texture2D(map, afRot(afUv)), afT);
  sampledDiffuseColor.rgb *= 1.0 + (afNoise(vMapUv * 0.09 + 13.1) - 0.5) * 0.16 * uAfMix;
  if (uAfConcAmt > 0.0) {
    vec2 afCu = vMapUv * uAfConcScale;
    float afCt = smoothstep(0.3, 0.7, afNoise(vMapUv * 0.35) * 0.7 + afNoise(vMapUv * 1.3 + 7.0) * 0.3);
    float afC = mix(texture2D(uAfConc, afCu).r, texture2D(uAfConc, afRot(afCu)).r, afCt);
    sampledDiffuseColor.rgb *= clamp(1.0 + (afC - 0.5) * 2.0 * uAfConcAmt, 0.6, 1.4);
  }
  diffuseColor *= sampledDiffuseColor;
#endif
`

export interface AntiTileUniforms {
  uAfDetail: { value: number }
  uAfMix: { value: number }
  uAfConc: { value: THREE.Texture | null }
  uAfConcScale: { value: number }
  uAfConcAmt: { value: number }
}

/** Patch a ground material once. Returns the live uniforms (also on userData.antiTile). */
export function applyAntiTile(mat: THREE.MeshLambertMaterial): AntiTileUniforms {
  const u: AntiTileUniforms = { uAfDetail: { value: 1 }, uAfMix: { value: 0 }, uAfConc: { value: null }, uAfConcScale: { value: 1 }, uAfConcAmt: { value: 0 } }
  mat.userData.antiTile = u
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAfDetail = u.uAfDetail
    shader.uniforms.uAfMix = u.uAfMix
    shader.uniforms.uAfConc = u.uAfConc
    shader.uniforms.uAfConcScale = u.uAfConcScale
    shader.uniforms.uAfConcAmt = u.uAfConcAmt
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <map_fragment>', MAP)
      .replace(/texture2D\(\s*normalMap,\s*vNormalMapUv\s*\)/g, () => 'mix(texture2D(normalMap, vNormalMapUv * uAfDetail), texture2D(normalMap, afRot(vNormalMapUv * uAfDetail)), afBlend(vNormalMapUv))')
  }
  mat.customProgramCacheKey = () => 'hatch-antitile-v2'
  return u
}

/** CC0 plate: true scale + blend. Seasonal/wet plates (authored at uvSize): detail 1, no blend. */
export function setAntiTile(mat: THREE.Material | undefined, detail: number, mix: number) {
  const u = mat?.userData?.antiTile as AntiTileUniforms | undefined
  if (!u) return
  u.uAfDetail.value = detail
  u.uAfMix.value = mix
}

/** Concrete grain over a slab plate. Pass null / 0 to switch it off (wet, snow, asphalt). */
export function setConcreteDetail(mat: THREE.Material | undefined, tex: THREE.Texture | null, scale: number, amt: number) {
  const u = mat?.userData?.antiTile as AntiTileUniforms | undefined
  if (!u) return
  u.uAfConc.value = tex
  u.uAfConcScale.value = scale
  u.uAfConcAmt.value = tex ? amt : 0
}
