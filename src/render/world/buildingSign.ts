/**
 * Real text on its own panel. The canvas is drawn left to right and the
 * panel faces the apron (+Z), so the words are not mirrored.
 * Node tests have no canvas; the panel stays a flat colour with the same name.
 */
import * as THREE from 'three'
import { SKIN_TILE_M } from '../../build/materialTargets'
import { WORLD_PER_METER } from '../aircraft/specs'
import { metreUv, photoMaterial, skinBox } from './buildingSkin'
import { textTexture } from './textures'

const cache = new Map<string, THREE.Texture | null>()

export function signMaterial(text: string, bg: string, fg: string): THREE.MeshBasicMaterial {
  const key = `${text}|${bg}|${fg}`
  let map = cache.get(key)
  if (map === undefined) {
    map = textTexture(text, {
      w: 512,
      h: 128,
      bg,
      fg,
      font: '700 72px sans-serif',
    })
    if (map) {
      map.wrapS = THREE.ClampToEdgeWrapping
      map.wrapT = THREE.ClampToEdgeWrapping
    }
    cache.set(key, map ?? null)
  }
  const mat = new THREE.MeshBasicMaterial({
    color: bg,
    map: map ?? null,
    side: THREE.FrontSide,
    toneMapped: false,
  })
  mat.name = `sign:${text}`
  return mat
}

/** A sign panel. Width and height are world units; the face looks along +Z. */
export function mountSign(
  group: THREE.Group,
  text: string,
  frame: { w: number; h: number; x: number; y: number; z: number },
  bg: string,
  fg: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(frame.w, frame.h), signMaterial(text, bg, fg))
  mesh.name = `sign:${text}`
  mesh.position.set(frame.x, frame.y, frame.z)
  group.add(mesh)
  return mesh
}

/** Painted apron where a truck or aircraft nose stops. One box, so it stays cheap. */
export function mountDock(group: THREE.Group, w: number, d: number, x: number, z: number, color = '#4a5160'): THREE.Mesh {
  const mesh = new THREE.Mesh(
    metreUv(new THREE.BoxGeometry(w, 0.04, d), 4, WORLD_PER_METER),
    photoMaterial('apron_concrete', color),
  )
  mesh.name = 'service-dock'
  mesh.position.set(x, 0.05, z)
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** Two roof slabs meeting at a ridge. Shared geometry, still two draws. */
export function mountGable(group: THREE.Group, material: THREE.Material, span: number, depth: number, baseY: number, rise: number) {
  const half = span / 2
  const len = Math.hypot(half, rise) + 0.16
  const ang = Math.atan2(rise, half)
  const geo = skinBox(len, 0.1, depth, SKIN_TILE_M.roof, WORLD_PER_METER)
  const left = new THREE.Mesh(geo, material)
  left.position.set(-half / 2, baseY + rise / 2, 0)
  left.rotation.z = ang
  left.castShadow = true
  const right = new THREE.Mesh(geo, material)
  right.position.set(half / 2, baseY + rise / 2, 0)
  right.rotation.z = -ang
  right.castShadow = true
  group.add(left, right)
}
