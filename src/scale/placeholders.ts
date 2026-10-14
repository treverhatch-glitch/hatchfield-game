import * as THREE from 'three'
import { CELL, WORLD_PER_METER } from '../render/aircraft/specs'
import { metreUv, skinBox, skinMaterial, tankUv, yardMaterial } from '../render/world/buildingSkin'
import { mountDock, mountGable, mountServiceBay, mountSign } from '../render/world/buildingSign'
import { addFuelRailMass, addPeopleMoverMass, addSkywalkMass, addTravelatorMass } from '../render/world/progressionBuildings'
import { SKIN_TILE_M } from '../build/materialTargets'
import type { SizeTier } from './types'

/** Wall height in world units. The gable rises above this. */
export const HANGAR_WALL_H: Record<SizeTier, number> = { small: 3.2, wide: 4.6, jumbo: 6.4 }

const HANGAR_WORD: Record<SizeTier, string> = { small: 'HANGAR', wide: 'WIDE', jumbo: 'JUMBO' }

/**
 * Placeholder meshes in the same flat-shaded apron style as the other buildings.
 * Dimensions are real-metre cells, not a cartoon scale.
 */

function metal(color: string, roughness = 0.45): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.25 })
}

export function addFuelRail(g: THREE.Group) {
  addFuelRailMass(g)
}

export function addOilStation(g: THREE.Group) {
  const pad = new THREE.Mesh(metreUv(new THREE.BoxGeometry(CELL * 0.92, 0.1, CELL * 0.92), 4, WORLD_PER_METER), yardMaterial('gravel'))
  pad.position.y = 0.05
  pad.receiveShadow = true
  const tank = new THREE.Mesh(
    tankUv(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 12), SKIN_TILE_M.tank, WORLD_PER_METER),
    skinMaterial('fuel_farm', 'wall', { metalness: 0.25 }),
  )
  tank.position.set(-CELL * 0.18, 1.3, 0)
  tank.castShadow = true
  const tank2 = tank.clone()
  tank2.position.x = CELL * 0.16
  const gantry = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.7, 0.12, 0.16), metal('#d7dee6'))
  gantry.position.set(0, 2.55, CELL * 0.22)
  const hose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), metal('#e07a3d', 0.5))
  hose.position.set(CELL * 0.28, 1.7, CELL * 0.22)
  const bund = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.7, 0.28, 0.1), metal('#8a9098', 0.6))
  bund.position.set(0, 0.2, CELL * 0.22)
  mountSign(g, 'OIL', { w: 0.9, h: 0.24, x: 0, y: 2.15, z: CELL * 0.22 + 0.12 }, '#2a3038', '#f4f7fa')
  mountDock(g, CELL * 0.45, 0.9, CELL * 0.28, CELL * 0.22 + 0.7)
  mountServiceBay(g, 'transfer', 1.4, 1.1, CELL * 0.28, CELL * 0.22 + 0.15, '#e07a3d')
  g.add(pad, tank, tank2, gantry, hose, bund)
}

export function addHangar(g: THREE.Group, tier: SizeTier) {
  const height = HANGAR_WALL_H[tier]
  const span = CELL * (tier === 'jumbo' ? 0.96 : 0.92)
  const depth = CELL * 0.72
  const t = 0.16
  const wall = skinMaterial('hangar', 'wall', { metalness: 0.25 })
  const roofMat = skinMaterial('hangar', 'roof')
  const back = new THREE.Mesh(skinBox(span, height, t, SKIN_TILE_M.wall, WORLD_PER_METER), wall)
  back.position.set(0, height / 2, -depth / 2)
  back.castShadow = true
  const sideGeo = skinBox(t, height, depth, SKIN_TILE_M.wall, WORLD_PER_METER)
  const sideL = new THREE.Mesh(sideGeo, wall)
  sideL.position.set(-span / 2, height / 2, 0)
  sideL.castShadow = true
  const sideR = new THREE.Mesh(sideGeo, wall)
  sideR.position.set(span / 2, height / 2, 0)
  sideR.castShadow = true
  const doorH = height * (tier === 'small' ? 0.62 : 0.72)
  const lintelH = Math.max(0.4, height - doorH)
  const lintel = new THREE.Mesh(skinBox(span, lintelH, t, SKIN_TILE_M.wall, WORLD_PER_METER), wall)
  lintel.position.set(0, height - lintelH / 2, depth / 2)
  const doorW = span * (tier === 'jumbo' ? 0.82 : tier === 'wide' ? 0.74 : 0.64)
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH * 0.92, 0.08), skinMaterial('hangar', 'door'))
  door.position.set(0, doorH * 0.46, depth / 2 + 0.02)
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(span * 0.88, 0.12, 0.08),
    tier === 'small' ? skinMaterial('hangar', 'trim', { metalness: 0.25 }) : metal(tier === 'jumbo' ? '#c9a227' : '#3d6a8a'),
  )
  stripe.position.set(0, height - lintelH * 0.45, depth / 2 + 0.06)
  const rise = tier === 'jumbo' ? 1.15 : tier === 'wide' ? 0.85 : 0.55
  mountGable(g, roofMat, span + 0.3, depth + 0.35, height, rise)
  const canopy = new THREE.Mesh(skinBox(doorW + 0.5, 0.08, 0.85, SKIN_TILE_M.roof, WORLD_PER_METER), roofMat)
  canopy.position.set(0, doorH + 0.12, depth / 2 + 0.36)
  canopy.castShadow = true
  mountSign(
    g,
    HANGAR_WORD[tier],
    { w: Math.min(doorW * 0.55, 2.4), h: 0.32, x: 0, y: doorH + 0.38, z: depth / 2 + 0.1 },
    '#1c2830',
    '#f4f7fa',
  )
  mountDock(g, doorW, 1.1, 0, depth / 2 + 0.85)
  mountServiceBay(g, 'nose', doorW * 0.72, 0.9, 0, depth / 2 + 0.4, '#d7a21a')
  g.add(back, sideL, sideR, lintel, door, stripe, canopy)
}

export function addTravelator(g: THREE.Group) {
  addTravelatorMass(g)
}

export function addSkywalk(g: THREE.Group) {
  addSkywalkMass(g)
}

export function addPeopleMover(g: THREE.Group) {
  addPeopleMoverMass(g)
}
