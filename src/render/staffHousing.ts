import * as THREE from 'three'
import { WORLD_PER_METER } from './aircraft/specs.ts'
import { buildParts, housingParts, workerParts } from '../staffhousing/meshes.ts'
import type { HousingBuilding, WalkerPose } from '../staffhousing/types.ts'

const factory = {
  BoxGeometry: THREE.BoxGeometry,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  Mesh: THREE.Mesh,
  Group: THREE.Group,
}

/**
 * Houses sit on the parcel anchor. A handful of crew stroll toward the hall.
 * Meshes are rebuilt only when the set of houses changes.
 */
export function syncStaffHousing(
  parent: THREE.Group,
  houses: Map<string, THREE.Group>,
  walkers: Map<string, THREE.Group>,
  sites: readonly HousingBuilding[],
  poses: readonly WalkerPose[],
  toWorld: (c: number, r: number, y?: number) => THREE.Vector3,
): void {
  const live = new Set(sites.map((site) => site.id))
  for (const [id, mesh] of houses) {
    if (live.has(id)) continue
    parent.remove(mesh)
    disposeTree(mesh)
    houses.delete(id)
  }
  for (const site of sites) {
    let mesh = houses.get(site.id)
    if (!mesh) {
      mesh = buildParts(housingParts(site.tier), WORLD_PER_METER, factory)
      mesh.name = site.id
      houses.set(site.id, mesh)
      parent.add(mesh)
    }
    mesh.position.copy(toWorld(site.anchor.c, site.anchor.r, 0))
  }

  const walking = new Set(poses.map((pose) => pose.id))
  for (const [id, mesh] of walkers) {
    if (walking.has(id)) continue
    parent.remove(mesh)
    disposeTree(mesh)
    walkers.delete(id)
  }
  for (const pose of poses) {
    let mesh = walkers.get(pose.id)
    if (!mesh) {
      mesh = buildParts(workerParts(pose.tier), WORLD_PER_METER, factory)
      mesh.name = pose.id
      walkers.set(pose.id, mesh)
      parent.add(mesh)
    }
    const at = toWorld(pose.x, pose.y, 0)
    mesh.position.copy(at)
    mesh.rotation.y = -pose.heading
  }
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    mesh.geometry?.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) for (const item of mat) item.dispose()
    else mat?.dispose()
  })
}
