import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { engineUv, outwardUv, type LiveryBox, type LiveryMapKind } from './liveryUv'
import { liveryKey, paintVertexMesh, sharedGeo, type PaintedMesh } from './pool'
import { PANEL_U_M, PANEL_V_M } from './surfaceDetail'
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
  /** Group-space wear mask 0–1 (soot, belly grime, door halos), baked per vertex. */
  grime?: (x: number, y: number, z: number) => number
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

function isLoose(mesh: THREE.Mesh): boolean {
  const kind = mesh.userData.kind
  return kind === 'control' || kind === 'decal'
}

function writeLivery(
  geo: THREE.BufferGeometry,
  mode: LiveryMapKind | undefined,
  box: LiveryBox | undefined,
  local: boolean,
) {
  const pos = geo.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  const slot = new Float32Array(pos.count)
  const id = mode === 'fuselage' ? 0 : mode === 'tail' ? 1 : mode === 'engine' ? 2 : 3
  const bareMetal = geo.userData.nacelle === true
  for (let i = 0; i < pos.count; i++) {
    slot[i] = id
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    let u = 0
    let v = 0
    if (mode === 'engine' && local) {
      ;[u, v] = engineUv(x, y, z)
      // Cowl only: the polished intake lip, fan face, core nozzle and exhaust plug stay bare metal.
      const r = Math.hypot(x, z)
      if (bareMetal && (y > 0.26 || y < -0.46 || (y < -0.29 && r < 0.86))) slot[i] = 3
    } else if ((mode === 'fuselage' || mode === 'tail') && box && !local) {
      ;[u, v] = outwardUv(x, y, z, box)
    }
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geo.setAttribute('liveryUv', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('liverySlot', new THREE.BufferAttribute(slot, 1))
}

/** Bake a transformed clone that carries position, normal, colour, and livery UVs. */
export function bakeGeometry(
  src: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  hex?: string,
  livery?: { mode?: LiveryMapKind; box?: LiveryBox },
): THREE.BufferGeometry {
  const geo = src.clone()
  const hadLivery = Boolean(geo.getAttribute('liveryUv') && geo.getAttribute('liverySlot'))
  if (!hadLivery && livery?.mode === 'engine') writeLivery(geo, 'engine', undefined, true)
  geo.applyMatrix4(matrix)
  if (!hadLivery && livery?.mode !== 'engine') writeLivery(geo, livery?.mode, livery?.box, false)
  const flat = geo.index ? geo.toNonIndexed() : geo
  if (flat !== geo) geo.dispose()
  for (const name of Object.keys(flat.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color' && name !== 'liveryUv' && name !== 'liverySlot' && name !== 'grime') {
      flat.deleteAttribute(name)
    }
  }
  if (!flat.getAttribute('normal')) flat.computeVertexNormals()
  const pos = flat.getAttribute('position')
  if (hex || !flat.getAttribute('color')) {
    const colors = new Float32Array(pos.count * 3)
    _color.set(hex || '#888888')
    for (let i = 0; i < pos.count; i++) {
      colors[i * 3] = _color.r
      colors[i * 3 + 1] = _color.g
      colors[i * 3 + 2] = _color.b
    }
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }
  if (!flat.getAttribute('uv') || livery?.mode === 'fuselage' || livery?.mode === 'tail') {
    // Surface-detail UVs in skin metres (surfaceDetail.ts): fuselage unrolled around the
    // tube so panel joints ring it and run along it; fin flat; everything else planar.
    const uv = new Float32Array(pos.count * 2)
    const box = livery?.box
    const cy = box ? (box.y0 + box.y1) / 2 : 0
    const rad = box ? Math.max(0.5, (box.y1 - box.y0) / 2) : 1
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      if (livery?.mode === 'fuselage') {
        uv[i * 2] = x / PANEL_U_M
        uv[i * 2 + 1] = (Math.atan2(y - cy, Math.abs(z)) * rad) / PANEL_V_M
      } else if (livery?.mode === 'tail') {
        uv[i * 2] = x / PANEL_U_M
        uv[i * 2 + 1] = y / PANEL_V_M
      } else {
        uv[i * 2] = x * 0.18
        uv[i * 2 + 1] = z * 0.12 + y * 0.04
      }
    }
    flat.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }
  if (!flat.getAttribute('liveryUv')) writeLivery(flat, 'none', undefined, false)
  if (!flat.getAttribute('grime')) flat.setAttribute('grime', new THREE.BufferAttribute(new Float32Array(pos.count), 1))
  return flat
}

function liveryOf(mesh: THREE.Mesh): { mode?: LiveryMapKind; box?: LiveryBox } {
  const mode = mesh.userData.liveryMap as LiveryMapKind | undefined
  const box = mesh.userData.liveryBox as LiveryBox | undefined
  return { mode, box }
}

function piecesOf(mesh: THREE.Mesh, matrix: THREE.Matrix4): THREE.BufferGeometry[] {
  const inst = mesh as THREE.InstancedMesh
  const keep = !inst.isInstancedMesh && Boolean(mesh.geometry.getAttribute('color'))
  const hex = keep ? undefined : (mesh.userData.paint as string) || '#888888'
  const livery = liveryOf(mesh)
  if (!inst.isInstancedMesh) return [bakeGeometry(mesh.geometry, matrix, hex, livery)]
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < inst.count; i++) {
    inst.getMatrixAt(i, _instance)
    _combined.multiplyMatrices(matrix, _instance)
    parts.push(bakeGeometry(mesh.geometry, _combined, hex, livery))
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

function takeShell(
  frame: ShellSource,
  meshes: PaintedMesh[],
  key: string,
  name: string,
  finish: 'paint' | 'metal',
) {
  if (!meshes.length) return
  const partNames = meshes.map((mesh) => mesh.name).filter((part) => part.length > 0)
  const prev = frame.group.userData.partNames as string[] | undefined
  frame.group.userData.partNames = prev ? prev.concat(partNames) : partNames
  const geometry = sharedGeo(key, () => {
    const parts: THREE.BufferGeometry[] = []
    for (const mesh of meshes) {
      mesh.updateMatrix()
      parts.push(...piecesOf(mesh, mesh.matrix))
    }
    const merged = mergeParts(parts)
    if (frame.grime) {
      const pos = merged.getAttribute('position')
      const g = merged.getAttribute('grime') as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) g.setX(i, Math.max(0, Math.min(1, frame.grime(pos.getX(i), pos.getY(i), pos.getZ(i)))))
    }
    return merged
  })
  for (const mesh of meshes) {
    mesh.removeFromParent()
    const index = frame.meshes.indexOf(mesh)
    if (index >= 0) frame.meshes.splice(index, 1)
  }
  const shell = new THREE.Mesh(geometry)
  shell.name = name
  const painted = paintVertexMesh(shell, frame.tier === 'low' ? 'low' : 'mid', 'mesh', finish, frame.livery.airline, frame.livery.wear ?? 0)
  painted.userData.airline = frame.livery.airline
  painted.castShadow = frame.tier === 'mid'
  frame.group.add(painted)
  frame.meshes.push(painted)
}

/**
 * Fold static mid/low parts into one paint shell (and, up close, one metal shell).
 * Gear, spinners, lamps, control surfaces, and the tail decal stay separate.
 */
export function mergeStaticShell(frame: ShellSource) {
  if (frame.tier === 'high') return
  const staticMeshes = frame.meshes.filter((mesh) => {
    if (isLamp(mesh) || isLoose(mesh)) return false
    if (under(mesh, frame.gears) || under(mesh, frame.spinners)) return false
    return true
  })
  if (!staticMeshes.length) return
  const metal = frame.tier === 'mid'
    ? staticMeshes.filter((mesh) => mesh.userData.slot === 'metal')
    : []
  const paint = staticMeshes.filter((mesh) => !metal.includes(mesh))
  const base = `shell:${frame.tier}:${frame.specId}:${liveryKey(frame.livery)}`
  takeShell(frame, paint, base, 'airframe', 'paint')
  takeShell(frame, metal, `${base}:metal`, 'nacelles', 'metal')
}

/** One geometry of every mesh in a built level, for instancing parked copies. */
export function bakeGroup(root: THREE.Object3D): THREE.BufferGeometry {
  root.updateMatrixWorld(true)
  const parts: THREE.BufferGeometry[] = []
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    // Hidden parts (prop / rotor blur discs, shut doorway cuts) are not part of the parked shell:
    // baking them drew an opaque grey disc behind every parked prop in the batched copies.
    if (!mesh.visible || mesh.userData.ownMat) return
    _rel.copy(root.matrixWorld).invert().multiply(mesh.matrixWorld)
    parts.push(...piecesOf(mesh, _rel))
  })
  return mergeParts(parts)
}
