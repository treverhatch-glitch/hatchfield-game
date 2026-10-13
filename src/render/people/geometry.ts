// Low-poly person geometry. Each vertex carries `aPart` so the vertex shader
// can swing limbs around their pivots (procedural vertex animation, no bones).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const PART = { torso: 0, head: 1, legL: 2, legR: 3, armL: 4, armR: 5, skin: 6 } as const
export const HIP_Y = 0.9
export const SHOULDER_Y = 1.45

function part(g: THREE.BufferGeometry, id: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g
  ng.translate(x, y, z)
  ng.deleteAttribute('uv')
  const n = ng.getAttribute('position').count
  ng.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(id), 1))
  return ng
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)

/** tier 0 = near (~300 tris), 1 = mid (~72 tris), 2 = far (~24 tris, no limbs) */
export function buildPersonGeometry(tier: 0 | 1 | 2): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  if (tier === 2) {
    parts.push(part(box(0.42, 0.85, 0.24), PART.torso, 0, 1.2, 0))
    parts.push(part(box(0.36, 0.9, 0.2), PART.legL, 0, 0.45, 0))
    parts.push(part(box(0.22, 0.24, 0.22), PART.head, 0, 1.72, 0))
  } else {
    parts.push(part(box(0.42, 0.6, 0.24), PART.torso, 0, 1.2, 0))
    parts.push(part(box(0.38, 0.12, 0.22), PART.legL, 0, 0.86, 0)) // pelvis (moves with L leg a little; cheap)
    parts.push(part(box(0.16, 0.86, 0.18), PART.legL, -0.1, 0.45, 0))
    parts.push(part(box(0.16, 0.86, 0.18), PART.legR, 0.1, 0.45, 0))
    parts.push(part(box(0.11, 0.62, 0.13), PART.armL, -0.28, 1.15, 0))
    parts.push(part(box(0.11, 0.62, 0.13), PART.armR, 0.28, 1.15, 0))
    if (tier === 0) {
      parts.push(part(new THREE.IcosahedronGeometry(0.13, 1), PART.head, 0, 1.68, 0))
      parts.push(part(box(0.09, 0.08, 0.09), PART.skin, 0, 1.53, 0)) // neck
      parts.push(part(box(0.18, 0.09, 0.26), PART.legL, -0.1, 0.04, 0.04)) // shoes
      parts.push(part(box(0.18, 0.09, 0.26), PART.legR, 0.1, 0.04, 0.04))
    } else {
      parts.push(part(box(0.22, 0.24, 0.22), PART.head, 0, 1.68, 0))
    }
  }
  const g = mergeGeometries(parts)!
  g.computeBoundingSphere()
  g.boundingSphere!.radius = 1e9 // instances are spread out; we cull per instance on CPU
  return g
}

export type PropKind = 'backpack' | 'rolling' | 'checked' | 'desk' | 'cap'
export function buildPropGeometry(kind: PropKind): THREE.BufferGeometry {
  let g: THREE.BufferGeometry
  switch (kind) {
    case 'backpack': g = box(0.32, 0.4, 0.16); g.translate(0, 1.2, -0.2); break
    case 'rolling': { // case trailing behind-right, with handle up to the hand
      const c = box(0.36, 0.5, 0.22); c.translate(0.32, 0.3, -0.42)
      const h = box(0.03, 0.42, 0.03); h.translate(0.32, 0.74, -0.32)
      g = mergeGeometries([c.toNonIndexed(), h.toNonIndexed()])!; break
    }
    case 'checked': g = box(0.48, 0.66, 0.28); g.translate(-0.42, 0.33, 0.1); break
    case 'desk': {
      const top = box(1.1, 0.06, 0.6); top.translate(0, 0.74, 0.5)
      const mon = box(0.5, 0.32, 0.04); mon.translate(0, 1.0, 0.68)
      g = mergeGeometries([top.toNonIndexed(), mon.toNonIndexed()])!; break
    }
    case 'cap': g = new THREE.CylinderGeometry(0.15, 0.15, 0.07, 8); g.translate(0, 1.82, 0.02); break
  }
  g.computeBoundingSphere(); g.boundingSphere!.radius = 1e9
  return g
}
