/**
 * Massing for the later apron pieces, read from the Gemini concepts.
 * Boxes and a few cylinders only. Words sit on their own panels.
 * Vehicle sockets are not in this file; these meshes do not move them.
 */
import * as THREE from 'three'
import { SKIN_TILE_M } from '../../build/materialTargets'
import { CELL, WORLD_PER_METER } from '../aircraft/specs'
import { skinBox, skinMaterial, yardMaterial, metreUv } from './buildingSkin'
import { mountDock, mountSign } from './buildingSign'

const glassMat = () =>
  new THREE.MeshStandardMaterial({ color: '#9ec4de', roughness: 0.15, metalness: 0.25 })

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Pipes and a hydrant cabinet along the cell. The runs stay on the old rail line. */
export function addFuelRailMass(g: THREE.Group) {
  const pad = new THREE.Mesh(metreUv(new THREE.BoxGeometry(CELL * 0.94, 0.08, CELL * 0.62), 4, WORLD_PER_METER), yardMaterial('gravel'))
  pad.position.y = 0.05
  pad.receiveShadow = true
  const pipeGeo = new THREE.CylinderGeometry(0.09, 0.09, CELL * 0.86, 8)
  const steel = skinMaterial('fuel_farm', 'trim', { metalness: 0.45, color: '#c5ced6' })
  const pipeL = new THREE.Mesh(pipeGeo, steel)
  pipeL.rotation.z = Math.PI / 2
  pipeL.position.set(0, 0.28, -0.22 * CELL)
  const pipeR = pipeL.clone()
  pipeR.position.z = 0.22 * CELL
  const pit = box(CELL * 0.22, 0.16, CELL * 0.28, skinMaterial('fuel_farm', 'door'), 0, 0.12, 0)
  const cabinet = box(0.7, 0.85, 0.45, skinMaterial('fuel_farm', 'wall'), CELL * 0.28, 0.5, 0.22 * CELL)
  const cap = box(0.74, 0.08, 0.5, skinMaterial('fuel_farm', 'trim', { color: '#e0b020' }), CELL * 0.28, 0.94, 0.22 * CELL)
  mountSign(g, 'FUEL', { w: 0.62, h: 0.22, x: CELL * 0.28, y: 0.72, z: 0.22 * CELL + 0.26 }, '#2a3038', '#f4f7fa')
  mountDock(g, CELL * 0.4, 0.9, CELL * 0.28, 0.22 * CELL + 0.7)
  g.add(pad, pipeL, pipeR, pit, cabinet, cap)
}

/** Low glazed walk. The belt stays on the ground, inside the cell. */
export function addTravelatorMass(g: THREE.Group) {
  const deck = box(CELL * 0.88, 0.18, CELL * 0.46, skinMaterial('transit_station', 'wall'), 0, 0.12, 0)
  const belt = box(CELL * 0.72, 0.04, CELL * 0.22, new THREE.MeshStandardMaterial({ color: '#1a1d20', roughness: 0.4, metalness: 0.35 }), 0, 0.24, 0)
  const rail = skinMaterial('transit_station', 'trim')
  const left = box(CELL * 0.86, 0.42, 0.06, rail, 0, 0.48, CELL * 0.2)
  const right = left.clone()
  right.position.z = -CELL * 0.2
  const pane = glassMat()
  const glassL = box(CELL * 0.7, 0.36, 0.04, pane, 0, 0.55, CELL * 0.16)
  const glassR = glassL.clone()
  glassR.position.z = -CELL * 0.16
  for (const x of [-0.7, 0, 0.7]) {
    const chevron = box(0.28, 0.02, 0.08, skinMaterial('transit_station', 'trim', { color: '#e0b020' }), x, 0.28, 0)
    chevron.rotation.y = 0.6
    g.add(chevron)
  }
  const canopy = box(CELL * 0.5, 0.08, CELL * 0.5, skinMaterial('transit_station', 'roof'), -CELL * 0.15, 1.15, 0)
  mountSign(g, 'WALK', { w: 0.9, h: 0.24, x: -CELL * 0.15, y: 0.95, z: CELL * 0.22 }, '#1f3b57', '#f4f7fa')
  mountDock(g, CELL * 0.4, 0.7, CELL * 0.28, CELL * 0.28)
  g.add(deck, belt, left, right, glassL, glassR, canopy)
}

/** Enclosed bridge on two piers. The deck stays at the old walk height. */
export function addSkywalkMass(g: THREE.Group) {
  const deck = box(CELL * 0.92, 0.16, CELL * 0.48, skinMaterial('transit_station', 'wall'), 0, 3.2, 0)
  const pierMat = skinMaterial('transit_station', 'trim')
  const pierL = box(0.22, 3.05, 0.22, pierMat, -CELL * 0.28, 1.55, -CELL * 0.12)
  const pierR = box(0.22, 3.05, 0.22, pierMat, CELL * 0.28, 1.55, CELL * 0.12)
  const tube = box(CELL * 0.78, 0.7, CELL * 0.36, glassMat(), 0, 3.65, 0)
  const truss = box(CELL * 0.84, 0.08, 0.08, pierMat, 0, 4.1, 0)
  const rail = box(CELL * 0.8, 0.06, 0.05, skinMaterial('transit_station', 'trim', { color: '#e0b020' }), 0, 3.35, CELL * 0.2)
  mountSign(g, 'LINK', { w: 1.1, h: 0.28, x: 0, y: 3.85, z: CELL * 0.2 }, '#1f3b57', '#f4f7fa')
  mountDock(g, CELL * 0.45, 0.8, 0, CELL * 0.32)
  g.add(deck, pierL, pierR, tube, truss, rail)
}

/**
 * Ground-level guideway. The car stays named `pod` and the window `pod-glass`,
 * as siblings, so the shuttle can keep sliding them together.
 */
export function addPeopleMoverMass(g: THREE.Group) {
  const guide = box(CELL * 0.92, 0.14, 0.55, skinMaterial('transit_station', 'door'), 0, 0.12, 0)
  const beam = box(CELL * 0.9, 0.08, 0.12, skinMaterial('transit_station', 'trim'), 0, 0.24, 0)
  const home = 0
  const car = box(CELL * 0.36, 0.72, 0.48, skinMaterial('transit_station', 'wall'), home, 0.62, 0)
  car.name = 'pod'
  car.userData.home = home
  const window = box(CELL * 0.22, 0.28, 0.5, glassMat(), home, 0.78, 0)
  window.name = 'pod-glass'
  const nose = box(0.16, 0.4, 0.4, skinMaterial('transit_station', 'trim', { color: '#e0b020' }), home + CELL * 0.2, 0.58, 0)
  const postL = box(0.16, 1.5, 0.16, skinMaterial('transit_station', 'trim'), -CELL * 0.32, 0.8, 0)
  const postR = postL.clone()
  postR.position.x = -CELL * 0.08
  const canopy = box(CELL * 0.4, 0.08, 0.9, skinMaterial('transit_station', 'roof'), -CELL * 0.2, 1.6, 0)
  mountSign(g, 'MOVE', { w: 1.05, h: 0.26, x: -CELL * 0.2, y: 1.35, z: 0.48 }, '#1f3b57', '#f4f7fa')
  mountDock(g, CELL * 0.42, 0.7, -CELL * 0.2, 0.7)
  g.add(guide, beam, car, window, nose, postL, postR, canopy)
}

/** Remote checkpoint: a low hall, a blue canopy, and a bus bay on the apron face. */
export function addRemoteScreening(g: THREE.Group) {
  const span = CELL * 0.86
  const depth = CELL * 0.62
  const wallH = 2.4
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('terminal', 'wall'))
  body.position.set(0, wallH / 2, -CELL * 0.06)
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.3, 0.12, depth + 0.2, SKIN_TILE_M.roof, WORLD_PER_METER), skinMaterial('terminal', 'roof'))
  roof.position.set(0, wallH + 0.08, -CELL * 0.04)
  const frontZ = -CELL * 0.06 + depth / 2
  const canopy = box(span * 0.72, 0.1, 1.3, skinMaterial('terminal', 'trim', { color: '#2f6fa8' }), 0, wallH - 0.15, frontZ + 0.45)
  const glass = box(span * 0.62, 0.7, 0.06, glassMat(), 0, 1.7, frontZ + 0.02)
  const bay = box(span * 0.28, 1.3, 0.12, skinMaterial('terminal', 'door'), span * 0.28, 0.7, frontZ + 0.04)
  mountSign(g, 'REMOTE', { w: span * 0.4, h: 0.28, x: -span * 0.16, y: wallH - 0.35, z: frontZ + 0.08 }, '#1f3b57', '#f4f7fa')
  mountDock(g, span * 0.4, 1.1, span * 0.28, frontZ + 0.9)
  g.add(body, roof, canopy, glass, bay)
}

/** Fenced yard, two transformers, and a gantry. Sits on grass beside the terminal. */
export function addSubstation(g: THREE.Group) {
  const pad = new THREE.Mesh(metreUv(new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.8), 4, WORLD_PER_METER), yardMaterial('gravel'))
  pad.rotation.x = -Math.PI / 2
  pad.position.y = 0.04
  const fence = skinMaterial('ground_services', 'trim')
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    g.add(box(0.1, 1.35, 0.1, fence, x * CELL * 0.36, 0.7, z * CELL * 0.28))
  }
  g.add(box(CELL * 0.74, 0.08, 0.06, fence, 0, 1.3, -CELL * 0.28))
  g.add(box(CELL * 0.74, 0.08, 0.06, fence, 0, 1.3, CELL * 0.28))
  const xf = skinMaterial('ground_services', 'wall')
  g.add(box(1.3, 1.05, 0.8, xf, -CELL * 0.16, 0.58, 0))
  g.add(box(1.1, 0.9, 0.7, xf, CELL * 0.14, 0.5, 0))
  const gantry = box(CELL * 0.55, 0.1, 0.12, skinMaterial('ground_services', 'trim', { color: '#d7dee6' }), 0, 1.7, 0)
  mountSign(g, 'GRID', { w: 0.9, h: 0.24, x: 0, y: 1.15, z: CELL * 0.28 + 0.08 }, '#2a3028', '#f6f1e4')
  mountDock(g, CELL * 0.4, 0.8, 0, CELL * 0.28 + 0.55)
  g.add(pad, gantry)
}

/** Sort shed with a sawtooth roof and a dock conveyor. */
export function addTiltTray(g: THREE.Group) {
  const span = CELL * 0.88
  const depth = CELL * 0.7
  const wallH = 2.5
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('cargo_terminal', 'wall'))
  body.position.y = wallH / 2
  body.castShadow = true
  const roofMat = skinMaterial('cargo_terminal', 'roof')
  const slope = new THREE.Mesh(skinBox(span * 0.48, 0.1, depth + 0.2, SKIN_TILE_M.roof, WORLD_PER_METER), roofMat)
  slope.position.set(-span * 0.22, wallH + 0.28, 0)
  slope.rotation.z = 0.28
  slope.castShadow = true
  const slopeR = slope.clone()
  slopeR.position.x = span * 0.22
  slopeR.rotation.z = -0.28
  const frontZ = depth / 2
  const door = box(span * 0.22, 1.35, 0.08, skinMaterial('cargo_terminal', 'door'), -span * 0.22, 0.72, frontZ + 0.02)
  const door2 = door.clone()
  door2.position.x = span * 0.18
  const belt = box(span * 0.35, 0.12, 1.1, skinMaterial('cargo_terminal', 'trim', { color: '#c9a24a' }), span * 0.18, 0.45, frontZ + 0.5)
  mountSign(g, 'SORT', { w: span * 0.32, h: 0.28, x: 0, y: wallH - 0.3, z: frontZ + 0.08 }, '#3d4650', '#f4f0e4')
  mountDock(g, span * 0.4, 1.05, span * 0.18, frontZ + 1.05)
  g.add(body, slope, slopeR, door, door2, belt)
}

/** Low approach block with a roof dish. It does not sit on the tower shaft. */
export function addAtcApproach(g: THREE.Group) {
  const span = CELL * 0.7
  const depth = CELL * 0.5
  const wallH = 2.15
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('control_tower', 'wall'))
  body.position.y = wallH / 2
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.2, 0.12, depth + 0.16, SKIN_TILE_M.roof, WORLD_PER_METER), skinMaterial('control_tower', 'roof'))
  roof.position.y = wallH + 0.08
  const frontZ = depth / 2
  const glass = box(span * 0.7, 0.55, 0.06, glassMat(), 0, 1.45, frontZ + 0.02)
  const mast = box(0.12, 1.15, 0.12, skinMaterial('control_tower', 'trim'), span * 0.22, wallH + 0.7, -depth * 0.1)
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12),
    skinMaterial('control_tower', 'trim', { color: '#d7dee6', metalness: 0.4 }),
  )
  dish.position.set(span * 0.22, wallH + 1.25, -depth * 0.1)
  const door = box(0.6, 1.2, 0.08, skinMaterial('control_tower', 'door'), -span * 0.2, 0.65, frontZ + 0.02)
  mountSign(g, 'ATC', { w: span * 0.35, h: 0.26, x: span * 0.12, y: wallH - 0.22, z: frontZ + 0.08 }, '#1c2830', '#f4f7fa')
  mountDock(g, span * 0.4, 0.85, 0, frontZ + 0.6)
  g.add(body, roof, glass, mast, dish, door)
}

/** Pier massing once a prefab hall is tier II or III. Tier I stays the plain shell. */
export function apronPrefabTier(fits: { tier?: number; premade?: boolean; redesigned?: boolean }[] | undefined): 1 | 2 | 3 {
  const fit = fits?.find((row) => row.premade && !row.redesigned)
  const tier = fit?.tier ?? 1
  return tier === 2 || tier === 3 ? tier : 1
}

/** Pier module used once Prefab II raises the hall. One cell, glazed face toward +Z. */
export function addPrefabPier(g: THREE.Group) {
  const span = CELL * 0.92
  const depth = CELL * 0.78
  const wallH = 3.6
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('terminal', 'wall'))
  body.position.y = wallH / 2
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.4, 0.16, depth + 0.55, SKIN_TILE_M.roof, WORLD_PER_METER), skinMaterial('terminal', 'roof'))
  roof.position.set(0, wallH + 0.1, 0.15)
  const frontZ = depth / 2
  const curtain = box(span * 0.78, 1.5, 0.06, glassMat(), 0, 2.15, frontZ + 0.02)
  const stub = box(0.55, 0.45, 1.6, skinMaterial('terminal', 'trim'), span * 0.18, 2.4, frontZ + 0.7)
  const cab = box(0.7, 0.55, 0.7, glassMat(), span * 0.18, 2.35, frontZ + 1.45)
  const column = box(0.14, 2.2, 0.14, skinMaterial('terminal', 'trim'), span * 0.18, 1.1, frontZ + 1.2)
  mountSign(g, 'PREFAB', { w: span * 0.32, h: 0.3, x: -span * 0.2, y: wallH - 0.35, z: frontZ + 0.08 }, '#1f3b57', '#f4f7fa')
  g.add(body, roof, curtain, stub, cab, column)
}
