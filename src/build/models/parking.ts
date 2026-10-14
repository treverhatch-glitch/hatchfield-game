/** Parking family: small/large surface lots, multi-storey garage, underground entry. */
import * as THREE from 'three'
import type { ParkTerm } from '../../game/types'
import { box, cyl, emblem, HALF, M, mat, pad, sign } from './kit'

const CAR_COLS = ['#c0392b', '#2f6f9a', '#eef1f4', '#1d2126', '#e7b52a', '#7d8c9b']

function car(g: THREE.Object3D, x: number, y: number, z: number, i: number, rotY = 0) {
  const c = new THREE.Group()
  c.position.set(x, y, z)
  c.rotation.y = rotY
  box(c, 0.8, 0.4, 1.6, mat(CAR_COLS[i % CAR_COLS.length], { metal: 0.5, rough: 0.35 }), 0, 0.12, 0)
  box(c, 0.7, 0.3, 0.8, M.glass(), 0, 0.52, -0.05)
  g.add(c)
}

function bays(g: THREE.Object3D, rows: number[], n: number, y: number, fill: number, seed: number) {
  for (const z of rows) {
    for (let i = 0; i < n; i++) {
      const x = -HALF * 0.85 + ((HALF * 1.7) / n) * (i + 0.5)
      box(g, 0.06, 0.02, 1.8, M.white(), x - (HALF * 1.7) / n / 2, y, z)
      if ((i * 7 + seed + z * 3) % 10 < fill * 10) car(g, x, y - 0.1, z, i + seed)
    }
  }
}

function termTag(term: ParkTerm) {
  return term === 'long' ? { t: 'LONG STAY', c: '#2d6a4f' } : { t: 'SHORT STAY', c: '#2f6f9a' }
}

export function parking(g: THREE.Group, kind: 'park_s' | 'park_l' | 'park_g' | 'park_u', term: ParkTerm = 'short'): void {
  const tag = termTag(term)
  if (kind === 'park_s' || kind === 'park_l') {
    pad(g, HALF * 2, HALF * 2, M.asphalt(), 0.1)
    const rows = kind === 'park_l' ? [-3.3, -1.1, 1.1, 3.3] : [-1.6, 1.6]
    bays(g, rows, kind === 'park_l' ? 9 : 7, 0.11, 0.65, kind === 'park_l' ? 3 : 1)
    // Light masts + pay machine + big P sign pole.
    for (const x of [-3.8, 3.8]) {
      cyl(g, 0.06, 0.08, 3.6, M.steel(), x, 0.1, 0, 8)
      box(g, 0.6, 0.12, 0.3, M.glow('#fff1c8'), x, 3.7, 0)
    }
    cyl(g, 0.08, 0.08, 2.8, M.steel(), 0, 0.1, kind === 'park_l' ? 0 : 0, 8)
    box(g, 1.1, 1.1, 0.12, mat('#2f6f9a'), 0, 2.9, 0)
    sign(g, 'P', '#2f6f9a', '#ffffff', 1.0, 1.0, 0, 3.45, 0.07)
    sign(g, tag.t, tag.c, '#ffffff', 1.6, 0.32, 0, 2.6, 0.07)
    if (kind === 'park_l') box(g, 0.6, 1.2, 0.4, M.yellow(), 4.0, 0.1, 4.0)
    return
  }
  if (kind === 'park_g') {
    pad(g, HALF * 2, HALF * 2, M.asphalt(), 0.1)
    const deck = mat('#b9b5ab', { rough: 0.9 })
    const levels = 4
    for (let l = 0; l < levels; l++) {
      const y = 0.1 + l * 1.5
      box(g, 8.4, 0.25, 7.0, deck, 0, y, -0.6)
      if (l > 0) bays(g, [-2.4, 1.2], 6, y + 0.26, 0.55, l)
      // Spandrel bands give the stacked-deck silhouette.
      box(g, 8.4, 0.5, 0.06, mat(l % 2 ? '#d9822b' : '#e8e2d4'), 0, y + 0.25, 2.92)
    }
    for (const x of [-4.0, 0, 4.0]) for (const z of [-3.9, 2.8]) box(g, 0.3, levels * 1.5, 0.3, deck, x, 0.1, z)
    box(g, 8.4, 0.25, 7.0, deck, 0, 0.1 + levels * 1.5, -0.6)
    // Stair/lift core with big P.
    box(g, 1.6, levels * 1.5 + 1.2, 1.6, mat('#2f6f9a'), 3.4, 0.1, 3.4)
    sign(g, 'P', '#2f6f9a', '#ffffff', 1.2, 1.2, 3.4, levels * 1.5 + 0.2, 4.22)
    // Ramp.
    const ramp = box(g, 1.6, 0.2, 4.0, deck, -3.4, 0.75, 3.2)
    ramp.rotation.x = 0.35
    sign(g, tag.t, tag.c, '#ffffff', 2.4, 0.4, -0.4, 6.9, 2.95)
    emblem(g, 'plane', '#2f6f9a', 1.8, 0, 0.36 + levels * 1.5, -1.5, true)
    return
  }
  // Underground: landscaped roof, ramp portal down, vent stacks, lift kiosk.
  pad(g, HALF * 2, HALF * 2, mat('#5f8a48', { rough: 1 }), 0.15)
  box(g, 3.2, 0.2, 5.6, M.asphalt(), -2.4, 0.0, 0.9)
  const portal = box(g, 3.4, 1.8, 0.5, M.concrete(), -2.4, 0.15, -1.9)
  portal.name = 'portal'
  box(g, 2.6, 1.4, 0.1, M.black(), -2.4, 0.15, -1.62)
  for (const x of [-4.0, -0.8]) box(g, 0.3, 0.9, 5.4, M.concrete(), x, 0.15, 0.9)
  box(g, 1.8, 2.6, 1.8, mat('#2f6f9a', { rough: 0.4 }), 2.6, 0.15, 2.0)
  box(g, 1.4, 1.8, 0.05, M.glass(), 2.6, 0.4, 2.92)
  sign(g, 'P', '#2f6f9a', '#ffffff', 1.0, 1.0, 2.6, 2.2, 2.93)
  for (const [x, z] of [[1.4, -2.8], [3.4, -2.8]]) cyl(g, 0.45, 0.45, 1.2, M.steel(), x, 0.15, z, 14)
  for (const [x, z] of [[0.6, 0.4], [3.6, 0.0], [1.0, 3.6]]) cyl(g, 0.02, 0.8, 1.2, mat('#3f7a3a'), x, 0.15, z, 8)
  sign(g, tag.t, tag.c, '#ffffff', 2.4, 0.4, -2.4, 1.5, -1.6)
  emblem(g, 'plane', '#2f6f9a', 1.2, 2.6, 2.77, 2.0, true)
}
