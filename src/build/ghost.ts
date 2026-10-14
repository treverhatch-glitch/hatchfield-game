/**
 * Placement ghost: the real building model, translucent, at true footprint.
 * Valid = green, invalid = red. Uses a soft fresnel-like look (lit standard
 * material + crisp edge outline) so depth and shape read at any zoom.
 */
import * as THREE from 'three'

export const GHOST_OK = 0x5fe38a
export const GHOST_BAD = 0xff5a5a

export function ghostTint(valid: boolean): number {
  return valid ? GHOST_OK : GHOST_BAD
}

export interface GhostMaterials {
  body: THREE.MeshStandardMaterial
  edge: THREE.LineBasicMaterial
  dispose(): void
}

export function ghostMaterials(valid: boolean): GhostMaterials {
  const tint = ghostTint(valid)
  const body = new THREE.MeshStandardMaterial({
    color: tint,
    emissive: tint,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.0,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  })
  const edge = new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.95, depthWrite: false })
  return {
    body,
    edge,
    dispose() {
      body.dispose()
      edge.dispose()
    },
  }
}

/**
 * Turn a freshly built prop into a ghost in place: swap every material for the
 * ghost body (disposing the originals it owned) and add an edge outline per mesh.
 * Returns geometries it created so the caller's normal traverse-dispose frees them.
 */
export function ghostify(root: THREE.Object3D, mats: GhostMaterials, opts: { edges?: boolean } = {}): THREE.Object3D {
  const dropped = new Set<THREE.Material>()
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    meshes.push(mesh)
  })
  for (const mesh of meshes) {
    const src = mesh.material
    for (const m of Array.isArray(src) ? src : [src]) dropped.add(m)
    mesh.material = mats.body
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.renderOrder = 2
    if (opts.edges !== false && mesh.geometry) {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), mats.edge)
      lines.renderOrder = 3
      lines.userData.ghostEdge = true
      mesh.add(lines)
    }
  }
  for (const m of dropped) if (m !== mats.body) m.dispose()
  root.userData.ghost = true
  return root
}
