import * as THREE from 'three'
import { CELL, WORLD_PER_METER } from '../render/aircraft/specs'
import { metreUv, skinBox, skinMaterial, tankUv, yardMaterial } from '../render/world/buildingSkin'
import { mountDock, mountServiceBay, mountSign } from '../render/world/buildingSign'
import { addFuelRailMass, addPeopleMoverMass, addSkywalkMass, addTravelatorMass } from '../render/world/progressionBuildings'
import { addHangar, HANGAR_WALL_H } from '../render/world/hangarMass'
import { SKIN_TILE_M } from '../build/materialTargets'

export { addHangar, HANGAR_WALL_H }

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

/** A short quay. The barge ties up on the river side of the cell. */
export function addBerth(g: THREE.Group) {
  const deck = new THREE.Mesh(metreUv(new THREE.BoxGeometry(CELL * 0.92, 0.16, CELL * 0.55), 4, WORLD_PER_METER), yardMaterial('gravel'))
  deck.position.set(0, 0.12, -CELL * 0.1)
  deck.receiveShadow = true
  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8), metal('#d7dee6'))
  bollard.position.set(-CELL * 0.28, 0.5, CELL * 0.16)
  const bollard2 = bollard.clone()
  bollard2.position.x = CELL * 0.28
  mountSign(g, 'BERTH', { w: 1.1, h: 0.24, x: 0, y: 1.1, z: CELL * 0.05 }, '#1f3b57', '#f4f7fa')
  g.add(deck, bollard, bollard2)
}

/** One pipe along the cell. Distinct from the twin fuel-rail runs. */
export function addFuelPipe(g: THREE.Group) {
  const pad = new THREE.Mesh(metreUv(new THREE.BoxGeometry(CELL * 0.94, 0.06, CELL * 0.28), 4, WORLD_PER_METER), yardMaterial('gravel'))
  pad.position.y = 0.04
  pad.receiveShadow = true
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, CELL * 0.92, 10), metal('#e07a3d', 0.4))
  pipe.rotation.z = Math.PI / 2
  pipe.position.y = 0.28
  pipe.castShadow = true
  g.add(pad, pipe)
}

/** Receipt manifold. The pipe ends here and the farm takes the batch. */
export function addManifold(g: THREE.Group) {
  const pad = new THREE.Mesh(metreUv(new THREE.BoxGeometry(CELL * 0.9, 0.1, CELL * 0.9), 4, WORLD_PER_METER), yardMaterial('gravel'))
  pad.position.y = 0.05
  pad.receiveShadow = true
  const house = new THREE.Mesh(
    skinBox(CELL * 0.46, 1.6, CELL * 0.4, SKIN_TILE_M.wall, WORLD_PER_METER),
    skinMaterial('fuel_farm', 'wall'),
  )
  house.position.set(0, 0.9, 0)
  house.castShadow = true
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, CELL * 0.7, 8), metal('#e07a3d', 0.4))
  pipe.rotation.z = Math.PI / 2
  pipe.position.set(0, 0.4, CELL * 0.22)
  mountSign(g, 'PIPE', { w: 0.9, h: 0.24, x: 0, y: 1.5, z: CELL * 0.22 }, '#2a3038', '#f4f7fa')
  mountDock(g, CELL * 0.4, 0.9, 0, CELL * 0.28)
  g.add(pad, house, pipe)
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

export function addTravelator(g: THREE.Group) {
  addTravelatorMass(g)
}

export function addSkywalk(g: THREE.Group) {
  addSkywalkMass(g)
}

export function addPeopleMover(g: THREE.Group) {
  addPeopleMoverMass(g)
}
