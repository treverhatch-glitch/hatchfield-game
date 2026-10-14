/**
 * Shared procedural kit for building models: cached materials, primitive helpers,
 * canvas signage and type emblems. Everything is safe to call in Node (tests):
 * canvas-backed pieces are skipped when there is no `document`.
 */
import * as THREE from 'three'
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
    mats.set(key, m)
  }
  return m
}

export const M = {
  concrete: () => mat('#b9b5ab', { rough: 0.9 }),
  asphalt: () => mat('#3b3e44', { rough: 0.95 }),
  steel: () => mat('#9aa4ad', { rough: 0.35, metal: 0.7 }),
  darkSteel: () => mat('#4a525b', { rough: 0.45, metal: 0.6 }),
  white: () => mat('#eef1f4', { rough: 0.5 }),
  glass: () => mat('#6fb3dc', { rough: 0.08, metal: 0.5, emissive: '#1a3a55', ei: 0.35 }),
  glow: (c = '#ffe9a8') => mat(c, { emissive: c, ei: 0.9, rough: 0.4 }),
  yellow: () => mat('#e7b52a', { rough: 0.5 }),
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
export function windows(g: THREE.Object3D, w: number, y: number, z: number, n: number, ww = 0.5, wh = 0.5, m = M.glass()): void {
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5)
    box(g, ww, wh, 0.06, m, x, y, z)
  }
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
