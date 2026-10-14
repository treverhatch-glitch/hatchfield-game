/** Power family: field substation. */
import * as THREE from 'three'
import { box, cyl, emblem, fence, HALF, M, mat, pad, pipe, sign, tmat } from './kit'

function transformer(g: THREE.Object3D, x: number, z: number) {
  const body = mat('#6c7a5a', { rough: 0.55, metal: 0.3 })
  box(g, 1.6, 1.6, 1.2, body, x, 0.15, z)
  // Cooling fins.
  for (let i = 0; i < 6; i++) box(g, 0.06, 1.3, 0.5, body, x - 0.6 + i * 0.24, 0.3, z + 0.85)
  // Bushings on top (porcelain stacks).
  const porcelain = mat('#8b4a2f', { rough: 0.3 })
  for (const dx of [-0.5, 0, 0.5]) {
    for (let k = 0; k < 4; k++) cyl(g, 0.11, 0.11, 0.1, porcelain, x + dx, 1.75 + k * 0.16, z, 10)
  }
  cyl(g, 0.3, 0.3, 0.7, body, x - 0.55, 1.75, z - 0.35, 14).rotation.z = Math.PI / 2
}

function gantry(g: THREE.Object3D, x: number, z: number, h: number) {
  const s = M.steel()
  box(g, 0.14, h, 0.14, s, x - 1.2, 0.1, z)
  box(g, 0.14, h, 0.14, s, x + 1.2, 0.1, z)
  box(g, 2.6, 0.14, 0.14, s, x, h, z)
  // Lattice braces.
  for (let k = 0; k < 3; k++) {
    const b = box(g, 0.05, 1.2, 0.05, s, x - 1.2, 0.4 + k * (h / 3), z + 0.02)
    b.rotation.z = 0.6
    const b2 = box(g, 0.05, 1.2, 0.05, s, x + 1.2, 0.4 + k * (h / 3), z + 0.02)
    b2.rotation.z = -0.6
  }
  const ins = mat('#cfd6dd', { rough: 0.3 })
  for (const dx of [-0.8, 0, 0.8]) cyl(g, 0.07, 0.07, 0.5, ins, x + dx, h - 0.5, z, 8)
}

export function substation(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#9c978c', { rough: 1 }))
  // Gravel yard.
  box(g, HALF * 1.8, 0.04, HALF * 1.8, tmat('gravel_yard', '#a09a90', 3, 3, { rough: 1 }), 0, 0.12, 0)
  fence(g, HALF * 1.9, HALF * 1.9, 1.5, 1.6)
  transformer(g, -2, -0.6)
  transformer(g, 1.4, -0.6)
  gantry(g, -2, -2.8, 4.2)
  gantry(g, 1.4, -2.8, 4.2)
  // Overhead lines between gantries and off-plot.
  const wire = mat('#2a2d31', { metal: 0.6 })
  for (const dx of [-0.8, 0, 0.8]) {
    pipe(g, { x: -2 + dx, y: 3.75, z: -2.8 }, { x: 1.4 + dx, y: 3.75, z: -2.8 }, 0.025, wire)
    pipe(g, { x: -2 + dx, y: 3.75, z: -2.8 }, { x: -2 + dx * 0.5, y: 1.95, z: -0.6 }, 0.025, wire)
    pipe(g, { x: 1.4 + dx, y: 3.75, z: -2.8 }, { x: 1.4 + dx * 0.5, y: 1.95, z: -0.6 }, 0.025, wire)
  }
  // Tall pylon at the back corner (silhouette marker).
  const s = M.darkSteel()
  const py = new THREE.Group()
  py.position.set(HALF * 0.75, 0, -HALF * 0.75)
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const leg = box(py, 0.1, 6.5, 0.1, s, x * 0.6, 0, z * 0.6)
    leg.rotation.set(z * 0.07, 0, -x * 0.07)
  }
  for (const y of [4.2, 5.6]) box(py, 2.8, 0.12, 0.12, s, 0, y, 0)
  g.add(py)
  // Control kiosk with sign + emblem.
  box(g, 2.2, 2.2, 1.6, mat('#e5e2d8', { rough: 0.7 }), 2.4, 0.12, 2.4)
  box(g, 2.4, 0.12, 1.8, M.darkSteel(), 2.4, 2.32, 2.4)
  sign(g, 'SUBSTATION', '#f2c230', '#1d2126', 2.0, 0.42, 2.4, 1.85, 3.21)
  emblem(g, 'bolt', '#e0a800', 0.9, 2.4, 1.05, 3.22)
  // Danger signs on fence.
  for (const x of [-2.5, 0.2]) box(g, 0.5, 0.5, 0.03, M.yellow(), x, 0.7, HALF * 0.95 + 0.04)
}
