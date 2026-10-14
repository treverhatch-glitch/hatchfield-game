/**
 * Round-8 "de-box" pass for buildings (desktop target, no quality gate):
 *  - every large box gets rounded, bevelled edges with smooth normals (RoundedBoxGeometry);
 *  - main walls get chamfered corner posts, a plinth, a fascia trim line, a parapet with
 *    coping, eave gutters and downpipes at the corners;
 *  - glazing gets aluminium frames and mullions; vehicle doors get a deep reveal (recess);
 *  - the largest flat roof gets a curved roofline (barrel vault) on some ids and a curved
 *    entrance canopy, so the silhouettes vary instead of reading as plain cuboids.
 * Deterministic per model id. Animated parts are never altered, only framed.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { M, box, mat, sign } from './kit'
import { SERVICE_POINTS } from '../servicePoints'

/** Short names for the lit blade signs. */
const BLADE: Record<string, string> = {
  fuel: 'FUEL', fuel_farm_iii: 'FUEL', fire: 'ARFF', cargo: 'CARGO', kitchen: 'CATERING', snack: 'CATERING', bags: 'BAGGAGE',
  deice: 'DE-ICE', termbus: 'BUS', xferbus: 'BUS', bus: 'BUS', hangar: 'HANGAR', hangar_w: 'HANGAR', hangar_j: 'HANGAR', mro: 'MRO', tower: 'ATC',
}

const GLASS_HEX = new Set([0x5d8fb0, 0x6fb3dc])
const v = new THREE.Vector3()

function hashId(id: string): number {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h
}

function isGlass(m: THREE.Mesh): boolean {
  const mt = m.material as THREE.MeshStandardMaterial
  return !Array.isArray(mt) && !!mt?.color && GLASS_HEX.has(mt.color.getHex())
}

function hpipe(g: THREE.Object3D, len: number, r: number, m: THREE.Material, x: number, y: number, z: number, alongX: boolean) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10, 1, false, 0, Math.PI), m)
  p.rotation.set(alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0)
  p.position.set(x, y, z)
  p.castShadow = true
  g.add(p)
}

function vpipe(g: THREE.Object3D, h: number, r: number, m: THREE.Material, x: number, y: number, z: number, seg = 10) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m)
  p.position.set(x, y + h / 2, z)
  p.castShadow = true
  p.receiveShadow = true
  g.add(p)
}

/** Frame strips around a thin face-aligned box (window or door), plus optional mullions. */
function frame(g: THREE.Object3D, b: THREE.Box3, t: number, m: THREE.Material, mullion: number, depth: number): number {
  const s = b.getSize(new THREE.Vector3())
  const c = b.getCenter(new THREE.Vector3())
  const facingZ = s.z <= s.x
  const w = facingZ ? s.x : s.z
  const d = Math.max(facingZ ? s.z : s.x, 0.02) + depth
  const mk = (sw: number, sh: number, ox: number, oy: number) => {
    if (facingZ) box(g, sw, sh, d, m, c.x + ox, b.min.y + oy, c.z)
    else box(g, d, sh, sw, m, c.x, b.min.y + oy, c.z + ox)
  }
  mk(w + t * 2, t, 0, Math.max(-t, -b.min.y)) // sill, never below ground
  mk(w + t * 2, t, 0, s.y) // head
  mk(t, s.y, -w / 2 - t / 2, 0)
  mk(t, s.y, w / 2 + t / 2, 0)
  let n = 4
  if (mullion > 0) {
    const k = Math.max(1, Math.round(w / mullion))
    for (let i = 1; i < k; i++) { mk(t * 0.55, s.y, -w / 2 + (w / k) * i, 0); n++ }
    if (s.y > 0.7) { mk(w, t * 0.5, 0, s.y * 0.62); n++ }
  }
  return n
}

/** Four strips around a footprint at height y (outset `o`, strip height h). */
function ring(g: THREE.Object3D, b: THREE.Box3, h: number, o: number, m: THREE.Material, y: number) {
  const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2
  box(g, sx + o * 2, h, o, m, cx, y, b.min.z - o / 2)
  box(g, sx + o * 2, h, o, m, cx, y, b.max.z + o / 2)
  box(g, o, h, sz, m, b.min.x - o / 2, y, cz)
  box(g, o, h, sz, m, b.max.x + o / 2, y, cz)
}

/** Swap plain boxes for rounded boxes with smooth shading. Returns the count. */
export function softenBoxes(g: THREE.Group): number {
  let n = 0
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || m.geometry instanceof RoundedBoxGeometry || !(m.geometry instanceof THREE.BoxGeometry)) return
    const { width, height, depth } = (m.geometry as THREE.BoxGeometry).parameters
    const lo = Math.min(width, height, depth)
    if (lo < 0.06 || Math.max(width, height, depth) < 0.3) return
    const r = Math.min(0.32, lo * 0.2)
    const geo = new RoundedBoxGeometry(width, height, depth, lo > 0.6 ? 4 : 2, r)
    m.geometry.dispose()
    m.geometry = geo
    n++
  })
  return n
}

let CANOPY: THREE.MeshStandardMaterial | null = null
const canopyMat = () => {
  if (!CANOPY) { CANOPY = mat('#e9edf0', { rough: 0.4, metal: 0.3 }).clone(); CANOPY.side = THREE.DoubleSide }
  return CANOPY
}

export function architecture(g: THREE.Group, id: string): number {
  g.updateMatrixWorld(true)
  const h = hashId(id)
  const walls: { m: THREE.Mesh; b: THREE.Box3; roofOnly?: boolean }[] = []
  const glass: THREE.Box3[] = []
  const doors: THREE.Box3[] = []
  const roofs: { m: THREE.Mesh; b: THREE.Box3 }[] = []
  const all: THREE.Object3D[] = []
  g.traverse((o) => { if (o !== g) all.push(o) })
  for (const o of all) {
    const m = o as THREE.Mesh
    if (!m.isMesh) continue
    let animParent = false
    for (let p = o.parent; p && p !== g; p = p.parent) if (p.userData.anim) animParent = true
    if (animParent) continue
    const b = new THREE.Box3().setFromObject(m)
    const s = b.getSize(v)
    if (m.userData.anim) {
      if (s.y > 0.8 && Math.min(s.x, s.z) < 0.3) doors.push(b)
      continue
    }
    if (!(m.geometry instanceof THREE.BoxGeometry)) continue
    if (isGlass(m) && Math.min(s.x, s.z) < 0.25 && s.y > 0.2) glass.push(b)
    else if (s.y > 1.4 && s.x > 2.5 && s.z > 1.5 && b.min.y < 0.2) walls.push({ m, b })
    else if (s.y < 0.45 && s.x > 2 && s.z > 1.5 && b.min.y > 1) roofs.push({ m, b })
  }
  for (const r of roofs) {
    const rb = r.b
    const covered = walls.some(({ b }) => b.min.x <= rb.min.x + 0.3 && b.max.x >= rb.max.x - 0.3 && b.min.z <= rb.min.z + 0.3 && b.max.z >= rb.max.z - 0.3 && Math.abs(b.max.y - rb.min.y) < 0.6)
    if (covered) continue
    const mass = new THREE.Box3(new THREE.Vector3(rb.min.x + 0.05, 0, rb.min.z + 0.05), new THREE.Vector3(rb.max.x - 0.05, rb.max.y, rb.max.z - 0.05))
    walls.push({ m: r.m, b: mass, roofOnly: true })
  }
  let n = 0
  const coping = M.coping()
  const trim = M.frame()
  const gutter = mat('#8a9097', { rough: 0.4, metal: 0.65 })
  const plinth = M.concrete()
  for (const { m, b, roofOnly } of walls) {
    const s = b.getSize(new THREE.Vector3())
    const cx = (b.min.x + b.max.x) / 2
    const cz = (b.min.z + b.max.z) / 2
    const top = b.max.y
    const wallMat = m.material as THREE.Material
    // Chamfered/rounded corners: a column of wall material softens each vertical arris.
    const cr = Math.min(0.16, Math.min(s.x, s.z) * 0.06)
    if (!roofOnly) {
      for (const [x, z] of [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z]]) {
        vpipe(g, s.y * 0.98, cr, wallMat, x, b.min.y, z, 16)
        n++
      }
      // Plinth ring and fascia trim line (perimeter strips, not slabs, so open bays stay clear).
      ring(g, b, 0.16, 0.06, plinth, b.min.y)
      ring(g, b, 0.07, 0.04, trim, top - s.y * 0.14)
      n += 8
    } else {
      // Fascia under the roof edge.
      ring(g, b, 0.08, 0.03, trim, top - 0.1)
      n += 4
    }
    // Parapet with coping lip.
    const pt = 0.09, ph = 0.24
    box(g, s.x + 0.06, ph, pt, coping, cx, top, b.min.z + pt / 2 - 0.03)
    box(g, s.x + 0.06, ph, pt, coping, cx, top, b.max.z - pt / 2 + 0.03)
    box(g, pt, ph, s.z, coping, b.min.x + pt / 2 - 0.03, top, cz)
    box(g, pt, ph, s.z, coping, b.max.x - pt / 2 + 0.03, top, cz)
    ring(g, new THREE.Box3(new THREE.Vector3(b.min.x - 0.07, 0, b.min.z - 0.07), new THREE.Vector3(b.max.x + 0.07, 0, b.max.z + 0.07)), 0.04, 0.12, trim, top + ph)
    n += 8
    // Gutters along the long eaves, downpipes at the corners.
    hpipe(g, s.x, 0.055, gutter, cx, top - 0.02, b.max.z + 0.07, true)
    hpipe(g, s.x, 0.055, gutter, cx, top - 0.02, b.min.z - 0.07, true)
    for (const [x, z] of [[b.min.x + 0.12, b.max.z + 0.07], [b.max.x - 0.12, b.max.z + 0.07], [b.min.x + 0.12, b.min.z - 0.07], [b.max.x - 0.12, b.min.z - 0.07]]) {
      vpipe(g, top - b.min.y, 0.035, gutter, x, b.min.y, z)
      n++
    }
    n += 2
  }
  for (const b of glass) n += frame(g, b, 0.045, trim, 0.55, 0.03)
  const lamps = (g.userData.lamps ??= []) as number[][]
  const glow = M.glow('#fff1cf')
  for (const b of doors) {
    n += frame(g, b, 0.12, M.darkSteel(), 0, 0.22) // deep reveal: the door reads as recessed
    // Wall-pack light over each vehicle door, registered for night lighting.
    const c = b.getCenter(new THREE.Vector3())
    const s = b.getSize(new THREE.Vector3())
    const facingZ = s.z <= s.x
    box(g, facingZ ? 0.34 : 0.16, 0.1, facingZ ? 0.16 : 0.34, glow, c.x, b.max.y + 0.2, c.z)
    lamps.push([c.x, b.max.y + 0.25, c.z])
    n++
  }
  // Curved roofline and entrance canopy on the main mass (hangars already have arches).
  const main = walls.map((w) => w.b).sort((a, c) => c.getSize(v).x * c.getSize(v).z - a.getSize(v).x * a.getSize(v).z)[0]
  if (main && !/^(hangar|mro)/.test(id)) {
    const s = main.getSize(new THREE.Vector3())
    const cx = (main.min.x + main.max.x) / 2
    const cz = (main.min.z + main.max.z) / 2
    if (h % 3 !== 0 && s.z < 6) {
      // Low barrel vault, standing-seam metal, inset inside the parapet.
      const r = s.z * 0.5
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(r, r, s.x - 0.3, 32, 1, false, -Math.PI / 2, Math.PI), mat('#c6ccd2', { rough: 0.35, metal: 0.6 }))
      vault.rotation.z = Math.PI / 2
      vault.scale.set(0.22, 1, 0.94)
      vault.position.set(cx, main.max.y + 0.05, cz)
      vault.castShadow = true
      vault.receiveShadow = true
      g.add(vault)
      n++
    }
    // Curved canopy over the +z face centre.
    const cw = Math.min(3, s.x * 0.4)
    const canX = cx + (((h >> 3) & 1) ? s.x * 0.2 : -s.x * 0.2)
    const blocked = id in SERVICE_POINTS || doors.some((d) => d.max.z > main.max.z - 0.6 && d.min.x < canX + cw / 2 + 0.3 && d.max.x > canX - cw / 2 - 0.3)
    if (!blocked) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, cw, 24, 1, true, 0, Math.PI / 2), canopyMat())
    can.rotation.z = Math.PI / 2
    can.position.set(canX, Math.min(main.max.y - 0.6, 2.2) - 0.55, main.max.z)
    can.castShadow = true
    g.add(can)
    for (const side of [-1, 1]) vpipe(g, Math.min(main.max.y - 0.6, 2.2), 0.04, trim, can.position.x + side * (cw / 2 - 0.1), 0, main.max.z + 0.5)
    n += 3
    lamps.push([can.position.x, can.position.y + 0.6, main.max.z + 0.5])
    }
    // Lit blade sign on the front corner (two faces), and a soffit downlight under the canopy.
    const label = BLADE[id.replace(/_(lg|sm)$/, '')]
    if (label) {
      const bx = main.max.x + 0.06
      const by = Math.max(1.2, main.max.y * 0.55)
      const bz = main.max.z - 0.5
      box(g, 0.08, 1.15, 0.5, M.frame(), bx + 0.02, by - 0.05, bz)
      const a = sign(g, label, '#13324f', '#ffffff', 1.0, 0.36, bx + 0.07, by + 0.5, bz, Math.PI / 2)
      a.rotation.z = Math.PI / 2
      const b2 = sign(g, label, '#13324f', '#ffffff', 1.0, 0.36, bx - 0.03, by + 0.5, bz, -Math.PI / 2)
      b2.rotation.z = -Math.PI / 2
      lamps.push([bx + 0.4, by + 0.6, bz])
      n += 3
    }
  }
  return n
}
