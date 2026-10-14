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
  // Fresnel rim: silhouettes and roof edges glow, flat faces stay see-through, so depth reads at any zoom.
  body.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
  float gRim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);
  float gUp = clamp(normalize(vNormal).y, 0.0, 1.0);
  gl_FragColor.rgb += diffuse * (gRim * 0.75 + gUp * 0.12);
  gl_FragColor.a = clamp(gl_FragColor.a + gRim * 0.4, 0.0, 0.92);`,
    )
  }
  body.customProgramCacheKey = () => 'hf-ghost'
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
  // Footprint plate: the lot the building will claim, outlined on the ground.
  if (opts.edges !== false && meshes.length) {
    root.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const b = new THREE.Box3()
    for (const m of meshes) b.union(new THREE.Box3().setFromObject(m).applyMatrix4(inv))
    if (!b.isEmpty()) {
      const w = b.max.x - b.min.x
      const d = b.max.z - b.min.z
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.body)
      plate.rotation.x = -Math.PI / 2
      plate.position.set((b.min.x + b.max.x) / 2, b.min.y + 0.03, (b.min.z + b.max.z) / 2)
      plate.renderOrder = 1
      plate.userData.ghostPlate = true
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), mats.edge)
      outline.renderOrder = 3
      outline.userData.ghostEdge = true
      plate.add(outline)
      root.add(plate)
    }
  }
  root.userData.ghost = true
  return root
}
