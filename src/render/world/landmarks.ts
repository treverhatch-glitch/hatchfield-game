/**
 * Prestige landmarks, one cell each. Real footprints run to hundreds of metres, so
 * these are compressed massings with the part that reads from the air: a lit shaft,
 * a turning exhibit, a glass dome, a canopy. Parts that move carry a `landmark-*` name
 * and are driven by `animateLandmarks`. Boxes, cylinders and spheres only.
 */
import * as THREE from 'three'
import { CELL } from '../aircraft/specs'
import { mountSign } from './buildingSign'

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra })

const glass = () => std('#9ec4de', { roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.72 })

function add<T extends THREE.Mesh>(g: THREE.Group, mesh: T, x: number, y: number, z: number): T {
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  g.add(mesh)
  return mesh
}

const box = (w: number, h: number, d: number, mat: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, seg = 16) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)

function plinth(g: THREE.Group, color = '#8a8e94') {
  add(g, box(CELL * 0.94, 0.2, CELL * 0.94, std(color, { roughness: 0.85 })), 0, 0.1, 0)
}

/** Small walkers who shuffle along the front of the building. */
function visitors(g: THREE.Group, z: number, span: number, count = 3) {
  const palette = ['#d4553b', '#2f6fa8', '#e0b020', '#4f9a62']
  for (let i = 0; i < count; i++) {
    const body = cyl(0.12, 0.12, 0.42, std(palette[i % palette.length]!), 8)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), std('#e8c9a8'))
    head.position.y = 0.3
    body.add(head)
    body.name = 'landmark-visitor'
    body.userData = { span, phase: (i / count) * Math.PI * 2, speed: 0.35 + i * 0.07, z, y: 0.41 }
    body.position.set(0, 0.41, z)
    body.castShadow = true
    g.add(body)
  }
}

function observationTower(g: THREE.Group) {
  plinth(g)
  const concrete = std('#d9dde1', { roughness: 0.7 })
  add(g, cyl(0.62, 0.95, 1.0, concrete), 0, 0.7, 0)
  add(g, cyl(0.42, 0.55, 12.5, concrete), 0, 7.0, 0)
  add(g, cyl(1.9, 1.4, 0.55, std('#2f3a46')), 0, 13.5, 0)
  add(g, cyl(1.95, 1.95, 0.7, glass()), 0, 14.2, 0)
  add(g, cyl(2.05, 2.05, 0.18, std('#2f3a46')), 0, 14.65, 0)
  add(g, cyl(0.06, 0.1, 3, std('#c9d1d8')), 0, 16.2, 0)
  const beacon = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff2a1a', emissiveIntensity: 1.2 })), 0, 17.8, 0)
  beacon.name = 'landmark-beacon'
  const lift = add(g, box(0.34, 0.8, 0.34, std('#e0b020', { emissive: '#7a5a08', emissiveIntensity: 0.4 })), 0.5, 3, 0)
  lift.name = 'landmark-lift'
  lift.userData = { low: 1.2, high: 13.2 }
  mountSign(g, 'TOWER', { w: 1.5, h: 0.32, x: 0, y: 0.9, z: CELL * 0.44 }, '#1f3b57', '#f4f7fa')
  visitors(g, CELL * 0.34, CELL * 0.3)
}

function aviationMuseum(g: THREE.Group) {
  plinth(g)
  const wall = std('#c9b89a')
  add(g, box(CELL * 0.8, 2.4, CELL * 0.5, wall), 0, 1.4, -CELL * 0.14)
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.25, CELL * 0.25, CELL * 0.8, 20, 1, false, 0, Math.PI), std('#9aa7b4', { metalness: 0.35 }))
  vault.rotation.z = Math.PI / 2
  vault.rotation.y = Math.PI / 2
  add(g, vault, 0, 2.6, -CELL * 0.14)
  const turntable = cyl(1.5, 1.5, 0.18, std('#4a4f57'))
  add(g, turntable, 0, 0.3, CELL * 0.3)
  const plane = new THREE.Group()
  plane.name = 'landmark-exhibit'
  plane.position.set(0, 1.3, CELL * 0.3)
  const fuselage = cyl(0.22, 0.22, 2.4, std('#f1f3f5'), 10)
  fuselage.rotation.z = Math.PI / 2
  const wings = box(0.7, 0.06, 2.6, std('#d4553b'))
  const tail = box(0.4, 0.5, 0.06, std('#d4553b'))
  tail.position.set(-1.0, 0.3, 0)
  for (const m of [fuselage, wings, tail]) {
    m.castShadow = true
    plane.add(m)
  }
  g.add(plane)
  mountSign(g, 'MUSEUM', { w: 1.9, h: 0.34, x: 0, y: 2.1, z: CELL * 0.12 + 0.02 }, '#5a4630', '#f6f1e4')
  visitors(g, CELL * 0.4, CELL * 0.34)
}

function skyGarden(g: THREE.Group) {
  plinth(g, '#7c8a78')
  add(g, box(CELL * 0.86, 0.5, CELL * 0.62, std('#6b7480')), 0, 0.45, 0)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.36, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass())
  dome.scale.set(1.15, 0.9, 0.8)
  add(g, dome, 0, 0.7, 0)
  const leaf = std('#3f8f4f')
  for (const [x, z, h] of [
    [-1.6, -0.4, 1.6],
    [0.2, 0.5, 2.1],
    [1.7, -0.3, 1.4],
    [-0.4, -1.0, 1.2],
  ] as const) {
    const tree = new THREE.Group()
    tree.name = 'landmark-tree'
    tree.position.set(x, 0.7, z)
    tree.userData = { phase: x * 2 }
    const trunk = cyl(0.07, 0.09, h * 0.5, std('#6b4a2c'), 6)
    trunk.position.y = h * 0.25
    const crown = new THREE.Mesh(new THREE.SphereGeometry(h * 0.32, 10, 8), leaf)
    crown.position.y = h * 0.62
    crown.castShadow = true
    tree.add(trunk, crown)
    g.add(tree)
  }
  add(g, cyl(0.7, 0.7, 0.06, std('#4aa0c8', { roughness: 0.2 })), -1.2, 0.74, 0.9)
  mountSign(g, 'GARDEN', { w: 1.6, h: 0.3, x: 0, y: 0.5, z: CELL * 0.31 + 0.04 }, '#2f5a3a', '#f4f7fa')
  visitors(g, CELL * 0.4, CELL * 0.34, 2)
}

function artConcourse(g: THREE.Group) {
  plinth(g)
  add(g, box(CELL * 0.92, 1.6, CELL * 0.34, glass()), 0, 1.0, 0)
  add(g, box(CELL * 0.94, 0.14, CELL * 0.4, std('#2f3a46')), 0, 1.9, 0)
  const colours = ['#d4553b', '#e0b020', '#2f6fa8', '#4f9a62', '#8a4fa8']
  colours.forEach((c, i) => {
    const x = (i - 2) * CELL * 0.17
    add(g, box(CELL * 0.1, 1.2, 0.05, std(c)), x, 1.0, CELL * 0.18)
  })
  const sculpture = add(g, new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.16, 48, 8), std('#e8d9a8', { metalness: 0.7, roughness: 0.25 })), 0, 3.0, 0)
  sculpture.name = 'landmark-sculpture'
  mountSign(g, 'ART', { w: 0.9, h: 0.3, x: 0, y: 1.9, z: CELL * 0.2 + 0.1 }, '#3a2a4a', '#f4f0e4')
  visitors(g, CELL * 0.36, CELL * 0.38)
}

function grandArrivals(g: THREE.Group) {
  plinth(g, '#9a9ea4')
  add(g, box(CELL * 0.84, 3.0, CELL * 0.52, std('#e6e0d2')), 0, 1.7, -CELL * 0.1)
  add(g, box(CELL * 0.94, 0.3, CELL * 0.7, std('#2f3a46')), 0, 3.4, 0)
  add(g, box(CELL * 0.7, 2.0, 0.08, glass()), 0, 1.3, CELL * 0.17)
  for (const x of [-0.38, -0.13, 0.13, 0.38]) {
    add(g, cyl(0.12, 0.12, 3.2, std('#f4f0e4'), 10), x * CELL, 1.8, CELL * 0.3)
  }
  const flagpole = add(g, cyl(0.05, 0.05, 3.2, std('#c9d1d8'), 6), CELL * 0.4, 5.1, -CELL * 0.1)
  flagpole.name = 'landmark-flagpole'
  const beacon = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffd36b', emissiveIntensity: 0.9 })), CELL * 0.4, 6.8, -CELL * 0.1)
  beacon.name = 'landmark-beacon'
  mountSign(g, 'ARRIVALS', { w: 2.4, h: 0.4, x: 0, y: 3.4, z: CELL * 0.35 + 0.04 }, '#14283f', '#f6f1e4')
  visitors(g, CELL * 0.42, CELL * 0.36, 4)
}

function quietHall(g: THREE.Group) {
  plinth(g, '#8c9488')
  add(g, box(CELL * 0.5, 1.9, CELL * 0.42, std('#efe9dd')), 0, 1.15, 0)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(CELL * 0.34, 1.1, 4), std('#6b5a4a'))
  roof.rotation.y = Math.PI / 4
  add(g, roof, 0, 2.65, 0)
  add(g, cyl(0.05, 0.05, 0.9, std('#d9c9a0'), 6), 0, 3.6, 0)
  const lantern = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcf7a', emissiveIntensity: 0.8 })), 0, 4.2, 0)
  lantern.name = 'landmark-beacon'
  add(g, box(0.5, 0.9, 0.06, std('#7a5a3a')), 0, 0.65, CELL * 0.21 + 0.03)
  mountSign(g, 'QUIET', { w: 1.1, h: 0.26, x: 0, y: 1.9, z: CELL * 0.21 + 0.04 }, '#4a4034', '#f6f1e4')
  visitors(g, CELL * 0.38, CELL * 0.26, 2)
}

const BUILDERS: Readonly<Record<string, (g: THREE.Group) => void>> = {
  observation_tower: observationTower,
  aviation_museum: aviationMuseum,
  sky_garden: skyGarden,
  art_concourse: artConcourse,
  grand_arrivals_hall: grandArrivals,
  quiet_hall: quietHall,
}

/** Finished landmark. An unknown id draws nothing. */
export function addLandmark(g: THREE.Group, id: string | null) {
  const build = id ? BUILDERS[id] : undefined
  if (build) build(g)
}

/** Drive the `landmark-*` parts. Cheap: a few dozen nodes while landmarks stand. */
export function animateLandmarkPart(obj: THREE.Object3D, t: number) {
  switch (obj.name) {
    case 'landmark-beacon': {
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + 0.9 * (0.5 + 0.5 * Math.sin(t * 3.2))
      return
    }
    case 'landmark-lift': {
      const { low, high } = obj.userData as { low: number; high: number }
      obj.position.y = low + (high - low) * (0.5 + 0.5 * Math.sin(t * 0.45))
      return
    }
    case 'landmark-exhibit':
    case 'landmark-sculpture':
      obj.rotation.y = t * 0.6
      return
    case 'landmark-tree':
      obj.rotation.z = Math.sin(t * 0.9 + (obj.userData.phase as number)) * 0.035
      return
    case 'landmark-visitor': {
      const { span, phase, speed, z, y } = obj.userData as { span: number; phase: number; speed: number; z: number; y: number }
      obj.position.x = Math.sin(t * speed + phase) * span
      obj.position.z = z
      obj.position.y = y + Math.abs(Math.sin(t * speed * 9 + phase)) * 0.04
      return
    }
    default:
  }
}
