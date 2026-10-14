/** Services family: fire station, catering kitchen, vehicle depot, snack bar. */
import * as THREE from 'three'
import { animate } from '../anim'
import { box, cyl, emblem, HALF, M, mat, pad, pipe, sign, tmat } from './kit'

export function fireStation(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  const brick = mat('#a8352a', { rough: 0.75 })
  box(g, 7.0, 3.0, 4.6, brick, -0.6, 0.12, -1.2)
  box(g, 7.2, 0.2, 4.8, M.darkSteel(), -0.6, 3.12, -1.2)
  // Three apparatus bays with red roller doors framed in white.
  for (let i = 0; i < 3; i++) {
    const x = -2.8 + i * 2.2
    box(g, 2.0, 2.3, 0.05, M.white(), x, 0.12, 1.12)
    const door = box(g, 1.8, 2.15, 0.06, mat('#d62d20', { rough: 0.4, metal: 0.2 }), x, 0.12, 1.15)
    animate(door, { kind: 'roll', signal: 'fireDispatch', amount: 2.15, point: i })
    box(g, 1.8, 2.0, 0.04, mat('#2a2d31'), x, 0.12, 1.1) // dark bay behind the door
    box(g, 0.4, 0.15, 0.06, M.glow('#ff3b30'), x, 2.55, 1.15)
  }
  // Hose-drying / training tower: the tall red silhouette.
  box(g, 1.6, 6.4, 1.6, brick, 3.5, 0.12, -2.4)
  box(g, 1.8, 0.2, 1.8, M.darkSteel(), 3.5, 6.52, -2.4)
  for (let k = 0; k < 4; k++) box(g, 0.6, 0.5, 0.05, M.glass(), 3.5, 1.2 + k * 1.3, -1.58)
  cyl(g, 0.2, 0.2, 0.4, M.glow('#ff3b30'), 3.5, 6.72, -2.4, 10)
  sign(g, 'FIRE RESCUE', '#d62d20', '#ffffff', 3.4, 0.5, -0.6, 2.62, 1.12)
  emblem(g, 'flame', '#d62d20', 1.1, 3.5, 4.6, -1.57)
  emblem(g, 'flame', '#d62d20', 2.6, -0.6, 3.34, -1.2, true)
  // Crash tender on the apron.
  const t = new THREE.Group()
  t.position.set(-0.6, 0, 3.2)
  box(t, 4.2, 1.3, 1.5, mat('#e8f04a', { rough: 0.4 }), 0, 0.35, 0)
  box(t, 1.1, 0.7, 1.4, M.glass(), 1.6, 1.65, 0)
  cyl(t, 0.12, 0.12, 1.0, M.steel(), 0.8, 1.65, 0, 8).rotation.z = 1.1
  for (const x of [-1.4, -0.2, 1.4]) for (const z of [-0.78, 0.78]) {
    const w = cyl(t, 0.38, 0.38, 0.25, M.black(), x, 0.0, z, 14)
    w.rotation.x = Math.PI / 2
    w.position.y = 0.38
  }
  g.add(t)
}

export function kitchen(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  const wall = mat('#f1efe8', { rough: 0.6 })
  box(g, 7.4, 2.8, 4.8, wall, 0, 0.12, -1.2)
  box(g, 7.6, 0.18, 5.0, mat('#2d7d5a'), 0, 2.92, -1.2)
  // Extraction stacks + rooftop chillers.
  for (const x of [-2.4, -1.4]) cyl(g, 0.3, 0.3, 2.2, M.steel(), x, 3.1, -2.4, 14)
  for (const x of [1.0, 2.6]) {
    box(g, 1.2, 0.7, 1.2, M.darkSteel(), x, 3.1, -2.0)
    animate(box(g, 0.9, 0.04, 0.12, M.black(), x, 3.82, -2.0), { kind: 'spin', signal: 'always', axis: 'y', rate: 7 })
  }
  pipe(g, { x: -2.4, y: 4.0, z: -2.4 }, { x: -2.4, y: 4.0, z: -0.6 }, 0.22, M.steel())
  // High-loader dock: raised doors with two catering trucks (scissor box bodies).
  for (let i = 0; i < 2; i++) {
    const x = -1.8 + i * 3.6
    box(g, 2.0, 1.6, 0.06, M.darkSteel(), x, 1.0, 1.22)
    const tr = new THREE.Group()
    tr.position.set(x, 0, 3.0)
    box(tr, 1.4, 0.8, 1.0, mat('#2d7d5a'), 0, 0.3, 1.0)
    box(tr, 1.4, 0.5, 2.4, M.darkSteel(), 0, 0.2, -0.2)
    box(tr, 1.6, 1.6, 2.2, M.white(), 0, 1.25, -0.4)
    for (const k of [-0.5, 0.5]) {
      const sc = box(tr, 0.08, 1.1, 0.08, M.yellow(), k * 1.2, 0.55, -0.4)
      sc.rotation.x = 0.6
    }
    g.add(tr)
  }
  sign(g, 'FLIGHT CATERING', '#2d7d5a', '#ffffff', 3.6, 0.5, 0, 2.45, 1.22)
  emblem(g, 'fork', '#2d7d5a', 2.4, 0, 3.12, -0.4, true)
}

export function depot(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('dock_floor', '#8e8c88', 3, 3, { rough: 0.9 }))
  // Open-sided steel canopy with a mono-pitch roof.
  const s = mat('#e7b52a', { rough: 0.45, metal: 0.3 })
  for (const x of [-3.8, -1.3, 1.3, 3.8]) for (const z of [-3, 0.8]) box(g, 0.18, 3.0, 0.18, s, x, 0.12, z)
  const roof = box(g, 8.2, 0.18, 4.6, mat('#566270', { metal: 0.5, rough: 0.4 }), 0, 3.0, -1.1)
  roof.rotation.x = -0.08
  box(g, 8.0, 2.6, 0.12, mat('#566270', { metal: 0.5 }), 0, 0.12, -3.2)
  // Parked GSE: tugs, belt loader, GPU.
  const colors = ['#e7b52a', '#e7b52a', '#2f6f9a', '#c0392b']
  for (let i = 0; i < 4; i++) {
    const x = -3.0 + i * 2.0
    box(g, 1.2, 0.6, 1.8, mat(colors[i]), x, 0.32, -1.2)
    box(g, 0.9, 0.6, 0.6, M.glass(), x, 0.92, -1.6)
    for (const dz of [-0.6, 0.6]) {
      const w = cyl(g, 0.28, 0.28, 1.3, M.black(), x, 0.0, -1.2 + dz, 12)
      w.rotation.z = Math.PI / 2
      w.position.y = 0.3
    }
  }
  // Belt loader ramp + fuel dispenser.
  const belt = box(g, 0.8, 0.15, 3.2, M.black(), -2.6, 0.9, 2.6)
  belt.rotation.x = 0.28
  box(g, 0.6, 1.4, 0.5, mat('#2d6a4f'), 3.4, 0.12, 2.8)
  box(g, 0.5, 0.3, 0.06, M.glow('#9cf'), 3.4, 1.1, 3.06)
  // Painted bay lines.
  for (const x of [-4, -2, 0, 2, 4]) box(g, 0.1, 0.03, 3.4, M.white(), x, 0.12, -1.2)
  sign(g, 'GSE DEPOT', '#566270', '#f2c230', 3.0, 0.5, 0, 2.6, 1.0)
  emblem(g, 'wrench', '#566270', 2.4, 0, 3.4, -1.1, true)
}

export function snack(g: THREE.Group): void {
  pad(g, HALF * 1.6, HALF * 1.6, mat('#c9c2b2', { rough: 0.9 }))
  box(g, 4.0, 2.0, 3.0, mat('#d9a441', { rough: 0.55 }), 0, 0.12, -0.6)
  // Serving hatch + counter.
  box(g, 3.0, 0.9, 0.05, M.glow('#ffe0a0'), 0, 1.0, 0.92)
  box(g, 3.4, 0.12, 0.5, M.white(), 0, 0.95, 1.15)
  // Striped awning.
  for (let i = 0; i < 8; i++) {
    const a = box(g, 0.56, 0.1, 1.5, i % 2 ? M.white() : M.red(), -1.96 + i * 0.56, 2.1, 1.4)
    a.rotation.x = 0.3
  }
  // Roof-top giant cup marker (silhouette).
  cyl(g, 0.55, 0.4, 1.2, M.white(), 0, 2.12, -0.6, 18)
  cyl(g, 0.58, 0.58, 0.12, M.red(), 0, 3.32, -0.6, 18)
  cyl(g, 0.04, 0.04, 0.8, M.red(), 0.2, 3.44, -0.6, 6).rotation.z = 0.3
  // Bistro tables + umbrellas.
  // Round 6: tables sit off the catering bay (8.6 m hi-lift along the front, z 3.75).
  for (const x of [-2.6, 2.6]) {
    cyl(g, 0.4, 0.4, 0.06, M.white(), x, 0.8, 1.9, 14)
    cyl(g, 0.05, 0.05, 2.0, M.darkSteel(), x, 0.12, 1.9, 6)
    cyl(g, 0.02, 0.7, 0.4, M.red(), x, 2.0, 1.9, 16)
  }
  sign(g, 'SNACKS', '#b33', '#ffffff', 2.0, 0.4, 0, 1.68, 0.93)
  emblem(g, 'cup', '#b33', 0.9, 1.8, 1.25, 0.95)
}
