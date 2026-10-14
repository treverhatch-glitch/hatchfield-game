/**
 * Shared procedural kit for building models: cached materials, primitive helpers,
 * canvas signage and type emblems. Everything is safe to call in Node (tests):
 * canvas-backed pieces are skipped when there is no `document`.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CELL } from '../../render/aircraft/specs'

export { CELL }
type V3 = { x: number; y: number; z: number }
/** Usable footprint half-width inside a cell. */
export const HALF = CELL * 0.46

type MatOpts = { rough?: number; metal?: number; emissive?: string; ei?: number; opacity?: number }
const mats = new Map<string, THREE.MeshStandardMaterial>()

/** Cached standard material. Disposal elsewhere is harmless: three re-uploads on next use. */
export function mat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.rough ?? 0.6}|${o.metal ?? 0.1}|${o.emissive ?? ''}|${o.ei ?? 0}|${o.opacity ?? 1}`
  let m = mats.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.6,
      metalness: o.metal ?? 0.1,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.ei ?? 0,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
    })
    dress(m, o)
    mats.set(key, m)
  }
  return m
}

// ---------- PBR dressing: weathering, env reflections, night glow ----------
const WEATHER_VERT_HEAD = 'varying vec3 vHfW;\n'
const WEATHER_FRAG_HEAD = `varying vec3 vHfW;
float hfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hfNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hfHash(i), hfHash(i + vec2(1.0, 0.0)), f.x), mix(hfHash(i + vec2(0.0, 1.0)), hfHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`
/**
 * Procedural weathering on every opaque kit material: grime band at the wall
 * base, macro colour drift, faint rain streaks, and roughness break-up. Pure
 * shader, so it costs nothing in draw calls and shares one program per variant.
 */
let materialFx = true
const weathered = new Set<THREE.MeshStandardMaterial>()
/**
 * Per-pixel material effects (procedural weathering + PBR env reflections) on
 * every kit material. Off on Low/Medium: in software GL these two were most of
 * the round-4 fragment cost. Toggling recompiles the kit programs once.
 */
export function setMaterialFx(on: boolean): void {
  if (on === materialFx) return
  materialFx = on
  for (const m of weathered) m.needsUpdate = true
  for (const m of envMats) {
    m.envMap = on ? envTex : null
    m.needsUpdate = true
  }
}
export function getMaterialFx(): boolean {
  return materialFx
}

function weather(m: THREE.MeshStandardMaterial): void {
  weathered.add(m)
  m.onBeforeCompile = (sh) => {
    if (!materialFx) return
    sh.vertexShader = WEATHER_VERT_HEAD + sh.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vHfW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    sh.fragmentShader = WEATHER_FRAG_HEAD + sh.fragmentShader
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  float hfN = hfNoise(vHfW.xz * 0.23 + vHfW.y * 0.11);
  float hfS = hfNoise(vec2((vHfW.x + vHfW.z) * 2.7, vHfW.y * 0.18));
  float hfBase = mix(0.74, 1.0, smoothstep(0.04, 1.3, vHfW.y));
  diffuseColor.rgb *= mix(0.9, 1.06, hfN) * (1.0 - 0.08 * hfS * hfS) * hfBase;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * mix(0.82, 1.16, hfN), 0.04, 1.0);`,
      )
  }
  m.customProgramCacheKey = () => (materialFx ? 'hf-weather' : 'hf-plain')
}

let envTex: THREE.Texture | null = null
const envMats = new Set<THREE.MeshStandardMaterial>()
/** Shared studio reflection map for kit materials (metal and glass read as PBR, not plastic). */
export function setKitEnvironment(t: THREE.Texture | null): void {
  envTex = t
  for (const m of envMats) {
    m.envMap = materialFx ? t : null
    m.needsUpdate = true
  }
}

interface NightSpec { m: THREE.MeshStandardMaterial; day: THREE.Color; dayI: number; night: THREE.Color; nightI: number }
const nightMats: NightSpec[] = []
let nightLevel = 0
/** Register a material that glows at night (windows, lamps, signs). */
export function nightGlow(m: THREE.MeshStandardMaterial, night: string, nightI: number): THREE.MeshStandardMaterial {
  if (nightMats.some((n) => n.m === m)) return m
  nightMats.push({ m, day: m.emissive.clone(), dayI: m.emissiveIntensity, night: new THREE.Color(night), nightI })
  if (nightLevel > 0) setNightLevel(nightLevel)
  return m
}
/** 0 = day, 1 = full night. Lerps every registered glow material. Cheap (uniform updates only). */
export function setNightLevel(k: number): void {
  const v = Math.min(1, Math.max(0, k))
  if (Math.abs(v - nightLevel) < 0.002 && v !== 0 && v !== 1) return
  nightLevel = v
  for (const n of nightMats) {
    n.m.emissive.copy(n.day).lerp(n.night, v)
    n.m.emissiveIntensity = n.dayI + (n.nightI - n.dayI) * v
  }
}
export function getKitEnvironment(): THREE.Texture | null {
  return envTex
}
export function getNightLevel(): number {
  return nightLevel
}

function dress(m: THREE.MeshStandardMaterial, o: MatOpts): void {
  if ((o.opacity ?? 1) >= 1 && (o.ei ?? 0) < 0.6) weather(m)
  m.envMapIntensity = (o.metal ?? 0.1) > 0.3 ? 0.9 : 0.45
  if (envTex && materialFx) m.envMap = envTex
  envMats.add(m)
}

export const M = {
  concrete: () => mat('#b9b5ab', { rough: 0.9 }),
  asphalt: () => tmat('asphalt_road', '#5a5d63', 2, 2, { rough: 0.95 }),
  plate: () => tmat('diamond_plate', '#b4bac0', 2, 2, { rough: 0.4, metal: 0.7 }),
  steel: () => mat('#9aa4ad', { rough: 0.35, metal: 0.7 }),
  darkSteel: () => mat('#4a525b', { rough: 0.45, metal: 0.6 }),
  white: () => mat('#eef1f4', { rough: 0.5 }),
  glass: () => nightGlow(mat('#6fb3dc', { rough: 0.08, metal: 0.5, emissive: '#1a3a55', ei: 0.35 }), '#ffc97a', 1.25),
  /** Office / room glazing: reflective by day, warm lit interior at night. */
  window: () => nightGlow(mat('#5d8fb0', { rough: 0.06, metal: 0.6, emissive: '#16283a', ei: 0.25 }), '#ffd08a', 1.5),
  glow: (c = '#ffe9a8') => nightGlow(mat(c, { emissive: c, ei: 0.9, rough: 0.4 }), c, 2.2),
  frame: () => mat('#3a4048', { rough: 0.35, metal: 0.75 }),
  coping: () => mat('#7d8288', { rough: 0.5, metal: 0.55 }),
  kerb: () => mat('#cfccc4', { rough: 0.85 }),
  yellow: () => tmat('gse_yellow_paint', '#f0c03a', 1, 1, { rough: 0.5 }),
  red: () => mat('#c0392b', { rough: 0.5 }),
  black: () => mat('#1d2126', { rough: 0.7 }),
}

function finish<T extends THREE.Mesh>(m: T, x: number, y: number, z: number, cast = true): T {
  m.position.set(x, y, z)
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

/** Box sitting with its base at y (not centred). */
export function box(g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = finish(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y + h / 2, z)
  g.add(mesh)
  return mesh
}

/**
 * Round 9: rounded mass built that way from the start (big bevel radius, smooth normals),
 * base at y. Use for the main volumes of a building so it never reads as a raw cuboid.
 */
export function rbox(g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, r = 0.3): THREE.Mesh {
  const rr = Math.max(0.01, Math.min(r, w * 0.45, h * 0.45, d * 0.45))
  const mesh = finish(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, rr), m), x, y + h / 2, z)
  g.add(mesh)
  return mesh
}

/** Vertical cylinder with its base at y. */
export function cyl(g: THREE.Object3D, rTop: number, rBot: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 24): THREE.Mesh {
  const mesh = finish(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), m), x, y + h / 2, z)
  g.add(mesh)
  return mesh
}

/** Horizontal pipe from a to b. */
export function pipe(g: THREE.Object3D, a: V3, b: V3, r: number, m: THREE.Material): THREE.Mesh {
  const va = new THREE.Vector3(a.x, a.y, a.z)
  const vb = new THREE.Vector3(b.x, b.y, b.z)
  const len = va.distanceTo(vb)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m)
  mesh.position.copy(va).add(vb).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())
  mesh.castShadow = true
  g.add(mesh)
  return mesh
}

/** Ground slab / pad. */
export function pad(g: THREE.Object3D, w: number, d: number, m: THREE.Material = M.concrete(), h = 0.12): THREE.Mesh {
  return box(g, w, h, d, m, 0, 0, 0)
}

/** Ring of thin posts + rails: a chain-link style fence around w×d. */
export function fence(g: THREE.Object3D, w: number, d: number, h = 1.1, gap = 0): void {
  const post = mat('#7d868f', { metal: 0.6, rough: 0.4 })
  const mesh = mat('#9aa4ad', { metal: 0.5, rough: 0.5, opacity: 0.45 })
  const sides: [number, number, number, number][] = [
    [-w / 2, -d / 2, w / 2, -d / 2],
    [w / 2, -d / 2, w / 2, d / 2],
    [-w / 2, -d / 2, -w / 2, d / 2],
  ]
  // Front side gets a gate gap.
  const gw = gap / 2
  if (gap > 0) {
    sides.push([-w / 2, d / 2, -gw, d / 2], [gw, d / 2, w / 2, d / 2])
  } else sides.push([-w / 2, d / 2, w / 2, d / 2])
  for (const [x1, z1, x2, z2] of sides) {
    const len = Math.hypot(x2 - x1, z2 - z1)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.04), mesh)
    panel.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2)
    panel.rotation.y = -Math.atan2(z2 - z1, x2 - x1)
    g.add(panel)
    const n = Math.max(2, Math.round(len / 1.6))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      cyl(g, 0.05, 0.05, h + 0.1, post, x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, 6)
    }
  }
}

/** Row of glowing windows on a facade facing +z at depth z. */
export function windows(g: THREE.Object3D, w: number, y: number, z: number, n: number, ww = 0.5, wh = 0.5, m = M.window()): void {
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5)
    framedWindow(g, ww, wh, m, x, y, z)
  }
}

/** One window facing +z: recessed glass, aluminium frame, centre mullion, concrete sill. */
export function framedWindow(g: THREE.Object3D, ww: number, wh: number, m: THREE.Material, x: number, y: number, z: number): void {
  const f = M.frame()
  const t = Math.min(0.06, ww * 0.1)
  box(g, ww, wh, 0.04, m, x, y, z)
  box(g, ww + t * 2, t, 0.08, f, x, y + wh, z)
  box(g, ww + t * 2, t, 0.08, f, x, y - t, z)
  box(g, t, wh, 0.08, f, x - ww / 2 - t / 2, y, z)
  box(g, t, wh, 0.08, f, x + ww / 2 + t / 2, y, z)
  if (ww > 0.7) box(g, t * 0.7, wh, 0.07, f, x, y, z)
  if (wh > 0.9) box(g, ww, t * 0.7, 0.07, f, x, y + wh * 0.62, z)
  box(g, ww + t * 3, 0.05, 0.16, M.kerb(), x, y - t - 0.05, z + 0.04)
}

// ---------- canvas signage ----------
const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function'
const texCache = new Map<string, THREE.Texture>()

function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.Texture | null {
  if (!hasDom()) return null
  let t = texCache.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return null
  draw(ctx)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  texCache.set(key, t)
  return t
}

/** Flat sign board with text; faces +z. Always adds the board, text only with a DOM. */
export function sign(g: THREE.Object3D, text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, rotY = 0): THREE.Mesh {
  const tex = canvasTex(`sign|${text}|${bg}|${fg}`, 512, Math.round(512 * (h / w)) || 64, (ctx) => {
    const W = ctx.canvas.width
    const H = ctx.canvas.height
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = fg
    let size = H * 0.62
    ctx.font = `800 ${size}px "Inter", "Helvetica Neue", Arial, sans-serif`
    while (ctx.measureText(text).width > W * 0.9 && size > 8) {
      size -= 2
      ctx.font = `800 ${size}px "Inter", "Helvetica Neue", Arial, sans-serif`
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, W / 2, H / 2 + size * 0.04)
  })
  const m = tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 }) : mat(bg)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotY
  mesh.name = `sign:${text}`
  g.add(mesh)
  return mesh
}

export type EmblemKind = 'fuel' | 'bolt' | 'radar' | 'xray' | 'bag' | 'plane' | 'box' | 'flame' | 'fork' | 'wrench' | 'shield' | 'cup' | 'hydrant' | 'eye'

function drawGlyph(ctx: CanvasRenderingContext2D, kind: EmblemKind, s: number) {
  const c = s / 2
  ctx.lineWidth = s * 0.07
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  switch (kind) {
    case 'fuel':
      ctx.moveTo(c, s * 0.18)
      ctx.bezierCurveTo(s * 0.78, s * 0.5, s * 0.72, s * 0.8, c, s * 0.8)
      ctx.bezierCurveTo(s * 0.28, s * 0.8, s * 0.22, s * 0.5, c, s * 0.18)
      ctx.fill()
      break
    case 'hydrant':
      ctx.arc(c, c, s * 0.26, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(c, s * 0.3)
      ctx.bezierCurveTo(s * 0.64, s * 0.5, s * 0.6, s * 0.64, c, s * 0.64)
      ctx.bezierCurveTo(s * 0.4, s * 0.64, s * 0.36, s * 0.5, c, s * 0.3)
      ctx.fill()
      break
    case 'bolt':
      ctx.moveTo(s * 0.56, s * 0.12)
      ctx.lineTo(s * 0.26, s * 0.56)
      ctx.lineTo(s * 0.48, s * 0.56)
      ctx.lineTo(s * 0.42, s * 0.88)
      ctx.lineTo(s * 0.74, s * 0.42)
      ctx.lineTo(s * 0.52, s * 0.42)
      ctx.closePath()
      ctx.fill()
      break
    case 'radar':
      for (const r of [0.14, 0.26, 0.38]) {
        ctx.beginPath()
        ctx.arc(c, c, s * r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(c, c)
      ctx.arc(c, c, s * 0.38, -1.2, -0.5)
      ctx.closePath()
      ctx.fill()
      break
    case 'xray':
      ctx.strokeRect(s * 0.2, s * 0.24, s * 0.6, s * 0.52)
      ctx.font = `900 ${s * 0.3}px Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('X', c, c + s * 0.02)
      break
    case 'bag':
      ctx.fillRect(s * 0.22, s * 0.34, s * 0.56, s * 0.42)
      ctx.strokeRect(s * 0.38, s * 0.2, s * 0.24, s * 0.16)
      break
    case 'plane':
      ctx.moveTo(c, s * 0.12)
      ctx.lineTo(s * 0.55, s * 0.42)
      ctx.lineTo(s * 0.88, s * 0.58)
      ctx.lineTo(s * 0.55, s * 0.54)
      ctx.lineTo(s * 0.54, s * 0.76)
      ctx.lineTo(s * 0.66, s * 0.86)
      ctx.lineTo(c, s * 0.82)
      ctx.lineTo(s * 0.34, s * 0.86)
      ctx.lineTo(s * 0.46, s * 0.76)
      ctx.lineTo(s * 0.45, s * 0.54)
      ctx.lineTo(s * 0.12, s * 0.58)
      ctx.lineTo(s * 0.45, s * 0.42)
      ctx.closePath()
      ctx.fill()
      break
    case 'box':
      ctx.moveTo(c, s * 0.16)
      ctx.lineTo(s * 0.82, s * 0.32)
      ctx.lineTo(s * 0.82, s * 0.7)
      ctx.lineTo(c, s * 0.86)
      ctx.lineTo(s * 0.18, s * 0.7)
      ctx.lineTo(s * 0.18, s * 0.32)
      ctx.closePath()
      ctx.moveTo(s * 0.18, s * 0.32)
      ctx.lineTo(c, s * 0.48)
      ctx.lineTo(s * 0.82, s * 0.32)
      ctx.moveTo(c, s * 0.48)
      ctx.lineTo(c, s * 0.86)
      ctx.stroke()
      break
    case 'flame':
      ctx.moveTo(c, s * 0.12)
      ctx.bezierCurveTo(s * 0.9, s * 0.5, s * 0.75, s * 0.88, c, s * 0.88)
      ctx.bezierCurveTo(s * 0.25, s * 0.88, s * 0.12, s * 0.55, s * 0.36, s * 0.38)
      ctx.bezierCurveTo(s * 0.38, s * 0.55, s * 0.46, s * 0.6, s * 0.5, s * 0.58)
      ctx.bezierCurveTo(s * 0.42, s * 0.4, s * 0.5, s * 0.24, c, s * 0.12)
      ctx.fill()
      break
    case 'fork':
      ctx.moveTo(s * 0.36, s * 0.16)
      ctx.lineTo(s * 0.36, s * 0.84)
      ctx.moveTo(s * 0.26, s * 0.16)
      ctx.lineTo(s * 0.26, s * 0.36)
      ctx.quadraticCurveTo(s * 0.36, s * 0.46, s * 0.46, s * 0.36)
      ctx.lineTo(s * 0.46, s * 0.16)
      ctx.moveTo(s * 0.66, s * 0.84)
      ctx.lineTo(s * 0.66, s * 0.16)
      ctx.quadraticCurveTo(s * 0.8, s * 0.3, s * 0.66, s * 0.5)
      ctx.stroke()
      break
    case 'wrench':
      ctx.moveTo(s * 0.24, s * 0.76)
      ctx.lineTo(s * 0.6, s * 0.4)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(s * 0.66, s * 0.34, s * 0.16, 0.6, Math.PI * 2 - 0.9)
      ctx.stroke()
      break
    case 'shield':
      ctx.moveTo(c, s * 0.14)
      ctx.lineTo(s * 0.8, s * 0.26)
      ctx.quadraticCurveTo(s * 0.8, s * 0.7, c, s * 0.88)
      ctx.quadraticCurveTo(s * 0.2, s * 0.7, s * 0.2, s * 0.26)
      ctx.closePath()
      ctx.fill()
      break
    case 'cup':
      ctx.moveTo(s * 0.26, s * 0.3)
      ctx.lineTo(s * 0.34, s * 0.8)
      ctx.lineTo(s * 0.66, s * 0.8)
      ctx.lineTo(s * 0.74, s * 0.3)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(s * 0.48, s * 0.12, s * 0.06, s * 0.2)
      break
    case 'eye':
      ctx.moveTo(s * 0.12, c)
      ctx.quadraticCurveTo(c, s * 0.16, s * 0.88, c)
      ctx.quadraticCurveTo(c, s * 0.84, s * 0.12, c)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(c, c, s * 0.13, 0, Math.PI * 2)
      ctx.fill()
      break
  }
}

/** Round type emblem decal (badge), facing +z, or lying flat on a roof when flat=true. */
export function emblem(g: THREE.Object3D, kind: EmblemKind, color: string, size: number, x: number, y: number, z: number, flat = false, rotY = 0): THREE.Mesh | null {
  const tex = canvasTex(`emb|${kind}|${color}`, 256, 256, (ctx) => {
    const s = 256
    ctx.clearRect(0, 0, s, s)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = s * 0.035
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s * 0.43, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#ffffff'
    drawGlyph(ctx, kind, s)
  })
  if (!tex) return null
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.2 })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m)
  mesh.position.set(x, y, z)
  if (flat) mesh.rotation.set(-Math.PI / 2, 0, rotY)
  else mesh.rotation.y = rotY
  mesh.name = `emblem:${kind}`
  g.add(mesh)
  return mesh
}

/** Painted roof band: stripe of colour across a roof at height y. */
export function roofStripe(g: THREE.Object3D, w: number, d: number, y: number, color: string): void {
  box(g, w, 0.03, d, mat(color, { rough: 0.6 }), 0, y, 0)
}

// ---------- photo textures (public/art/textures/buildings) ----------
export type BuildingTex =
  | 'hangar_cladding'
  | 'warehouse_panels'
  | 'terminal_glass'
  | 'dock_floor'
  | 'tank_steel'
  | 'roof_membrane'
  | 'gravel_yard'
  | 'terrazzo_floor'
  | 'chevron_stripe'
  | 'apron_concrete'
  | 'asphalt_road'
  | 'airport_grass'
  | 'diamond_plate'
  | 'conveyor_belt'
  | 'gse_yellow_paint'
  | 'truck_white_panel'

const photoBase = new Map<string, THREE.Texture>()
const photoDerived = new Map<string, { normal: THREE.Texture; rough: THREE.Texture } | null>()

/**
 * Normal + roughness maps derived from the photo's luminance (Sobel height
 * gradient). Gives every Gemini texture real surface relief under the sun.
 */
function derivedMaps(name: string, img: CanvasImageSource & { width: number; height: number }): { normal: THREE.Texture; rough: THREE.Texture } | null {
  if (photoDerived.has(name)) return photoDerived.get(name)!
  let out: { normal: THREE.Texture; rough: THREE.Texture } | null = null
  try {
    const S = 1024 // round 8: desktop target, full-detail relief
    const c = document.createElement('canvas')
    c.width = c.height = S
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.drawImage(img, 0, 0, S, S)
      const src = ctx.getImageData(0, 0, S, S).data
      const lum = new Float32Array(S * S)
      for (let i = 0; i < S * S; i++) lum[i] = (src[i * 4]! * 0.299 + src[i * 4 + 1]! * 0.587 + src[i * 4 + 2]! * 0.114) / 255
      const L = (x: number, y: number) => lum[((y + S) % S) * S + ((x + S) % S)]!
      const nc = document.createElement('canvas')
      nc.width = nc.height = S
      const rc = document.createElement('canvas')
      rc.width = rc.height = S
      const nctx = nc.getContext('2d')!
      const rctx = rc.getContext('2d')!
      const nd = nctx.createImageData(S, S)
      const rd = rctx.createImageData(S, S)
      const k = 3.2
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1))
        const dy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1))
        let nx = -dx * k
        let ny = dy * k
        const inv = 1 / Math.hypot(nx, ny, 1)
        nx *= inv
        ny *= inv
        const i = (y * S + x) * 4
        nd.data[i] = (nx * 0.5 + 0.5) * 255
        nd.data[i + 1] = (ny * 0.5 + 0.5) * 255
        nd.data[i + 2] = (inv * 0.5 + 0.5) * 255
        nd.data[i + 3] = 255
        // Darker grain (pits, joints, grime) is rougher; bright worn faces a touch smoother.
        const r = 255 * (0.72 + 0.28 * (1 - L(x, y)))
        rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = r
        rd.data[i + 3] = 255
      }
      nctx.putImageData(nd, 0, 0)
      rctx.putImageData(rd, 0, 0)
      const mk = (cv: HTMLCanvasElement) => {
        const t = new THREE.CanvasTexture(cv)
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.anisotropy = 8
        return t
      }
      out = { normal: mk(nc), rough: mk(rc) }
    }
  } catch {
    out = null
  }
  photoDerived.set(name, out)
  return out
}
const photoReady = new Set<string>()
const photoWaiters = new Map<string, (() => void)[]>()
let loader: THREE.TextureLoader | null = null

function texBase(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
  return `${env?.BASE_URL ?? '/'}art/textures/buildings/`
}

/** Load (once) a photo texture; `ready` runs when pixels are in. A missing file just never applies. */
function loadPhoto(name: BuildingTex, ready: (t: THREE.Texture) => void): void {
  let base = photoBase.get(name)
  if (!base) {
    loader ??= new THREE.TextureLoader()
    base = loader.load(
      `${texBase()}${name}.jpg`,
      () => {
        photoReady.add(name)
        for (const cb of photoWaiters.get(name) ?? []) cb()
        photoWaiters.delete(name)
      },
      undefined,
      () => photoWaiters.delete(name),
    )
    base.colorSpace = THREE.SRGBColorSpace
    base.wrapS = base.wrapT = THREE.RepeatWrapping
    base.anisotropy = 8
    photoBase.set(name, base)
  }
  const b = base
  if (photoReady.has(name)) ready(b)
  else photoWaiters.set(name, [...(photoWaiters.get(name) ?? []), () => ready(b)])
}

const ALL_TEX: BuildingTex[] = [
  'hangar_cladding', 'warehouse_panels', 'terminal_glass', 'dock_floor', 'tank_steel', 'roof_membrane', 'gravel_yard',
  'terrazzo_floor', 'chevron_stripe', 'apron_concrete', 'asphalt_road', 'airport_grass', 'diamond_plate', 'conveyor_belt',
  'gse_yellow_paint', 'truck_white_panel',
]
/** Resolve once every building photo texture has loaded (or failed / timed out). Icons wait on this. */
export function preloadPhotos(timeoutMs = 5000): Promise<void> {
  if (!hasDom()) return Promise.resolve()
  return new Promise((resolve) => {
    let left = ALL_TEX.length
    const done = () => {
      if (--left <= 0) resolve()
    }
    setTimeout(resolve, timeoutMs)
    for (const n of ALL_TEX) {
      if (photoReady.has(n)) done()
      else loadPhoto(n, () => done())
    }
  })
}

const deriveQueue: (() => void)[] = []
let deriveScheduled = false
/** Run heavy derived-map work one job per idle slot (falls back to a timer). */
function idleDerive(job: () => void): void {
  deriveQueue.push(job)
  if (deriveScheduled) return
  deriveScheduled = true
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const next = () => {
    const j = deriveQueue.shift()
    if (j) j()
    if (deriveQueue.length) schedule()
    else deriveScheduled = false
  }
  const schedule = () => (ric ? ric(next, { timeout: 2000 }) : setTimeout(next, 16))
  schedule()
}

const texMats = new Map<string, THREE.MeshStandardMaterial>()
/**
 * Material tinted by colour that picks up a repeat-wrapped sRGB photo map once it
 * loads. Until then (or in Node, or if the file is absent) it is the plain colour.
 */
/**
 * Call `cb` with a material's photo map once it exists (now if already loaded).
 * Clones made before the photo arrived (construction stages) use this to pick it up.
 * Returns an unsubscribe function.
 */
export function onMaterialMap(src: THREE.Material, cb: (map: THREE.Texture) => void): () => void {
  const m = src as THREE.MeshStandardMaterial
  if (m.map) {
    cb(m.map)
    return () => {}
  }
  const set = (m.userData.mapWaiters ??= new Set()) as Set<(map: THREE.Texture) => void>
  set.add(cb)
  return () => set.delete(cb)
}

export function tmat(name: BuildingTex, color: string, rx = 1, ry = 1, o: MatOpts = {}): THREE.MeshStandardMaterial {
  if (!hasDom()) return mat(color, o)
  const key = `${name}|${rx}|${ry}|${color}|${o.rough ?? 0.6}|${o.metal ?? 0.1}|${o.opacity ?? 1}|${o.emissive ?? ''}|${o.ei ?? 0}`
  let m = texMats.get(key)
  if (!m) {
    const made = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.6,
      metalness: o.metal ?? 0.1,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.ei ?? 0,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
    })
    dress(made, o)
    loadPhoto(name, (base) => {
      const t = base.clone()
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(rx, ry)
      t.needsUpdate = true
      made.map = t
      const img = base.image as (CanvasImageSource & { width: number; height: number }) | undefined
      // Relief maps are a 1024² Sobel pass per photo: run them off the load path, one per idle slot,
      // so page load and first frames aren't blocked (CI page.goto networkidle timeouts on #258).
      if (img && img.width) {
        idleDerive(() => {
          const d = derivedMaps(name, img)
          if (!d) return
          const n = d.normal.clone()
          n.repeat.set(rx, ry)
          n.needsUpdate = true
          const r = d.rough.clone()
          r.repeat.set(rx, ry)
          r.needsUpdate = true
          made.normalMap = n
          made.normalScale.set(0.55, 0.55)
          made.roughnessMap = r
          made.needsUpdate = true
        })
      }
      made.needsUpdate = true
      const waiting = made.userData.mapWaiters as Set<(map: THREE.Texture) => void> | undefined
      if (waiting) for (const cb of waiting) cb(t)
      delete made.userData.mapWaiters
    })
    texMats.set(key, made)
    m = made
  }
  return m
}
