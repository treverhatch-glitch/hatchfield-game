/**
 * Loads per-airline livery PNGs. Missing files, a missing manifest, and Node
 * tests all leave the procedural paint in place.
 */
import * as THREE from 'three'

export interface AirlineLiveryTex {
  fuselage: THREE.Texture
  tail: THREE.Texture
  engine: THREE.Texture
}

const SLOTS = ['fuselage', 'tail', 'engine'] as const

let blank: THREE.DataTexture | null = null
let manifest: Promise<Set<string>> | null = null
const cache = new Map<string, AirlineLiveryTex>()
/** Materials that can take a livery, waiting until a PNG actually arrives. */
const waiting: THREE.Material[] = []
/** True once any airline art has loaded. Until then the stock shader stays. */
let armed = false

export function blankLiveryTexture(): THREE.Texture {
  if (!blank) {
    blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1)
    blank.colorSpace = THREE.SRGBColorSpace
    blank.needsUpdate = true
    blank.wrapS = THREE.ClampToEdgeWrapping
    blank.wrapT = THREE.ClampToEdgeWrapping
  }
  return blank
}

function emptyTex(): AirlineLiveryTex {
  const tex = blankLiveryTexture()
  return { fuselage: tex, tail: tex, engine: tex }
}

function knownAirlines(): Promise<Set<string>> {
  if (typeof fetch !== 'function') return Promise.resolve(new Set())
  manifest ??= fetch('/textures/liveries/manifest.json')
    .then((res) => (res.ok ? res.json() : []))
    .then((list) => new Set(Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []))
    .catch(() => new Set<string>())
  return manifest
}

function loadSlot(id: string, slot: (typeof SLOTS)[number], into: AirlineLiveryTex) {
  const loader = new THREE.TextureLoader()
  loader.load(
    `/textures/liveries/${id}/${slot}.png`,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      tex.wrapS = slot === 'engine' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      tex.needsUpdate = true
      into[slot] = tex
      armLiveryShaders()
    },
    undefined,
    () => {
      // Keep the transparent texel so procedural paint stays.
    },
  )
}

/** Textures for one airline. Starts blank and fills in if the manifest lists it. */
export function airlineLiveryTex(airline: string | undefined): AirlineLiveryTex {
  if (!airline || typeof document === 'undefined') return emptyTex()
  const hit = cache.get(airline)
  if (hit) return hit
  const created = emptyTex()
  cache.set(airline, created)
  void knownAirlines().then((ids) => {
    if (!ids.has(airline)) return
    for (const slot of SLOTS) loadSlot(airline, slot, created)
  })
  return created
}

export function disposeLiveryTextures() {
  for (const tex of cache.values()) {
    for (const slot of SLOTS) {
      if (tex[slot] !== blank) tex[slot].dispose()
    }
  }
  cache.clear()
  manifest = null
  blank?.dispose()
  blank = null
  armed = false
  waiting.length = 0
}

function installLiveryShader(material: THREE.Material) {
  if (material.userData.liveryInstalled) return
  material.userData.liveryInstalled = true
  material.onBeforeCompile = (shader) => {
    const tex = blankLiveryTexture()
    shader.uniforms.liveryFuselage = { value: tex }
    shader.uniforms.liveryTail = { value: tex }
    shader.uniforms.liveryEngine = { value: tex }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 liveryUv;
attribute float liverySlot;
varying vec2 vLiveryUv;
varying float vLiverySlot;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vLiveryUv = liveryUv;
vLiverySlot = liverySlot;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D liveryFuselage;
uniform sampler2D liveryTail;
uniform sampler2D liveryEngine;
varying vec2 vLiveryUv;
varying float vLiverySlot;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec4 liveryTex = vec4(0.0);
  if (vLiverySlot < 0.5) liveryTex = texture2D(liveryFuselage, vLiveryUv);
  else if (vLiverySlot < 1.5) liveryTex = texture2D(liveryTail, vLiveryUv);
  else if (vLiverySlot < 2.5) liveryTex = texture2D(liveryEngine, vLiveryUv);
  vec3 liveryLinear = sRGBTransferEOTF(vec4(liveryTex.rgb, 1.0)).rgb;
  diffuseColor.rgb = mix(diffuseColor.rgb, liveryLinear, liveryTex.a);
}`,
      )
    material.userData.liveryShader = shader
  }
  material.customProgramCacheKey = () => 'livery-maps-v1'
  material.needsUpdate = true
}

/**
 * Remember the material. The sampler stays out of the program until a livery
 * PNG loads, so an empty manifest does not tax SwiftShader.
 */
export function hookLiveryMaterial(material: THREE.Material) {
  if (material.userData.liveryQueued) return
  material.userData.liveryQueued = true
  if (armed) installLiveryShader(material)
  else waiting.push(material)
}

function armLiveryShaders() {
  if (armed) return
  armed = true
  for (const material of waiting) installLiveryShader(material)
  waiting.length = 0
}

export function bindLiveryUniforms(material: THREE.Material, airline: string | undefined) {
  const shader = material.userData.liveryShader as { uniforms: Record<string, { value: THREE.Texture }> } | undefined
  if (!shader) return
  const tex = airlineLiveryTex(airline)
  shader.uniforms.liveryFuselage.value = tex.fuselage
  shader.uniforms.liveryTail.value = tex.tail
  shader.uniforms.liveryEngine.value = tex.engine
}
