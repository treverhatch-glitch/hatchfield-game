/**
 * Apron buildings whose massing follows the Gemini concepts: a shed with
 * vehicle bays, a station block, and a gate booth. Colours and photo maps
 * come from the material targets. Words sit on their own panels.
 */
import * as THREE from 'three'
import { SKIN_TILE_M } from '../../build/materialTargets'
import { CELL, WORLD_PER_METER } from '../aircraft/specs'
import { skinBox, skinMaterial, yardMaterial, metreUv } from './buildingSkin'
import { mountDock, mountSign } from './buildingSign'

export function addDepotBuilding(g: THREE.Group) {
  const yard = new THREE.Mesh(metreUv(new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96), 4, WORLD_PER_METER), yardMaterial('gravel'))
  yard.rotation.x = -Math.PI / 2
  yard.position.y = 0.035
  yard.receiveShadow = true
  const span = CELL * 0.9
  const depth = CELL * 0.62
  const wallH = 2.15
  const wall = skinMaterial('ground_services', 'wall')
  const shed = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), wall)
  shed.position.set(0, wallH / 2, -CELL * 0.06)
  shed.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.3, 0.12, depth + 0.45, SKIN_TILE_M.roof, WORLD_PER_METER), skinMaterial('ground_services', 'roof'))
  roof.position.set(0, wallH + 0.06, -CELL * 0.02)
  const frontZ = -CELL * 0.06 + depth / 2
  const bayW = span * 0.22
  const doorMat = skinMaterial('ground_services', 'door')
  const trim = skinMaterial('ground_services', 'trim')
  for (const x of [-span * 0.28, 0, span * 0.28]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(bayW, 1.15, 0.08), doorMat)
    door.position.set(x, 0.62, frontZ + 0.02)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(bayW + 0.12, 0.08, 0.1), trim)
    frame.position.set(x, 1.24, frontZ + 0.04)
    g.add(door, frame)
  }
  const canopy = new THREE.Mesh(skinBox(span + 0.2, 0.08, 1.15, SKIN_TILE_M.roof, WORLD_PER_METER), skinMaterial('ground_services', 'roof'))
  canopy.position.set(0, 1.55, frontZ + 0.45)
  canopy.castShadow = true
  mountSign(g, 'DEPOT', { w: span * 0.42, h: 0.28, x: 0, y: 1.82, z: frontZ + 0.1 }, '#3a3428', '#f6f1e4')
  mountDock(g, span * 0.86, 1.05, 0, frontZ + 0.85)
  g.add(yard, shed, roof, canopy)
}

export function addPoliceBuilding(g: THREE.Group) {
  const span = CELL * 0.7
  const depth = CELL * 0.58
  const wallH = 2.35
  const body = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('police_station', 'wall'))
  body.position.y = wallH / 2
  body.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.2, 0.12, depth + 0.16, SKIN_TILE_M.roof, WORLD_PER_METER), skinMaterial('police_station', 'roof'))
  roof.position.y = wallH + 0.08
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(span + 0.28, 0.22, depth + 0.22), skinMaterial('police_station', 'trim'))
  parapet.position.y = wallH + 0.22
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(span * 0.28, 0.1, 0.16),
    new THREE.MeshStandardMaterial({ color: '#3a8fd4', emissive: '#1a4a88', emissiveIntensity: 0.55 }),
  )
  bar.position.set(0, wallH + 0.42, depth * 0.15)
  const frontZ = depth / 2
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.35, 0.08), skinMaterial('police_station', 'door'))
  door.position.set(-span * 0.18, 0.7, frontZ + 0.02)
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(span * 0.38, 0.55, 0.06),
    new THREE.MeshStandardMaterial({ color: '#9ec4de', roughness: 0.15, metalness: 0.2 }),
  )
  window.position.set(span * 0.16, 1.35, frontZ + 0.02)
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.7), skinMaterial('police_station', 'trim'))
  canopy.position.set(-span * 0.18, 1.55, frontZ + 0.32)
  mountSign(g, 'POLICE', { w: span * 0.55, h: 0.28, x: 0, y: wallH - 0.22, z: frontZ + 0.08 }, '#1c2430', '#d8e4f0')
  mountDock(g, span * 0.7, 0.85, 0, frontZ + 0.7, '#2a3038')
  g.add(body, roof, parapet, bar, door, window, canopy)
}

export function addGuardBuilding(g: THREE.Group) {
  const span = CELL * 0.42
  const depth = CELL * 0.38
  const wallH = 1.85
  const booth = new THREE.Mesh(skinBox(span, wallH, depth, SKIN_TILE_M.wall, WORLD_PER_METER), skinMaterial('guard_booth', 'wall'))
  booth.position.set(-CELL * 0.12, wallH / 2, 0)
  booth.castShadow = true
  const roof = new THREE.Mesh(skinBox(span + 0.55, 0.1, depth + 0.4, SKIN_TILE_M.roof, WORLD_PER_METER), skinMaterial('guard_booth', 'roof'))
  roof.position.set(-CELL * 0.08, wallH + 0.06, 0.08)
  const frontZ = depth / 2
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(span * 0.7, 0.55, 0.06),
    new THREE.MeshStandardMaterial({ color: '#c5d8e4', roughness: 0.12, metalness: 0.15 }),
  )
  window.position.set(-CELL * 0.12, 1.2, frontZ + 0.02)
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.7, 0.08, 0.1),
    skinMaterial('guard_booth', 'trim', { emissive: '#4a3a10', emissiveIntensity: 0.2 }),
  )
  bar.position.set(CELL * 0.16, 0.95, 0.15)
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.28, 0.16),
    new THREE.MeshStandardMaterial({ color: '#e8d080', emissive: '#8a7020', emissiveIntensity: 0.35 }),
  )
  lamp.position.set(-CELL * 0.12, wallH + 0.28, 0)
  mountSign(g, 'GUARD', { w: span * 0.85, h: 0.24, x: -CELL * 0.12, y: wallH - 0.16, z: frontZ + 0.08 }, '#2a3028', '#f2e2a0')
  mountDock(g, CELL * 0.55, 0.55, CELL * 0.18, 0.55, '#3a4048')
  g.add(booth, roof, window, bar, lamp)
}
