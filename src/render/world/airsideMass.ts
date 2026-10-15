/**
 * Airside support massing, pass 2. Each building keeps a real footprint and
 * puts a named bay on the apron where a truck or an aircraft nose stops.
 * The fuel-farm fill socket stays on the primary tank.
 */
import * as THREE from 'three'
import { SKIN_TILE_M } from '../../build/materialTargets'
import { CELL, WORLD_PER_METER } from '../aircraft/specs'
import { FUEL_TILE_SOCKETS } from '../socketLayout'
import { mountSockets } from '../socketMount'
import { metreUv, skinBox, skinMaterial, tankUv, yardMaterial } from './buildingSkin'
import { exteriorTexture } from './exteriorArt'
import { mountServiceBay, mountSign } from './buildingSign'

function wall(target: Parameters<typeof skinMaterial>[0], part: Parameters<typeof skinMaterial>[1]) {
  return skinMaterial(target, part)
}

/** Tank farm: bund, pump house, and a fill bay on the +X outlet. */
export function addFuelFarm(g: THREE.Group) {
  const yard = new THREE.Mesh(metreUv(new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96), 4, WORLD_PER_METER), yardMaterial('gravel'))
  yard.rotation.x = -Math.PI / 2
  yard.position.y = 0.03
  yard.receiveShadow = true
  const tank = new THREE.Mesh(
    tankUv(new THREE.CylinderGeometry(1.1, 1.1, 2.4, 12), SKIN_TILE_M.tank, WORLD_PER_METER),
    skinMaterial('fuel_farm', 'wall', { metalness: 0.35 }),
  )
  tank.name = 'fuel-tank'
  tank.position.set(0, 1.2, 0)
  tank.castShadow = true
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.18, 12, 1, true), wall('fuel_farm', 'trim'))
  band.position.y = 2.05
  const spare = new THREE.Mesh(
    tankUv(new THREE.CylinderGeometry(0.85, 0.85, 2.1, 12), SKIN_TILE_M.tank, WORLD_PER_METER),
    skinMaterial('fuel_farm', 'wall', { metalness: 0.35 }),
  )
  spare.position.set(-0.15, 1.05, -2.55)
  spare.castShadow = true
  const spareBand = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.14, 12, 1, true), wall('fuel_farm', 'trim'))
  spareBand.position.set(-0.15, 1.85, -2.55)
  const pump = new THREE.Mesh(skinBox(1.7, 1.45, 1.35, SKIN_TILE_M.wall, WORLD_PER_METER), wall('fuel_farm', 'wall'))
  pump.position.set(-2.55, 0.75, 0.35)
  pump.castShadow = true
  const pumpRoof = new THREE.Mesh(skinBox(1.85, 0.1, 1.5, SKIN_TILE_M.roof, WORLD_PER_METER), wall('fuel_farm', 'roof'))
  pumpRoof.position.set(-2.55, 1.52, 0.35)
  const bundH = 0.42
  const bundMat = wall('fuel_farm', 'trim')
  const bund = (w: number, d: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, bundH, d), bundMat)
    mesh.position.set(x, bundH / 2, z)
    return mesh
  }
  // Bund opens on +X so the tanker can reach the outlet.
  const walls = [
    bund(CELL * 0.72, 0.12, -0.7, -CELL * 0.4),
    bund(CELL * 0.72, 0.12, -0.7, CELL * 0.28),
    bund(0.12, CELL * 0.62, -CELL * 0.4, -0.4),
  ]
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), wall('fuel_farm', 'door'))
  reel.rotation.z = Math.PI / 2
  reel.position.set(1.55, 0.7, 0.35)
  const hose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), wall('fuel_farm', 'trim'))
  hose.position.set(1.55, 0.4, 0.15)
  mountSign(g, 'FUEL', { w: 1.2, h: 0.28, x: -2.55, y: 1.7, z: 1.15 }, '#2a3038', '#f4f7fa')
  mountServiceBay(g, 'fill', 1.6, 2.2, 2.7, 0.15, '#d7a21a')
  g.add(yard, tank, band, spare, spareBand, pump, pumpRoof, reel, hose, ...walls)
  mountSockets(g, FUEL_TILE_SOCKETS)
}

/** Two apparatus bays, a watch window, and a hose tower. */
export function addFireStation(g: THREE.Group) {
  const span = CELL * 0.86
  const depth = CELL * 0.58
  const wallH = 2.45
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), wall('fire_station', 'wall'))
  body.position.set(0, wallH / 2, -CELL * 0.06)
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.35, 0.12, depth + 0.4, SKIN_TILE_M.roof, WORLD_PER_METER), wall('fire_station', 'roof'))
  roof.position.set(0, wallH + 0.08, -CELL * 0.02)
  const frontZ = -CELL * 0.06 + depth / 2
  const doorMat = wall('fire_station', 'door')
  const trim = wall('fire_station', 'trim')
  const bayW = span * 0.34
  for (const [i, x] of [[1, -span * 0.22], [2, span * 0.22]] as const) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(bayW, 1.7, 0.08), doorMat)
    door.position.set(x, 0.9, frontZ + 0.02)
    door.name = `apparatus:${i}`
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(bayW + 0.14, 0.1, 0.1), trim)
    lintel.position.set(x, 1.82, frontZ + 0.04)
    g.add(door, lintel)
    mountServiceBay(g, String(i), bayW * 0.92, 1.35, x, frontZ + 1.05, '#e23b32')
  }
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(span * 0.22, 0.55, 0.06),
    new THREE.MeshStandardMaterial({ color: '#9ec4de', roughness: 0.15, metalness: 0.2 }),
  )
  glass.position.set(0, 2.05, frontZ + 0.03)
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.35, 8), wall('fire_station', 'wall'))
  tower.position.set(span * 0.42, wallH + 0.7, -depth * 0.2)
  tower.castShadow = true
  const towerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.12, 8), wall('fire_station', 'roof'))
  towerCap.position.set(span * 0.42, wallH + 1.4, -depth * 0.2)
  mountSign(g, 'FIRE', { w: span * 0.28, h: 0.28, x: 0, y: wallH - 0.15, z: frontZ + 0.08 }, '#3a1818', '#f6f1e4')
  g.add(body, roof, glass, tower, towerCap)
}

/** Three truck docks under a canopy. */
export function addCargoShed(g: THREE.Group) {
  const span = CELL * 0.9
  const depth = CELL * 0.7
  const wallH = 2.6
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), wall('cargo_terminal', 'wall'))
  body.position.set(0, wallH / 2, -CELL * 0.04)
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.3, 0.14, depth + 0.55, SKIN_TILE_M.roof, WORLD_PER_METER), wall('cargo_terminal', 'roof'))
  roof.position.set(0, wallH + 0.08, 0.1)
  const frontZ = -CELL * 0.04 + depth / 2
  const doorMat = wall('cargo_terminal', 'door')
  const trim = wall('cargo_terminal', 'trim')
  for (const [i, x] of [[1, -0.28], [2, 0], [3, 0.28]] as const) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.18, 1.35, 0.08), doorMat)
    door.position.set(CELL * x, 0.7, frontZ + 0.02)
    door.name = `dock-door:${i}`
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.2, 0.1, 0.1), trim)
    lintel.position.set(CELL * x, 1.42, frontZ + 0.05)
    g.add(door, lintel)
    mountServiceBay(g, String(i), CELL * 0.16, 1.15, CELL * x, frontZ + 0.95, '#d7a21a')
  }
  const canopy = new THREE.Mesh(skinBox(span + 0.2, 0.08, 1.2, SKIN_TILE_M.roof, WORLD_PER_METER), wall('cargo_terminal', 'roof'))
  canopy.position.set(0, 1.7, frontZ + 0.55)
  canopy.castShadow = true
  mountSign(g, 'CARGO', { w: span * 0.32, h: 0.28, x: 0, y: wallH - 0.2, z: frontZ + 0.1 }, '#2a2824', '#f4f0e4')
  g.add(body, roof, canopy)
}

/** Capture pad, fluid tank, and a truck bay beside the boom. */
export function addDeicePad(g: THREE.Group) {
  const pad = new THREE.Mesh(
    metreUv(new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95), 4, WORLD_PER_METER),
    new THREE.MeshLambertMaterial({ color: '#3a4a58' }),
  )
  pad.rotation.x = -Math.PI / 2
  pad.position.y = 0.04
  pad.receiveShadow = true
  const berm = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.7, 0.16, 0.1), wall('deice_pad', 'trim'))
  berm.position.set(0.2, 0.12, -CELL * 0.28)
  const tank = new THREE.Mesh(
    tankUv(new THREE.CylinderGeometry(0.55, 0.65, 1.6, 10), SKIN_TILE_M.tank, WORLD_PER_METER),
    skinMaterial('deice_pad', 'wall', { metalness: 0.35 }),
  )
  tank.position.set(-CELL * 0.28, 0.85, -CELL * 0.22)
  tank.castShadow = true
  const boom = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.42, 0.1, 0.16), wall('deice_pad', 'trim'))
  boom.position.set(-CELL * 0.05, 1.55, -CELL * 0.22)
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.45, 0.16),
    new THREE.MeshStandardMaterial({ color: '#7ec8e0', emissive: '#2a6070', emissiveIntensity: 0.25 }),
  )
  head.position.set(CELL * 0.12, 1.25, -CELL * 0.22)
  mountServiceBay(g, 'pad', CELL * 0.55, CELL * 0.42, CELL * 0.08, CELL * 0.08, '#e8d56a')
  mountServiceBay(g, 'truck', 1.5, 1.3, -CELL * 0.28, CELL * 0.22, '#3fa8d6')
  mountSign(g, 'DEICE', { w: 1.15, h: 0.26, x: -CELL * 0.28, y: 1.85, z: -CELL * 0.22 + 0.7 }, '#1c2830', '#f4f7fa')
  g.add(pad, berm, tank, boom, head)
}

/** Cab stays inside the cell. A ramp bay sits at the foot for the service van. */
export function addControlTower(g: THREE.Group) {
  const cabR = CELL * 0.42
  const shaft = new THREE.Mesh(
    tankUv(new THREE.CylinderGeometry(cabR * 0.45, cabR * 0.72, CELL * 0.55, 10), SKIN_TILE_M.wall, WORLD_PER_METER),
    wall('control_tower', 'wall'),
  )
  shaft.position.y = CELL * 0.28
  shaft.castShadow = true
  const cabMat = new THREE.MeshStandardMaterial({
    color: '#c5d8e6',
    roughness: 0.15,
    metalness: 0.2,
    emissive: '#1a3348',
    emissiveIntensity: 0.25,
  })
  const curtain = exteriorTexture('curtain')
  if (curtain) cabMat.map = curtain
  const cab = new THREE.Mesh(tankUv(new THREE.CylinderGeometry(cabR, cabR * 0.86, CELL * 0.12, 12), 2.4, WORLD_PER_METER), cabMat)
  cab.position.y = CELL * 0.58
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(cabR * 0.7, cabR * 1.04, CELL * 0.04, 12), wall('control_tower', 'roof'))
  cap.position.y = CELL * 0.66
  const band = new THREE.Mesh(new THREE.CylinderGeometry(cabR * 0.88, cabR * 0.88, CELL * 0.025, 12, 1, true), wall('control_tower', 'trim'))
  band.position.y = CELL * 0.51
  const base = new THREE.Mesh(skinBox(CELL * 0.55, 1.15, CELL * 0.42, SKIN_TILE_M.wall, WORLD_PER_METER), wall('control_tower', 'wall'))
  base.position.set(0, 0.58, CELL * 0.22)
  base.castShadow = true
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.06), wall('control_tower', 'door'))
  door.position.set(0, 0.5, CELL * 0.22 + CELL * 0.21)
  mountServiceBay(g, 'ramp', 1.6, 1.2, 0, CELL * 0.42 + 0.75, '#d7a21a')
  mountSign(g, 'TOWER', { w: 1.2, h: 0.26, x: 0, y: 1.25, z: CELL * 0.44 }, '#1c2830', '#f4f7fa')
  g.add(shaft, cab, cap, band, base, door)
}
