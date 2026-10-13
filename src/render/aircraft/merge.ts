import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { paintVertexMesh, sharedGeo, type PaintedMesh } from './pool'
import type { Livery } from './specs'

type Tier = 'low' | 'mid' | 'high'

const _color = new THREE.Color()
const _rel = new THREE.Matrix4()
const _combined = new THREE.Matrix4()
const _instance = new THREE.Matrix4()

interface ShellSource {
  tier: Tier
  specId: string
  livery: Livery
  group: THREE.Group
  meshes: PaintedMesh[]
  gears: THREE.Object3D[]
  spinners: THREE.Object3D[]
}

function under(mesh: THREE.Object3D, roots: THREE.Object3D[]): boolean {
  let parent: THREE.Object3D | null = mesh
  while (parent) {
    if (roots.includes(parent)) return true
    parent = parent.parent
  }
  return false
}

function isLamp(mesh: THREE.Mesh): boolean {
  const kind = mesh.userData.kind
  return kind === 'light' || kind === 'strobe' || kind === 'beacon'
}

/** Bake a transformed clone that carries only position, normal, and color. */
export function bakeGeometry(
  src: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  hex?: string,
): THREE.BufferGeometry {
  const geo = src.clone()
  geo.applyMatrix4(matrix)
  const flat = geo.index ? geo.toNonIndexed() : geo
  if (flat !== geo) geo.dispose()
  for (const name of Object.keys(flat.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') flat.deleteAttribute(name)
  }
  if (!flat.getAttribute('normal')) flat.computeVertexNormals()
  if (!hex && flat.getAttribute('color')) return flat
  const pos = flat.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  _color.set(hex || '#888888')
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = _color.r
    colors[i * 3 + 1] = _color.g
    colors[i * 3 + 2] = _color.b
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return flat
}

function piecesOf(mesh: THREE.Mesh, matrix: THREE.Matrix4): THREE.BufferGeometry[] {
  const inst = mesh as THREE.InstancedMesh
  const keep = !inst.isInstancedMesh && Boolean(mesh.geometry.getAttribute('color'))
  const hex = keep ? undefined : (mesh.userData.paint as string) || '#888888'
  if (!inst.isInstancedMesh) return [bakeGeometry(mesh.geometry, matrix, hex)]
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < inst.count; i++) {
    inst.getMatrixAt(i, _instance)
    _combined.multiplyMatrices(matrix, _instance)
    parts.push(bakeGeometry(mesh.geometry, _combined, hex))
  }
  return parts
}

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  if (!merged) throw new Error('aircraft shell had no triangles')
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

/**
 * Fold static mid/low parts (fuselage, wing, tail, nacelles, stripes) into
 * one geometry per type and livery. Gear, spinners, and lamps stay separate.
 */
export function mergeStaticShell(frame: ShellSource) {
  if (frame.tier === 'high') return
  const staticMeshes = frame.meshes.filter((mesh) => {
    if (isLamp(mesh)) return false
    if (under(mesh, frame.gears) || under(mesh, frame.spinners)) return false
    return true
  })
  if (!staticMeshes.length) return
  const partNames = staticMeshes.map((mesh) => mesh.name).filter((name) => name.length > 0)
  const prev = frame.group.userData.partNames as string[] | undefined
  frame.group.userData.partNames = prev ? prev.concat(partNames) : partNames

  const key = `shell:${frame.tier}:${frame.specId}:${frame.livery.body}:${frame.livery.stripe}`
  const geometry = sharedGeo(key, () => {
    const parts: THREE.BufferGeometry[] = []
    for (const mesh of staticMeshes) {
      mesh.updateMatrix()
      parts.push(...piecesOf(mesh, mesh.matrix))
    }
    return mergeParts(parts)
  })

  for (const mesh of staticMeshes) {
    mesh.removeFromParent()
    const index = frame.meshes.indexOf(mesh)
    if (index >= 0) frame.meshes.splice(index, 1)
  }
  const shell = new THREE.Mesh(geometry)
  shell.name = 'airframe'
  const painted = paintVertexMesh(shell, frame.tier === 'low' ? 'low' : 'mid', 'mesh')
  painted.castShadow = frame.tier === 'mid'
  frame.group.add(painted)
  frame.meshes.push(painted)
}

/** One geometry of every mesh in a built level, for instancing parked copies. */
export function bakeGroup(root: THREE.Object3D): THREE.BufferGeometry {
  root.updateMatrixWorld(true)
  const parts: THREE.BufferGeometry[] = []
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    _rel.copy(root.matrixWorld).invert().multiply(mesh.matrixWorld)
    parts.push(...piecesOf(mesh, _rel))
  })
  return mergeParts(parts)
}
