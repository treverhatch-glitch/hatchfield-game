import * as THREE from 'three'
import { MESH_TRIANGLE_BUDGET } from './config.ts'
import { SKIN_TILE_M, type BuildingTargetId } from '../build/materialTargets.ts'
import { WORLD_PER_METER } from '../render/aircraft/specs.ts'
import { skinBox, skinMaterial, type SkinPart } from '../render/world/buildingSkin.ts'

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

/** A box whose material comes from the building's material target (walls and roofs get the photo map). */
function skinned(target: BuildingTargetId, part: SkinPart, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const tile = part === 'roof' ? SKIN_TILE_M.roof : SKIN_TILE_M.wall
  const mesh = new THREE.Mesh(skinBox(w, h, d, tile, WORLD_PER_METER), skinMaterial(target, part))
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
  group.add(skinned('maintenance_shed', 'wall', w * 0.92, wallH, wallT, 0, wallH / 2, -depth / 2))
  group.add(skinned('maintenance_shed', 'wall', wallT, wallH, depth * 0.84, -w / 2, wallH / 2, -cell * 0.04))
  group.add(skinned('maintenance_shed', 'wall', wallT, wallH, depth * 0.84, w / 2, wallH / 2, -cell * 0.04))
  group.add(skinned('maintenance_shed', 'roof', w * 0.98, 0.1, depth * 0.9, 0, wallH, -cell * 0.02))
  const doors = [w * 0.16, w * 0.24, w * 0.34]
  let cursor = -w * 0.38
  for (const width of doors) {
    const door = skinned('maintenance_shed', 'door', width, cell * 0.3, 0.12, cursor + width / 2, cell * 0.16, depth / 2 - cell * 0.04)
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
  group.add(skinned('warehouse', 'wall', w * 0.88, cell * 0.32, w * 0.7, 0, cell * 0.18, 0))
  group.add(skinned('warehouse', 'roof', w * 0.92, 0.08, w * 0.74, 0, cell * 0.36, 0))
  group.add(skinned('warehouse', 'door', w * 0.2, cell * 0.16, 0.1, 0, cell * 0.1, w * 0.32))
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
