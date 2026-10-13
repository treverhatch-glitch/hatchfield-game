import * as THREE from 'three'
import { CELL } from '../render/aircraft/specs'
import type { SizeTier } from './types'

/**
 * Placeholder meshes in the same flat-shaded apron style as the other buildings.
 * Dimensions are real-metre cells, not a cartoon scale.
 */

function metal(color: string, roughness = 0.45): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.25 })
}

export function addFuelRail(g: THREE.Group) {
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.92, 0.08, CELL * 0.55),
    new THREE.MeshLambertMaterial({ color: '#2a3036' }),
  )
  bed.position.y = 0.06
  bed.receiveShadow = true
  const ties = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.78, 0.06, CELL * 0.42),
    metal('#4a4036', 0.7),
  )
  ties.position.y = 0.12
  const railL = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.9, 0.08, 0.06), metal('#8d97a1', 0.35))
  railL.position.set(0, 0.18, -0.22 * CELL)
  const railR = railL.clone()
  railR.position.z = 0.22 * CELL
  g.add(bed, ties, railL, railR)
}

export function addOilStation(g: THREE.Group) {
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.92, 0.1, CELL * 0.92),
    new THREE.MeshLambertMaterial({ color: '#343a40' }),
  )
  pad.position.y = 0.05
  pad.receiveShadow = true
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 12), metal('#c4b07a', 0.4))
  tank.position.set(-CELL * 0.18, 1.3, 0)
  tank.castShadow = true
  const tank2 = tank.clone()
  tank2.position.x = CELL * 0.16
  const gantry = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.7, 0.12, 0.16), metal('#d7dee6'))
  gantry.position.set(0, 2.55, CELL * 0.22)
  const hose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), metal('#e07a3d', 0.5))
  hose.position.set(CELL * 0.28, 1.7, CELL * 0.22)
  g.add(pad, tank, tank2, gantry, hose)
}

export function addHangar(g: THREE.Group, tier: SizeTier) {
  const height = tier === 'jumbo' ? 6.4 : tier === 'wide' ? 4.6 : 3.2
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.95, height, CELL * 0.95),
    metal(tier === 'jumbo' ? '#6e7884' : '#7a8490', 0.55),
  )
  body.position.y = height / 2
  body.castShadow = true
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.62, height * 0.55, 0.08),
    new THREE.MeshStandardMaterial({ color: '#1e242b', roughness: 0.6 }),
  )
  door.position.set(0, height * 0.28, CELL * 0.46)
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.7, 0.12, 0.1),
    metal(tier === 'jumbo' ? '#c9a227' : tier === 'wide' ? '#3d6a8a' : '#9aa3ad'),
  )
  stripe.position.set(0, height - 0.2, CELL * 0.46)
  g.add(body, door, stripe)
}

export function addTravelator(g: THREE.Group) {
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.86, 0.16, CELL * 0.42),
    metal('#2c3338', 0.5),
  )
  deck.position.y = 0.18
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.7, 0.04, CELL * 0.22),
    new THREE.MeshStandardMaterial({ color: '#1a1d20', roughness: 0.35, metalness: 0.4 }),
  )
  belt.position.y = 0.28
  const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.08), metal('#c9a227'))
  chevron.position.set(-0.4, 0.32, 0)
  chevron.rotation.y = 0.5
  const rail = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.86, 0.5, 0.06), metal('#d7dee6', 0.3))
  rail.position.set(0, 0.55, CELL * 0.2)
  const rail2 = rail.clone()
  rail2.position.z = -CELL * 0.2
  g.add(deck, belt, chevron, rail, rail2)
}

export function addSkywalk(g: THREE.Group) {
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.92, 0.18, CELL * 0.55),
    metal('#c5ced6', 0.4),
  )
  deck.position.y = 3.2
  deck.castShadow = true
  const pierL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.1, 0.18), metal('#6a737c'))
  pierL.position.set(-CELL * 0.28, 1.55, -CELL * 0.16)
  const pierR = pierL.clone()
  pierR.position.x = CELL * 0.28
  pierR.position.z = CELL * 0.16
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.7, 0.7, CELL * 0.4),
    new THREE.MeshStandardMaterial({
      color: '#9ec4de',
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.55,
    }),
  )
  glass.position.y = 3.7
  g.add(deck, pierL, pierR, glass)
}

export function addPeopleMover(g: THREE.Group) {
  const guide = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.92, 0.12, 0.28),
    metal('#3a4148', 0.4),
  )
  guide.position.y = 2.4
  const car = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.46, 0.7, 0.42), metal('#d7dee6', 0.35))
  car.position.set(-CELL * 0.08, 2.85, 0)
  car.castShadow = true
  car.name = 'pod'
  car.userData.home = car.position.x
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 0.28, 0.28, 0.44),
    new THREE.MeshStandardMaterial({ color: '#7eb6e0', roughness: 0.2, metalness: 0.15 }),
  )
  window.position.set(-CELL * 0.08, 3.0, 0)
  window.name = 'pod-glass'
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.36), metal('#c9a227'))
  nose.position.set(CELL * 0.16, 2.8, 0)
  g.add(guide, car, window, nose)
}
