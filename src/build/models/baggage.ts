/** Baggage family: bag sort hall and tilt-tray sorter. */
import * as THREE from 'three'
import { box, cyl, emblem, HALF, M, mat, pad, pipe, sign } from './kit'

function rollerDoors(g: THREE.Object3D, n: number, w: number, z: number, dw = 1.3, dh = 1.4) {
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5)
    box(g, dw, dh, 0.06, mat('#c9ced3', { metal: 0.5, rough: 0.4 }), x, 0.12, z)
    for (let k = 1; k < 6; k++) box(g, dw, 0.03, 0.07, M.darkSteel(), x, 0.12 + (dh / 6) * k, z)
  }
}

export function bagSort(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  box(g, 7.2, 2.6, 5.6, mat('#8a909a', { rough: 0.5, metal: 0.3 }), 0, 0.12, -0.8)
  box(g, 7.4, 0.15, 5.8, M.darkSteel(), 0, 2.72, -0.8)
  rollerDoors(g, 3, 6.6, 2.02)
  // Belt chutes feeding out to the apron.
  for (const x of [-2.2, 0, 2.2]) {
    box(g, 0.8, 0.14, 2.0, M.black(), x, 0.4, 3.0)
    for (let k = 0; k < 4; k++) box(g, 0.5, 0.35, 0.4, mat(['#c0392b', '#2f6f9a', '#e7b52a', '#2d6a4f'][k % 4]), x, 0.54, 2.3 + k * 0.45)
  }
  sign(g, 'BAG SORT', '#2f6f9a', '#ffffff', 2.4, 0.42, 0, 2.3, 2.04)
  emblem(g, 'bag', '#2f6f9a', 2.2, 0, 2.82, -0.8, true)
}

/** Tilt-tray sorter: a loop building with a visible tray oval, ducting and gantry. */
export function tiltTray(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  const shell = mat('#c6ccd2', { rough: 0.45, metal: 0.35 })
  // Rounded-end hall (stadium plan) whose shape echoes the tray loop.
  box(g, 4.8, 3.0, 5.0, shell, 0, 0.12, -0.4)
  for (const x of [-2.4, 2.4]) cyl(g, 2.5, 2.5, 3.0, shell, x, 0.12, -0.4, 28)
  box(g, 4.8, 0.14, 5.1, M.darkSteel(), 0, 3.12, -0.4)
  for (const x of [-2.4, 2.4]) cyl(g, 2.55, 2.55, 0.14, M.darkSteel(), x, 3.12, -0.4, 28)
  // Glazed belt band showing the coloured tray loop inside.
  const band = mat('#6fb3dc', { rough: 0.05, metal: 0.5, emissive: '#2a5a80', ei: 0.4, opacity: 0.55 })
  box(g, 4.8, 0.9, 0.06, band, 0, 1.0, 2.12)
  const loop = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 6, 40), mat('#e67e22', { rough: 0.4 }))
  loop.rotation.x = Math.PI / 2
  loop.scale.set(2.0, 1, 1)
  loop.position.set(0, 1.25, 0.2)
  g.add(loop)
  // Roof ducting: two big runs with elbows and fans.
  const duct = M.steel()
  pipe(g, { x: -4.2, y: 3.7, z: -1.6 }, { x: 4.2, y: 3.7, z: -1.6 }, 0.38, duct)
  pipe(g, { x: -4.2, y: 3.7, z: 0.6 }, { x: 3.0, y: 3.7, z: 0.6 }, 0.28, duct)
  for (const x of [-3.2, 0, 3.2]) cyl(g, 0.55, 0.55, 0.5, M.darkSteel(), x, 3.26, -2.6, 16)
  // Inbound / outbound conveyors on gantries.
  for (const [x, dir] of [[-4.0, -1], [4.0, 1]] as const) {
    box(g, 0.9, 0.18, 3.2, M.black(), x, 1.8, 3.0)
    box(g, 0.12, 1.8, 0.12, M.yellow(), x - 0.4 * dir, 0.12, 3.8)
    box(g, 0.12, 1.8, 0.12, M.yellow(), x + 0.4 * dir, 0.12, 3.8)
  }
  sign(g, 'TILT-TRAY SORT', '#e67e22', '#1d2126', 3.6, 0.5, 0, 2.3, 2.15)
  emblem(g, 'bag', '#e67e22', 2.2, 0, 3.22, -0.4, true)
}
