/**
 * Loads per-airline livery JPEGs. Missing files, a missing manifest, and Node
 * tests all leave the procedural paint in place. Engines are a solid colour
 * from the manifest. Plate size follows the texture-quality setting.
 */
import * as THREE from 'three'
import {
  DEFAULT_TEXTURE_QUALITY,
  TEXTURE_QUALITY_KEY,
  liveryFile,
  parseTextureQuality,
  type LiverySlotName,
  type TextureQuality,
} from './liveryFiles'
import { LIVERY_KEY_SEP, disposeProcLiveries, procLiveryTextures } from './procLivery'

export interface AirlineLiveryTex {
  fuselage: THREE.Texture
  tail: THREE.Texture
  engine: THREE.Texture
}

interface LiveryEntry {
  id: string
  engine: string
  airlines: string[]
  preload: boolean
}

interface LiveryIndex {
  byAirline: Map<string, LiveryEntry>
}

const SLOTS: LiverySlotName[] = ['fuselage', 'tail']

let blank: THREE.DataTexture | null = null
let manifest: Promise<LiveryIndex> | null = null
let quality: TextureQuality = DEFAULT_TEXTURE_QUALITY
const cache = new Map<string, AirlineLiveryTex>()
const engineTex = new Map<string, THREE.DataTexture>()
/** Materials that can take a livery, waiting until a plate actually arrives. */
const waiting: THREE.Material[] = []
/** True once any airline art has loaded. Until then the stock shader stays. */
let armed = false
/** Dev preview. `off` keeps procedural paint. A slug forces that plate. */
let preview: string | null = null
/** `${id}:fuselage` / `${id}:tail` once that JPEG has uploaded. Aliases share the keys. */
const ready = new Set<string>()
/** Folder id → catalog ids that wear it, so a flight can ask by either name. */
const aliasOf = new Map<string, string[]>()

export function setLiveryPreview(id: string | null) {
  preview = id
}

/** Both plates for this folder id have decoded. Dev shots wait on this. */
export function liveryPlateReady(id: string): boolean {
  return ready.has(`${id}:fuselage`) && ready.has(`${id}:tail`)
}

/** Airline id the shell should sample, after the dev preview override. */
export function resolveLiveryAirline(airline: string | undefined): string | undefined {
  if (preview === 'off') return undefined
  if (preview) return preview
  return airline
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const dev = window as unknown as {
    __liveryPreview?: typeof setLiveryPreview
    __liveryReady?: typeof liveryPlateReady
  }
  dev.__liveryPreview = setLiveryPreview
  dev.__liveryReady = liveryPlateReady
}

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

function emptyIndex(): LiveryIndex {
  return { byAirline: new Map() }
}

function parseIndex(raw: unknown): LiveryIndex {
  const byAirline = new Map<string, LiveryEntry>()
  const rows = Array.isArray(raw)
    ? raw.filter((id) => typeof id === 'string').map((id) => ({ id, engine: '#888888', airlines: [id] }))
    : Array.isArray((raw as { liveries?: unknown })?.liveries)
      ? ((raw as { liveries: unknown[] }).liveries)
      : []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const rec = row as { id?: unknown; engine?: unknown; airlines?: unknown; preload?: unknown }
    if (typeof rec.id !== 'string') continue
    const airlines = Array.isArray(rec.airlines) ? rec.airlines.filter((id) => typeof id === 'string') : [rec.id]
    const entry: LiveryEntry = {
      id: rec.id,
      engine: typeof rec.engine === 'string' ? rec.engine : '#888888',
      airlines: airlines.length ? airlines : [rec.id],
      preload: rec.preload !== false,
    }
    for (const id of entry.airlines) byAirline.set(id, entry)
    byAirline.set(entry.id, entry)
  }
  return { byAirline }
}

function liveryIndex(): Promise<LiveryIndex> {
  if (typeof fetch !== 'function') return Promise.resolve(emptyIndex())
  quality = readTextureQuality()
  manifest ??= fetch('/textures/liveries/manifest.json')
    .then((res) => (res.ok ? res.json() : { liveries: [] }))
    .then((raw) => parseIndex(raw))
    .catch(() => emptyIndex())
  return manifest
}

function readTextureQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return DEFAULT_TEXTURE_QUALITY
  }
}

function solidEngine(hex: string): THREE.Texture {
  const hit = engineTex.get(hex)
  if (hit) return hit
  const n = Number.parseInt(hex.replace('#', ''), 16)
  const data = new Uint8Array([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255])
  const tex = new THREE.DataTexture(data, 1, 1)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  engineTex.set(hex, tex)
  return tex
}

function loadPlate(id: string, slot: LiverySlotName, into: AirlineLiveryTex) {
  const loader = new THREE.TextureLoader()
  loader.load(
    liveryFile(id, slot, quality),
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = quality === 'high' ? 16 : quality === 'med' ? 8 : 4
      tex.magFilter = THREE.LinearFilter
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.generateMipmaps = true
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      tex.needsUpdate = true
      into[slot] = tex
      ready.add(`${id}:${slot}`)
      for (const alias of aliasOf.get(id) ?? []) ready.add(`${alias}:${slot}`)
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
  if (airline.includes(LIVERY_KEY_SEP)) {
    // Roster airline on a specific model: canvas plates, no manifest or fetch.
    const drawn = procLiveryTextures(airline, readTextureQuality())
    if (!drawn) return emptyTex()
    cache.set(airline, drawn)
    ready.add(`${airline}:fuselage`)
    ready.add(`${airline}:tail`)
    armLiveryShaders()
    return drawn
  }
  const created = emptyTex()
  cache.set(airline, created)
  void liveryIndex().then((index) => {
    const entry = index.byAirline.get(airline)
    if (!entry) return
    const shared = cache.get(entry.id)
    if (shared && shared !== created) {
      cache.set(airline, shared)
      return
    }
    cache.set(entry.id, created)
    created.engine = solidEngine(entry.engine)
    aliasOf.set(entry.id, entry.airlines)
    armLiveryShaders()
    for (const slot of SLOTS) loadPlate(entry.id, slot, created)
  })
  return created
}

/** Fetch every listed plate as soon as the page loads, so the upload is not a hitch mid-sim. */
function preloadListedLiveries() {
  if (typeof document === 'undefined') return
  void liveryIndex().then((index) => {
    const seen = new Set<string>()
    for (const entry of index.byAirline.values()) {
      if (!entry.preload || seen.has(entry.id) || cache.has(entry.id)) continue
      seen.add(entry.id)
      const created = emptyTex()
      cache.set(entry.id, created)
      for (const alias of entry.airlines) cache.set(alias, created)
      created.engine = solidEngine(entry.engine)
      aliasOf.set(entry.id, entry.airlines)
      armLiveryShaders()
      for (const slot of SLOTS) loadPlate(entry.id, slot, created)
    }
  })
}

preloadListedLiveries()

export function disposeLiveryTextures() {
  for (const tex of cache.values()) {
    for (const slot of SLOTS) {
      if (tex[slot] !== blank && !engineTexHas(tex[slot])) tex[slot].dispose()
    }
  }
  for (const tex of engineTex.values()) tex.dispose()
  engineTex.clear()
  disposeProcLiveries()
  cache.clear()
  manifest = null
  blank?.dispose()
  blank = null
  armed = false
  waiting.length = 0
  preview = null
  ready.clear()
  aliasOf.clear()
}

function engineTexHas(tex: THREE.Texture): boolean {
  for (const solid of engineTex.values()) if (solid === tex) return true
  return false
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
  // Bias toward the sharper mip so a small aircraft keeps its plate instead of a white average.
  if (vLiverySlot < 0.5) liveryTex = texture2D(liveryFuselage, vLiveryUv, -2.5);
  else if (vLiverySlot < 1.5) liveryTex = texture2D(liveryTail, vLiveryUv, -2.5);
  else if (vLiverySlot < 2.5) liveryTex = texture2D(liveryEngine, vLiveryUv, -2.5);
  vec3 liveryLinear = sRGBTransferEOTF(vec4(liveryTex.rgb, 1.0)).rgb;
  diffuseColor.rgb = mix(diffuseColor.rgb, liveryLinear, liveryTex.a);
}`,
      )
    material.userData.liveryShader = shader
  }
  material.customProgramCacheKey = () => 'livery-maps-v2'
  material.needsUpdate = true
}

/**
 * Remember the material. The sampler stays out of the program until a livery
 * plate loads, so an empty manifest does not tax SwiftShader.
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
  // Ask for the plate before the program exists. Arming the shader is what
  // this request does, so bailing out here would leave every shell procedural.
  const tex = airlineLiveryTex(airline)
  const shader = material.userData.liveryShader as { uniforms: Record<string, { value: THREE.Texture }> } | undefined
  if (!shader) return
  shader.uniforms.liveryFuselage.value = tex.fuselage
  shader.uniforms.liveryTail.value = tex.tail
  shader.uniforms.liveryEngine.value = tex.engine
}
