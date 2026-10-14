/** Link family: fuel rail siding, oil transfer, travelator, skywalk, people mover. */
import * as THREE from 'three'
import { animate } from '../anim'
import { box, cyl, emblem, HALF, M, mat, pad, pipe, sign } from './kit'

export function fuelRail(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8a8478', { rough: 1 }), 0.1)
  for (const dz of [-0.5, 0.5]) box(g, 9.0, 0.12, 0.1, M.steel(), 0, 0.1, -1.0 + dz)
  for (let i = 0; i < 12; i++) box(g, 0.25, 0.06, 1.4, mat('#5a4a3a'), -4.2 + i * 0.76, 0.1, -1.0)
  // Two tank wagons.
  for (const x of [-2.2, 2.2]) {
    const t = cyl(g, 0.75, 0.75, 3.8, mat('#1d2126', { metal: 0.4, rough: 0.4 }), x, 0.8, -1.0, 20)
    t.rotation.z = Math.PI / 2
    t.position.y = 1.3
    box(g, 4.0, 0.3, 1.2, M.darkSteel(), x, 0.3, -1.0)
    box(g, 0.6, 0.05, 1.6, M.yellow(), x, 2.1, -1.0)
  }
  // Loading gantry with arms + pipe to farm.
  box(g, 8.8, 0.2, 0.9, M.steel(), 0, 3.0, 0.6)
  for (const x of [-4.2, 4.2]) box(g, 0.2, 3.0, 0.2, M.steel(), x, 0.1, 0.6)
  for (const x of [-2.2, 2.2]) pipe(g, { x, y: 3.0, z: 0.6 }, { x, y: 2.2, z: -1.0 }, 0.08, M.yellow())
  pipe(g, { x: -4.5, y: 0.5, z: 2.6 }, { x: 4.5, y: 0.5, z: 2.6 }, 0.18, mat('#d4a017', { metal: 0.5 }))
  sign(g, 'FUEL RAIL', '#2d6a4f', '#ffffff', 2.4, 0.42, 0, 3.4, 1.06)
  emblem(g, 'fuel', '#2d6a4f', 1.0, 3.2, 2.5, 1.06)
}

export function oilTransfer(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8a8478', { rough: 1 }), 0.1)
  // Pump house + horizontal bullet tanks + manifold rack.
  box(g, 2.6, 2.2, 2.4, mat('#2d6a4f'), -2.8, 0.1, -2.6)
  for (const z of [-0.2, 1.6]) {
    const t = cyl(g, 0.8, 0.8, 5.0, mat('#e9ecef', { metal: 0.45, rough: 0.35 }), 1.2, 0, z, 20)
    t.rotation.z = Math.PI / 2
    t.position.y = 1.2
    for (const x of [-0.8, 3.2]) box(g, 0.3, 0.5, 1.2, M.concrete(), x, 0.1, z)
  }
  for (const y of [0.6, 1.0, 1.4]) pipe(g, { x: -4.2, y, z: 3.4 }, { x: 4.2, y, z: 3.4 }, 0.1, [M.yellow(), M.red(), M.steel()][Math.round(y * 2.5) % 3])
  for (const x of [-4, 0, 4]) box(g, 0.15, 1.6, 0.15, M.darkSteel(), x, 0.1, 3.4)
  pipe(g, { x: -2.8, y: 2.3, z: -2.6 }, { x: -2.8, y: 1.4, z: 3.4 }, 0.1, M.steel())
  sign(g, 'OIL TRANSFER', '#2d6a4f', '#ffffff', 2.4, 0.4, -2.8, 1.7, -1.38)
  emblem(g, 'fuel', '#1d2126', 1.0, 1.2, 2.05, 0.7, true)
}

export function travelator(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#d8dde2', { rough: 0.6 }), 0.08)
  // Twin moving walks under a glass tube canopy.
  for (const z of [-0.9, 0.9]) {
    box(g, 9.0, 0.3, 1.2, M.darkSteel(), 0, 0.08, z)
    box(g, 8.6, 0.04, 0.9, M.black(), 0, 0.38, z)
    for (let i = 0; i < 8; i++) {
      const c = box(g, 0.35, 0.02, 0.1, M.yellow(), -4.2, 0.42, z)
      c.rotation.y = z > 0 ? 0.6 : -0.6
      animate(c, { kind: 'cycle', signal: 'always', axis: 'x', amount: (z > 0 ? 1 : 1) * 8.4, rate: 0.12, phase: i / 8 })
    }
    box(g, 9.0, 0.6, 0.06, mat('#9fd0ea', { opacity: 0.55, rough: 0.05 }), 0, 0.38, z + 0.62)
    box(g, 9.0, 0.6, 0.06, mat('#9fd0ea', { opacity: 0.55, rough: 0.05 }), 0, 0.38, z - 0.62)
  }
  const geo = new THREE.CylinderGeometry(2.4, 2.4, 9.0, 24, 1, true, Math.PI / 2, Math.PI)
  geo.rotateX(Math.PI / 2)
  geo.rotateY(Math.PI / 2)
  const tube = new THREE.Mesh(geo, mat('#9fd0ea', { rough: 0.05, metal: 0.4, opacity: 0.4 }))
  tube.position.y = 0.4
  g.add(tube)
  for (const x of [-4.2, -1.4, 1.4, 4.2]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 6, 24, Math.PI), M.steel())
    rib.rotation.y = Math.PI / 2
    rib.position.set(x, 0.4, 0)
    g.add(rib)
  }
  sign(g, 'TRAVELATOR', '#3c6e9e', '#ffffff', 2.2, 0.36, 0, 2.2, 0.0, 0)
  emblem(g, 'plane', '#3c6e9e', 1.0, 0, 0.12, 3.4, true)
}

export function skywalk(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8d9196', { rough: 0.9 }), 0.08)
  // Elevated glazed bridge on V-piers with apron clearance underneath.
  const deckY = 4.2
  box(g, 9.0, 0.4, 2.4, mat('#e8edf2'), 0, deckY, 0)
  box(g, 9.0, 1.8, 0.06, mat('#6fb3dc', { rough: 0.05, metal: 0.55, emissive: '#2a5a80', ei: 0.4, opacity: 0.8 }), 0, deckY + 0.4, 1.17)
  box(g, 9.0, 1.8, 0.06, mat('#6fb3dc', { rough: 0.05, metal: 0.55, emissive: '#2a5a80', ei: 0.4, opacity: 0.8 }), 0, deckY + 0.4, -1.17)
  box(g, 9.2, 0.25, 2.8, mat('#c7cfd8', { metal: 0.5 }), 0, deckY + 2.2, 0)
  for (let i = 0; i < 9; i++) for (const z of [-1.17, 1.17]) box(g, 0.06, 1.8, 0.08, M.darkSteel(), -4.4 + i * 1.1, deckY + 0.4, z)
  for (const x of [-3, 3]) {
    for (const s of [-1, 1]) {
      const leg = box(g, 0.35, deckY + 0.3, 0.35, M.concrete(), x + s * 0.6, 0, 0)
      leg.rotation.z = s * 0.15
    }
  }
  // Clearance bars underneath + tail-height marker.
  box(g, 0.2, 0.03, 8.0, M.yellow(), 0, 0.1, 0)
  sign(g, 'SKYWALK', '#3c6e9e', '#ffffff', 2.2, 0.4, 0, deckY + 1.9, 1.22)
  emblem(g, 'plane', '#3c6e9e', 0.8, 3.6, deckY + 1.9, 1.22)
}

export function peopleMover(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#5f8a48', { rough: 1 }), 0.08)
  // Elevated guideway beam on T-columns with a two-car pod and a small station.
  const y = 3.0
  box(g, 9.0, 0.6, 1.4, M.concrete(), 0, y, -1.0)
  for (const x of [-3.5, 0, 3.5]) {
    box(g, 0.6, y, 0.6, M.concrete(), x, 0.08, -1.0)
    box(g, 2.0, 0.3, 0.8, M.concrete(), x, y - 0.3, -1.0)
  }
  for (const x of [-1.6, 0.6]) {
    box(g, 2.1, 1.4, 1.2, mat('#eef1f4', { metal: 0.3, rough: 0.3 }), x, y + 0.6, -1.0)
    box(g, 2.0, 0.6, 1.22, M.glass(), x, y + 1.15, -1.0)
    box(g, 2.1, 0.15, 1.22, mat('#3c6e9e'), x, y + 0.8, -1.0)
  }
  // Station: platform with canopy and stair tower.
  box(g, 3.6, 0.3, 1.6, M.concrete(), 2.6, y + 0.3, 0.6)
  box(g, 3.6, 0.12, 2.2, mat('#3c6e9e'), 2.6, y + 2.4, 0.2)
  for (const x of [1.0, 4.2]) cyl(g, 0.07, 0.07, 2.1, M.steel(), x, y + 0.3, 1.3, 6)
  box(g, 1.4, y + 0.6, 1.4, mat('#d9dee3'), 2.6, 0.08, 2.6)
  sign(g, 'PEOPLE MOVER', '#3c6e9e', '#ffffff', 2.6, 0.36, 2.6, y + 1.9, 1.32)
  emblem(g, 'plane', '#3c6e9e', 0.9, 2.6, y + 0.3, 3.32)
}
