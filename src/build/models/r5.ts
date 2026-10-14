/**
 * Round-5 builders for the ten buildings that have Gemini concept renders
 * (assets/gemini/buildings/*.jpeg). Each one copies its concept's massing:
 * several stepped volumes, real roof forms, facade rhythm and a working yard.
 * Moving parts keep the same anim signals and points as round 4, and service
 * points (servicePoints.ts) stay clear.
 */
import * as THREE from 'three'
import { animate } from '../anim'
import { box, CELL, cyl, emblem, HALF, M, mat, pad, pipe, sign, tmat } from './kit'
import { block, canopy, curtainWall, hatch, paint, pitchedRoof, sawtooth, stair } from './massing'

const concreteWall = () => mat('#c9c6bf', { rough: 0.8 })
const greyPanel = () => tmat('warehouse_panels', '#9ea5ac', 4, 1, { rough: 0.55, metal: 0.3 })

function lampPost(g: THREE.Group, x: number, z: number, h = 3.6): void {
  const pole = mat('#5a636c', { rough: 0.45, metal: 0.7 })
  cyl(g, 0.05, 0.07, h, pole, x, 0.12, z, 8)
  box(g, 0.34, 0.08, 0.16, M.frame(), x, 0.12 + h, z)
  box(g, 0.28, 0.02, 0.12, M.glow('#fff4d6'), x, 0.1 + h, z)
  ;((g.userData.lamps ??= []) as number[][]).push([x, 0.1 + h, z])
}

// ---------------------------------------------------------------- hangar
/** Arched maintenance hangar flanked by concrete door pylons and a stepped office wing. */
export function hangarR5(g: THREE.Group, tier: 'small' | 'wide' | 'jumbo' = 'small'): void {
  const h = tier === 'jumbo' ? 6.6 : tier === 'wide' ? 5.0 : 3.6
  const accent = tier === 'jumbo' ? '#c9a227' : tier === 'wide' ? '#3d6a8a' : '#7d8c9b'
  pad(g, HALF * 2, HALF * 2, tmat('apron_concrete', '#cfcdc6', 3, 3, { rough: 0.9 }))
  const w = 6.4
  const d = 6.6
  const cz = -1.0
  const fz = cz + d / 2
  const clad = tmat('hangar_cladding', '#bcc4cc', 4, 1, { rough: 0.45, metal: 0.45 })
  const eave = h * 0.62
  // Main shell + side walls with vertical ribs.
  box(g, w, eave, d, clad, 0.4, 0.12, cz)
  // Barrel roof, low rise like the concept.
  const r = w / 2 + 0.2
  const archH = h - eave
  const arch = new THREE.CylinderGeometry(r, r, d + 0.3, 40, 1, true, Math.PI / 2, Math.PI)
  arch.rotateX(Math.PI / 2)
  arch.scale(1, archH / r, 1)
  const roof = new THREE.Mesh(arch, tmat('hangar_cladding', '#d4dbe2', 1, 6, { rough: 0.35, metal: 0.55 }))
  roof.position.set(0.4, 0.12 + eave, cz)
  roof.castShadow = true
  g.add(roof)
  // Arched roof ribs + ridge skylight band.
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.05, 4, 24, Math.PI), M.darkSteel())
    rib.scale.set(1, archH / r, 1)
    rib.position.set(0.4, 0.12 + eave, cz - d / 2 + (d / 5) * i)
    g.add(rib)
  }
  box(g, 0.9, 0.08, d * 0.86, M.glass(), 0.4, 0.12 + h - 0.02, cz)
  // Front gable: arched clerestory glazing above the door, framed fill.
  const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 40, 0, Math.PI), clad)
  cap.scale.set(1, archH / r, 1)
  cap.position.set(0.4, 0.12 + eave, fz + 0.02)
  g.add(cap)
  const back = cap.clone()
  back.position.z = cz - d / 2 - 0.02
  back.rotation.y = Math.PI
  g.add(back)
  const dh = eave * 0.92
  curtainWall(g, 0.4, fz + 0.05, w - 1.0, archH * 0.55, 0.12 + dh + 0.25, M.glass(), 10, 2)
  // Concrete door pylons, taller than the eave (the concept's book-end towers).
  for (const sx of [-1, 1]) {
    const px = 0.4 + sx * (w / 2 + 0.3)
    box(g, 0.75, eave + archH * 0.7, 1.2, concreteWall(), px, 0.12, fz - 0.4)
    for (let k = 0; k < 3; k++) box(g, 0.06, eave * 0.2, 0.5, M.window(), px + sx * 0.38, 0.6 + k * eave * 0.28, fz - 0.4)
    box(g, 0.8, 0.12, 1.25, M.coping(), px, 0.12 + eave + archH * 0.7, fz - 0.4)
  }
  // Door leaves stack outward when an aircraft is in work.
  const leaves = tier === 'jumbo' ? 6 : 4
  const dw = w - 0.3
  box(g, dw, dh, 0.04, mat('#2a2d31'), 0.4, 0.12, fz - 0.06) // bay interior
  for (let i = 0; i < leaves; i++) {
    const x = 0.4 - dw / 2 + (dw / leaves) * (i + 0.5)
    const leaf = box(g, dw / leaves - 0.05, dh, 0.08, mat('#566270', { rough: 0.5, metal: 0.45 }), x, 0.12, fz + 0.02 - (i % 2) * 0.09)
    animate(leaf, { kind: 'slide', signal: 'hangarBusy', axis: 'x', amount: (x - 0.4 < 0 ? -1 : 1) * (dw / 2 - Math.abs(x - 0.4)) * 0.9 })
  }
  box(g, dw + 0.4, 0.34, 0.16, tmat('chevron_stripe', '#ffffff', 6, 1, { rough: 0.4 }), 0.4, 0.12 + dh, fz + 0.04)
  sign(g, tier === 'jumbo' ? 'HANGAR J' : tier === 'wide' ? 'HANGAR W' : 'HANGAR', accent, '#ffffff', 2.4, 0.42, 0.4, 0.12 + dh + 0.36, fz + 0.1)
  box(g, 0.9, 0.9, 0.04, M.white(), 0.4 + w / 2 + 0.3, 0.12 + eave * 0.8, fz + 0.22)
  emblem(g, 'wrench', accent, 0.7, 0.4 + w / 2 + 0.3, 0.12 + eave * 0.8 + 0.1, fz + 0.25)
  // Stepped office / workshop wing down the west side (3 then 2 storeys).
  const ow = 1.7
  const ox = 0.4 - w / 2 - 0.75 - ow / 2 + 0.35
  block(g, { x: ox, z: cz - 1.4, w: ow, d: 3.6, floors: 3, fh: 0.9, wall: concreteWall(), faces: ['left', 'front'], plant: 1, win: M.window() })
  block(g, { x: ox, z: cz + 1.8, w: ow, d: 2.6, floors: 2, fh: 0.9, wall: greyPanel(), faces: ['left', 'front'], win: M.window() })
  stair(g, ox, cz - 3.4, 2.6, Math.PI)
  // Lean-to stores + tank pair on the east side (concept's back corner).
  block(g, { x: 4.1, z: cz - 2.3, w: 0.8, d: 2.4, floors: 1, fh: 1.2, wall: greyPanel(), faces: ['right'], parapet: false })
  for (const z of [-4.0, -3.2]) cyl(g, 0.35, 0.35, 1.5, M.white(), 4.2, 0.12, z, 16)
  // Apron: lead-in line, stop bar, red hatched equipment boxes either side.
  paint(g, 0.4, fz + 0.9, 0.18, 1.4)
  paint(g, 0.4, fz + 0.3, 2.4, 0.12)
  hatch(g, -3.0, 3.6, 2.4, 1.4)
  hatch(g, 3.4, 3.6, 1.8, 1.4)
  lampPost(g, -4.3, 4.3)
  lampPost(g, 4.3, 1.4)
}

// ---------------------------------------------------------------- fuel farm
function tankR5(g: THREE.Object3D, x: number, z: number, r: number, h: number, band = '#2d6a4f') {
  const shell = tmat('tank_steel', '#f1f3f4', 3, 1, { rough: 0.35, metal: 0.45 })
  cyl(g, r, r, h, shell, x, 0.3, z, 36)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 8, 0, Math.PI * 2, 0, Math.PI * 0.16), shell)
  dome.position.set(x, 0.3 + h - r * Math.cos(Math.PI * 0.16), z)
  dome.castShadow = true
  g.add(dome)
  cyl(g, r * 1.006, r * 1.006, 0.12, mat(band, { rough: 0.4 }), x, 0.3 + h * 0.8, z, 36)
  for (let k = 1; k < 4; k++) cyl(g, r * 1.004, r * 1.004, 0.02, M.steel(), x, 0.3 + (h / 4) * k, z, 36)
  const rail = new THREE.Mesh(new THREE.TorusGeometry(r * 0.97, 0.03, 4, 36), M.darkSteel())
  rail.rotation.x = Math.PI / 2
  rail.position.set(x, 0.3 + h + 0.2, z)
  g.add(rail)
  // Spiral stair up the shell.
  for (let i = 0; i < 9; i++) {
    const a = 0.4 + i * 0.32
    box(g, 0.35, 0.05, 0.22, M.darkSteel(), x + Math.cos(a) * (r + 0.13), 0.3 + (h / 9) * i, z + Math.sin(a) * (r + 0.13)).rotation.y = -a
  }
}

/** Tank farm: six tanks of three sizes in a bund, pipe racks, pump house and loading gantry. */
export function fuelFarmR5(g: THREE.Group, heavy = false): void {
  pad(g, HALF * 2, HALF * 2, tmat('gravel_yard', '#b4aea2', 3, 3, { rough: 0.95 }))
  // Bund wall around the tank field (rear two thirds).
  const bw = 8.6
  const bd = 5.6
  const bz = -1.6
  const wall = mat('#a8a397', { rough: 0.95 })
  box(g, bw, 0.5, 0.2, wall, 0, 0.12, bz - bd / 2)
  box(g, bw, 0.5, 0.2, wall, 0, 0.12, bz + bd / 2)
  box(g, 0.2, 0.5, bd, wall, -bw / 2, 0.12, bz)
  box(g, 0.2, 0.5, bd, wall, bw / 2, 0.12, bz)
  box(g, bw - 0.4, 0.04, bd - 0.4, mat('#9c9789', { rough: 1 }), 0, 0.12, bz)
  const tanks: [number, number, number, number][] = [
    [-2.85, -2.9, 1.35, 3.0],
    [0, -2.9, 1.35, 3.0],
    [2.85, -2.9, 1.35, 3.0],
    [-2.6, -0.1, 0.8, 2.0],
    [-0.6, -0.1, 0.7, 1.6],
    ...(heavy ? ([[1.2, -0.1, 0.7, 1.9], [3.4, -1.2, 0.62, 1.8]] as [number, number, number, number][]) : []),
  ]
  for (const [x, z, r, h] of tanks) tankR5(g, x, z, r, h)
  // Pipe rack running across the bund to the pump house.
  const yel = mat('#d4a017', { metal: 0.5, rough: 0.4 })
  for (const x of [-3.6, -1.8, 0, 1.8]) {
    box(g, 0.08, 0.9, 0.08, M.darkSteel(), x, 0.12, 0.9)
    box(g, 0.08, 0.9, 0.08, M.darkSteel(), x, 0.12, 1.3)
    box(g, 0.08, 0.06, 0.5, M.darkSteel(), x, 1.0, 1.1)
  }
  for (const [dz, c] of [[0.95, yel], [1.1, M.steel()], [1.25, M.darkSteel()]] as const)
    pipe(g, { x: -3.8, y: 1.1, z: dz }, { x: 2.6, y: 1.1, z: dz }, 0.06, c)
  for (const [x, z, r] of tanks) pipe(g, { x, y: 0.5, z: z + r }, { x, y: 1.1, z: 0.95 }, 0.05, M.steel())
  // Pump house (2 storey control room over pumps) east of the rack.
  block(g, { x: 3.2, z: 0.4, w: 2.0, d: 1.6, floors: 2, fh: 0.85, wall: concreteWall(), faces: ['front', 'left'], plant: 1 })
  // Pump skid with spinning valve.
  box(g, 1.4, 0.7, 0.8, mat('#2d6a4f', { rough: 0.5 }), 0, 0.12, 2.1)
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 16), M.red())
  valve.position.set(0, 0.98, 2.1)
  valve.rotation.x = Math.PI / 2
  g.add(animate(valve, { kind: 'spin', signal: 'fuelFlow', axis: 'z', rate: 3 }))
  // Truck loading gantry: canopy over the two hose stands (service points ±2.0, z 3.4).
  canopy(g, 0, 3.4, 6.6, 1.8, 2.5, mat('#e9ecef', { rough: 0.4, metal: 0.4 }), 4, M.steel(), mat('#2d6a4f'))
  for (const x of [-2.0, 2.0]) {
    box(g, 0.35, 1.5, 0.35, mat('#2d6a4f'), x, 0.12, 2.35)
    pipe(g, { x, y: 1.5, z: 2.4 }, { x, y: 1.9, z: 3.0 }, 0.07, M.darkSteel())
  }
  sign(g, heavy ? 'FUEL III' : 'JET A-1', '#2d6a4f', '#ffffff', 1.6, 0.36, 0, 2.66, 4.32)
  emblem(g, 'fuel', '#2d6a4f', 1.2, tanks[1][0], 0.3 + tanks[1][3] + 0.22, tanks[1][1], true)
  box(g, 0.7, 0.45, 0.04, M.red(), -3.0, 0.15, bz + bd / 2 + 0.12)
  lampPost(g, -4.3, 2.6)
  lampPost(g, 4.3, 2.6)
}

// ---------------------------------------------------------------- cargo
/** Cargo terminal: long banded shed, 3-storey office end block, dock row with canopies. */
export function cargoR5(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('dock_floor', '#9a9894', 3, 3, { rough: 0.9 }))
  const shed = tmat('warehouse_panels', '#a9aeb3', 5, 1, { rough: 0.6, metal: 0.25 })
  const sw = 5.6
  const sx = -1.1
  const sd = 4.0
  const sz = -1.2
  box(g, sw, 3.4, sd, shed, sx, 0.12, sz)
  // Two-tone horizontal bands like the concept.
  box(g, sw + 0.04, 0.5, sd + 0.04, mat('#5c646c', { rough: 0.5, metal: 0.3 }), sx, 0.12, sz)
  box(g, sw + 0.04, 0.35, sd + 0.04, mat('#d7a43b', { rough: 0.5 }), sx, 3.0, sz)
  box(g, sw + 0.1, 0.12, sd + 0.1, tmat('roof_membrane', '#8d949b', 3, 2), sx, 3.52, sz)
  // Roof: low ridge with plant and a row of skylights.
  pitchedRoof(g, sx, 3.64, sz, sw - 0.3, sd - 0.3, 0.45, mat('#b4bac0', { rough: 0.5, metal: 0.4 }))
  // Office end block: 3 storeys, curtain-wall corner.
  const ox = sx + sw / 2 + 0.8
  const top = block(g, { x: ox, z: sz + 0.4, w: 1.5, d: 3.2, floors: 3, fh: 1.05, wall: concreteWall(), faces: ['front', 'right'], plant: 2 })
  curtainWall(g, ox + 0.1, sz + 2.02, 1.0, top - 0.3, 0.2, M.window(), 3, 3)
  stair(g, ox, sz - 1.3, 2.8, Math.PI)
  // Dock row: canopy, four roll-up doors with levellers (service points x -3,-1,1,3 z 3.3).
  const dz = sz + sd / 2
  box(g, 8.6, 0.85, 1.0, M.concrete(), 0, 0.12, dz + 0.5)
  canopy(g, 0, dz + 0.55, 8.6, 1.2, 2.9, mat('#5c646c', { metal: 0.4 }), 0)
  for (let i = 0; i < 4; i++) {
    const x = -3.0 + i * 2.0
    box(g, 1.6, 1.85, 0.03, mat('#2a2d31'), x, 0.98, dz + 0.01)
    const door = box(g, 1.5, 1.8, 0.06, mat('#5c6f82', { metal: 0.45, rough: 0.45 }), x, 0.98, dz + 0.04)
    animate(door, { kind: 'roll', signal: 'dockActive', amount: 1.8, point: i })
    const lev = new THREE.Group()
    lev.position.set(x, 0.98, dz + 1.0)
    box(lev, 1.3, 0.05, 0.5, M.steel(), 0, 0, 0.25)
    animate(lev, { kind: 'rot', signal: 'dockActive', axis: 'x', amount: 0.35, point: i })
    g.add(lev)
    for (const s of [-0.8, 0.8]) box(g, 0.18, 0.4, 0.16, M.black(), x + s, 0.5, dz + 1.02)
    box(g, 1.6, 0.14, 0.05, M.glow('#ffd27a'), x, 2.72, dz + 0.04)
    box(g, 0.22, 0.22, 0.04, x % 4 === 1 ? M.glow('#3bd16f') : M.glow('#ff3b30'), x + 0.95, 2.2, dz + 0.04)
  }
  // Airside ULD racking against the west wall.
  for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) box(g, 0.75, 0.8, 0.8, mat(j ? '#c3c9cf' : '#b0b8c0', { metal: 0.5, rough: 0.4 }), -4.3, 0.12 + j * 0.85, sz - 1.4 + k * 0.95)
  sign(g, 'CARGO', '#d7a43b', '#1d2126', 2.4, 0.5, sx, 3.05, dz + 0.04)
  emblem(g, 'box', '#8a5a1f', 1.4, ox, top + 0.02, sz + 0.9, true)
  emblem(g, 'box', '#8a5a1f', 0.7, ox + 0.1, top - 0.6, sz + 2.06)
  lampPost(g, -4.3, 4.3)
  lampPost(g, 4.3, 4.3)
}

// ---------------------------------------------------------------- fire station
/** Red-brick two-storey station with white trim, 3 apparatus bays, stepped crew wing, drill tower. */
export function fireStationR5(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('apron_concrete', '#c8c5bd', 3, 3, { rough: 0.9 }))
  const brick = mat('#a8352a', { rough: 0.78 })
  const trim = M.white()
  // Apparatus hall (tall single volume) with crew floor above at the back.
  const hz = -1.4
  box(g, 7.2, 2.9, 4.4, brick, -0.6, 0.12, hz)
  box(g, 7.3, 0.18, 4.5, trim, -0.6, 3.02, hz)
  for (let i = 0; i < 3; i++) {
    const x = -2.8 + i * 2.2
    box(g, 2.0, 2.35, 0.05, trim, x, 0.12, hz + 2.21)
    box(g, 1.8, 2.0, 0.04, mat('#2a2d31'), x, 0.12, hz + 2.2)
    const door = box(g, 1.8, 2.15, 0.06, mat('#d62d20', { rough: 0.4, metal: 0.2 }), x, 0.12, hz + 2.24)
    animate(door, { kind: 'roll', signal: 'fireDispatch', amount: 2.15, point: i })
    for (let k = 1; k < 4; k++) box(g, 1.6, 0.25, 0.02, M.window(), x, 0.3 + k * 0.5, hz + 2.28)
    box(g, 0.4, 0.15, 0.06, M.glow('#ff3b30'), x, 2.55, hz + 2.24)
    box(g, 0.12, 2.6, 0.12, trim, x + 1.08, 0.12, hz + 2.24)
  }
  // Second storey (crew quarters), set back, with window band and white cornice.
  const top = block(g, { x: -0.6, z: hz - 0.8, w: 7.2, d: 2.8, floors: 1, fh: 1.1, y0: 3.2, wall: brick, faces: ['front', 'left'], ribbon: 0.45, pitch: 0.6, band: trim, plant: 2 })
  box(g, 7.3, 0.12, 2.9, trim, -0.6, top - 0.02, hz - 0.8)
  // Stepped admin wing on the east side (2 storeys) with glazed entry.
  block(g, { x: 3.65, z: -0.6, w: 1.5, d: 3.2, floors: 2, fh: 1.2, wall: brick, faces: ['front', 'right'], band: trim, plant: 1 })
  curtainWall(g, 3.65, 1.02, 1.0, 1.0, 0.12, M.glass(), 2, 1)
  // Drill / hose tower.
  box(g, 1.3, 6.0, 1.3, brick, 3.6, 0.12, -3.6)
  box(g, 1.45, 0.18, 1.45, trim, 3.6, 6.12, -3.6)
  for (let k = 0; k < 4; k++) box(g, 0.5, 0.45, 0.05, M.window(), 3.6, 1.3 + k * 1.2, -2.93)
  cyl(g, 0.16, 0.16, 0.35, M.glow('#ff3b30'), 3.6, 6.3, -3.6, 10)
  sign(g, 'FIRE RESCUE', '#d62d20', '#ffffff', 3.2, 0.46, -0.6, 3.25, hz + 2.26)
  emblem(g, 'flame', '#d62d20', 1.0, 3.6, 4.4, -2.92)
  emblem(g, 'flame', '#d62d20', 2.0, -2.0, top + 0.02, hz - 0.8, true)
  // Apron: hatched bay fronts + yellow keep-clear lines.
  for (let i = 0; i < 3; i++) paint(g, -2.8 + i * 2.2, 2.3, 1.8, 0.1)
  hatch(g, -0.6, 3.6, 6.6, 1.0, '#d62d20')
  lampPost(g, -4.3, 2.0)
  lampPost(g, 4.3, 3.6)
}

// ---------------------------------------------------------------- check-in terminal
/** Wave-roofed glass check-in hall with a stepped landside office block and a kerb canopy. */
export function checkinHallR5(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('apron_concrete', '#d9d6cf', 3, 3, { rough: 0.85 }))
  const glass = tmat('terminal_glass', '#bfe0f2', 4, 1, { rough: 0.05, metal: 0.55, emissive: '#2a5a80', ei: 0.4, opacity: 0.9 })
  // Hall: glass box set on a stone plinth.
  box(g, 8.4, 0.3, 5.4, mat('#d8d3c8', { rough: 0.6 }), 0, 0.12, -1.1)
  box(g, 8.0, 3.4, 4.8, mat('#e4e9ee', { rough: 0.5 }), 0, 0.42, -1.4)
  curtainWall(g, 0, 1.02, 8.0, 3.2, 0.42, glass, 12, 3)
  curtainWall(g, -4.02, -1.4, 4.6, 3.2, 0.42, glass, 6, 3, -Math.PI / 2)
  curtainWall(g, 4.02, -1.4, 4.6, 3.2, 0.42, glass, 6, 3, Math.PI / 2)
  // Wave roof: three overlapping curved shells on tree columns.
  const roofMat = mat('#e8ecf0', { metal: 0.5, rough: 0.3 })
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.CylinderGeometry(6.0, 6.0, 3.0, 32, 1, true, Math.PI / 2 - 0.5, 1.0)
    geo.rotateZ(Math.PI / 2)
    const shell = new THREE.Mesh(geo, roofMat)
    shell.position.set(-3.0 + i * 3.0, 3.85 - 6.0 + (i === 1 ? 0.45 : 0.15), -1.0)
    shell.castShadow = true
    g.add(shell)
  }
  for (let i = 0; i < 8; i++) box(g, 0.08, 0.2, 6.2, M.darkSteel(), -3.9 + i * 1.12, 4.0, -1.0)
  // Tree columns along the front.
  for (const x of [-3.0, 0, 3.0]) {
    cyl(g, 0.12, 0.16, 3.6, M.white(), x, 0.42, 1.7, 10)
    for (const a of [-0.5, 0.5]) {
      const br = box(g, 0.08, 1.0, 0.08, M.white(), x + a * 0.6, 3.5, 1.7)
      br.rotation.z = -a
    }
  }
  // Desk row visible through glass.
  for (let i = 0; i < 6; i++) box(g, 0.9, 0.8, 0.5, mat('#2f6f9a'), -3.2 + i * 1.3, 0.42, 0.2)
  for (let i = 0; i < 6; i++) box(g, 0.7, 0.32, 0.05, M.glow('#9fe3ff'), -3.2 + i * 1.3, 1.8, 0.0)
  // Stepped office / airline block behind the hall (rises above roof).
  block(g, { x: -2.6, z: -3.9, w: 3.2, d: 1.2, floors: 5, fh: 0.9, wall: mat('#cfd6dc', { rough: 0.5 }), faces: ['front', 'left', 'back'], plant: 2, pitch: 0.5 })
  block(g, { x: 1.4, z: -3.9, w: 3.0, d: 1.2, floors: 4, fh: 0.9, wall: mat('#cfd6dc', { rough: 0.5 }), faces: ['front', 'right', 'back'], plant: 1, pitch: 0.5 })
  // Kerb drop-off canopy + road markings.
  canopy(g, 0, 2.9, 8.8, 1.4, 2.5, mat('#c7cfd8', { metal: 0.5, rough: 0.35 }), 5, M.steel(), mat('#2f6f9a'))
  for (let i = 0; i < 8; i++) paint(g, -3.85 + i * 1.1, 4.1, 0.5, 0.12, M.white())
  sign(g, 'CHECK-IN', '#2f6f9a', '#ffffff', 2.6, 0.48, 0, 3.25, 1.12)
  emblem(g, 'bag', '#2f6f9a', 0.8, 3.4, 3.25, 1.12)
  for (const x of [-4.2, 4.2]) {
    cyl(g, 0.4, 0.45, 0.4, mat('#8a8f86'), x, 0.12, 4.2, 12)
    const tree = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat('#3f7d3a', { rough: 0.9 }))
    tree.position.set(x, 1.0, 4.2)
    tree.castShadow = true
    g.add(tree)
  }
  lampPost(g, -4.3, 3.2)
  lampPost(g, 4.3, 3.2)
}

// ---------------------------------------------------------------- bag sort
/** Dark-clad 3-storey bag hall with stepped wings, belt gantries and a tug-train apron. */
export function bagSortR5(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('apron_concrete', '#c0beb7', 3, 3, { rough: 0.9 }))
  const dark = tmat('warehouse_panels', '#5f666e', 4, 1, { rough: 0.5, metal: 0.35 })
  const light = concreteWall()
  // Central sort hall (tall), two stepped side wings.
  const top = block(g, { x: 0, z: -1.4, w: 5.0, d: 4.6, floors: 3, fh: 1.0, wall: dark, faces: ['front'], ribbon: 0.28, pitch: 0.7, band: mat('#2f6f9a'), plant: 3 })
  block(g, { x: -3.4, z: -1.0, w: 1.8, d: 4.0, floors: 2, fh: 1.0, wall: light, faces: ['front', 'left'], plant: 1 })
  block(g, { x: 3.4, z: -1.6, w: 1.8, d: 3.4, floors: 2, fh: 1.0, wall: light, faces: ['front', 'right'], plant: 1 })
  // Sawtooth roof lights on the hall.
  sawtooth(g, 0, top + 0.02, -1.6, 4.2, 2.4, 5, mat('#8d949b'), M.glass())
  // Roller doors at apron level (service doors at x -2.2, 0, 2.2 z 3.6).
  const fz = -1.4 + 2.3
  for (const x of [-2.2, 0, 2.2]) {
    box(g, 1.3, 1.3, 0.05, mat('#2a2d31'), x, 0.12, fz + 0.01)
    box(g, 1.2, 1.25, 0.06, mat('#c9ced3', { metal: 0.5, rough: 0.4 }), x, 0.12, fz + 0.03)
    for (let k = 1; k < 5; k++) box(g, 1.2, 0.03, 0.07, M.darkSteel(), x, 0.12 + 0.25 * k, fz + 0.03)
    // Belt chute out to the make-up position, bags riding it.
    box(g, 0.8, 0.12, 1.8, mat('#1d2126'), x, 0.45, fz + 0.95)
    for (const s of [-0.38, 0.38]) box(g, 0.04, 0.12, 1.8, M.steel(), x + s, 0.55, fz + 0.95)
    for (let k = 0; k < 4; k++) {
      const bag = box(g, 0.45, 0.32, 0.38, mat(['#c0392b', '#2f6f9a', '#e7b52a', '#2d6a4f'][k % 4]), x, 0.57, fz + 0.15)
      animate(bag, { kind: 'cycle', signal: 'bagsFlow', axis: 'z', amount: 1.6, rate: 0.4, phase: k / 4 })
    }
  }
  // Elevated transfer conveyor bridge leaving the top floor toward the terminal.
  box(g, 0.9, 0.5, 4.0, mat('#c7cfd8', { metal: 0.4 }), -3.4, 2.4, -4.6 + 2.0)
  for (const z of [-4.2, -3.0]) box(g, 0.14, 2.3, 0.14, M.darkSteel(), -3.4, 0.12, z)
  sign(g, 'BAG SORT', '#2f6f9a', '#ffffff', 2.4, 0.42, 0, 1.75, fz + 0.04)
  emblem(g, 'bag', '#2f6f9a', 1.8, 0, top + 0.6, -1.4, true)
  for (let i = 0; i < 4; i++) paint(g, -3.3 + i * 2.2, 4.2, 0.1, 1.0)
  lampPost(g, -4.3, 4.3)
  lampPost(g, 4.3, 4.3)
}

// ---------------------------------------------------------------- catering
/** Flight kitchen: stepped 3-storey office front over a long chilled production hall with high-loader docks. */
export function cateringR5(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('apron_concrete', '#c4c1b9', 3, 3, { rough: 0.9 }))
  const hall = tmat('warehouse_panels', '#d7d9d6', 4, 1, { rough: 0.55 })
  box(g, 7.8, 2.6, 4.2, hall, 0, 0.12, -2.2)
  box(g, 7.9, 0.3, 4.3, mat('#2d7d5a'), 0, 2.72, -2.2)
  box(g, 7.92, 0.12, 4.32, M.coping(), 0, 3.0, -2.2)
  // Office front: 3 storeys on the west, stepping to 2 then the dock canopy.
  const top = block(g, { x: -2.6, z: 0.0, w: 2.6, d: 1.6, floors: 3, fh: 0.95, wall: concreteWall(), faces: ['front', 'left'], plant: 1, band: mat('#2d7d5a') })
  block(g, { x: 0.2, z: -0.1, w: 3.0, d: 1.4, floors: 2, fh: 0.95, wall: concreteWall(), faces: ['front'], plant: 1 })
  // Extraction stacks + chillers on the hall roof.
  for (const x of [-1.6, -0.8]) cyl(g, 0.22, 0.22, 1.8, M.steel(), x, 3.12, -3.4, 12)
  pipe(g, { x: -1.6, y: 4.6, z: -3.4 }, { x: -1.6, y: 4.6, z: -2.0 }, 0.18, M.steel())
  for (const x of [1.2, 2.6]) {
    box(g, 1.0, 0.6, 1.0, M.darkSteel(), x, 3.12, -3.0)
    animate(box(g, 0.8, 0.04, 0.1, M.black(), x, 3.74, -3.0), { kind: 'spin', signal: 'always', axis: 'y', rate: 7 })
  }
  // High-loader docks on the east (service bays x -1.8 / 1.8, z 2.6): raised doors under a canopy.
  canopy(g, 2.4, 1.3, 3.8, 1.4, 2.6, mat('#2d7d5a'), 3)
  for (const x of [1.8, 3.4]) {
    box(g, 1.3, 1.4, 0.05, M.darkSteel(), x, 1.1, -0.06)
    box(g, 1.4, 1.0, 0.6, M.concrete(), x, 0.12, 0.25)
  }
  canopy(g, -1.8, 1.3, 1.6, 1.0, 2.6, mat('#2d7d5a'), 2)
  // Cold-store compressor yard behind a screen.
  for (let i = 0; i < 3; i++) box(g, 0.8, 0.7, 0.8, M.steel(), -3.6 + i * 1.0, 0.12, -4.4)
  sign(g, 'FLIGHT CATERING', '#2d7d5a', '#ffffff', 2.4, 0.42, -2.6, top - 0.5, 0.82)
  emblem(g, 'fork', '#2d7d5a', 2.0, 1.4, 3.12, -1.6, true)
  lampPost(g, -4.3, 4.3)
  lampPost(g, 4.3, 4.3)
}

// ---------------------------------------------------------------- de-ice
/** De-ice pad: glycol-drained apron, control booth on stilts, glycol plant and boom trucks. */
export function deiceR5(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8d9196', { rough: 0.9 }), 0.08)
  const pur = mat('#7a3fa0')
  hatch(g, 0, 0.4, 8.4, 6.6, '#7a3fa0', 0.085)
  paint(g, 0, 0.4, 0.2, 6.4, M.yellow(), 0.09)
  for (let i = 0; i < 6; i++) box(g, 0.2, 0.02, 0.2, M.darkSteel(), -3.5 + i * 1.4, 0.085, -3.0)
  for (const s of [-1, 1]) {
    const t = new THREE.Group()
    t.position.set(s * 3.2, 0.08, 1.4)
    box(t, 1.3, 1.1, 2.9, mat('#7a3fa0', { rough: 0.4 }), 0, 0.3, 0)
    box(t, 1.25, 0.75, 0.85, M.glass(), 0, 1.4, 1.0)
    cyl(t, 0.48, 0.48, 1.2, M.white(), 0, 1.4, -0.6, 14).rotation.x = Math.PI / 2
    const arm = new THREE.Group()
    arm.position.set(0, 1.6, -0.6)
    box(arm, 0.18, 3.4, 0.18, M.yellow(), 0, 0, 0)
    box(arm, 0.7, 0.55, 0.7, M.white(), 0, 3.4, 0)
    arm.rotation.z = s * 1.2
    animate(arm, { kind: 'rot', signal: 'deicing', axis: 'z', amount: -s * 0.75, point: s < 0 ? 0 : 1 })
    t.add(arm)
    for (const z of [-1, 1]) for (const x of [-0.68, 0.68]) {
      const w = cyl(t, 0.28, 0.28, 0.2, M.black(), x, 0, z, 12)
      w.rotation.z = Math.PI / 2
      w.position.y = 0.3
    }
    g.add(t)
  }
  // Control booth on stilts (west rear corner) with wrap glazing.
  for (const [x, z] of [[-3.9, -4.0], [-2.9, -4.0], [-3.9, -3.2], [-2.9, -3.2]]) box(g, 0.12, 1.6, 0.12, M.darkSteel(), x, 0.08, z)
  block(g, { x: -3.4, z: -3.6, w: 1.4, d: 1.1, floors: 1, fh: 1.0, y0: 1.68, wall: M.white(), faces: ['front', 'right', 'left'], ribbon: 0.6, plant: 0 })
  stair(g, -2.2, -3.8, 1.6, -Math.PI / 2)
  // Glycol plant: four tanks, pump house, pipe to the pad edge.
  for (let i = 0; i < 4; i++) cyl(g, 0.45, 0.45, 1.9, mat('#e9ecef', { metal: 0.4 }), -0.6 + i * 1.05, 0.08, -4.0, 18)
  block(g, { x: 3.7, z: -3.8, w: 1.4, d: 1.2, floors: 1, fh: 1.3, y0: 0.08, wall: pur, faces: ['front'], plant: 1 })
  pipe(g, { x: -0.6, y: 0.4, z: -3.5 }, { x: 2.6, y: 0.4, z: -3.5 }, 0.07, pur)
  sign(g, 'DE-ICE', '#7a3fa0', '#ffffff', 1.4, 0.4, 3.7, 1.1, -3.18)
  emblem(g, 'hydrant', '#7a3fa0', 1.2, 0, 0.1, 3.4, true)
  lampPost(g, -4.4, 4.4)
  lampPost(g, 4.4, 4.4)
  lampPost(g, 4.4, -1.5)
}

// ---------------------------------------------------------------- tower
function cabR5(g: THREE.Object3D, y: number, r: number) {
  cyl(g, r * 0.8, r * 0.62, 0.45, M.white(), 0, y, 0, 12)
  cyl(g, r * 0.98, r * 0.98, 0.12, M.darkSteel(), 0, y + 0.45, 0, 12)
  const glass = mat('#5fa8d6', { rough: 0.05, metal: 0.6, emissive: '#2a5a80', ei: 0.45, opacity: 0.92 })
  cyl(g, r * 1.05, r * 0.88, 1.2, glass, 0, y + 0.57, 0, 12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    box(g, 0.06, 1.2, 0.06, M.darkSteel(), Math.cos(a) * r * 0.97, y + 0.57, Math.sin(a) * r * 0.97).rotation.y = -a
  }
  cyl(g, r * 1.18, r * 1.1, 0.3, mat('#26313b', { rough: 0.5 }), 0, y + 1.77, 0, 12)
  cyl(g, r * 0.6, r * 0.7, 0.3, M.white(), 0, y + 2.07, 0, 12)
  cyl(g, 0.05, 0.05, 1.5, M.steel(), 0, y + 2.37, 0, 6)
  const ant = box(g, 1.0, 0.25, 0.08, M.darkSteel(), 0, y + 2.6, 0)
  animate(ant, { kind: 'spin', signal: 'always', axis: 'y', rate: 1.2 })
  animate(cyl(g, 0.1, 0.1, 0.12, M.glow('#ff3b30'), 0, y + 3.85, 0, 8), { kind: 'blink', signal: 'always', rate: 0.8 })
}

/** Control tower: fluted shaft on a stepped 3-storey base building wrapped around it. */
export function towerR5(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('apron_concrete', '#d0cdc5', 3, 3, { rough: 0.85 }))
  // Base: 3-storey east wing, 2-storey west wing, glazed entry link.
  block(g, { x: 2.2, z: 0.6, w: 3.2, d: 3.0, floors: 3, fh: 0.9, wall: M.white(), faces: ['front', 'right'], band: mat('#2f6f9a'), plant: 2 })
  block(g, { x: -2.4, z: 1.0, w: 2.8, d: 2.4, floors: 2, fh: 0.9, wall: M.white(), faces: ['front', 'left'], band: mat('#2f6f9a'), plant: 1 })
  curtainWall(g, -0.2, 2.2, 1.4, 1.8, 0.12, M.glass(), 3, 2)
  box(g, 1.6, 1.9, 2.2, mat('#dfe5ea'), -0.2, 0.12, 1.0)
  // Shaft with vertical light slots and fins.
  const r = CELL * 0.2
  cyl(g, r * 0.48, r * 0.62, 7.4, mat('#d8dee6', { rough: 0.55 }), -0.2, 0.12, -1.6, 16)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    box(g, 0.12, 7.0, 0.3, M.white(), -0.2 + Math.cos(a) * r * 0.55, 0.12, -1.6 + Math.sin(a) * r * 0.55).rotation.y = -a
  }
  box(g, 0.16, 6.0, 0.05, M.glass(), -0.2, 1.2, -1.6 + r * 0.6)
  const cg = new THREE.Group()
  cg.position.set(-0.2, 0, -1.6)
  cabR5(cg, 7.5, r)
  g.add(cg)
  emblem(g, 'radar', '#2f6f9a', 0.8, 3.2, 1.5, 2.12)
  sign(g, 'ATC', '#2f6f9a', '#ffffff', 1.0, 0.32, -0.2, 2.15, 2.25)
  // Staff car park in front with planters.
  for (let i = 0; i < 6; i++) paint(g, -3.6 + i * 1.0, 3.7, 0.06, 1.0, M.white())
  for (const x of [-4.2, 4.2]) {
    cyl(g, 0.35, 0.4, 0.35, mat('#8a8f86'), x, 0.12, 2.6, 12)
    const tr = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat('#3f7d3a', { rough: 0.9 }))
    tr.position.set(x, 0.85, 2.6)
    g.add(tr)
  }
  lampPost(g, -4.3, 4.3)
  lampPost(g, 4.3, 4.3)
}

// ---------------------------------------------------------------- bus station
function coach(g: THREE.Object3D, x: number, z: number, color: string, rotY = 0, len = 3.8) {
  const b = new THREE.Group()
  b.position.set(x, 0, z)
  b.rotation.y = rotY
  box(b, 1.1, 1.2, len, mat(color, { rough: 0.4, metal: 0.2 }), 0, 0.32, 0)
  box(b, 1.12, 0.45, len * 0.92, M.glass(), 0, 0.92, 0)
  box(b, 1.0, 0.1, len * 0.9, M.white(), 0, 1.52, 0)
  for (const dz of [-len * 0.32, len * 0.32]) for (const dx of [-0.55, 0.55]) {
    const w = cyl(b, 0.28, 0.28, 0.18, M.black(), dx, 0.25, dz, 12)
    w.rotation.z = Math.PI / 2
    w.position.y = 0.28
  }
  g.add(b)
}

/** Bus station: long island platform under a glass-and-steel saw canopy, waiting hall, sawtooth bays. */
export function busStationR5(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, M.asphalt(), 0.1)
  // Raised island platform with kerb (kerb points x ±2.2, z -1.2 face it).
  box(g, 8.8, 0.22, 2.2, M.concrete(), 0, 0.1, -2.7)
  box(g, 8.8, 0.04, 0.12, M.yellow(), 0, 0.32, -1.66)
  // Waiting hall: glazed box with green roof band.
  block(g, { x: -2.6, z: -3.4, w: 3.0, d: 1.0, floors: 1, fh: 1.4, y0: 0.32, wall: mat('#dfe5ea'), faces: ['front'], ribbon: 0.7, pitch: 0.5, plant: 0 })
  block(g, { x: 2.8, z: -3.5, w: 2.4, d: 0.9, floors: 2, fh: 0.9, y0: 0.32, wall: concreteWall(), faces: ['front'], plant: 1 })
  // Canopy: ribbed steel with glass skylight strip on tree columns.
  const can = mat('#2d6a4f', { rough: 0.4 })
  for (const x of [-3.9, -1.3, 1.3, 3.9]) {
    cyl(g, 0.08, 0.1, 2.3, M.steel(), x, 0.32, -2.2, 8)
    for (const a of [-0.45, 0.45]) {
      const br = box(g, 0.06, 0.9, 0.06, M.steel(), x + a * 0.5, 2.0, -2.2)
      br.rotation.z = -a
    }
  }
  const slab = box(g, 9.0, 0.12, 2.6, can, 0, 2.75, -2.5)
  slab.rotation.x = -0.08
  box(g, 8.6, 0.06, 0.7, mat('#9fd0ea', { opacity: 0.6, rough: 0.05 }), 0, 2.92, -2.5)
  for (let i = 0; i < 10; i++) box(g, 0.05, 0.14, 2.6, M.darkSteel(), -4.3 + i * 0.95, 2.82, -2.5)
  // Benches, departures board, bins.
  for (let i = 0; i < 4; i++) box(g, 0.9, 0.3, 0.3, M.darkSteel(), -3.4 + i * 2.2, 0.32, -2.3)
  box(g, 1.2, 0.5, 0.06, M.glow('#9fe3ff'), 0, 1.6, -2.0)
  // Bay markings + buses at the kerb.
  for (const x of [-2.2, 2.2]) paint(g, x, -1.2, 3.8, 0.1, M.yellow(), 0.105)
  for (let i = 0; i < 5; i++) paint(g, -4.0 + i * 2.0, 1.4, 1.0, 0.1, M.white(), 0.105)
  coach(g, -2.2, -0.9, '#2d6a4f', Math.PI / 2)
  coach(g, 2.6, 2.6, '#e7b52a', Math.PI / 2)
  // Planted islands at the ends.
  for (const x of [-4.2, 4.2]) {
    box(g, 0.8, 0.25, 1.2, mat('#8a8f86'), x, 0.1, 3.8)
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat('#3f7d3a', { rough: 0.9 }))
    t.position.set(x, 0.85, 3.8)
    g.add(t)
  }
  cyl(g, 0.06, 0.06, 2.8, M.steel(), 4.3, 0.1, -1.4, 6)
  sign(g, 'BUS', '#2d6a4f', '#ffffff', 1.0, 0.5, 4.3, 2.4, -1.36)
  sign(g, 'BUS STATION', '#2d6a4f', '#ffffff', 2.8, 0.42, 0, 2.25, -1.24)
  emblem(g, 'plane', '#2d6a4f', 1.4, 0, 3.0, -2.5, true)
  lampPost(g, -4.4, 0.4)
  lampPost(g, 4.4, 0.4)
}
