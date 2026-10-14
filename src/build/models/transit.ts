/** Transit family: bus curb, rail station, terminal-bus depot, transfer-bus depot. */
import * as THREE from 'three'
import { box, cyl, emblem, HALF, M, mat, pad, sign } from './kit'
import { animate } from '../anim'

function bus(g: THREE.Object3D, x: number, z: number, color: string, rotY = 0, len = 4.2, real = false) {
  const b = new THREE.Group()
  // Real apron bus at a 2x2 lot (4.44 m/unit across, 3.22 up): 14 x 3 x 3.1 m.
  if (real) { b.scale.set(0.675 / 1.22, 0.96 / 1.65, 1); b.userData.fleet = 'termbus'; b.name = 'fleet:termbus' }
  b.position.set(x, 0, z)
  b.rotation.y = rotY
  box(b, 1.2, 1.3, len, mat(color, { rough: 0.4, metal: 0.2 }), 0, 0.35, 0)
  box(b, 1.22, 0.5, len * 0.92, M.glass(), 0, 0.95, 0)
  for (const dz of [-len * 0.32, len * 0.32]) for (const dx of [-0.6, 0.6]) {
    const w = cyl(b, 0.3, 0.3, 0.2, M.black(), dx, 0.25, dz, 12)
    w.rotation.z = Math.PI / 2
    w.position.y = 0.3
  }
  g.add(b)
}

export function busCurb(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, M.asphalt(), 0.1)
  box(g, 8.6, 0.25, 2.2, M.concrete(), 0, 0.1, -2.6)
  // Wave-canopy shelter with glass back panels.
  for (const x of [-3.6, -1.2, 1.2, 3.6]) cyl(g, 0.08, 0.08, 2.4, M.steel(), x, 0.35, -2.0, 8)
  const c = box(g, 8.6, 0.12, 2.0, mat('#2d6a4f', { rough: 0.4 }), 0, 2.75, -2.4)
  c.rotation.x = -0.12
  box(g, 8.0, 1.6, 0.05, mat('#9fd0ea', { opacity: 0.5, rough: 0.05 }), 0, 0.35, -3.5)
  for (let i = 0; i < 3; i++) box(g, 1.6, 0.4, 0.4, M.darkSteel(), -2.6 + i * 2.6, 0.35, -3.1)
  // Bay markings + two buses.
  for (const x of [-2.2, 2.2]) box(g, 3.8, 0.02, 0.1, M.yellow(), x, 0.11, -1.3)
  bus(g, -2.2, 0.2, '#2d6a4f', Math.PI / 2)
  bus(g, 2.6, 2.4, '#e7b52a', Math.PI / 2)
  cyl(g, 0.06, 0.06, 2.8, M.steel(), 4.2, 0.1, -1.4, 6)
  sign(g, 'BUS', '#2d6a4f', '#ffffff', 1.0, 0.5, 4.2, 2.7, -1.36)
  sign(g, 'BUS STATION', '#2d6a4f', '#ffffff', 2.8, 0.42, 0, 2.3, -1.4)
  emblem(g, 'plane', '#2d6a4f', 1.4, 0, 2.88, -2.4, true)
}

export function railStation(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, M.concrete())
  // Two tracks with sleepers, island platform, train set, barrel-vault train shed.
  for (const z of [-2.6, 2.6]) {
    for (const dz of [-0.5, 0.5]) box(g, 9.0, 0.12, 0.1, M.steel(), 0, 0.12, z + dz)
    for (let i = 0; i < 12; i++) box(g, 0.25, 0.06, 1.4, mat('#5a4a3a'), -4.2 + i * 0.76, 0.12, z)
  }
  box(g, 9.0, 0.6, 2.8, M.concrete(), 0, 0.12, 0)
  box(g, 9.0, 0.03, 0.15, M.yellow(), 0, 0.72, 1.3)
  box(g, 9.0, 0.03, 0.15, M.yellow(), 0, 0.72, -1.3)
  const train = new THREE.Group()
  train.position.set(0, 0.2, -2.6)
  box(train, 8.4, 1.8, 1.5, mat('#eef1f4', { metal: 0.3, rough: 0.35 }), 0, 0, 0)
  box(train, 8.4, 0.3, 1.52, mat('#c0392b'), 0, 0.3, 0)
  box(train, 8.2, 0.5, 1.53, M.glass(), 0, 1.0, 0)
  g.add(train)
  const geo = new THREE.CylinderGeometry(4.2, 4.2, 9.0, 36, 1, true, Math.PI / 2 + 0.6, Math.PI - 1.2)
  geo.rotateX(Math.PI / 2)
  geo.rotateY(Math.PI / 2)
  const shed = new THREE.Mesh(geo, mat('#9fd0ea', { rough: 0.1, metal: 0.4, opacity: 0.75 }))
  shed.position.set(0, 0.6, 0)
  shed.castShadow = true
  g.add(shed)
  for (const x of [-4, -1.3, 1.3, 4]) for (const z of [-3.6, 3.6]) cyl(g, 0.1, 0.1, 3.4, M.darkSteel(), x, 0.12, z, 8)
  sign(g, 'RAIL', '#c0392b', '#ffffff', 1.6, 0.5, 0, 1.6, 0.05)
  emblem(g, 'plane', '#c0392b', 1.0, 2.6, 1.5, 0.05)
}

export function busDepot(g: THREE.Group, transfer: boolean): void {
  const color = transfer ? '#e7b52a' : '#3c6e9e'
  pad(g, HALF * 2, HALF * 2, M.asphalt(), 0.1)
  // Long garage with sawtooth roof and three bus doors; apron buses outside.
  box(g, 8.6, 3.0, 3.6, mat('#d9dee3'), 0, 0.1, -2.4)
  for (let i = 0; i < 4; i++) {
    const t = box(g, 2.2, 0.5, 3.6, mat(color, { rough: 0.4 }), -3.2 + i * 2.15, 3.1, -2.4)
    t.rotation.x = 0.0
    t.rotation.z = 0.2
  }
  for (let i = 0; i < 3; i++) {
    box(g, 1.8, 2.2, 0.03, mat('#1b1e22'), -2.8 + i * 2.8, 0.1, -0.6)
    // Round 7: each garage door rolls up for the bus on its bay.
    animate(box(g, 1.76, 2.16, 0.06, mat('#5c6f82', { metal: 0.45, rough: 0.45 }), -2.8 + i * 2.8, 0.1, -0.56), { kind: 'roll', signal: 'bayDoor', amount: 2.16, point: i })
  }
  // Round 7: no parked prop buses on the bays: the live apron buses park there.
  if (transfer) box(g, 0.7, 0.6, 3.0, M.yellow(), 4.1, 0.1, 2.2) // apron boarding island
  else cyl(g, 0.3, 0.3, 1.6, M.steel(), 4.15, 0.1, 2.3, 12) // charger
  if (!transfer) for (const x of [-3.0, 3.0]) cyl(g, 0.18, 0.22, 0.5, M.steel(), x, 3.1, -3.6, 10) // roof vents
  sign(g, transfer ? 'TRANSFER BUS' : 'TERMINAL BUS', color, '#ffffff', 3.0, 0.45, 0, 2.6, -0.56)
  emblem(g, 'plane', color, 1.0, 3.6, 1.6, -0.56)
}
