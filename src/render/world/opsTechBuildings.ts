/**
 * Apron pieces that appear once the Ops wallet buys them: a solar array
 * (sustainability.t1) and a battery bank (sustainability.t2). Boxes only.
 */
import * as THREE from 'three'
import { CELL } from '../aircraft/specs'
import { mountSign } from './buildingSign'

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Two rows of tilted panels on posts, with an inverter cabinet at one end. */
export function addSolarArray(g: THREE.Group) {
  const cell = new THREE.MeshStandardMaterial({ color: '#1b3358', roughness: 0.25, metalness: 0.55 })
  const frame = new THREE.MeshStandardMaterial({ color: '#c9d1d8', roughness: 0.6, metalness: 0.4 })
  const pad = box(CELL * 0.94, 0.05, CELL * 0.86, new THREE.MeshStandardMaterial({ color: '#6c6f66', roughness: 1 }), 0, 0.03, 0)
  pad.castShadow = false
  g.add(pad)
  for (const z of [-CELL * 0.24, CELL * 0.1]) {
    for (const x of [-CELL * 0.26, 0, CELL * 0.26]) {
      const panel = box(CELL * 0.24, 0.06, CELL * 0.26, cell, x, 0.72, z)
      panel.rotation.x = -0.45
      const rim = box(CELL * 0.25, 0.04, CELL * 0.27, frame, x, 0.69, z)
      rim.rotation.x = -0.45
      const post = box(0.08, 0.6, 0.08, frame, x, 0.32, z + 0.1)
      g.add(rim, panel, post)
    }
  }
  g.add(box(0.6, 0.8, 0.4, frame, CELL * 0.36, 0.42, CELL * 0.34))
  mountSign(g, 'SOLAR', { w: 0.9, h: 0.24, x: 0, y: 0.5, z: CELL * 0.42 }, '#1f3b57', '#f4f7fa')
}

/** A row of containerised battery cabinets with status strips. */
export function addBatteryBank(g: THREE.Group) {
  const shell = new THREE.MeshStandardMaterial({ color: '#e6ebef', roughness: 0.55, metalness: 0.2 })
  const strip = new THREE.MeshStandardMaterial({ color: '#3fbf6f', emissive: '#2a8f50', emissiveIntensity: 0.6 })
  const pad = box(CELL * 0.94, 0.05, CELL * 0.62, new THREE.MeshStandardMaterial({ color: '#6c6f66', roughness: 1 }), 0, 0.03, 0)
  pad.castShadow = false
  g.add(pad)
  for (const x of [-CELL * 0.3, 0, CELL * 0.3]) {
    g.add(box(CELL * 0.26, 1.1, CELL * 0.34, shell, x, 0.6, 0))
    g.add(box(CELL * 0.2, 0.08, 0.04, strip, x, 0.95, CELL * 0.17 + 0.02))
  }
  mountSign(g, 'STORE', { w: 0.9, h: 0.24, x: 0, y: 0.5, z: CELL * 0.3 }, '#1f3b57', '#f4f7fa')
}
