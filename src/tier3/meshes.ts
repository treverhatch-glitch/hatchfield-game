import * as THREE from 'three'
import { MESH_TRIANGLE_BUDGET } from './config.ts'

export { MESH_TRIANGLE_BUDGET }

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  )
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Wide MRO hall with three door widths (narrow, wide, jumbo).
 * Boxes only, so the triangle count stays small.
 */
export function addMroMesh(group: THREE.Group, cell: number): void {
  const w = cell * 0.96
  const depth = w * 0.92
  const wallH = cell * 0.38
  const wallT = Math.max(0.18, cell * 0.045)
  // Open south face. The nose sits in the bay; the doors slide up in front of it.
  group.add(box(w, 0.08, depth, '#4a5158', 0, 0.04, -cell * 0.02))
  group.add(box(w * 0.78, 0.02, depth * 0.62, '#2c333a', 0, 0.09, -cell * 0.06))
  group.add(box(w * 0.92, wallH, wallT, '#8b939c', 0, wallH / 2, -depth / 2))
  group.add(box(wallT, wallH, depth * 0.84, '#7e868f', -w / 2, wallH / 2, -cell * 0.04))
  group.add(box(wallT, wallH, depth * 0.84, '#7e868f', w / 2, wallH / 2, -cell * 0.04))
  group.add(box(w * 0.98, 0.1, depth * 0.9, '#5c656e', 0, wallH, -cell * 0.02))
  const doors: [number, string][] = [
    [w * 0.16, '#1c242c'],
    [w * 0.24, '#1c242c'],
    [w * 0.34, '#243040'],
  ]
  let cursor = -w * 0.38
  for (const [width, color] of doors) {
    const door = box(width, cell * 0.3, 0.12, color, cursor + width / 2, cell * 0.16, depth / 2 - cell * 0.04)
    door.name = 'mro-door'
    door.userData.mroDoor = true
    door.userData.restY = door.position.y
    group.add(door)
    cursor += width + w * 0.03
  }
  group.add(box(cell * 0.2, cell * 0.16, cell * 0.18, '#c4b49a', w * 0.32, cell * 0.1, -depth * 0.28))
  group.add(box(w * 0.4, 0.06, 0.08, '#e8d080', 0, wallH + 0.08, depth * 0.2))
}

/** Shed, a short ULD row, and two floodlights for the night wave. */
export function addNightHubMesh(group: THREE.Group, cell: number): void {
  const w = cell * 0.96
  group.add(box(w, 0.08, w, '#3a3530', 0, 0.04, 0))
  group.add(box(w * 0.88, cell * 0.32, w * 0.7, '#6a6258', 0, cell * 0.18, 0))
  group.add(box(w * 0.92, 0.08, w * 0.74, '#3e4a44', 0, cell * 0.36, 0))
  group.add(box(w * 0.2, cell * 0.16, 0.1, '#2a241c', 0, cell * 0.1, w * 0.32))
  const uld = cell * 0.12
  for (let i = 0; i < 4; i++) {
    group.add(box(uld, uld * 0.8, uld, i % 2 === 0 ? '#c9a227' : '#8a909a', -w * 0.28 + i * uld * 1.3, uld * 0.45, w * 0.28))
  }
  for (const side of [-1, 1]) {
    group.add(box(0.08, cell * 0.38, 0.08, '#d5dbe2', side * w * 0.4, cell * 0.2, -w * 0.32))
    group.add(box(0.22, 0.06, 0.16, '#f0e2a0', side * w * 0.4, cell * 0.4, -w * 0.32))
  }
}

export function meshTriangleCount(root: THREE.Object3D): number {
  let tris = 0
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    const geo = mesh.geometry as THREE.BufferGeometry | undefined
    if (!geo) return
    if (geo.index) tris += geo.index.count / 3
    else {
      const pos = geo.getAttribute('position')
      if (pos) tris += pos.count / 3
    }
  })
  return tris
}
