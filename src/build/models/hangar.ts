/** Hangar family: arched-roof line hangars in three tiers. */
import * as THREE from 'three'
import { animate } from '../anim'
import type { SizeTier } from '../../scale/types'
import { box, emblem, HALF, M, mat, pad, sign, tmat } from './kit'

export function hangar(g: THREE.Group, tier: SizeTier = 'small'): void {
  const h = tier === 'jumbo' ? 6.6 : tier === 'wide' ? 5.0 : 3.6
  const w = HALF * 2
  const d = HALF * 1.85
  const accent = tier === 'jumbo' ? '#c9a227' : tier === 'wide' ? '#3d6a8a' : '#7d8c9b'
  pad(g, w, w, tmat('dock_floor', '#d8d6d0', 3, 3, { rough: 0.9 }))
  const wall = tmat('hangar_cladding', '#c4ccd4', 4, 1, { rough: 0.45, metal: 0.45 })
  // Side walls up to the eave, then a barrel-vault arch roof.
  const eave = h * 0.55
  box(g, w * 0.98, eave, d, wall, 0, 0.12, -0.2)
  const r = (w * 0.98) / 2
  const archH = h - eave
  const archGeo = new THREE.CylinderGeometry(r, r, d, 36, 1, true, Math.PI / 2, Math.PI)
  archGeo.rotateX(Math.PI / 2)
  archGeo.scale(1, archH / r, 1)
  const arch = new THREE.Mesh(archGeo, tmat('hangar_cladding', '#d4dbe2', 1, 6, { rough: 0.35, metal: 0.55 }))
  arch.position.set(0, 0.12 + eave, -0.2)
  arch.castShadow = true
  g.add(arch)
  // Gable end fill (front + back) so the arch reads solid.
  for (const z of [-0.2 + d / 2, -0.2 - d / 2]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 36, 0, Math.PI), wall)
    cap.scale.set(1, archH / r, 1)
    cap.position.set(0, 0.12 + eave, z)
    if (z < 0) cap.rotation.y = Math.PI
    g.add(cap)
  }
  // Huge multi-leaf door across almost the whole front.
  const fz = -0.2 + d / 2 + 0.04
  const leaves = tier === 'jumbo' ? 6 : 4
  const dw = w * 0.86
  for (let i = 0; i < leaves; i++) {
    const x = -dw / 2 + (dw / leaves) * (i + 0.5)
    const leaf = box(g, dw / leaves - 0.06, eave + archH * 0.55, 0.08, mat('#2a3038', { rough: 0.55, metal: 0.4 }), x, 0.12, fz - (i % 2) * 0.1)
    // Leaves stack outward toward their side when an aircraft is in work.
    animate(leaf, { kind: 'slide', signal: 'hangarBusy', axis: 'x', amount: (x < 0 ? -1 : 1) * (dw / 2 - Math.abs(x)) * 0.9 })
    box(g, 0.04, eave + archH * 0.55, 0.1, M.steel(), x + dw / leaves / 2, 0.12, fz)
  }
  // Door header beam with tier stripe and sign.
  box(g, dw + 0.4, 0.3, 0.14, tmat('chevron_stripe', '#ffffff', 6, 1, { rough: 0.4 }), 0, 0.12 + eave + archH * 0.55, fz)
  sign(g, tier === 'jumbo' ? 'HANGAR J' : tier === 'wide' ? 'HANGAR W' : 'HANGAR', accent, '#ffffff', 2.6, 0.5, 0, 0.12 + eave + archH * 0.72, fz + 0.02)
  emblem(g, 'wrench', accent, 1.0, w * 0.4, eave * 0.6, fz + 0.03)
  // Door track and apron lead-in line.
  box(g, dw, 0.04, 0.3, M.darkSteel(), 0, 0.12, fz + 0.2)
  box(g, 0.25, 0.03, 0.5, M.yellow(), 0, 0.12, fz + 0.45)
  // Roof lights along the arch crown.
  for (let i = 0; i < 4; i++) box(g, 0.6, 0.06, d * 0.18, M.glass(), 0, 0.12 + h + 0.02, -0.2 - d / 2 + d * (0.15 + i * 0.23))
}
