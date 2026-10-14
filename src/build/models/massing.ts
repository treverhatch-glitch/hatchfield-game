/**
 * Round-5 massing kit: stepped multi-storey blocks with floor bands, ribbon
 * windows, parapets and roof plant; curtain walls; pitched / barrel / sawtooth
 * roofs; canopies on columns; stair cores. Every builder in r5.ts composes these
 * so buildings read as several volumes (like the concept renders), not one box.
 */
import * as THREE from 'three'
import { box, cyl, M, mat, rbox } from './kit'

export type Face = 'front' | 'back' | 'left' | 'right'
export interface BlockOpts {
  x: number
  z: number
  w: number
  d: number
  /** Number of storeys. */
  floors: number
  /** Storey height. */
  fh?: number
  y0?: number
  wall: THREE.Material
  /** Glazing material; ribbon windows per storey. */
  win?: THREE.Material
  /** Faces that get windows. */
  faces?: Face[]
  /** Window ribbon height as a fraction of storey height. */
  ribbon?: number
  /** Vertical mullion spacing. */
  pitch?: number
  /** Projecting floor-slab band colour. */
  band?: THREE.Material | null
  parapet?: boolean
  /** Rooftop plant units (0 = none). */
  plant?: number
  roof?: THREE.Material
  /** Round 9: corner/edge radius for the shell (0 = sharp box, the old look). */
  round?: number
  /** Round 9: curved (barrel) roof of this rise instead of the flat deck. */
  vault?: number
}

/**
 * Round 9: barrel-vault roof spanning d (curving across z), running along x, base at y.
 * Standing-seam ribs and rounded eave fascias, so the roofline reads curved at any distance.
 */
export function vault(g: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, rise: number, m: THREE.Material, alongX = true): void {
  const grp = new THREE.Group()
  grp.position.set(x, y, z)
  if (!alongX) grp.rotation.y = Math.PI / 2
  const span = alongX ? d : w
  const len = alongX ? w : d
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, len, 48, 1, false, -Math.PI / 2, Math.PI), m)
  shell.rotation.z = Math.PI / 2
  shell.scale.set(rise * 2, 1, span)
  shell.castShadow = true
  shell.receiveShadow = true
  grp.add(shell)
  const seam = M.darkSteel()
  const n = Math.max(3, Math.round(len / 0.8))
  for (let i = 0; i <= n; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 6, 32, Math.PI), seam)
    rib.rotation.y = Math.PI / 2
    rib.scale.set(span, rise * 2, 1)
    rib.position.x = -len / 2 + (len / n) * i
    grp.add(rib)
  }
  for (const s of [-1, 1]) {
    const eave = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 12), M.coping())
    eave.rotation.z = Math.PI / 2
    eave.position.set(0, 0.03, (s * span) / 2)
    grp.add(eave)
  }
  g.add(grp)
}

/** One storeyed block. Returns roof height. */
export function block(g: THREE.Object3D, o: BlockOpts): number {
  const fh = o.fh ?? 0.95
  const y0 = o.y0 ?? 0.12
  const h = fh * o.floors
  const rr = o.round ?? 0
  if (rr > 0) rbox(g, o.w, h, o.d, o.wall, o.x, y0, o.z, rr)
  else box(g, o.w, h, o.d, o.wall, o.x, y0, o.z)
  const top = y0 + h
  const roof = o.roof ?? mat('#8d949b', { rough: 0.8 })
  if (o.vault) vault(g, o.x, top - 0.02, o.z, o.w - 0.1, o.d - 0.1, o.vault, mat('#c3c9cf', { rough: 0.35, metal: 0.6 }))
  else if (rr > 0) rbox(g, o.w - 0.12, 0.06, o.d - 0.12, roof, o.x, top - 0.02, o.z, rr * 0.8)
  else box(g, o.w - 0.06, 0.04, o.d - 0.06, roof, o.x, top, o.z)
  const faces = o.faces ?? ['front']
  const win = o.win ?? M.window()
  const rib = o.ribbon ?? 0.5
  const pitch = o.pitch ?? 0.55
  const f = M.frame()
  for (let k = 0; k < o.floors; k++) {
    const wy = y0 + k * fh + fh * (1 - rib) * 0.55
    for (const face of faces) {
      const along = face === 'front' || face === 'back' ? o.w : o.d
      const span = along - 0.4
      const n = Math.max(1, Math.round(span / pitch))
      const put = (a: number, ww: number, hh: number, y: number, depth: number, m: THREE.Material) => {
        if (face === 'front') box(g, ww, hh, depth, m, o.x + a, y, o.z + o.d / 2)
        else if (face === 'back') box(g, ww, hh, depth, m, o.x + a, y, o.z - o.d / 2)
        else if (face === 'left') box(g, depth, hh, ww, m, o.x - o.w / 2, y, o.z + a)
        else box(g, depth, hh, ww, m, o.x + o.w / 2, y, o.z + a)
      }
      put(0, span, fh * rib, wy, 0.05, win)
      for (let i = 0; i <= n; i++) put(-span / 2 + (span / n) * i, 0.04, fh * rib, wy, 0.08, f)
      put(0, span + 0.04, 0.04, wy + fh * rib, 0.09, f)
    }
    if (o.band !== null && k > 0) {
      if (rr > 0) rbox(g, o.w + 0.08, 0.08, o.d + 0.08, o.band ?? M.coping(), o.x, y0 + k * fh - 0.04, o.z, Math.min(rr + 0.04, 0.04 + rr))
      else box(g, o.w + 0.08, 0.07, o.d + 0.08, o.band ?? M.coping(), o.x, y0 + k * fh - 0.035, o.z)
    }
  }
  if (o.parapet !== false && rr > 0 && !o.vault) {
    // Rounded coping rim that follows the shell's corner radius.
    rbox(g, o.w + 0.06, 0.2, o.d + 0.06, M.coping(), o.x, top - 0.02, o.z, rr + 0.03)
  } else if (o.parapet !== false && !o.vault) {
    const c = M.coping()
    const t = 0.1
    const ph = 0.22
    box(g, o.w, ph, t, c, o.x, top, o.z + o.d / 2 - t / 2)
    box(g, o.w, ph, t, c, o.x, top, o.z - o.d / 2 + t / 2)
    box(g, t, ph, o.d - t * 2, c, o.x - o.w / 2 + t / 2, top, o.z)
    box(g, t, ph, o.d - t * 2, c, o.x + o.w / 2 - t / 2, top, o.z)
  }
  for (let i = 0; i < (o.plant ?? 0); i++) {
    const px = o.x + (i % 2 ? 0.25 : -0.25) * o.w
    const pz = o.z + (i < 2 ? -0.2 : 0.18) * o.d
    const uw = Math.min(1.1, o.w * 0.28)
    const ud = Math.min(0.8, o.d * 0.25)
    box(g, uw, 0.45, ud, mat('#b7bec4', { rough: 0.4, metal: 0.6 }), px, top, pz)
    cyl(g, 0.18, 0.18, 0.08, M.darkSteel(), px, top + 0.45, pz, 12)
  }
  return top
}

/** Full-height glass curtain wall on a face with a mullion grid. */
export function curtainWall(g: THREE.Object3D, x: number, z: number, w: number, h: number, y0: number, glass: THREE.Material, cols = 8, rows = 3, rotY = 0): void {
  const grp = new THREE.Group()
  grp.position.set(x, 0, z)
  grp.rotation.y = rotY
  box(grp, w, h, 0.05, glass, 0, y0, 0)
  const f = M.frame()
  for (let i = 0; i <= cols; i++) box(grp, 0.05, h, 0.09, f, -w / 2 + (w / cols) * i, y0, 0.01)
  for (let j = 0; j <= rows; j++) box(grp, w, 0.05, 0.09, f, 0, y0 + (h / rows) * j - (j === rows ? 0.05 : 0), 0.01)
  g.add(grp)
}

/** Gabled / low-pitch roof over w×d (ridge along x). */
export function pitchedRoof(g: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, rise: number, m: THREE.Material, ribs = 0): void {
  const half = d / 2
  const slope = Math.hypot(half, rise)
  const ang = Math.atan2(rise, half)
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, slope + 0.1), m)
    p.position.set(x, y + rise / 2, z + (s * half) / 2)
    p.rotation.x = s * ang
    p.castShadow = true
    p.receiveShadow = true
    g.add(p)
  }
  const sh = new THREE.Shape()
  sh.moveTo(-half, 0)
  sh.lineTo(half, 0)
  sh.lineTo(0, rise)
  sh.closePath()
  for (const sx of [-1, 1]) {
    const gab = new THREE.Mesh(new THREE.ShapeGeometry(sh), m)
    gab.rotation.y = sx * Math.PI / 2
    gab.position.set(x + (sx * w) / 2, y, z)
    g.add(gab)
  }
  for (let i = 0; i < ribs; i++) box(g, 0.05, 0.05, d, M.darkSteel(), x - w / 2 + (w / (ribs + 1)) * (i + 1), y + rise * 0.98, z).scale.set(1, 1, 0.02)
}

/** Sawtooth north-light roof modules along x. */
export function sawtooth(g: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, n: number, m: THREE.Material, glass: THREE.Material): void {
  const step = w / n
  for (let i = 0; i < n; i++) {
    const cx = x - w / 2 + step * (i + 0.5)
    const s = new THREE.Mesh(new THREE.BoxGeometry(step * 1.02, 0.07, d), m)
    s.position.set(cx, y + 0.25, z)
    s.rotation.z = 0.32
    s.castShadow = true
    g.add(s)
    box(g, 0.05, 0.5, d, glass, cx + step / 2 - 0.04, y, z)
  }
}

/** Flat canopy slab on slim columns. */
export function canopy(g: THREE.Object3D, x: number, z: number, w: number, d: number, h: number, slab: THREE.Material, cols: number, colMat: THREE.Material = M.steel(), fascia?: THREE.Material): void {
  box(g, w, 0.14, d, slab, x, h, z)
  if (fascia) box(g, w + 0.04, 0.22, 0.06, fascia, x, h - 0.04, z + d / 2)
  for (let i = 0; i < cols; i++) {
    const cx = x - w / 2 + 0.25 + ((w - 0.5) / Math.max(1, cols - 1)) * i
    cyl(g, 0.06, 0.06, h, colMat, cx, 0.12, z + d / 2 - 0.2, 8)
  }
}

/** Exterior steel stair: stringer + landings, on a face. */
export function stair(g: THREE.Object3D, x: number, z: number, h: number, rotY = 0): void {
  const grp = new THREE.Group()
  grp.position.set(x, 0, z)
  grp.rotation.y = rotY
  const s = M.darkSteel()
  const flights = Math.max(1, Math.round(h / 0.95))
  for (let i = 0; i < flights; i++) {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.35), s)
    fl.position.set(i % 2 ? 0.3 : -0.3, 0.12 + (i + 0.5) * (h / flights), 0.2)
    fl.rotation.z = (i % 2 ? -1 : 1) * 0.75
    grp.add(fl)
    box(grp, 0.4, 0.04, 0.38, s, i % 2 ? -0.75 : 0.75, 0.12 + (i + 1) * (h / flights) - 0.04, 0.2)
  }
  box(grp, 0.04, h, 0.04, s, -0.95, 0.12, 0.38)
  box(grp, 0.04, h, 0.04, s, 0.95, 0.12, 0.38)
  g.add(grp)
}

/** Painted ground line strip (markings, bay lines). */
export function paint(g: THREE.Object3D, x: number, z: number, w: number, d: number, m: THREE.Material = M.yellow(), y = 0.125): void {
  box(g, w, 0.012, d, m, x, y, z)
}

/** Hatched box (red/yellow) marking on the pad. */
export function hatch(g: THREE.Object3D, x: number, z: number, w: number, d: number, color = '#c0392b', y = 0.125): void {
  const m = mat(color, { rough: 0.6 })
  paint(g, x, z - d / 2, w, 0.07, m, y)
  paint(g, x, z + d / 2, w, 0.07, m, y)
  paint(g, x - w / 2, z, 0.07, d, m, y)
  paint(g, x + w / 2, z, 0.07, d, m, y)
  const n = Math.max(2, Math.round(w / 0.5))
  for (let i = 1; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, Math.min(d, w / n) * 1.4), m)
    s.position.set(x - w / 2 + (w / n) * i, y + 0.006, z)
    s.rotation.y = 0.7
    g.add(s)
  }
}
