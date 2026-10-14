/** Security family: remote screening hall, police post, guard post. */
import * as THREE from 'three'
import { animate } from '../anim'
import { box, cyl, emblem, HALF, M, mat, pad, sign, tmat } from './kit'

export function remoteScreening(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  const wall = mat('#d9dee3', { rough: 0.5 })
  // Long hall with sawtooth roof lights.
  box(g, 8.0, 2.8, 5.0, wall, 0, 0.12, -0.6)
  for (let i = 0; i < 4; i++) {
    const tooth = box(g, 2.0, 0.6, 5.0, mat('#3c6e9e', { rough: 0.4 }), -3 + i * 2, 2.9, -0.6)
    tooth.rotation.z = 0.25
  }
  // Glazed entry canopy with screening lanes visible.
  box(g, 6.4, 1.9, 0.08, mat('#6fb3dc', { rough: 0.05, metal: 0.5, emissive: '#2a5a80', ei: 0.4, opacity: 0.7 }), 0, 0.2, 1.92)
  for (let i = 0; i < 3; i++) {
    const x = -2.0 + i * 2.0
    box(g, 0.5, 0.75, 1.6, M.darkSteel(), x, 0.12, 1.0) // X-ray tunnel
    box(g, 0.6, 0.35, 0.9, mat('#2a2d31'), x, 0.87, 1.0)
    box(g, 0.08, 1.9, 0.08, M.white(), x + 0.6, 0.12, 1.4) // walk-through arch
    box(g, 0.08, 1.9, 0.08, M.white(), x + 1.1, 0.12, 1.4)
    box(g, 0.58, 0.1, 0.1, M.white(), x + 0.85, 2.0, 1.4)
  }
  box(g, 8.4, 0.18, 2.6, M.darkSteel(), 0, 2.2, 2.2) // canopy
  for (const x of [-3.9, 3.9]) cyl(g, 0.1, 0.1, 2.1, M.steel(), x, 0.12, 3.3, 8)
  sign(g, 'X-RAY SCREENING', '#c0392b', '#ffffff', 4.0, 0.55, 0, 2.62, 1.92)
  emblem(g, 'xray', '#c0392b', 1.0, 3.3, 1.4, 1.95)
  emblem(g, 'xray', '#c0392b', 2.4, 2.8, 3.3, -0.6, true)
  // Bus bay kerb in front.
  box(g, 7.6, 0.2, 0.4, M.yellow(), 0, 0.12, 4.0)
}

export function police(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  const blue = mat('#1e3a5f', { rough: 0.5 })
  box(g, 5.6, 2.4, 4.0, mat('#e4e7ea', { rough: 0.6 }), -0.6, 0.12, -0.8)
  box(g, 5.6, 0.5, 4.0, blue, -0.6, 2.52, -0.8)
  box(g, 5.8, 0.22, 0.05, mat('#f2f2f2'), -0.6, 2.4, 1.23)
  windows(g)
  // Blue lamp + chequered band.
  for (let i = 0; i < 10; i++) box(g, 0.56, 0.2, 0.05, i % 2 ? blue : M.white(), -3.1 + i * 0.56, 1.95, 1.24)
  cyl(g, 0.18, 0.18, 0.4, M.glow('#3b82f6'), -0.6, 3.02, 1.0, 12)
  // Comms mast.
  cyl(g, 0.06, 0.08, 4.2, M.steel(), 1.6, 3.0, -2.0, 6)
  sign(g, 'POLICE', '#1e3a5f', '#ffffff', 2.0, 0.45, -0.6, 2.77, 1.21)
  emblem(g, 'shield', '#1e3a5f', 1.0, 1.4, 1.0, 1.23)
  // Patrol car in the bay.
  box(g, 1.1, 0.6, 2.2, M.white(), 3.4, 0.2, 1.2)
  box(g, 1.0, 0.45, 1.1, blue, 3.4, 0.8, 1.0)
  box(g, 0.9, 0.12, 0.25, M.glow('#3b82f6'), 3.4, 1.25, 1.0)
}

function windows(g: THREE.Object3D) {
  for (let i = 0; i < 4; i++) box(g, 0.7, 0.6, 0.05, M.glass(), -2.4 + i * 1.2, 0.9, 1.23)
}

export function guard(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 1.2, M.asphalt())
  // Booth with wraparound glass and overhanging roof.
  box(g, 1.6, 1.0, 1.6, mat('#3d4a3a', { rough: 0.55 }), -2.2, 0.12, 0)
  box(g, 1.6, 0.9, 1.6, mat('#6fb3dc', { rough: 0.05, metal: 0.5, emissive: '#2a5a80', ei: 0.35, opacity: 0.8 }), -2.2, 1.12, 0)
  box(g, 2.2, 0.15, 2.2, M.darkSteel(), -2.2, 2.02, 0)
  cyl(g, 0.15, 0.15, 0.3, M.glow('#ffb020'), -2.2, 2.17, 0, 10)
  // Boom barrier striped red/white.
  box(g, 0.3, 1.0, 0.3, M.yellow(), -1.2, 0.12, 1.6)
  const boom = new THREE.Group()
  boom.position.set(-1.0, 1.06, 1.6)
  box(boom, 4.8, 0.12, 0.12, tmat('chevron_stripe', '#ffffff', 6, 1), 2.4, -0.06, 0)
  animate(boom, { kind: 'rot', signal: 'gateTraffic', axis: 'z', amount: 1.35 })
  g.add(boom)
  // Lane islands + truck-height canopy.
  box(g, 7.6, 0.2, 0.5, M.yellow(), 0.4, 0.12, -1.0)
  for (const x of [-3.2, 3.6]) box(g, 0.2, 3.6, 0.2, M.steel(), x, 0.12, -1.0)
  box(g, 7.2, 0.25, 3.0, mat('#3d4a3a'), 0.2, 3.72, 0)
  sign(g, 'CHECKPOINT', '#3d4a3a', '#f2c230', 3.0, 0.4, 0.2, 3.5, 1.52)
  emblem(g, 'eye', '#3d4a3a', 0.8, -2.2, 0.62, 0.82)
  // Canopy downlights, CCTV mast, tyre-killer strip, painted stop bar and lane arrows.
  for (const x of [-1.8, 0.2, 2.2]) box(g, 0.9, 0.05, 0.3, M.glow('#f4f8ff'), x, 3.67, 0)
  box(g, 7.2, 0.08, 0.1, M.frame(), 0.2, 3.97, 1.5)
  cyl(g, 0.06, 0.08, 3.2, M.darkSteel(), 3.6, 0.12, 1.4, 8)
  box(g, 0.35, 0.18, 0.18, M.white(), 3.45, 3.2, 1.4).rotation.y = 0.6
  box(g, 0.08, 0.08, 0.14, M.black(), 3.3, 3.2, 1.5)
  box(g, 4.4, 0.06, 0.3, M.darkSteel(), 1.4, 0.12, 0.9)
  for (let i = 0; i < 12; i++) box(g, 0.05, 0.08, 0.12, M.yellow(), -0.7 + i * 0.38, 0.18, 0.9)
  box(g, 4.4, 0.012, 0.2, M.white(), 1.4, 0.12, 2.1)
  for (const x of [0.4, 2.6]) {
    box(g, 0.14, 0.012, 0.9, M.white(), x, 0.12, -0.2)
    const head = box(g, 0.4, 0.012, 0.4, M.white(), x, 0.12, 0.3)
    head.rotation.y = Math.PI / 4
  }

}
