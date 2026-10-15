import * as THREE from 'three'
import { CELL, WORLD_PER_METER } from './aircraft/specs.ts'

const meters = (value: number) => value * WORLD_PER_METER

/** Pure presentation for the raised public deck. Gameplay values stay in tier3plus data. */
export function addSpottersDeck(root: THREE.Group, crowdSize: number): void {
  const concrete = new THREE.MeshStandardMaterial({ color: '#8f969b', roughness: 0.82 })
  const steel = new THREE.MeshStandardMaterial({ color: '#39464e', metalness: 0.35, roughness: 0.5 })
  const canopyMat = new THREE.MeshStandardMaterial({ color: '#d7e4e8', roughness: 0.42 })
  const deckY = meters(3.2)

  const pad = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.94, meters(0.2), CELL * 0.9), concrete)
  pad.position.y = meters(0.1)
  pad.receiveShadow = true
  root.add(pad)

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(meters(16), meters(0.35), meters(10)),
    concrete,
  )
  platform.position.set(0, deckY, 0)
  platform.castShadow = true
  platform.receiveShadow = true
  root.add(platform)

  for (const x of [-meters(6.5), meters(6.5)]) {
    for (const z of [-meters(3.6), meters(3.6)]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(meters(0.25), deckY, meters(0.25)), steel)
      post.position.set(x, deckY / 2, z)
      post.castShadow = true
      root.add(post)
    }
  }

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(meters(9), meters(0.25), meters(4.5)),
    canopyMat,
  )
  canopy.position.set(0, deckY + meters(3.1), meters(1.5))
  canopy.castShadow = true
  root.add(canopy)

  for (const x of [-meters(3.8), meters(3.8)]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(meters(0.1), meters(0.1), meters(3), 8), steel)
    pole.position.set(x, deckY + meters(1.5), meters(1.5))
    root.add(pole)
  }

  const frontRail = new THREE.Mesh(
    new THREE.BoxGeometry(meters(16), meters(0.12), meters(0.12)),
    steel,
  )
  frontRail.position.set(0, deckY + meters(1.15), -meters(5))
  root.add(frontRail)

  addStairs(root, concrete, steel, deckY)
  addSpotterCrowd(root, Math.max(0, Math.floor(crowdSize)), deckY)
  root.name = 'spotters-deck'
}

function addStairs(root: THREE.Group, concrete: THREE.Material, steel: THREE.Material, deckY: number) {
  const steps = 8
  for (let i = 0; i < steps; i++) {
    const rise = deckY * (i + 1) / steps
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(meters(3), rise, meters(0.75)),
      concrete,
    )
    step.position.set(0, rise / 2, meters(7.7 - i * 0.75))
    root.add(step)
  }
  for (const x of [-meters(1.55), meters(1.55)]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(meters(0.1), meters(1), meters(6)),
      steel,
    )
    rail.position.set(x, deckY * 0.72, meters(5))
    rail.rotation.x = -0.43
    root.add(rail)
  }
}

function addSpotterCrowd(root: THREE.Group, crowdSize: number, deckY: number) {
  if (!crowdSize) return
  const body = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(meters(0.28), meters(0.75), 3, 6),
    new THREE.MeshLambertMaterial({ color: '#4f718d' }),
    crowdSize,
  )
  const head = new THREE.InstancedMesh(
    new THREE.SphereGeometry(meters(0.17), 6, 5),
    new THREE.MeshLambertMaterial({ color: '#c58d68' }),
    crowdSize,
  )
  const camera = new THREE.InstancedMesh(
    new THREE.BoxGeometry(meters(0.28), meters(0.18), meters(0.24)),
    new THREE.MeshStandardMaterial({ color: '#20272c', roughness: 0.35 }),
    crowdSize,
  )
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < crowdSize; i++) {
    const columns = Math.min(9, crowdSize)
    const row = Math.floor(i / columns)
    const column = i % columns
    const x = meters((column - (columns - 1) / 2) * 1.55 + (row % 2) * 0.35)
    const z = -meters(3.9 - row * 1.35)
    matrix.makeTranslation(x, deckY + meters(0.72), z)
    body.setMatrixAt(i, matrix)
    matrix.makeTranslation(x, deckY + meters(1.55), z)
    head.setMatrixAt(i, matrix)
    matrix.makeTranslation(x, deckY + meters(1.5), z - meters(0.35))
    camera.setMatrixAt(i, matrix)
  }
  body.name = 'spotter-crowd-body'
  head.name = 'spotter-crowd-head'
  camera.name = 'spotter-crowd-camera'
  body.castShadow = true
  root.add(body, head, camera)
}
