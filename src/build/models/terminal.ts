/** Terminal family (menu icons for commissioned upgrades): each a distinct hall shape. */
import * as THREE from 'three'
import { box, cyl, emblem, HALF, M, mat, pad, sign, tmat } from './kit'

const curtain = () => tmat('terminal_glass', '#bfe0f2', 4, 1, { rough: 0.05, metal: 0.55, emissive: '#2a5a80', ei: 0.4, opacity: 0.9 })

function mullions(g: THREE.Object3D, w: number, h: number, y: number, z: number, n: number) {
  for (let i = 0; i <= n; i++) box(g, 0.06, h, 0.08, M.darkSteel(), -w / 2 + (w / n) * i, y, z)
  box(g, w, 0.06, 0.08, M.darkSteel(), 0, y + h / 2, z)
}

/** Prefab II: stacked modular boxes with a flat canopy, cheap and cheerful. */
export function prefabII(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  const panel = mat('#e9edf1', { rough: 0.6 })
  for (let i = 0; i < 3; i++) {
    box(g, 2.6, 2.4, 4.6, i % 2 ? mat('#dfe5ea') : panel, -2.8 + i * 2.8, 0.12, -1.0)
    box(g, 2.0, 1.2, 0.06, M.glass(), -2.8 + i * 2.8, 0.8, 1.34)
  }
  box(g, 5.4, 2.0, 3.6, panel, -1.4, 2.52, -1.4)
  for (let i = 0; i < 4; i++) box(g, 0.9, 0.8, 0.06, M.glass(), -3.2 + i * 1.2, 3.1, 0.42)
  box(g, 8.6, 0.12, 2.0, M.darkSteel(), 0, 2.52, 2.2)
  for (const x of [-4, 4]) cyl(g, 0.08, 0.08, 2.4, M.steel(), x, 0.12, 3.1, 8)
  sign(g, 'PREFAB II', '#2f6f9a', '#ffffff', 2.4, 0.42, -1.4, 4.1, 0.44)
  emblem(g, 'plane', '#2f6f9a', 1.0, 2.8, 3.2, -1.0)
}

/** Check-in hall: long-span sawtooth-free wave roof over a full-height glass front, desks inside. */
export function checkinHall(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  box(g, 8.6, 3.4, 5.4, mat('#e4e9ee', { rough: 0.5 }), 0, 0.12, -1.2)
  box(g, 8.4, 3.2, 0.06, curtain(), 0, 0.12, 1.56)
  mullions(g, 8.4, 3.2, 1.72, 1.6, 8)
  // Wave roof: overhanging slab with a rolled leading edge and ribs.
  const roofMat = mat('#c7cfd8', { metal: 0.5, rough: 0.35 })
  box(g, 9.0, 0.22, 6.2, roofMat, 0, 3.52, -0.9)
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9.0, 16, 1, false, 0, Math.PI), roofMat)
  edge.rotation.z = Math.PI / 2
  edge.position.set(0, 3.63, 2.2)
  g.add(edge)
  for (let i = 0; i < 6; i++) box(g, 0.12, 0.35, 6.0, M.darkSteel(), -3.75 + i * 1.5, 3.74, -0.9)
  // Desk row with queue posts visible through the glass.
  for (let i = 0; i < 6; i++) box(g, 0.9, 0.8, 0.5, mat('#2f6f9a'), -3.2 + i * 1.3, 0.12, 0.4)
  for (let i = 0; i < 6; i++) box(g, 0.7, 0.35, 0.05, M.glow('#9fe3ff'), -3.2 + i * 1.3, 1.6, 0.2)
  // Kerb drop-off canopy.
  box(g, 8.8, 0.15, 1.4, M.darkSteel(), 0, 2.4, 2.6)
  sign(g, 'CHECK-IN', '#2f6f9a', '#ffffff', 2.6, 0.5, 0, 2.95, 1.62)
  emblem(g, 'bag', '#2f6f9a', 0.9, 3.4, 2.95, 1.62)
}

/** Security hall: solid secure block with slit windows, X-ray lanes and a red security band. */
export function securityHall(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2)
  box(g, 8.0, 3.0, 6.0, mat('#c9cfd5', { rough: 0.6 }), 0, 0.12, -1.0)
  box(g, 8.2, 0.5, 6.2, mat('#8e2a22'), 0, 3.12, -1.0)
  for (let i = 0; i < 8; i++) box(g, 0.25, 1.8, 0.06, M.glass(), -3.5 + i, 0.6, 2.02)
  // Lane entry portals.
  for (let i = 0; i < 4; i++) {
    const x = -3 + i * 2
    box(g, 1.2, 2.0, 0.6, M.darkSteel(), x, 0.12, 2.4)
    box(g, 0.9, 1.6, 0.05, M.glow('#9fe3ff'), x, 0.25, 2.72)
  }
  // Roof plant + CCTV masts.
  box(g, 2.2, 0.8, 1.6, M.steel(), -2.4, 3.62, -2.4)
  for (const x of [-3.8, 3.8]) {
    cyl(g, 0.05, 0.05, 1.4, M.darkSteel(), x, 3.62, 1.8, 6)
    box(g, 0.25, 0.18, 0.4, M.white(), x, 5.0, 1.9)
  }
  sign(g, 'SECURITY', '#8e2a22', '#ffffff', 2.8, 0.5, 1.6, 3.37, 2.13)
  emblem(g, 'shield', '#8e2a22', 2.4, 1.6, 3.64, -1.0, true)
}

/** Concourse: long low airside finger with a gull-wing roof and gate pods. */
export function concourse(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8d9196', { rough: 0.9 }))
  box(g, 9.0, 2.4, 2.6, mat('#e8edf2'), 0, 0.12, -0.6)
  box(g, 9.0, 1.6, 0.06, curtain(), 0, 0.5, 0.72)
  box(g, 9.0, 1.6, 0.06, curtain(), 0, 0.5, -1.92)
  for (const s of [-1, 1]) {
    const wing = box(g, 9.2, 0.14, 1.9, mat('#c7cfd8', { metal: 0.5, rough: 0.35 }), 0, 2.6, -0.6 + s * 0.8)
    wing.rotation.x = s * 0.22
  }
  // Gate pods with jet bridges stubs.
  for (const x of [-3, 0, 3]) {
    box(g, 1.4, 1.6, 1.4, mat('#e8edf2'), x, 0.12, 1.4)
    box(g, 0.5, 0.6, 2.2, M.steel(), x, 1.2, 3.0)
    box(g, 0.8, 0.5, 0.05, M.glow('#ffd27a'), x, 1.0, 2.12)
  }
  sign(g, 'CONCOURSE', '#3c6e9e', '#ffffff', 2.4, 0.42, 0, 2.0, 0.76)
  emblem(g, 'plane', '#3c6e9e', 0.9, -4.0, 1.9, 0.76)
}

/** Pier II: narrow T-pier on stilts over the apron with a control cab at the head. */
export function pierII(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8d9196', { rough: 0.9 }))
  const body = mat('#e8edf2')
  box(g, 2.0, 2.0, 9.0, body, 0, 1.6, 0)
  box(g, 2.0, 0.8, 9.0, curtain(), 0, 2.2, 0).scale.set(1.02, 1, 0.98)
  for (let i = 0; i < 5; i++) for (const x of [-0.8, 0.8]) cyl(g, 0.14, 0.14, 1.6, M.concrete(), x, 0, -4 + i * 2, 10)
  // T-head across the front.
  box(g, 8.6, 2.4, 2.0, body, 0, 1.6, 3.4)
  box(g, 8.6, 0.9, 0.06, curtain(), 0, 2.3, 4.42)
  box(g, 8.8, 0.14, 2.2, M.darkSteel(), 0, 4.0, 3.4)
  cyl(g, 0.7, 0.6, 1.0, mat('#5fa8d6', { metal: 0.6, rough: 0.05, emissive: '#2a5a80', ei: 0.4 }), 0, 4.14, 3.4, 12)
  sign(g, 'PIER II', '#3c6e9e', '#ffffff', 2.0, 0.42, -2.6, 3.65, 4.46)
  emblem(g, 'plane', '#3c6e9e', 0.9, 2.6, 3.65, 4.46)
}

/** Satellite: round hub building with radial glazed fingers. */
export function satellite(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8d9196', { rough: 0.9 }))
  cyl(g, 2.6, 2.8, 2.6, mat('#e8edf2'), 0, 0.12, 0, 36)
  cyl(g, 2.65, 2.65, 1.2, curtain(), 0, 0.8, 0, 36)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.7, 36, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), mat('#c7cfd8', { metal: 0.55, rough: 0.3 }))
  dome.position.y = 2.72 - 2.7 * Math.cos(Math.PI * 0.32)
  dome.castShadow = true
  g.add(dome)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const arm = new THREE.Group()
    arm.rotation.y = a
    box(arm, 1.4, 1.6, 1.8, mat('#e8edf2'), 0, 0.5, 3.4)
    box(arm, 1.0, 0.6, 0.06, M.glow('#ffd27a'), 0, 1.0, 4.32)
    g.add(arm)
  }
  cyl(g, 0.06, 0.06, 1.4, M.steel(), 0, 3.4, 0, 6)
  sign(g, 'SATELLITE', '#3c6e9e', '#ffffff', 2.2, 0.4, 0, 2.2, 2.9)
  emblem(g, 'radar', '#3c6e9e', 1.4, 0, 3.42, 0, true)
}

/** Prestige landmark: sculptural sail roof, gold fins and a reflecting pool. */
export function prestigeLandmark(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, tmat('terrazzo_floor', '#ffffff', 3, 3, { rough: 0.5 }))
  box(g, 6.4, 0.06, 1.6, mat('#3a7fb0', { rough: 0.05, metal: 0.4, emissive: '#123a5a', ei: 0.4 }), 0, 0.12, 3.2)
  box(g, 7.0, 2.6, 4.2, curtain(), 0, 0.12, -0.8)
  // Gold vertical fins on the facade.
  for (let i = 0; i < 12; i++) box(g, 0.08, 2.6, 0.35, mat('#c9a227', { metal: 0.8, rough: 0.25 }), -3.3 + i * 0.6, 0.12, 1.4)
  // Twin sail roofs rising to a peak.
  for (const s of [-1, 1]) {
    const sail = new THREE.Mesh(new THREE.ConeGeometry(3.0, 5.6, 3, 1, true), mat('#f6f4ee', { rough: 0.3, metal: 0.1 }))
    sail.scale.set(1, 1, 0.35)
    sail.rotation.z = s * 0.35
    sail.position.set(s * 0.9, 4.9, -0.8)
    sail.castShadow = true
    g.add(sail)
  }
  cyl(g, 0.12, 0.12, 0.3, M.glow('#ffd27a'), 0, 7.6, -0.8, 8)
  sign(g, 'LANDMARK', '#1d2126', '#c9a227', 2.6, 0.45, 0, 2.95, 1.62)
  emblem(g, 'eye', '#c9a227', 1.0, -2.8, 2.95, 1.62)
}
