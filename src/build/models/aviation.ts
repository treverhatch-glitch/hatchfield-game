/** Aviation-support family: helipad, de-ice pad, MRO hangar, cargo night hub. */
import * as THREE from 'three'
import { animate } from '../anim'
import { box, cyl, emblem, HALF, M, mat, pad, pipe, sign, tmat } from './kit'

export function helipad(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#5f8a48', { rough: 1 }), 0.06)
  cyl(g, 4.0, 4.1, 0.25, M.asphalt(), 0, 0.06, 0, 40)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.1, 6, 48), M.yellow())
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.33
  g.add(ring)
  // Big H.
  for (const x of [-0.9, 0.9]) box(g, 0.4, 0.03, 2.8, M.white(), x, 0.31, 0)
  box(g, 1.8, 0.03, 0.4, M.white(), 0, 0.31, 0)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    cyl(g, 0.1, 0.1, 0.18, M.glow('#7cff7a'), Math.cos(a) * 3.9, 0.31, Math.sin(a) * 3.9, 6)
  }
  // Windsock mast at the corner.
  cyl(g, 0.05, 0.06, 3.0, M.steel(), 4.0, 0.06, -4.0, 6)
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 10, 1, true), mat('#ff7a1a'))
  sock.rotation.z = Math.PI / 2
  const sockPivot = new THREE.Group()
  sockPivot.position.set(4.0, 2.9, -4.0)
  sock.position.set(-0.6, 0, 0)
  sockPivot.add(sock)
  g.add(animate(sockPivot, { kind: 'sway', signal: 'wind' }))
  // Parked helicopter silhouette.
  const h = new THREE.Group()
  h.position.set(0, 0.33, 0)
  h.rotation.y = 0.6
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10), mat('#c0392b', { metal: 0.3, rough: 0.35 }))
  body.scale.set(1.5, 0.9, 0.9)
  body.position.y = 1.0
  h.add(body)
  box(h, 2.6, 0.2, 0.2, mat('#c0392b'), 1.8, 1.0, 0)
  box(h, 7.0, 0.04, 0.25, M.black(), 0, 1.95, 0)
  box(h, 0.25, 0.04, 7.0, M.black(), 0, 1.95, 0)
  for (const z of [-0.6, 0.6]) box(h, 2.2, 0.06, 0.08, M.darkSteel(), 0, 0.0, z)
  g.add(h)
  sign(g, 'HELI', '#c0392b', '#ffffff', 1.2, 0.4, 4.0, 2.4, -3.94)
}

export function deicePad(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8d9196', { rough: 0.9 }), 0.08)
  // Glycol-collection drain grid + boundary.
  box(g, 8.6, 0.02, 0.2, mat('#7a3fa0'), 0, 0.08, -4.2)
  box(g, 8.6, 0.02, 0.2, mat('#7a3fa0'), 0, 0.08, 4.2)
  for (let i = 0; i < 5; i++) box(g, 0.3, 0.02, 7.6, M.darkSteel(), -3.6 + i * 1.8, 0.08, 0)
  box(g, 0.3, 0.02, 8.0, M.yellow(), 0, 0.1, 0)
  // Two boom trucks with raised baskets.
  for (const s of [-1, 1]) {
    const t = new THREE.Group()
    t.position.set(s * 3.2, 0.08, 1.4)
    box(t, 1.4, 1.2, 3.0, mat('#7a3fa0', { rough: 0.4 }), 0, 0.3, 0)
    box(t, 1.3, 0.8, 0.9, M.glass(), 0, 1.5, 1.0)
    cyl(t, 0.5, 0.5, 1.2, M.white(), 0, 1.5, -0.6, 14)
    const arm = new THREE.Group()
    arm.position.set(0, 1.6, -0.6)
    box(arm, 0.2, 3.6, 0.2, M.yellow(), 0, 0, 0)
    box(arm, 0.8, 0.6, 0.8, M.white(), 0, 3.6, 0)
    arm.rotation.z = s * 1.2
    animate(arm, { kind: 'rot', signal: 'deicing', axis: 'z', amount: -s * 0.75 })
    t.add(arm)
    for (const z of [-1, 1]) for (const x of [-0.7, 0.7]) {
      const w = cyl(t, 0.3, 0.3, 0.2, M.black(), x, 0, z, 12)
      w.rotation.z = Math.PI / 2
      w.position.y = 0.3
    }
    g.add(t)
  }
  // Glycol tanks + sign.
  for (const x of [-1, 1]) cyl(g, 0.6, 0.6, 1.8, mat('#e9ecef', { metal: 0.4 }), x * 1.0, 0.08, -3.2, 18)
  sign(g, 'DE-ICE', '#7a3fa0', '#ffffff', 1.8, 0.45, 0, 2.2, -2.56)
  emblem(g, 'hydrant', '#7a3fa0', 1.4, 0, 0.11, 2.6, true)
}

export function mro(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, M.concrete())
  // Twin-bay box hangar with a sawtooth workshop wing and a tail-dock notch.
  const wall = tmat('hangar_cladding', '#8ea2b8', 4, 1, { metal: 0.45, rough: 0.4 })
  box(g, 9.0, 4.6, 5.8, wall, 0, 0.12, -1.4)
  box(g, 9.2, 0.25, 6.0, tmat('roof_membrane', '#8a9096', 3, 2), 0, 4.72, -1.4)
  box(g, 2.4, 1.6, 0.12, M.black(), -2.2, 4.72 - 1.6, 1.54) // tail notch
  box(g, 2.4, 1.6, 0.12, M.black(), 2.2, 4.72 - 1.6, 1.54)
  for (const x of [-2.2, 2.2]) {
    for (const half of [-1, 1]) {
      const leaf = box(g, 2.0, 3.1, 0.08, mat('#1e242b', { metal: 0.4 }), x + half * 1.0, 0.12, 1.56 + (half > 0 ? 0.04 : 0))
      animate(leaf, { kind: 'slide', signal: 'hangarBusy', axis: 'x', amount: half * 1.7 })
    }
    for (let k = 0; k < 4; k++) box(g, 0.04, 3.1, 0.1, M.steel(), x - 1.5 + k, 0.12, 1.58)
  }
  box(g, 9.2, 0.35, 0.16, mat('#e67e22'), 0, 3.25, 1.6)
  // Workshop wing.
  for (let i = 0; i < 4; i++) {
    box(g, 2.2, 1.6, 2.4, mat('#d9dee3'), -3.3 + i * 2.2, 0.12, 3.2)
    const t = box(g, 2.2, 0.4, 2.4, mat('#e67e22', { rough: 0.4 }), -3.3 + i * 2.2, 1.72, 3.2)
    t.rotation.z = 0.2
  }
  box(g, 0.6, 3.6, 0.6, M.steel(), 4.1, 0.12, -4.0)
  sign(g, 'MRO', '#e67e22', '#ffffff', 2.4, 0.6, 0, 4.05, 1.63)
  emblem(g, 'wrench', '#e67e22', 2.6, 0, 4.98, -1.4, true)
}

export function nightHub(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, M.asphalt())
  // Big dark sort hub with lit dock row and a glowing roof crown.
  box(g, 9.0, 3.6, 5.6, tmat('warehouse_panels', '#58657a', 4, 1, { rough: 0.5, metal: 0.3 }), 0, 0.12, -1.4)
  box(g, 9.2, 0.25, 5.8, mat('#6a3fa0'), 0, 3.72, -1.4)
  box(g, 8.8, 0.15, 0.08, M.glow('#b78cff'), 0, 3.85, 1.42)
  for (let i = 0; i < 6; i++) {
    const x = -3.75 + i * 1.5
    animate(box(g, 1.1, 1.7, 0.06, mat('#3a4555'), x, 0.6, 1.42), { kind: 'roll', signal: 'night', amount: 1.7 })
    box(g, 1.1, 0.12, 0.08, M.glow('#ffd27a'), x, 2.45, 1.44)
  }
  box(g, 9.0, 0.6, 1.0, M.concrete(), 0, 0.12, 1.9)
  // ULD dollies train + stack lights.
  for (let i = 0; i < 4; i++) box(g, 1.1, 1.0, 1.1, mat('#b8c0c8', { metal: 0.5 }), -3.4 + i * 1.3, 0.3, 3.4)
  pipe(g, { x: -4.2, y: 0.4, z: 3.4 }, { x: 1.2, y: 0.4, z: 3.4 }, 0.04, M.darkSteel())
  for (const x of [-4.2, 4.2]) {
    cyl(g, 0.08, 0.1, 6.0, M.steel(), x, 0.12, 4.0, 8)
    box(g, 0.8, 0.2, 0.4, M.glow('#fff1c8'), x, 6.1, 4.0)
  }
  sign(g, 'NIGHT HUB', '#6a3fa0', '#ffffff', 3.2, 0.5, 0, 3.0, 1.46)
  emblem(g, 'box', '#6a3fa0', 2.6, 0, 3.98, -1.4, true)
}
