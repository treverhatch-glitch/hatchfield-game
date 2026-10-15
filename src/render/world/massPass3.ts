/**
 * Massing pass 3. Hydrant, catering, bag sort, bus and rail stations,
 * helipad, and the three hotels. Concept sheets set the volume, roof and
 * colour. Each vehicle bay is a named `service-bay:*` on the apron.
 * Photo tiles come from the material registry. Words sit on their own panels.
 */
import * as THREE from 'three'
import { HOTEL_WALL, SKIN_TILE_M } from '../../build/materialTargets'
import type { HotelClass } from '../../game/types'
import { CELL, WORLD_PER_METER } from '../aircraft/specs'
import { MASS3_SOCKETS, mass3SocketTable } from '../socketLayout'
import { mountSockets } from '../socketMount'
import { MODEL_SIZE } from '../vehicleModels'
import { metreUv, skinBox, skinMaterial, yardMaterial } from './buildingSkin'
import { mountGable, mountServiceBay, mountSign } from './buildingSign'
import { addParapet, addVault, softenBuilding } from './roundMass'

const wu = (meters: number) => meters * WORLD_PER_METER

const glass = () => new THREE.MeshStandardMaterial({ color: '#9ec4de', roughness: 0.15, metalness: 0.25 })

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function bays(g: THREE.Group, building: string, size: Record<string, { w: number; d: number }>, color: string) {
  const rows = MASS3_SOCKETS[building]
  if (!rows) return
  for (const [id, row] of Object.entries(rows)) {
    const s = size[id]
    if (!s) continue
    mountServiceBay(g, id, s.w, s.d, row.at[0], row.at[2], color)
  }
  mountSockets(g, mass3SocketTable(building))
}

/** Fuel-hydrant pit: a flush lid, a cabinet, and one dispenser stop. */
export function addHydrantPit(g: THREE.Group) {
  const pad = new THREE.Mesh(metreUv(new THREE.PlaneGeometry(CELL * 0.72, CELL * 0.72), 4, WORLD_PER_METER), yardMaterial('gravel'))
  pad.rotation.x = -Math.PI / 2
  pad.position.y = 0.03
  const pit = box(1.5, 0.14, 1.15, skinMaterial('fuel_farm', 'door'), 0, 0.1, 0.15)
  const lid = box(1.15, 0.06, 0.85, skinMaterial('fuel_farm', 'trim', { color: '#e0b020' }), 0, 0.2, 0.15)
  const cabinet = box(0.95, 1.2, 0.55, skinMaterial('fuel_farm', 'wall'), -1.75, 0.68, -0.35)
  const cap = box(1.02, 0.08, 0.62, skinMaterial('fuel_farm', 'trim', { color: '#e0b020' }), -1.75, 1.32, -0.35)
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8),
    skinMaterial('fuel_farm', 'trim', { metalness: 0.45, color: '#c5ced6' }),
  )
  pipe.rotation.z = Math.PI / 2
  pipe.position.set(-0.35, 0.32, -0.85)
  const valve = box(0.16, 0.28, 0.16, skinMaterial('fuel_farm', 'trim', { color: '#d1342c' }), 0.15, 0.38, 0.55)
  mountSign(g, 'HYDRANT', { w: 0.82, h: 0.22, x: -1.75, y: 0.95, z: -0.02 }, '#2a3038', '#f4f7fa')
  bays(g, 'hydrant', { dispenser: { w: 1.7, d: 2.2 } }, '#e0b020')
  g.add(pad, pit, lid, cabinet, cap, pipe, valve)
}

/** Catering kitchen: orange hall, cream roof, two truck doors. */
export function addCateringKitchen(g: THREE.Group) {
  const span = CELL * 0.72
  const depth = CELL * 0.46
  const wallH = 2.3
  const z = -0.9
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('catering_kitchen', 'wall'))
  body.position.set(0, wallH / 2, z)
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.25, 0.12, depth + 0.2, SKIN_TILE_M.roof, WORLD_PER_METER), skinMaterial('catering_kitchen', 'roof'))
  roof.position.set(0, wallH + 0.08, z)
  const front = z + depth / 2
  const doorH = wu(MODEL_SIZE.catering_hilift[1]) + 0.2
  const doorW = Math.max(1.35, wu(MODEL_SIZE.catering_hilift[2]) + 0.25)
  for (const x of [-1.55, 1.55]) {
    const door = box(doorW, doorH, 0.08, skinMaterial('catering_kitchen', 'door'), x, doorH / 2 + 0.04, front + 0.04)
    const bumper = box(doorW + 0.1, 0.12, 0.1, skinMaterial('catering_kitchen', 'trim'), x, 0.2, front + 0.12)
    g.add(door, bumper)
  }
  const vent = box(0.7, 0.42, 0.55, skinMaterial('catering_kitchen', 'trim'), -1.1, wallH + 0.32, z)
  const vent2 = box(0.45, 0.55, 0.4, skinMaterial('catering_kitchen', 'trim'), 1.2, wallH + 0.38, z + 0.2)
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 6), skinMaterial('catering_kitchen', 'trim'))
  stack.position.set(1.2, wallH + 0.85, z + 0.2)
  mountSign(g, 'CATER', { w: 1.5, h: 0.32, x: 0, y: wallH - 0.28, z: front + 0.1 }, '#5b3a1a', '#f7f1e8')
  bays(g, 'kitchen', { '1': { w: 1.6, d: wu(MODEL_SIZE.catering_hilift[0]) }, '2': { w: 1.6, d: wu(MODEL_SIZE.catering_hilift[0]) } }, '#e07a3d')
  addParapet(g, span + 0.1, depth + 0.1, wallH + 0.16, z, skinMaterial('catering_kitchen', 'trim'))
  addVault(g, span * 0.86, depth * 0.8, wallH + 0.18, z, skinMaterial('catering_kitchen', 'roof'), 0.36)
  g.add(body, roof, vent, vent2, stack)
  softenBuilding(g)
}

/** Bag sort hall: three roller doors under a sawtooth roof. */
export function addBagSort(g: THREE.Group) {
  const span = CELL * 0.84
  const depth = CELL * 0.44
  const wallH = 2.2
  const z = -1.05
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('baggage_hall', 'wall'))
  body.position.set(0, wallH / 2, z)
  body.castShadow = true
  const roofMat = skinMaterial('baggage_hall', 'roof')
  const slope = new THREE.Mesh(skinBox(span * 0.48, 0.1, depth + 0.16, SKIN_TILE_M.roof, WORLD_PER_METER), roofMat)
  slope.position.set(-span * 0.22, wallH + 0.32, z)
  slope.rotation.z = 0.22
  slope.castShadow = true
  const slopeR = slope.clone()
  slopeR.position.x = span * 0.22
  slopeR.rotation.z = -0.22
  const front = z + depth / 2
  for (const x of [-2.15, 0, 2.15]) {
    const door = box(1.25, 1.45, 0.08, skinMaterial('baggage_hall', 'door'), x, 0.78, front + 0.04)
    const lip = box(1.15, 0.1, 0.7, skinMaterial('baggage_hall', 'trim'), x, 0.42, front + 0.4)
    g.add(door, lip)
  }
  mountSign(g, 'BAGS', { w: 1.4, h: 0.3, x: 0, y: wallH - 0.22, z: front + 0.1 }, '#3d4650', '#f4f0e4')
  bays(g, 'bags', {
    '1': { w: 1.45, d: wu(MODEL_SIZE.baggage_train[0]) },
    '2': { w: 1.45, d: wu(MODEL_SIZE.baggage_train[0]) },
    '3': { w: 1.45, d: wu(MODEL_SIZE.baggage_train[0]) },
  }, '#e0a21b')
  g.add(body, slope, slopeR)
  softenBuilding(g)
}

/** City bus station: a canopy and two coach stops. */
export function addBusStation(g: THREE.Group) {
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.7),
    new THREE.MeshLambertMaterial({ color: '#3d4248' }),
  )
  pad.rotation.x = -Math.PI / 2
  pad.position.set(0, 0.04, 0.4)
  pad.receiveShadow = true
  const curb = box(CELL * 0.86, 0.14, 0.18, skinMaterial('transit_station', 'trim'), 0, 0.12, -0.55)
  const canopy = box(CELL * 0.8, 0.1, CELL * 0.32, skinMaterial('transit_station', 'roof'), 0, 2.35, -1.15)
  const postMat = skinMaterial('transit_station', 'trim')
  for (const x of [-CELL * 0.32, CELL * 0.32]) {
    g.add(box(0.12, 2.2, 0.12, postMat, x, 1.15, -1.7))
    g.add(box(0.12, 2.2, 0.12, postMat, x, 1.15, -0.6))
  }
  const bench = box(CELL * 0.4, 0.08, 0.4, skinMaterial('transit_station', 'wall'), 0, 0.48, -1.2)
  const glassPane = box(CELL * 0.55, 0.9, 0.04, glass(), 0, 1.15, -1.55)
  mountSign(g, 'BUS', { w: 1.3, h: 0.32, x: 0, y: 2.05, z: -0.95 }, '#1f3b57', '#f4f7fa')
  bays(g, 'bus', { '1': { w: Math.max(1.7, wu(MODEL_SIZE.coach[2]) + 0.3), d: wu(MODEL_SIZE.coach[0]) }, '2': { w: Math.max(1.7, wu(MODEL_SIZE.coach[2]) + 0.3), d: wu(MODEL_SIZE.coach[0]) } }, '#c9a227')
  g.add(pad, curb, canopy, bench, glassPane)
  softenBuilding(g)
}

/** A short train on one track socket. Low boxes so both slots stay cheap. */
function addTrackTrain(g: THREE.Group, id: string, z: number) {
  const at = MASS3_SOCKETS.rail[id]!.at
  const root = new THREE.Group()
  root.name = `train:${id}`
  root.position.set(at[0], 0.36, z)
  const cream = new THREE.MeshStandardMaterial({ color: '#e7e1d4', roughness: 0.55 })
  const red = new THREE.MeshStandardMaterial({ color: '#9c2b2b', roughness: 0.5 })
  const glassM = glass()
  const steel = new THREE.MeshStandardMaterial({ color: '#3a4148', roughness: 0.4, metalness: 0.35 })
  const loco = box(2.15, 0.85, 0.48, cream, 1.35, 0.55, 0)
  const cab = box(0.85, 0.55, 0.46, cream, 0.45, 1.15, 0)
  const nose = box(0.35, 0.42, 0.4, red, 2.35, 0.4, 0)
  const car = box(3.15, 0.78, 0.48, cream, -1.55, 0.52, 0)
  const windows = box(2.4, 0.28, 0.5, glassM, -1.55, 0.72, 0)
  const cabGlass = box(0.7, 0.28, 0.48, glassM, 0.45, 1.22, 0)
  for (const x of [1.7, 0.7, -0.7, -2.4]) root.add(box(0.45, 0.22, 0.52, steel, x, 0.08, 0))
  root.add(loco, cab, nose, car, windows, cabGlass)
  g.add(root)
}

/** Helicopter parked on the pad socket. Blades are two slabs, not a disc. */
function addPadHeli(g: THREE.Group) {
  const at = MASS3_SOCKETS.helipad.pad!.at
  const root = new THREE.Group()
  root.name = 'heli:pad'
  root.visible = false
  root.position.set(at[0], 0.22, at[2])
  const white = new THREE.MeshStandardMaterial({ color: '#e8eef4', roughness: 0.45 })
  const dark = new THREE.MeshStandardMaterial({ color: '#2c343c', roughness: 0.5 })
  const body = box(1.35, 0.42, 0.48, white, 0.15, 0.38, 0)
  const nose = box(0.4, 0.28, 0.4, glass(), 0.85, 0.4, 0)
  const boom = box(1.15, 0.1, 0.1, dark, -0.95, 0.42, 0)
  const fin = box(0.08, 0.32, 0.22, dark, -1.5, 0.58, 0)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6), dark)
  mast.position.set(0.15, 0.78, 0)
  const bladeA = box(2.2, 0.03, 0.1, dark, 0.15, 0.96, 0)
  const bladeB = box(0.1, 0.03, 2.2, dark, 0.15, 0.98, 0)
  const tailRotor = box(0.04, 0.28, 0.06, dark, -1.5, 0.58, 0.14)
  for (const s of [-1, 1]) {
    root.add(box(1.15, 0.04, 0.05, dark, 0.1, 0.06, s * 0.22))
    root.add(box(0.05, 0.22, 0.05, dark, 0.35, 0.16, s * 0.18))
    root.add(box(0.05, 0.22, 0.05, dark, -0.25, 0.16, s * 0.18))
  }
  root.add(body, nose, boom, fin, mast, bladeA, bladeB, tailRotor)
  g.add(root)
}

/** Rail hall, a platform, and a train on each track socket. */
export function addRailStation(g: THREE.Group) {
  const span = CELL * 0.58
  const depth = CELL * 0.34
  const wallH = 2.35
  const z = -1.85
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('transit_station', 'wall'))
  body.position.set(0, wallH / 2, z)
  body.castShadow = true
  mountGable(g, skinMaterial('transit_station', 'roof'), span + 0.3, depth + 0.2, wallH, 0.7)
  const right = g.children[g.children.length - 1]
  const left = g.children[g.children.length - 2]
  if (right) right.position.z = z
  if (left) left.position.z = z
  const front = z + depth / 2
  const door = box(0.9, 1.4, 0.08, skinMaterial('transit_station', 'door'), 0, 0.75, front + 0.04)
  const pane = box(span * 0.55, 0.55, 0.05, glass(), 0, 1.7, front + 0.04)
  const platform = box(CELL * 0.88, 0.22, CELL * 0.42, skinMaterial('transit_station', 'wall'), 0, 0.16, 1.85)
  const railMat = skinMaterial('transit_station', 'trim', { metalness: 0.4, color: '#c5ced6' })
  for (const [id, tz] of [['track1', 1.15], ['track2', 2.55]] as const) {
    g.add(box(CELL * 0.82, 0.06, 0.06, railMat, 0, 0.3, tz - 0.22))
    g.add(box(CELL * 0.82, 0.06, 0.06, railMat, 0, 0.3, tz + 0.22))
    addTrackTrain(g, id, tz)
  }
  const canopy = box(CELL * 0.7, 0.08, CELL * 0.5, skinMaterial('transit_station', 'roof'), 0, 2.55, 1.85)
  for (const x of [-CELL * 0.28, CELL * 0.28]) g.add(box(0.12, 2.3, 0.12, railMat, x, 1.25, 1.85))
  mountSign(g, 'RAIL', { w: 1.35, h: 0.3, x: 0, y: wallH - 0.25, z: front + 0.1 }, '#1f3b57', '#f4f7fa')
  bays(g, 'rail', { track1: { w: CELL * 0.7, d: 0.85 }, track2: { w: CELL * 0.7, d: 0.85 } }, '#c9a227')
  g.add(body, door, pane, platform, canopy)
}

/** Helipad: a marked circle, a windsock, and a bowser stop beside a cabinet. */
export function addHelipad(g: THREE.Group) {
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(CELL * 0.36, CELL * 0.36, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.55 }),
  )
  pad.position.y = 0.08
  pad.receiveShadow = true
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(CELL * 0.26, CELL * 0.3, 16),
    new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.4, side: THREE.DoubleSide }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.15
  const bar = box(CELL * 0.08, 0.04, CELL * 0.28, new THREE.MeshStandardMaterial({ color: '#e8eef4' }), 0, 0.16, 0)
  const cross = box(CELL * 0.28, 0.04, CELL * 0.08, new THREE.MeshStandardMaterial({ color: '#e8eef4' }), 0, 0.16, 0)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), skinMaterial('deice_pad', 'trim'))
  pole.position.set(-CELL * 0.32, 0.9, -CELL * 0.22)
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 6), skinMaterial('deice_pad', 'trim', { color: '#e8742a' }))
  sock.rotation.z = Math.PI / 2
  sock.position.set(-CELL * 0.32 + 0.35, 1.55, -CELL * 0.22)
  const cabinet = box(0.7, 0.9, 0.5, skinMaterial('fuel_farm', 'wall'), 2.55, 0.5, 2.15)
  const cap = box(0.76, 0.08, 0.56, skinMaterial('fuel_farm', 'trim', { color: '#e0b020' }), 2.55, 0.98, 2.15)
  mountSign(g, 'HELI', { w: 0.7, h: 0.2, x: 2.55, y: 0.72, z: 2.46 }, '#2a3038', '#f4f7fa')
  bays(
    g,
    'helipad',
    { pad: { w: CELL * 0.48, d: CELL * 0.48 }, bowser: { w: Math.max(1.6, wu(MODEL_SIZE.fuel_tanker[2]) + 0.2), d: wu(MODEL_SIZE.fuel_tanker[0]) } },
    '#c9a227',
  )
  addPadHeli(g)
  g.add(pad, ring, bar, cross, pole, sock, cabinet, cap)
}

/** Landside hotels. The plinth stays one cell. Each grade has a coach drop and a van door. */
export function addHotelMass(g: THREE.Group, cls: HotelClass) {
  const plinth = box(CELL * 0.96, 0.18, CELL * 0.96, new THREE.MeshStandardMaterial({ color: '#6a6e76', roughness: 0.8 }), 0, 0.09, 0)
  plinth.castShadow = false
  g.add(plinth)
  if (cls === 'inn') addInn(g)
  else if (cls === 'resort') addResort(g)
  else addBiz(g)
}

function addInn(g: THREE.Group) {
  const span = CELL * 0.74
  const depth = CELL * 0.56
  const wallH = 2.45
  const z = -0.55
  const body = new THREE.Mesh(
    skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER),
    skinMaterial('hotel', 'wall', { color: HOTEL_WALL.inn }),
  )
  body.position.set(0, wallH / 2 + 0.1, z)
  body.castShadow = true
  const roof = new THREE.Mesh(new THREE.ConeGeometry(CELL * 0.42, 1.05, 4), new THREE.MeshStandardMaterial({ color: '#6b3a2a', roughness: 0.65 }))
  roof.position.set(0, wallH + 0.7, z)
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  const front = z + depth / 2
  const awning = box(CELL * 0.4, 0.08, 1.1, skinMaterial('hotel', 'trim'), 0, 1.7, front + 0.35)
  const door = box(0.6, 1.15, 0.08, skinMaterial('hotel', 'door'), 0, 0.75, front + 0.04)
  const winMat = glass()
  for (const dx of [-1.15, 1.15]) g.add(box(0.55, 0.5, 0.05, winMat, dx, 1.7, front + 0.04))
  mountSign(g, 'INN', { w: 1.15, h: 0.28, x: 0, y: 2.15, z: front + 0.1 }, '#6b3a2a', '#f7f1e8')
  bays(g, 'hotel_inn', { drop: { w: 1.8, d: wu(MODEL_SIZE.coach[0]) }, service: { w: 1.15, d: wu(MODEL_SIZE.van[0]) } }, '#2f6f9a')
  g.add(body, roof, awning, door)
  softenBuilding(g)
}

function addBiz(g: THREE.Group) {
  const span = CELL * 0.76
  const depth = CELL * 0.58
  const wallH = 4.6
  const z = -0.5
  const body = new THREE.Mesh(
    skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER),
    skinMaterial('hotel', 'wall', { color: HOTEL_WALL.business }),
  )
  body.position.set(0, wallH / 2 + 0.1, z)
  body.castShadow = true
  const roof = new THREE.Mesh(
    skinBox(span + 0.2, 0.22, depth + 0.16, SKIN_TILE_M.roof, WORLD_PER_METER),
    skinMaterial('hotel', 'roof', { color: '#4a4038' }),
  )
  roof.position.set(0, wallH + 0.22, z)
  const front = z + depth / 2
  const porch = box(CELL * 0.42, 1.5, 0.7, skinMaterial('hotel', 'trim'), 0, 0.85, front + 0.2)
  const canopy = box(CELL * 0.5, 0.1, 1.15, skinMaterial('hotel', 'trim'), 0, 1.85, front + 0.4)
  const glassBand = box(span * 0.72, 2.6, 0.05, glass(), 0, 3.15, front + 0.04)
  mountSign(g, 'BIZ', { w: 1.2, h: 0.28, x: 0, y: 2.15, z: front + 0.55 }, '#2f5d8a', '#f4f7fa')
  bays(g, 'hotel_biz', { drop: { w: 1.8, d: wu(MODEL_SIZE.coach[0]) }, service: { w: 1.15, d: wu(MODEL_SIZE.van[0]) } }, '#2f6f9a')
  addParapet(g, span + 0.05, depth + 0.05, wallH + 0.34, z, skinMaterial('hotel', 'trim'))
  g.add(body, roof, porch, canopy, glassBand)
  softenBuilding(g)
}

function addResort(g: THREE.Group) {
  const z = -0.35
  const towerW = CELL * 0.52
  const towerD = CELL * 0.42
  const towerH = 6.2
  const tower = new THREE.Mesh(
    skinBox(towerW, towerH, towerD, SKIN_TILE_M.wall, WORLD_PER_METER),
    skinMaterial('hotel', 'wall', { color: HOTEL_WALL.resort, metalness: 0.15 }),
  )
  tower.position.set(0, towerH / 2 + 0.15, z)
  tower.castShadow = true
  const wing = box(CELL * 0.88, 1.8, CELL * 0.4, new THREE.MeshStandardMaterial({ color: '#b8c4ce', roughness: 0.45 }), 0, 1.05, z - 0.15)
  const front = z + towerD / 2
  const glassFace = box(towerW * 0.72, 4.4, 0.05, glass(), 0, 3.4, front + 0.04)
  const canopy = box(CELL * 0.55, 0.1, 1.2, skinMaterial('hotel', 'trim', { color: '#c9a227' }), 0, 2.15, front + 0.45)
  const crown = box(towerW + 0.2, 0.4, towerD + 0.16, skinMaterial('hotel', 'trim'), 0, towerH + 0.3, z)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), skinMaterial('hotel', 'trim'))
  mast.position.set(0, towerH + 0.95, z)
  mountSign(g, 'RESORT', { w: 1.45, h: 0.28, x: 0, y: 2.45, z: front + 0.6 }, '#1f3b57', '#f4f7fa')
  bays(g, 'hotel_resort', { drop: { w: 1.8, d: wu(MODEL_SIZE.coach[0]) }, service: { w: 1.5, d: wu(MODEL_SIZE.van[0]) } }, '#c9a227')
  g.add(tower, wing, glassFace, canopy, crown, mast)
  softenBuilding(g)
}
