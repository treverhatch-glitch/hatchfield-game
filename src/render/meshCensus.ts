/**
 * Counts individual (non-instanced) meshes that share one geometry.
 * Used to find the repeated parts worth turning into InstancedMesh.
 */
import type * as THREE from 'three'

export interface MeshRepeat {
  /** Geometry name, or the mesh name when the geometry is unnamed. */
  name: string
  count: number
  triangles: number
}

function trianglesOf(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute('position')
  return geo.index ? geo.index.count / 3 : (pos?.count ?? 0) / 3
}

function tally(root: THREE.Object3D, keyOf: (mesh: THREE.Mesh) => string, nameOf: (mesh: THREE.Mesh) => string): MeshRepeat[] {
  const buckets = new Map<string, MeshRepeat>()
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return
    const geo = mesh.geometry
    if (!geo) return
    const key = keyOf(mesh)
    const triangles = trianglesOf(geo)
    const hit = buckets.get(key)
    if (hit) {
      hit.count += 1
      hit.triangles += triangles
    } else {
      buckets.set(key, { name: nameOf(mesh), count: 1, triangles })
    }
  })
  return [...buckets.values()].sort((a, b) => b.count - a.count || b.triangles - a.triangles)
}

/** Meshes that already share one geometry object. */
export function repeatedMeshes(root: THREE.Object3D): MeshRepeat[] {
  return tally(
    root,
    (mesh) => mesh.geometry.uuid,
    (mesh) => mesh.name || mesh.geometry.name || mesh.geometry.type,
  )
}

/** Same mesh name and vertex count, even when each copy owns its own geometry. */
export function repeatedShapes(root: THREE.Object3D): MeshRepeat[] {
  return tally(
    root,
    (mesh) => {
      const verts = mesh.geometry.getAttribute('position')?.count ?? 0
      return `${mesh.name || mesh.geometry.type}|v${verts}`
    },
    (mesh) => {
      const verts = mesh.geometry.getAttribute('position')?.count ?? 0
      return `${mesh.name || mesh.geometry.type}|v${verts}`
    },
  )
}
