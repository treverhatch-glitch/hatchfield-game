/**
 * Cargo hub II and the cold store, one cell each. Trucks shuttle along the dock
 * and the condenser fans turn while the building stands. Boxes and cylinders only.
 */
import * as THREE from 'three'
import { CELL } from '../aircraft/specs'
import { mountSign } from './buildingSign'

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra })

function add<T extends THREE.Mesh>(g: THREE.Group, mesh: T, x: number, y: number, z: number): T {
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  g.add(mesh)
  return mesh
}

const box = (w: number, h: number, d: number, mat: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
const cyl = (r: number, h: number, mat: THREE.Material, seg = 14) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat)

function truck(g: THREE.Group, z: number, span: number, phase: number, body: string, cab: string) {
  const t = new THREE.Group()
  t.name = 'cargo2-truck'
  t.userData = { span, phase, z }
  const box1 = box(1.7, 0.9, 0.8, std(body))
  box1.position.set(-0.3, 0.6, 0)
  const cab1 = box(0.6, 0.7, 0.78, std(cab))
  cab1.position.set(0.85, 0.5, 0)
  for (const m of [box1, cab1]) {
    m.castShadow = true
    t.add(m)
  }
  for (const x of [-0.8, 0.1, 0.9]) {
    const wheel = cyl(0.17, 0.82, std('#1a1d20'), 8)
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x, 0.17, 0)
    t.add(wheel)
  }
  t.position.set(0, 0, z)
  g.add(t)
}

function pad(g: THREE.Group) {
  add(g, box(CELL * 0.94, 0.2, CELL * 0.94, std('#7a7e84', { roughness: 0.9 })), 0, 0.1, 0)
}

function cargoHubII(g: THREE.Group) {
  pad(g)
  const wallMat = std('#c3c9cf')
  add(g, box(CELL * 0.88, 3.0, CELL * 0.5, wallMat), 0, 1.7, -CELL * 0.18)
  for (const x of [-0.27, 0, 0.27]) {
    const roof = box(CELL * 0.26, 0.16, CELL * 0.54, std('#59626c'))
    roof.rotation.z = 0.3
    add(g, roof, x * CELL, 3.35, -CELL * 0.18)
  }
  for (const x of [-0.3, 0, 0.3]) {
    add(g, box(CELL * 0.2, 1.6, 0.08, std('#e0b020')), x * CELL, 1.0, CELL * 0.08)
  }
  add(g, box(CELL * 0.8, 0.14, 0.4, std('#3a424b')), 0, 0.3, CELL * 0.14)
  const dolly = add(g, box(0.9, 0.35, 0.7, std('#d4553b')), 0, 0.55, CELL * 0.14)
  dolly.name = 'cargo2-dolly'
  dolly.userData = { span: CELL * 0.32 }
  truck(g, CELL * 0.34, CELL * 0.3, 0, '#e8eaee', '#2f6fa8')
  truck(g, CELL * 0.4, CELL * 0.3, 2.4, '#e0b020', '#3a424b')
  mountSign(g, 'HUB II', { w: 2.0, h: 0.4, x: 0, y: 2.7, z: CELL * 0.07 + 0.05 }, '#3a2a14', '#f6f1e4')
}

function coldStore(g: THREE.Group) {
  pad(g)
  add(g, box(CELL * 0.7, 2.4, CELL * 0.5, std('#eef3f7', { roughness: 0.4 })), -CELL * 0.08, 1.4, -CELL * 0.14)
  add(g, box(CELL * 0.72, 0.3, CELL * 0.52, std('#2f6fa8')), -CELL * 0.08, 2.75, -CELL * 0.14)
  for (const [x, z] of [
    [-0.28, -0.14],
    [-0.08, -0.14],
    [0.12, -0.14],
  ] as const) {
    const housing = add(g, cyl(0.62, 0.3, std('#9aa7b4', { metalness: 0.4 })), x * CELL, 3.05, z * CELL)
    housing.name = 'cargo2-housing'
    const fan = box(1.0, 0.05, 0.14, std('#2a2f35'))
    fan.name = 'cargo2-fan'
    fan.position.set(x * CELL, 3.25, z * CELL)
    g.add(fan)
  }
  const glow = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: '#bfe8ff', emissive: '#6fc8ff', emissiveIntensity: 0.9 })), CELL * 0.3, 2.2, -CELL * 0.14)
  glow.name = 'cargo2-glow'
  for (const x of [-0.25, -0.02]) add(g, box(CELL * 0.14, 1.4, 0.08, std('#9ecbe8')), x * CELL, 0.9, CELL * 0.11 + 0.02)
  truck(g, CELL * 0.34, CELL * 0.3, 0.8, '#dff1fb', '#2f6fa8')
  mountSign(g, 'COLD', { w: 1.2, h: 0.32, x: -CELL * 0.08, y: 2.2, z: CELL * 0.11 + 0.05 }, '#14425f', '#f4f7fa')
}

export function addCargoLate(g: THREE.Group, id: string | null) {
  if (id === 'cargo_hub_ii') cargoHubII(g)
  else if (id === 'cold_store') coldStore(g)
}

export function animateCargoPart(obj: THREE.Object3D, t: number) {
  switch (obj.name) {
    case 'cargo2-truck': {
      const { span, phase, z } = obj.userData as { span: number; phase: number; z: number }
      const s = Math.sin(t * 0.5 + phase)
      obj.position.x = s * span
      obj.position.z = z
      obj.rotation.y = Math.cos(t * 0.5 + phase) >= 0 ? 0 : Math.PI
      return
    }
    case 'cargo2-dolly': {
      const { span } = obj.userData as { span: number }
      obj.position.x = Math.sin(t * 0.8) * span
      return
    }
    case 'cargo2-fan':
      obj.rotation.y = t * 9
      return
    case 'cargo2-glow': {
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2))
      return
    }
    default:
  }
}
