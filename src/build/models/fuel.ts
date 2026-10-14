/** Fuel family: tank farms (I and III), hydrant pit. */
import * as THREE from 'three'
import { box, cyl, emblem, HALF, M, mat, pad, pipe, sign } from './kit'

function tank(g: THREE.Object3D, x: number, z: number, r: number, h: number) {
  const shell = mat('#e9ecef', { rough: 0.35, metal: 0.45 })
  cyl(g, r, r, h, shell, x, 0.3, z, 32)
  // Domed / floating roof and a coloured product band.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 8, 0, Math.PI * 2, 0, Math.PI * 0.18), shell)
  dome.position.set(x, 0.3 + h - r * Math.cos(Math.PI * 0.18), z)
  dome.castShadow = true
  g.add(dome)
  cyl(g, r * 1.005, r * 1.005, h * 0.12, mat('#d4a017', { rough: 0.4 }), x, 0.3 + h * 0.62, z, 32)
  // Spiral stair hint + roof rail.
  const torus = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.04, 4, 32), M.darkSteel())
  torus.rotation.x = Math.PI / 2
  torus.position.set(x, 0.3 + h + 0.25, z)
  g.add(torus)
  for (let i = 0; i < 6; i++) box(g, 0.5, 0.06, 0.3, M.darkSteel(), x + Math.cos(i * 0.5) * (r + 0.18), 0.3 + (h / 6) * i, z + Math.sin(i * 0.5) * (r + 0.18))
}

function bund(g: THREE.Object3D, w: number, d: number) {
  const wall = mat('#a8a397', { rough: 0.95 })
  const t = 0.25
  const h = 0.6
  box(g, w, h, t, wall, 0, 0, -d / 2)
  box(g, w, h, t, wall, 0, 0, d / 2)
  box(g, t, h, d, wall, -w / 2, 0, 0)
  box(g, t, h, d, wall, w / 2, 0, 0)
}

export function fuelFarm(g: THREE.Group, heavy = false): void {
  pad(g, HALF * 2, HALF * 2, mat('#8f8b82', { rough: 0.95 }))
  bund(g, HALF * 1.9, HALF * 1.9)
  const steel = M.steel()
  const spots: [number, number, number, number][] = heavy
    ? [
        [-2.3, -2.3, 1.75, 3.6],
        [2.3, -2.3, 1.75, 3.6],
        [-2.3, 1.6, 1.55, 3.2],
        [2.3, 1.6, 1.55, 3.2],
      ]
    : [
        [-1.9, -1.2, 1.6, 2.8],
        [1.9, -1.2, 1.6, 2.8],
      ]
  for (const [x, z, r, h] of spots) tank(g, x, z, r, h)
  // Manifold: header pipe along the front with drops into each tank.
  const fz = heavy ? 3.7 : 2.6
  pipe(g, { x: -HALF * 0.85, y: 0.55, z: fz }, { x: HALF * 0.85, y: 0.55, z: fz }, 0.14, mat('#d4a017', { metal: 0.5, rough: 0.4 }))
  for (const [x, z, r] of spots) {
    pipe(g, { x, y: 0.55, z: fz }, { x, y: 0.55, z: z + r * 0.9 }, 0.09, steel)
  }
  // Pump skid + loading arm.
  box(g, 1.4, 0.8, 0.9, mat('#2d6a4f', { rough: 0.5 }), heavy ? 0 : 0, 0.12, fz + 0.2)
  if (heavy) {
    // Third-farm signature: extra slim day-tank pair and a high-flow pump house.
    cyl(g, 0.6, 0.6, 2.2, mat('#e9ecef', { rough: 0.35, metal: 0.45 }), 0, 0.3, -0.4, 20)
    box(g, 1.6, 1.3, 1.2, mat('#2d6a4f'), HALF * 0.65, 0.12, fz - 0.1)
    sign(g, 'FUEL III', '#2d6a4f', '#ffffff', 1.5, 0.4, HALF * 0.65, 1.0, fz + 0.52)
  } else {
    sign(g, 'JET A-1', '#2d6a4f', '#ffffff', 1.3, 0.38, 0, 0.6, fz + 0.66)
  }
  emblem(g, 'fuel', '#2d6a4f', 1.4, spots[0][0], 0.32 + spots[0][3] + 0.25, spots[0][1], true)
  // Hazard placard on bund wall.
  box(g, 0.7, 0.45, 0.04, M.red(), -HALF * 0.6, 0.15, HALF * 0.95 + 0.14)
}

/** Hydrant pit: flush hatch in the apron, a hose dispenser cart parked beside it. */
export function hydrant(g: THREE.Group): void {
  pad(g, HALF * 2, HALF * 2, mat('#8d9196', { rough: 0.9 }), 0.08)
  // Yellow-hatched box marking around the pit.
  const paint = M.yellow()
  box(g, 3.2, 0.02, 0.18, paint, 0, 0.08, -1.6)
  box(g, 3.2, 0.02, 0.18, paint, 0, 0.08, 1.6)
  box(g, 0.18, 0.02, 3.2, paint, -1.6, 0.08, 0)
  box(g, 0.18, 0.02, 3.2, paint, 1.6, 0.08, 0)
  // Pit lid: round hatch with a valve stub.
  cyl(g, 0.9, 0.9, 0.06, mat('#5d646b', { metal: 0.8, rough: 0.3 }), 0, 0.08, 0, 32)
  cyl(g, 0.2, 0.24, 0.35, M.red(), 0, 0.14, 0, 16)
  // Underground supply line hint (painted).
  box(g, 0.25, 0.02, HALF - 1.7, mat('#2d6a4f'), 0, 0.08, -(1.7 + HALF) / 2)
  // Hose dispenser cart.
  const cart = new THREE.Group()
  cart.position.set(2.2, 0, 1.6)
  cart.rotation.y = -0.4
  box(cart, 2.4, 0.9, 1.3, mat('#f2f2f0', { rough: 0.5 }), 0, 0.45, 0)
  box(cart, 0.9, 0.85, 1.25, mat('#2d6a4f'), -0.9, 1.35, 0)
  box(cart, 0.7, 0.3, 0.06, M.glass(), -0.9, 1.7, 0.63)
  cyl(cart, 0.32, 0.32, 0.4, mat('#222'), 0.6, 1.35, 0, 18).rotation.x = Math.PI / 2
  for (const [x, z] of [[-0.8, 0.66], [0.8, 0.66], [-0.8, -0.66], [0.8, -0.66]]) {
    const wheel = cyl(cart, 0.32, 0.32, 0.22, M.black(), x, 0.21, z, 14)
    wheel.rotation.x = Math.PI / 2
  }
  // Mast with platform rails.
  box(cart, 0.08, 1.3, 0.08, M.yellow(), 1.0, 1.35, 0.5)
  box(cart, 0.08, 1.3, 0.08, M.yellow(), 1.0, 1.35, -0.5)
  g.add(cart)
  // Hose from hatch to cart.
  pipe(g, { x: 0, y: 0.35, z: 0 }, { x: 1.6, y: 1.1, z: 1.3 }, 0.08, M.black())
  emblem(g, 'hydrant', '#2d6a4f', 1.6, -2.6, 0.1, 2.4, true)
}
