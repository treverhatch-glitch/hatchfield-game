/** Control family: tower and ATC approach centre. */
import * as THREE from 'three'
import { animate } from '../anim'
import { box, CELL, cyl, emblem, HALF, M, mat, pad, sign } from './kit'

function cab(g: THREE.Object3D, y: number, r: number) {
  // Flared, faceted glazed cab with mullions, dark roof and antenna mast.
  cyl(g, r * 0.82, r * 0.7, 0.35, M.white(), 0, y, 0, 12)
  const glass = mat('#5fa8d6', { rough: 0.05, metal: 0.6, emissive: '#2a5a80', ei: 0.45, opacity: 0.92 })
  cyl(g, r, r * 0.82, 1.3, glass, 0, y + 0.35, 0, 12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const m = box(g, 0.06, 1.3, 0.06, M.darkSteel(), Math.cos(a) * r * 0.92, y + 0.35, Math.sin(a) * r * 0.92)
    m.rotation.y = -a
  }
  cyl(g, r * 1.12, r * 1.05, 0.3, mat('#26313b', { rough: 0.5 }), 0, y + 1.65, 0, 12)
  cyl(g, 0.05, 0.05, 1.6, M.steel(), 0, y + 1.95, 0, 6)
  animate(cyl(g, 0.1, 0.1, 0.12, M.glow('#ff3b30'), 0, y + 3.55, 0, 8), { kind: 'blink', signal: 'always', rate: 0.8 })
}

export function tower(g: THREE.Group): void {
  pad(g, HALF * 1.6, HALF * 1.6)
  // Base building.
  box(g, 4.2, 1.6, 3.4, M.white(), 0, 0.12, 0.6)
  box(g, 4.4, 0.12, 3.6, M.darkSteel(), 0, 1.72, 0.6)
  for (let i = 0; i < 5; i++) box(g, 0.5, 0.5, 0.05, M.glass(), -1.6 + i * 0.8, 0.8, 2.32)
  // Tapered shaft with vertical light slot.
  const r = CELL * 0.22
  cyl(g, r * 0.42, r * 0.6, 6.4, mat('#d8dee6', { rough: 0.55 }), 0, 0.12, 0, 16)
  box(g, 0.18, 5.2, 0.05, M.glass(), 0, 1.0, r * 0.52)
  cab(g, 6.5, r)
  emblem(g, 'radar', '#2f6f9a', 0.9, 1.5, 0.75, 2.33)
  sign(g, 'ATC', '#2f6f9a', '#ffffff', 1.0, 0.32, -1.2, 1.35, 2.33)
}

export function atcApproach(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  // Wide low TRACON / approach-control block with banded windows.
  box(g, 7.8, 2.6, 4.6, mat('#e7ebee', { rough: 0.55 }), 0, 0.12, 1.8)
  box(g, 8.0, 0.14, 4.8, M.darkSteel(), 0, 2.72, 1.8)
  for (let row = 0; row < 2; row++) box(g, 7.4, 0.4, 0.05, M.glass(), 0, 0.6 + row * 1.0, 4.12)
  // HVAC plant on roof.
  for (const x of [-2.6, -1.6]) {
    cyl(g, 0.4, 0.4, 0.5, M.steel(), x, 2.86, 1.2, 14)
    const fan = box(g, 0.7, 0.04, 0.1, M.black(), x, 3.37, 1.2)
    animate(fan, { kind: 'spin', signal: 'always', axis: 'y', rate: 6 })
  }
  // Taller tower than the basic one, behind the block.
  const r = CELL * 0.24
  cyl(g, r * 0.4, r * 0.62, 8.6, mat('#d8dee6', { rough: 0.55 }), -1.8, 0.12, -2.2, 16)
  const cg = new THREE.Group()
  cg.position.set(-1.8, 0, -2.2)
  cab(cg, 8.7, r)
  g.add(cg)
  // Radar: lattice mast + radome, plus a rotating-style surveillance antenna.
  const s = M.steel()
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(g, 0.08, 5.6, 0.08, s, 2.8 + x, 0.12, -2.6 + z)
  for (const y of [1.5, 3.0, 4.5]) box(g, 0.9, 0.06, 0.9, s, 2.8, y, -2.6)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 16), mat('#f4f6f8', { rough: 0.35 }))
  dome.position.set(2.8, 6.6, -2.6)
  dome.castShadow = true
  g.add(dome)
  const ant = box(g, 2.6, 0.7, 0.12, M.darkSteel(), 2.8, 2.9, 1.8)
  animate(ant, { kind: 'spin', signal: 'always', axis: 'y', rate: 1.6 })
  cyl(g, 0.12, 0.12, 0.25, M.darkSteel(), 2.8, 2.72, 1.8, 8)
  sign(g, 'APPROACH', '#2f6f9a', '#ffffff', 3.2, 0.5, -1.4, 2.05, 4.13)
  emblem(g, 'radar', '#2f6f9a', 1.3, 2.4, 1.6, 4.13)
  emblem(g, 'radar', '#2f6f9a', 2.2, 1.0, 2.88, 2.6, true)
}
