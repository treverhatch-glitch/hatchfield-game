/**
 * Round-8 de-box for buildings that are still cuboids. Large boxes pick up a
 * bevel; flat roofs can take a low barrel vault and a parapet coping.
 * Signs, docks, and bay marks are left alone. The passenger terminal is not
 * passed through here.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { SKIN_TILE_M } from '../../build/materialTargets'
import { WORLD_PER_METER } from '../aircraft/specs'
import { metreUv } from './buildingSkin'

const SKIP = /^(sign:|service-bay:|service-dock|parapet|vault)/

/** Bevel every large box. Returns how many meshes changed. */
export function softenBuilding(root: THREE.Object3D): number {
  const meshes: THREE.Mesh[] = []
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !(mesh.geometry instanceof THREE.BoxGeometry)) return
    if (SKIP.test(mesh.name)) return
    const { width, height, depth } = mesh.geometry.parameters
    const lo = Math.min(width, height, depth)
    // Only the main volumes. Doors, copings, and slabs stay sharp.
    if (lo < 0.35 || Math.max(width, height, depth) < 0.8) return
    meshes.push(mesh)
  })
  for (const mesh of meshes) {
    const { width, height, depth } = (mesh.geometry as THREE.BoxGeometry).parameters
    const lo = Math.min(width, height, depth)
    const radius = Math.min(0.22, lo * 0.12)
    const geo = new RoundedBoxGeometry(width, height, depth, 1, radius)
    metreUv(geo, SKIN_TILE_M.wall, WORLD_PER_METER)
    mesh.geometry.dispose()
    mesh.geometry = geo
  }
  return meshes.length
}

/** A low barrel on top of a flat roof. Rise is world units. */
export function addVault(
  g: THREE.Group,
  span: number,
  depth: number,
  y: number,
  z: number,
  material: THREE.Material,
  rise = 0.42,
) {
  const r = Math.max(span / 2, rise)
  const geo = new THREE.CylinderGeometry(r, r, depth, 16, 1, true, Math.PI / 2, Math.PI)
  geo.rotateX(Math.PI / 2)
  geo.scale(1, rise / r, 1)
  const mesh = new THREE.Mesh(metreUv(geo, SKIN_TILE_M.roof, WORLD_PER_METER), material)
  mesh.name = 'vault'
  mesh.position.set(0, y, z)
  mesh.castShadow = true
  g.add(mesh)
  return mesh
}

/** Coping ring just above a roof slab. */
export function addParapet(g: THREE.Group, span: number, depth: number, y: number, z: number, material: THREE.Material) {
  const t = 0.1
  const h = 0.22
  const ring = new THREE.Group()
  ring.name = 'parapet'
  const add = (w: number, d: number, x: number, zz: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, h / 2, zz)
    mesh.castShadow = true
    ring.add(mesh)
  }
  add(span, t, 0, -depth / 2)
  add(span, t, 0, depth / 2)
  add(t, depth, -span / 2, 0)
  add(t, depth, span / 2, 0)
  ring.position.set(0, y, z)
  g.add(ring)
  return ring
}
