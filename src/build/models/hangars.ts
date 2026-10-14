/**
 * Hangar family, one model per tier (regional / widebody / jumbo).
 * Door sizes come from the tier's design aircraft (HANGAR_DESIGN in ../fleet):
 * door width >= span + 2 m and door height >= tail + 1 m at that tier's lot scale.
 * Small reuses the round-5 barrel-roof line hangar; wide and jumbo get their own massing.
 */
import * as THREE from 'three'
import { animate } from '../anim'
import { HANGAR_DESIGN, lotScale, mPerUnit, mPerUnitY } from '../fleet'
import { box, cyl, emblem, HALF, M, mat, pad, rbox, sign, tmat } from './kit'
import { block, curtainWall, hatch, paint, stair } from './massing'
import { hangarR5 } from './r5'

const concreteWall = () => mat('#c9c6bf', { rough: 0.8 })
const greyPanel = () => tmat('warehouse_panels', '#9ea5ac', 4, 1, { rough: 0.55, metal: 0.3 })

/** Smallest door (model units) that clears a tier's design aircraft, plus margin. */
export function doorMin(tier: 'small' | 'wide' | 'jumbo'): { w: number; h: number } {
  const s = lotScale('hangar', tier)
  const [span, tail] = HANGAR_DESIGN[tier]
  return { w: (span + 2) / mPerUnit(s), h: (tail + 1) / mPerUnitY(s) }
}

function lamp(g: THREE.Group, x: number, z: number, h = 3.6): void {
  cyl(g, 0.05, 0.07, h, mat('#5a636c', { rough: 0.45, metal: 0.7 }), x, 0.12, z, 8)
  box(g, 0.34, 0.08, 0.16, M.frame(), x, 0.12 + h, z)
  box(g, 0.28, 0.02, 0.12, M.glow('#fff4d6'), x, 0.1 + h, z)
}

/** Sliding leaves, a dark bay behind, and the userData door the bay test reads. */
function doors(g: THREE.Group, dw: number, dh: number, hx: number, fz: number, leaves: number, color: string): void {
  g.userData.hangarDoor = { w: dw, h: dh, x: hx, z: fz }
  box(g, dw, dh, 0.04, mat('#24272b'), hx, 0.12, fz - 0.08)
  for (let i = 0; i < leaves; i++) {
    const x = hx - dw / 2 + (dw / leaves) * (i + 0.5)
    const leaf = box(g, dw / leaves - 0.05, dh, 0.08, mat(color, { rough: 0.5, metal: 0.45 }), x, 0.12, fz + 0.02 - (i % 2) * 0.09)
    // Horizontal panel seams + a window strip on each leaf.
    for (let k = 1; k < 4; k++) box(leaf, dw / leaves - 0.07, 0.02, 0.1, M.frame(), 0, -dh / 2 + (dh / 4) * k, 0)
    box(leaf, dw / leaves - 0.25, 0.14, 0.1, M.window(), 0, dh * 0.22, 0)
    animate(leaf, { kind: 'slide', signal: 'hangarBusy', axis: 'x', amount: (x - hx < 0 ? -1 : 1) * (dw / 2 - Math.abs(x - hx)) * 0.9 })
  }
}

/** Widebody (787/A350): portal-frame shed, shallow gable roof, tail-dock notch over the door. */
export function hangarWide(g: THREE.Group): void {
  const need = doorMin('wide')
  pad(g, HALF * 2, HALF * 2, tmat('apron_concrete', '#cfcdc6', 4, 4, { rough: 0.9 }))
  const w = 8.6
  const d = 6.0
  const cz = -1.25
  const fz = cz + d / 2
  const dw = Math.max(need.w + 0.1, 7.7)
  const dh = Math.max(need.h + 0.08, 3.55)
  const eave = dh + 0.55
  const clad = tmat('hangar_cladding', '#c3cad1', 5, 1, { rough: 0.45, metal: 0.45 })
  // Side + rear walls (front is all door + header).
  box(g, 0.22, eave, d, clad, -w / 2 + 0.11, 0.12, cz)
  box(g, 0.22, eave, d, clad, w / 2 - 0.11, 0.12, cz)
  box(g, w, eave, 0.22, clad, 0, 0.12, cz - d / 2 + 0.11)
  // Deep door-header girder with a lattice face.
  const hdr = eave - dh
  box(g, w, hdr, 0.5, mat('#dfe3e7', { rough: 0.45, metal: 0.4 }), 0, 0.12 + dh, fz - 0.2)
  for (let i = 0; i < 12; i++) {
    const x = -w / 2 + 0.35 + ((w - 0.7) / 11) * i
    const brace = box(g, 0.05, hdr * 1.1, 0.04, M.darkSteel(), x, 0.12 + dh, fz + 0.06)
    brace.rotation.z = i % 2 ? 0.55 : -0.55
  }
  // Shallow gable roof (two pitched planes) with a ridge vent.
  const rise = 0.75
  const half = w / 2 + 0.2
  const slope = Math.hypot(half, rise)
  const ang = Math.atan2(rise, half)
  const roofM = tmat('roof_membrane', '#aeb5bc', 4, 2, { rough: 0.6, metal: 0.35 })
  for (const s of [-1, 1]) {
    const p = box(g, slope, 0.12, d + 0.4, roofM, (s * half) / 2, 0.12 + eave + rise / 2 - 0.06, cz)
    p.rotation.z = -s * ang
  }
  box(g, 0.5, 0.16, d * 0.92, M.glass(), 0, 0.12 + eave + rise - 0.04, cz)
  // Gable infill at the back.
  const tri = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)])
  const gable = new THREE.Mesh(new THREE.ShapeGeometry(tri), clad)
  gable.position.set(0, 0.12 + eave, cz - d / 2)
  gable.rotation.y = Math.PI
  g.add(gable)
  const front = gable.clone()
  front.position.z = fz + 0.05
  front.rotation.y = 0
  g.add(front)
  // Tail-dock notch: a raised slot above centre for the fin, with its own small leaf.
  box(g, 1.1, 0.55, 0.12, mat('#4a5562', { rough: 0.5, metal: 0.45 }), 0, 0.12 + dh, fz + 0.12)
  sign(g, 'WIDEBODY MX', '#3d6a8a', '#ffffff', 2.6, 0.38, -2.4, 0.12 + dh + hdr * 0.45, fz + 0.12)
  doors(g, dw, dh, 0, fz, 6, '#5f6d7b')
  // Wall ribs + high strip glazing on the sides.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) box(g, 0.04, eave, 0.08, M.coping(), s * (w / 2 + 0.01), 0.12, cz - d / 2 + (d / 6) * i)
    box(g, 0.04, 0.32, d * 0.85, M.window(), s * (w / 2 + 0.02), 0.12 + eave - 0.6, cz)
  }
  // Rear two-storey workshop lean-to and roof plant.
  block(g, { x: 2.6, z: cz - d / 2 - 0.45, w: 3.2, d: 0.9, floors: 2, fh: 0.85, wall: concreteWall(), faces: ['right'], win: M.window() })
  for (const x of [-2.4, -1.4]) rbox(g, 0.7, 0.4, 0.7, M.steel(), x, 0.12 + eave + 0.2, cz - 1.8, 0.08)
  // Apron: lead-in, stop bar, wingtip clearance lines, GPU pits.
  paint(g, 0, fz + 0.9, 0.16, 1.5)
  paint(g, 0, fz + 0.35, dw * 0.9, 0.1)
  for (const s of [-1, 1]) paint(g, s * (dw / 2 - 0.1), fz + 0.9, 0.08, 1.4, M.red())
  hatch(g, -3.6, 3.9, 1.6, 1.0)
  hatch(g, 3.6, 3.9, 1.6, 1.0)
  emblem(g, 'wrench', '#3d6a8a', 0.6, w / 2 - 0.6, 0.12 + dh + hdr * 0.5, fz + 0.12)
  lamp(g, -4.3, 4.3)
  lamp(g, 4.3, 4.3)
}

/** Jumbo (A380/747-8): flat-roof cantilever hall with a giant box-girder header and roof monitors. */
export function hangarJumbo(g: THREE.Group): void {
  const need = doorMin('jumbo')
  pad(g, HALF * 2, HALF * 2, tmat('apron_concrete', '#cfcdc6', 5, 5, { rough: 0.9 }))
  const w = 8.9
  const d = 6.5
  const cz = -1.05
  const fz = cz + d / 2
  const dw = Math.max(need.w + 0.3, 8.1)
  const dh = Math.max(need.h + 0.1, 4.2)
  const hdr = 1.3
  const eave = dh + hdr
  const clad = tmat('hangar_cladding', '#b7bfc7', 6, 1, { rough: 0.45, metal: 0.5 })
  box(g, 0.25, eave, d, clad, -w / 2 + 0.12, 0.12, cz)
  box(g, 0.25, eave, d, clad, w / 2 - 0.12, 0.12, cz)
  box(g, w, eave, 0.25, clad, 0, 0.12, cz - d / 2 + 0.12)
  // Flat roof deck, parapet and three saw-tooth roof monitors.
  box(g, w + 0.2, 0.18, d + 0.2, tmat('roof_membrane', '#9aa1a8', 4, 3, { rough: 0.65 }), 0, 0.12 + eave, cz)
  for (const z of [cz - 2.0, cz, cz + 2.0]) {
    box(g, w - 1.2, 0.35, 0.7, M.frame(), 0, 0.3 + eave, z)
    box(g, w - 1.3, 0.28, 0.04, M.glass(), 0, 0.33 + eave, z + 0.36)
  }
  // Giant cantilever box girder over the door, with a Warren-truss face and gold band.
  box(g, w + 0.3, hdr, 0.9, mat('#e4e7ea', { rough: 0.4, metal: 0.45 }), 0, 0.12 + dh, fz - 0.35)
  for (let i = 0; i < 16; i++) {
    const x = -w / 2 + 0.3 + ((w - 0.6) / 15) * i
    const b = box(g, 0.06, hdr * 1.15, 0.05, M.darkSteel(), x, 0.12 + dh - 0.05, fz + 0.12)
    b.rotation.z = i % 2 ? 0.5 : -0.5
  }
  box(g, w + 0.32, 0.14, 0.92, mat('#c9a227', { rough: 0.35, metal: 0.6 }), 0, 0.12 + eave - 0.16, fz - 0.35)
  sign(g, 'A380 HANGAR', '#1d2126', '#c9a227', 3.2, 0.5, 0, 0.12 + dh + 0.18, fz + 0.15)
  doors(g, dw, dh, 0, fz, 8, '#4f5a66')
  // Door pocket towers either side where the leaves stack.
  for (const s of [-1, 1]) {
    box(g, 0.45, eave + 0.5, 1.3, concreteWall(), s * (w / 2 + 0.05), 0.12, fz - 0.45)
    for (let k = 0; k < 5; k++) box(g, 0.05, 0.4, 0.6, M.window(), s * (w / 2 + 0.29), 0.5 + k * 0.95, fz - 0.45)
    box(g, 0.5, 0.12, 1.35, M.coping(), s * (w / 2 + 0.05), 0.62 + eave, fz - 0.45)
    for (let i = 0; i < 8; i++) box(g, 0.05, eave, 0.08, M.coping(), s * (w / 2 + 0.01), 0.12, cz - d / 2 + (d / 7) * i)
  }
  // Rear four-storey engineering block and stair tower poking above the roof.
  block(g, { x: -2.4, z: cz - d / 2 - 0.5, w: 3.6, d: 1.0, floors: 4, fh: 0.85, wall: greyPanel(), faces: ['left'], plant: 1, win: M.window() })
  stair(g, 3.6, cz - d / 2 - 0.4, eave, Math.PI)
  curtainWall(g, 0, cz - d / 2 - 0.02, 3.0, 0.8, 0.12 + eave - 1.2, M.glass(), 8, 1, Math.PI)
  // Apron: A380 lead-in, nose stop bars by type, wingtip lines, tail-stand marks.
  paint(g, 0, fz + 0.75, 0.2, 1.2)
  for (const dz of [0.25, 0.55]) paint(g, 0, fz + dz, dw * 0.85, 0.08)
  for (const s of [-1, 1]) paint(g, s * (dw / 2 - 0.12), fz + 0.75, 0.1, 1.2, M.red())
  hatch(g, -3.9, 3.95, 1.2, 0.9)
  hatch(g, 3.9, 3.95, 1.2, 0.9)
  emblem(g, 'wrench', '#c9a227', 0.8, -3.4, 0.12 + dh + 0.45, fz + 0.15)
  lamp(g, -4.35, 4.35, 4.2)
  lamp(g, 4.35, 4.35, 4.2)
}

/** Regional / line hangar: the round-5 barrel roof with office wing. */
export function hangarSmall(g: THREE.Group): void {
  hangarR5(g, 'small')
}

export function hangarTiered(g: THREE.Group, tier: 'small' | 'wide' | 'jumbo'): void {
  if (tier === 'jumbo') hangarJumbo(g)
  else if (tier === 'wide') hangarWide(g)
  else hangarSmall(g)
}
