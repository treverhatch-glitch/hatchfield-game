/**
 * Round-4 architectural detail pass, applied to every building model after its
 * builder runs. It reads the model's own massing (wall boxes, glazing, lot pad)
 * and dresses it: parapets with metal coping, rooftop HVAC plant, eave gutters
 * and downpipes, plinths, pilaster seams, framed side windows that light at
 * night, wall-pack lamps, kerbed lots with bollards, lamp posts, painted edge
 * lines, drains and oil stains. Placement is deterministic per building id and
 * collision-checked against the original parts so nothing clips the doors or signs.
 *
 * `mergeStatic` then folds every non-moving, unnamed mesh into one mesh per
 * material, so the extra detail costs triangles, not draw calls.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { box, cyl, framedWindow, HALF, M, mat } from './kit'

type Rng = () => number
function rng(seed: string): Rng {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function isAnimated(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (p.userData?.anim) return true
  return false
}

interface Mass {
  mesh: THREE.Mesh
  x: number
  z: number
  w: number
  d: number
  y0: number
  top: number
}

function boxParams(m: THREE.Mesh): { width: number; height: number; depth: number } | null {
  const geo = m.geometry as THREE.BoxGeometry
  if (geo.type !== 'BoxGeometry') return null
  if (m.rotation.x || m.rotation.y || m.rotation.z) return null
  const p = geo.parameters
  return { width: p.width * m.scale.x, height: p.height * m.scale.y, depth: p.depth * m.scale.z }
}

const LIMIT = HALF * 1.04
const inside = (x: number, z: number, r = 0) => Math.abs(x) + r <= LIMIT && Math.abs(z) + r <= LIMIT

export function enrich(g: THREE.Group, id: string): void {
  const r = rng(id)
  g.updateMatrixWorld(true)
  const orig: { mesh: THREE.Mesh; box: THREE.Box3 }[] = []
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) orig.push({ mesh: m, box: new THREE.Box3().setFromObject(m) })
  })
  const added: THREE.Box3[] = []
  const free = (b: THREE.Box3, skip?: THREE.Mesh, pad = 0.02) => {
    const e = b.clone().expandByScalar(pad)
    // Things the new part sits on (roof slabs, pads, flat roof emblems) never block it.
    const floor = b.min.y + 0.04
    for (const o of orig) {
      if (o.mesh === skip || !o.box.intersectsBox(e)) continue
      // Roof emblems are painted on: keep plant off them too.
      if (o.box.max.y > floor || o.mesh.name.startsWith('emblem:')) return false
    }
    for (const a of added) if (a.max.y > floor && a.intersectsBox(e)) return false
    return true
  }
  const claim = (b: THREE.Box3) => added.push(b)
  const bx = (x: number, y: number, z: number, w: number, h: number, d: number) =>
    new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2))

  // ---------- massing: wall boxes on the model root ----------
  const masses: Mass[] = []
  for (const { mesh } of orig) {
    if (mesh.parent !== g || mesh.name || isAnimated(mesh, g)) continue
    const p = boxParams(mesh)
    if (!p) continue
    const mt = mesh.material as THREE.MeshStandardMaterial
    if (Array.isArray(mt) || mt.transparent || (mt.emissiveIntensity ?? 0) > 0.3) continue
    if (p.height < 1.4 || p.width < 1.6 || p.depth < 1.6) continue
    masses.push({ mesh, x: mesh.position.x, z: mesh.position.z, w: p.width, d: p.depth, y0: mesh.position.y - p.height / 2, top: mesh.position.y + p.height / 2 })
  }
  masses.sort((a, b) => b.w * b.d - a.w * a.d)
  for (const ms of masses.slice(0, 5)) dressMass(g, ms, orig, r, free, claim, bx)

  // ---------- glazing: frame any bare glass pane ----------
  const glass = M.glass()
  for (const { mesh } of orig) {
    if (mesh.material !== glass || isAnimated(mesh, g) || mesh.parent !== g) continue
    const p = boxParams(mesh)
    if (!p) continue
    const thinZ = p.depth <= 0.12 && p.width >= 0.3 && p.height >= 0.3
    const thinX = p.width <= 0.12 && p.depth >= 0.3 && p.height >= 0.3
    if (!thinZ && !thinX) continue
    const span = thinZ ? p.width : p.depth
    const y0 = mesh.position.y - p.height / 2
    const f = M.frame()
    const t = 0.05
    const along = (a: number, w: number, h: number, y: number) => {
      if (thinZ) box(g, w, h, 0.09, f, mesh.position.x + a, y, mesh.position.z)
      else box(g, 0.09, h, w, f, mesh.position.x, y, mesh.position.z + a)
    }
    along(0, span + t * 2, t, y0 + p.height)
    along(0, span + t * 2, t, y0 - t)
    along(-span / 2 - t / 2, t, p.height, y0)
    along(span / 2 + t / 2, t, p.height, y0)
    const n = Math.max(0, Math.round(span / 0.75) - 1)
    for (let i = 1; i <= n; i++) along(-span / 2 + (span / (n + 1)) * i, t * 0.7, p.height, y0)
    if (p.height > 0.9) along(0, span, t * 0.7, y0 + p.height * 0.66)
  }

  // ---------- lot: kerbs, bollards, lamps, markings ----------
  const padMesh = orig.find(({ mesh }) => {
    const p = boxParams(mesh)
    return p && mesh.parent === g && p.height <= 0.2 && mesh.position.y < 0.2 && p.width >= HALF * 1.1 && p.depth >= HALF * 1.1
  })?.mesh
  if (padMesh) dressLot(g, padMesh, r, free, claim, bx)
}

function dressMass(
  g: THREE.Group,
  ms: Mass,
  orig: { mesh: THREE.Mesh; box: THREE.Box3 }[],
  r: Rng,
  free: (b: THREE.Box3, skip?: THREE.Mesh, pad?: number) => boolean,
  claim: (b: THREE.Box3) => void,
  bx: (x: number, y: number, z: number, w: number, h: number, d: number) => THREE.Box3,
): void {
  // Roof level: a thin slab sitting on the wall box raises it.
  let roof = ms.top
  let rw = ms.w
  let rd = ms.d
  for (const { mesh, box: b } of orig) {
    const p = boxParams(mesh)
    if (!p || mesh === ms.mesh || p.height > 0.45) continue
    if (Math.abs(b.min.y - ms.top) < 0.12 && Math.abs(mesh.position.x - ms.x) < 0.3 && Math.abs(mesh.position.z - ms.z) < 0.3 && p.width >= ms.w * 0.9) {
      roof = Math.max(roof, b.max.y)
      rw = Math.max(rw, p.width)
      rd = Math.max(rd, p.depth)
    }
  }
  const h = ms.top - ms.y0
  const coping = M.coping()
  // Parapet + coping only if the roof is clear (no arch or sloped cap sits there).
  const roofClear = free(bx(ms.x, roof + 0.02, ms.z, rw * 0.6, 0.3, rd * 0.6), ms.mesh, 0)
  if (roofClear) {
    const t = 0.14
    const ph = 0.32
    const edges: [number, number, number, number][] = [
      [ms.x, ms.z + rd / 2, rw + t, t],
      [ms.x, ms.z - rd / 2, rw + t, t],
      [ms.x - rw / 2, ms.z, t, rd - t * 1.6],
      [ms.x + rw / 2, ms.z, t, rd - t * 1.6],
    ]
    for (const [ex, ez, ew, ed] of edges) {
      const eb = bx(ex, roof, ez, ew, ph, ed)
      if (!free(eb, ms.mesh, 0)) continue
      box(g, ew, ph, ed, coping, ex, roof, ez)
      box(g, ew + 0.04, 0.04, ed + 0.04, M.steel(), ex, roof + ph, ez)
      claim(eb)
    }
    // Skylight strips and a maintenance walkway.
    if (rw * rd > 14) {
      const sl = M.glass()
      for (const k of [-0.22, 0.22]) {
        const sb = bx(ms.x + k * rw, roof, ms.z, rw * 0.12, 0.2, rd * 0.55)
        if (!free(sb, undefined, 0.05)) continue
        claim(sb)
        box(g, rw * 0.12 + 0.08, 0.1, rd * 0.55 + 0.08, M.frame(), ms.x + k * rw, roof, ms.z)
        box(g, rw * 0.12, 0.06, rd * 0.55, sl, ms.x + k * rw, roof + 0.1, ms.z)
      }
      const wb = bx(ms.x, roof, ms.z + rd * 0.3, rw * 0.7, 0.04, 0.35)
      if (free(wb, undefined, 0)) box(g, rw * 0.7, 0.03, 0.35, M.plate(), ms.x, roof, ms.z + rd * 0.3)
    }
    // Rooftop plant: AHUs with fan housings, ducts, a roof hatch, lightning finials.
    const units = Math.min(4, Math.max(1, Math.floor((rw * rd) / 9)))
    let placed = 0
    for (let tries = 0; tries < 18 && placed < units; tries++) {
      const uw = 0.9 + r() * 0.9
      const ud = 0.7 + r() * 0.6
      const ux = ms.x + (r() - 0.5) * (rw - uw - 0.6)
      const uz = ms.z + (r() - 0.5) * (rd - ud - 0.6)
      const b = bx(ux, roof, uz, uw, 0.75, ud)
      if (!free(b, undefined, 0.15)) continue
      claim(b)
      placed++
      const body = mat(r() < 0.5 ? '#c5cacf' : '#a9b1b8', { rough: 0.4, metal: 0.6 })
      box(g, uw + 0.1, 0.08, ud + 0.1, M.darkSteel(), ux, roof, uz) // curb
      box(g, uw, 0.55, ud, body, ux, roof + 0.08, uz)
      for (const k of uw > 1.3 ? [-0.25, 0.25] : [0]) {
        cyl(g, 0.22, 0.22, 0.12, M.darkSteel(), ux + k * uw, roof + 0.63, uz, 16)
        cyl(g, 0.17, 0.17, 0.02, M.black(), ux + k * uw, roof + 0.75, uz, 16)
      }
      for (let i = 0; i < 4; i++) box(g, 0.02, 0.4, ud * 0.8, M.frame(), ux - uw / 2 - 0.01, roof + 0.15, uz - ud * 0.4 + 0.02 + i * 0.01) // louvre
      // Duct run to the parapet.
      const dz = uz > ms.z ? ms.z + rd / 2 - 0.2 : ms.z - rd / 2 + 0.2
      const dl = Math.abs(dz - uz) - ud / 2
      if (dl > 0.2) box(g, 0.3, 0.26, dl, mat('#b8bec4', { rough: 0.35, metal: 0.7 }), ux, roof + 0.05, (uz + Math.sign(dz - uz) * ud / 2 + dz) / 2 + 0)
    }
    if (rw * rd > 8) {
      const hx = ms.x - rw / 2 + 0.7
      const hz = ms.z - rd / 2 + 0.7
      const hb = bx(hx, roof, hz, 0.6, 0.3, 0.6)
      if (free(hb, undefined, 0.05)) {
        claim(hb)
        box(g, 0.6, 0.25, 0.6, M.frame(), hx, roof, hz)
        box(g, 0.66, 0.05, 0.66, M.steel(), hx, roof + 0.25, hz)
      }
    }
    for (const sx of [-1, 1]) cyl(g, 0.025, 0.025, 0.7, M.steel(), ms.x + sx * (rw / 2 - 0.05), roof + 0.3, ms.z - rd / 2, 6)
  }
  // Plinth: darker splash band at the base.
  const plinth = mat('#6f6c66', { rough: 0.9 })
  box(g, ms.w + 0.06, 0.32, 0.04, plinth, ms.x, ms.y0, ms.z - ms.d / 2 - 0.02)
  box(g, 0.04, 0.32, ms.d + 0.06, plinth, ms.x - ms.w / 2 - 0.02, ms.y0, ms.z)
  box(g, 0.04, 0.32, ms.d + 0.06, plinth, ms.x + ms.w / 2 + 0.02, ms.y0, ms.z)
  // Eave gutters front/back and downpipes at the corners.
  const gut = mat('#8b9298', { rough: 0.4, metal: 0.65 })
  for (const sz of [-1, 1]) {
    const gz = ms.z + sz * (ms.d / 2 + 0.07)
    const gb = bx(ms.x, ms.top - 0.12, gz, ms.w, 0.12, 0.12)
    if (free(gb, ms.mesh, 0)) {
      box(g, ms.w + 0.1, 0.12, 0.12, gut, ms.x, ms.top - 0.14, gz)
      for (const sx of [-1, 1]) {
        const px = ms.x + sx * (ms.w / 2 - 0.12)
        const pb = bx(px, ms.y0, gz, 0.08, h, 0.08)
        if (free(pb, ms.mesh, 0)) cyl(g, 0.045, 0.045, h - 0.1, gut, px, ms.y0 + 0.02, gz, 8)
      }
    }
  }
  // Side faces: pilaster seams and a row of framed, night-lit windows.
  const win = M.window()
  for (const sx of [-1, 1]) {
    const fx = ms.x + sx * (ms.w / 2 + 0.03)
    const seams = Math.max(2, Math.round(ms.d / 1.4))
    for (let i = 0; i <= seams; i++) {
      const z = ms.z - ms.d / 2 + (ms.d / seams) * i
      if (free(bx(fx, ms.y0 + 0.3, z, 0.08, h - 0.5, 0.1), ms.mesh, 0)) box(g, 0.07, h - 0.5, 0.1, coping, fx, ms.y0 + 0.32, z)
    }
    if (h >= 2.2 && ms.d >= 2.6) {
      const rows = h > 5 ? Math.min(4, Math.floor((h - 0.8) / 1.5)) : 1
      for (let row = 0; row < rows; row++) {
        const wy = ms.y0 + (rows === 1 ? h * 0.48 : 0.8 + row * 1.5)
        const n = Math.max(1, Math.floor(ms.d / 1.4) - 1)
        for (let i = 0; i < n; i++) {
          if (r() < 0.12) continue
          const z = ms.z - ms.d / 2 + (ms.d / n) * (i + 0.5)
          const wb = bx(fx, wy - 0.1, z, 0.12, 0.9, 0.8)
          if (!free(wb, ms.mesh, 0)) continue
          const holder = new THREE.Group()
          holder.position.set(fx, 0, z)
          holder.rotation.y = sx * Math.PI / 2
          framedWindow(holder, 0.62, 0.7, win, 0, wy, 0.02)
          g.add(holder)
        }
      }
    }
  }
  // Wall-pack lamps over the front.
  const lamp = M.glow('#fff1c9')
  const n = Math.max(1, Math.floor(ms.w / 2.6))
  const ly = Math.min(ms.y0 + h * 0.78, ms.y0 + 2.7)
  for (let i = 0; i < n; i++) {
    const x = ms.x - ms.w / 2 + (ms.w / n) * (i + 0.5)
    const z = ms.z + ms.d / 2 + 0.05
    const lb = bx(x, ly - 0.05, z + 0.05, 0.3, 0.25, 0.2)
    if (!free(lb, ms.mesh, 0.05)) continue
    claim(lb)
    box(g, 0.28, 0.16, 0.14, M.frame(), x, ly, z + 0.04)
    box(g, 0.22, 0.04, 0.1, lamp, x, ly - 0.03, z + 0.06)
  }
}

function dressLot(
  g: THREE.Group,
  padMesh: THREE.Mesh,
  r: Rng,
  free: (b: THREE.Box3, skip?: THREE.Mesh, pad?: number) => boolean,
  claim: (b: THREE.Box3) => void,
  bx: (x: number, y: number, z: number, w: number, h: number, d: number) => THREE.Box3,
): void {
  const p = boxParams(padMesh)!
  const top = padMesh.position.y + p.height / 2
  const w = Math.min(p.width, LIMIT * 2) - 0.1
  const d = Math.min(p.depth, LIMIT * 2) - 0.1
  const kerb = M.kerb()
  const kh = 0.14
  // Raised kerb: full on back and sides, corner returns on the open front.
  box(g, w, kh, 0.18, kerb, 0, top, -d / 2 + 0.09)
  for (const sx of [-1, 1]) {
    box(g, 0.18, kh, d, kerb, sx * (w / 2 - 0.09), top, 0)
    box(g, w * 0.14, kh, 0.18, kerb, sx * (w / 2 - w * 0.07), top, d / 2 - 0.09)
  }
  // Painted safety line inset from the kerb and hatched corners.
  const paint = mat('#e6c13d', { rough: 0.7 })
  const li = 0.45
  box(g, w - li * 2, 0.012, 0.08, paint, 0, top, -d / 2 + li)
  for (const sx of [-1, 1]) box(g, 0.08, 0.012, d - li * 2, paint, sx * (w / 2 - li), top, 0)
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const s = box(g, 0.08, 0.012, 0.7, paint, sx * (w / 2 - li - 0.25 - i * 0.22), top, d / 2 - 0.55)
    s.rotation.y = sx * 0.7
  }
  // Bollards flanking the entrance (yellow with a black reflective band).
  const yel = M.yellow()
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = sx * (w / 2 - w * 0.14 - 0.25 - i * 0.5)
    const z = d / 2 - 0.25
    const b = bx(x, top, z, 0.2, 0.9, 0.2)
    if (!inside(x, z, 0.1) || !free(b)) continue
    claim(b)
    cyl(g, 0.09, 0.09, 0.85, yel, x, top, z, 10)
    cyl(g, 0.095, 0.095, 0.1, M.black(), x, top + 0.6, z, 10)
    cyl(g, 0.06, 0.09, 0.05, yel, x, top + 0.85, z, 10)
  }
  // Lamp posts at the corners (pole, arm, LED head that lights at night).
  const pole = mat('#5a636c', { rough: 0.45, metal: 0.7 })
  const head = M.glow('#fff4d6')
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    for (const inset of [0.35, 0.8, 1.3]) {
      const x = cx * (w / 2 - inset)
      const z = cz * (d / 2 - inset)
      const b = bx(x, top, z, 0.3, 4.2, 0.3)
      if (!free(b)) continue
      claim(b)
      cyl(g, 0.16, 0.18, 0.25, M.concrete(), x, top, z, 10)
      cyl(g, 0.05, 0.07, 3.8, pole, x, top + 0.25, z, 10)
      const ax = -cx * 0.35
      const az = -cz * 0.35
      const arm = box(g, Math.abs(ax) + 0.06, 0.05, 0.06, pole, x + ax / 2, top + 3.95, z)
      arm.rotation.y = 0
      box(g, 0.32, 0.08, 0.16, M.frame(), x + ax, top + 3.92, z + az * 0)
      box(g, 0.26, 0.02, 0.12, head, x + ax, top + 3.9, z)
      break
    }
  }
  // Drainage grates and weathering: oil stains, patch repairs.
  const grate = M.plate()
  for (const sx of [-0.25, 0.25]) box(g, 0.5, 0.015, 0.25, grate, sx * w, top, d / 2 - 0.9)
  const stain = mat('#1c1b19', { rough: 0.3, opacity: 0.32 })
  for (let i = 0; i < 4; i++) {
    const x = (r() - 0.5) * w * 0.7
    const z = d * 0.15 + r() * d * 0.3
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.25 + r() * 0.35, 14), stain)
    s.rotation.x = -Math.PI / 2
    s.position.set(x, top + 0.006 + i * 0.001, z)
    s.scale.set(1, 0.6 + r() * 0.6, 1)
    s.receiveShadow = true
    g.add(s)
  }
  const patch = mat('#9b978f', { rough: 0.95 })
  for (let i = 0; i < 2; i++) box(g, 0.6 + r() * 0.8, 0.008, 0.5 + r() * 0.6, patch, (r() - 0.5) * w * 0.6, top, (r() - 0.5) * d * 0.6)
}

/**
 * Merge every static, unnamed mesh into one mesh per material (keeps moving
 * parts, signs, emblems and named props separate). Returns draw calls saved.
 */
export function mergeStatic(g: THREE.Group): number {
  g.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert()
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>()
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || m.name || Array.isArray(m.material) || isAnimated(m, g)) return
    for (let p = m.parent; p && p !== g; p = p.parent) if (p.name) return
    const geo = m.geometry
    const attrs = Object.keys(geo.attributes).sort().join(',')
    const key = `${m.material.uuid}|${m.castShadow}|${geo.index ? 'i' : 'n'}|${attrs}`
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { mat: m.material, cast: m.castShadow, geos: [], meshes: [] }))
    b.meshes.push(m)
  })
  let saved = 0
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue
    const geos = b.meshes.map((m) => {
      const c = m.geometry.clone()
      c.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
      c.morphAttributes = {}
      c.clearGroups()
      return c
    })
    const merged = mergeGeometries(geos, false)
    for (const c of geos) c.dispose()
    if (!merged) continue
    merged.computeBoundingSphere()
    const mesh = new THREE.Mesh(merged, b.mat)
    mesh.castShadow = b.cast
    mesh.receiveShadow = true
    mesh.userData.merged = b.meshes.length
    for (const m of b.meshes) {
      m.removeFromParent()
      m.geometry.dispose()
    }
    g.add(mesh)
    saved += b.meshes.length - 1
  }
  // Drop now-empty static groups.
  const empties: THREE.Object3D[] = []
  g.traverse((o) => {
    if (o !== g && !(o as THREE.Mesh).isMesh && o.children.length === 0 && !o.userData?.anim && !o.name) empties.push(o)
  })
  for (const e of empties) e.removeFromParent()
  return saved
}
