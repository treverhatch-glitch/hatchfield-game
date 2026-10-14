/**
 * Round C vehicle surface: photo detail maps (GSE paint, white truck panel,
 * diamond plate, chevrons, conveyor belt), grime on the lower body and a
 * per-vehicle wear/rust tint, all in one Lambert shader so the fleet keeps its
 * draw count. Textures come from base64 copies of the building-visuals photo
 * store (public/art/textures/vehicles/_b64), decoded in the browser, so the
 * text-only push path works and no unpack step is needed. Until they load (and
 * always in Node), the maps are flat white and the vehicles keep plain colours.
 */
import * as THREE from 'three'

export const VEHICLE_TEXTURES = ['gse_yellow_paint', 'truck_white_panel', 'diamond_plate', 'chevron_stripe', 'conveyor_belt'] as const

/** Metres per texture repeat for each map, and mean luminance used to keep paint hue. */
const REPEAT = [2.2, 3.0, 1.2, 1.0, 1.6] as const

const white = () => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  t.needsUpdate = true
  return t
}

let maps: THREE.Texture[] | null = null
const uniforms = {
  uMaps: { value: [] as THREE.Texture[] },
  uMean: { value: [0.75, 0.75, 0.75, 0.75, 0.75] },
  uTime: { value: 0 },
  uWear: { value: 1 },
}

function base(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
  return `${env?.BASE_URL ?? '/'}art/textures/vehicles/_b64/`
}

/**
 * Round D: desktop-class clients (fine pointer, wide screen, >= 4 GB) get the
 * 1024px detail set from _b64/hi; phones and tablets keep the 512px set.
 */
export function wantsHiResVehicleTextures(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  try {
    if (/[?&]vehtex=lo\b/.test(window.location?.search ?? '')) return false
    const fine = window.matchMedia?.('(pointer: fine)').matches ?? true
    const wide = Math.max(window.screen?.width ?? 0, window.innerWidth ?? 0) >= 1200
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '')
    return fine && wide && mem >= 4 && !mobile
  } catch {
    return false
  }
}

function loadMaps(): THREE.Texture[] {
  if (maps) return maps
  maps = VEHICLE_TEXTURES.map(() => white())
  uniforms.uMaps.value = maps
  if (typeof window === 'undefined' || typeof fetch === 'undefined' || typeof document === 'undefined') return maps
  const hi = wantsHiResVehicleTextures()
  VEHICLE_TEXTURES.forEach((name, i) => {
    const lo = `${base()}${name}.jpg.b64`
    ;(hi ? fetch(`${base()}hi/${name}.jpg.b64`).then((r) => (r.ok ? r : fetch(lo))) : fetch(lo))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((b64) => {
        const img = new Image()
        img.onload = () => {
          const tex = new THREE.Texture(img)
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = hi ? 8 : 4
          tex.generateMipmaps = true
          tex.minFilter = THREE.LinearMipmapLinearFilter
          tex.needsUpdate = true
          uniforms.uMean.value[i] = meanLuma(img)
          maps![i] = tex
          uniforms.uMaps.value = maps!
        }
        img.src = `data:image/jpeg;base64,${b64.trim()}`
      })
      .catch(() => {
        /* plain colours */
      })
  })
  return maps
}

function meanLuma(img: HTMLImageElement): number {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0, 16, 16)
    const d = g.getImageData(0, 0, 16, 16).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4) {
      const lin = (v: number) => Math.pow(v / 255, 2.2)
      sum += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
    }
    return Math.max(0.05, sum / 256)
  } catch {
    return 0.5
  }
}

/** Advance the belt scroll clock (sim seconds). */
export function setVehicleSurfaceTime(t: number) {
  uniforms.uTime.value = t
}

/** 0 = factory clean, 1 = default grime. */
export function setVehicleWear(w: number) {
  uniforms.uWear.value = w
}

const VERT_HEAD = /* glsl */ `
attribute vec2 uvm;
attribute float tid;
varying vec2 vUvm;
varying float vTid;
varying float vObjY;
varying float vSeed;
varying float vRun;
#ifdef USE_INSTANCING
attribute float iRun;
#endif
`
const VERT_BODY = /* glsl */ `
vUvm = uvm;
vTid = tid;
vObjY = position.y;
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  vSeed = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vRun = iRun;
#else
  vSeed = 0.37;
  vRun = 0.0;
#endif
`
const FRAG_HEAD = /* glsl */ `
uniform sampler2D uMaps[5];
uniform float uMean[5];
uniform float uTime;
uniform float uWear;
varying vec2 vUvm;
varying float vTid;
varying float vObjY;
varying float vSeed;
varying float vRun;
float vhash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vhash(i), vhash(i + vec2(1, 0)), f.x), mix(vhash(i + vec2(0, 1)), vhash(i + vec2(1, 1)), f.x), f.y);
}
`
const FRAG_BODY = /* glsl */ `
{
  int id = int(vTid + 0.5);
  vec3 tex = vec3(1.0);
  if (id == 1) tex = texture2D(uMaps[0], vUvm / ${REPEAT[0].toFixed(2)}).rgb;
  else if (id == 2) tex = texture2D(uMaps[1], vUvm / ${REPEAT[1].toFixed(2)}).rgb;
  else if (id == 3) tex = texture2D(uMaps[2], vUvm / ${REPEAT[2].toFixed(2)}).rgb;
  else if (id == 4) tex = texture2D(uMaps[3], vUvm / ${REPEAT[3].toFixed(2)}).rgb;
  else if (id == 5) tex = texture2D(uMaps[4], (vUvm + vec2(vRun * uTime * 0.9, 0.0)) / ${REPEAT[4].toFixed(2)}).rgb;
  if (id == 4 || id == 5) {
    diffuseColor.rgb = tex * (id == 5 ? 0.55 : 1.0);
  } else if (id >= 1) {
    float m = id == 1 ? uMean[0] : id == 2 ? uMean[1] : uMean[2];
    float l = dot(tex, vec3(0.2126, 0.7152, 0.0722)) / m;
    diffuseColor.rgb *= clamp(mix(1.0, l, 0.75), 0.55, 1.35);
  }
  // Grime: road dirt climbs the lower body, blotchy, varied per vehicle.
  float n = vnoise(vUvm * 3.1 + vSeed * 17.0) * 0.6 + vnoise(vUvm * 11.0) * 0.4;
  float low = 1.0 - smoothstep(0.15, 1.25 + vSeed * 0.5, vObjY);
  float grime = clamp(low * (0.35 + 0.65 * n) * (0.55 + 0.45 * vSeed), 0.0, 1.0) * uWear;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.52, 0.47, 0.40), grime * 0.75);
  // Rust / oil streaks on some vehicles.
  float rust = step(0.62, vSeed) * smoothstep(0.72, 0.95, n) * low * uWear;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.18, 0.09), rust * 0.45);
}
`

/** Patch a vertex-coloured Lambert material with the vehicle surface shader. */
export function applyVehicleSurface(mat: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
  loadMaps()
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMaps = uniforms.uMaps
    shader.uniforms.uMean = uniforms.uMean
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uWear = uniforms.uWear
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`)
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_BODY}`)
  }
  mat.customProgramCacheKey = () => 'vehicle-surface-v1'
  return mat
}
