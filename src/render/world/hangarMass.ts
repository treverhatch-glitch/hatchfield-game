/**
 * Line hangars from building-visuals-r9 (hangarR5): a barrel vault, concrete
 * door pylons, and stacked door leaves. The shell is drawn in one cell, then
 * scaled onto the tier's lot so the door clears the design aircraft.
 * Cladding and the roof membrane stay on the Gemini exterior plates.
 */
import * as THREE from 'three'
import { SKIN_TILE_M } from '../../build/materialTargets'
import { HANGAR_DESIGN, HANGAR_HEAD_CLEAR_M, HANGAR_SIDE_CLEAR_M } from '../../scale/data'
import type { SizeTier } from '../../scale/types'
import { CELL, WORLD_PER_METER } from '../aircraft/specs'
import { metreUv, photoMaterial, skinBox, skinMaterial } from './buildingSkin'
import { mountDock, mountServiceBay, mountSign } from './buildingSign'

/** Eave height in world units after the lot scale (the vault rises above this). */
export const HANGAR_WALL_H: Record<SizeTier, number> = {
  small: 5.4 * 0.62 * (0.55 + 0.45 * 3),
  wide: 6.1 * 0.62 * (0.55 + 0.45 * 4),
  jumbo: 7.1 * 0.62 * (0.55 + 0.45 * 5),
}

const WORD: Record<SizeTier, string> = { small: 'HANGAR', wide: 'WIDE', jumbo: 'JUMBO' }
const ACCENT: Record<SizeTier, string> = { small: '#7d8c9b', wide: '#3d6a8a', jumbo: '#c9a227' }

function baseBox(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y + h / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function shellSize(tier: SizeTier) {
  const h = tier === 'jumbo' ? 7.1 : tier === 'wide' ? 6.1 : 5.4
  const w = tier === 'small' ? 6.4 : 7.9
  const d = 6.6
  const eave = h * 0.62
  return { h, w, d, eave, archH: h - eave, doorW: w - 0.3, doorH: eave * 0.92 }
}

/** Door opening in metres after the lot scale. Tests check this against the design aircraft. */
export function hangarOpeningM(tier: SizeTier): { widthM: number; heightM: number } {
  const { doorW, doorH } = shellSize(tier)
  const lot = HANGAR_DESIGN[tier].lot
  const yScale = 0.55 + 0.45 * lot
  return {
    widthM: (doorW * lot) / WORLD_PER_METER,
    heightM: (doorH * yScale) / WORLD_PER_METER,
  }
}

export function hangarClearsDesign(tier: SizeTier): boolean {
  const design = HANGAR_DESIGN[tier]
  const open = hangarOpeningM(tier)
  return open.widthM >= design.spanM + HANGAR_SIDE_CLEAR_M * 2 && open.heightM >= design.tailM + HANGAR_HEAD_CLEAR_M
}

export function addHangar(g: THREE.Group, tier: SizeTier) {
  const shell = new THREE.Group()
  shell.name = 'hangar-shell'
  const { h, w, d, eave, archH, doorW, doorH } = shellSize(tier)
  const hx = tier === 'small' ? 0.4 : 0
  const cz = -1
  const fz = cz + d / 2
  const wall = skinMaterial('hangar', 'wall', { metalness: 0.25 })
  const roofMat = skinMaterial('hangar', 'roof')
  const doorMat = skinMaterial('hangar', 'door')
  const concrete = new THREE.MeshStandardMaterial({ color: '#c9c6bf', roughness: 0.8 })
  const glass = new THREE.MeshStandardMaterial({ color: '#9ec4de', roughness: 0.15, metalness: 0.2 })
  const dark = new THREE.MeshStandardMaterial({ color: '#2a3038', roughness: 0.55, metalness: 0.35 })

  const pad = new THREE.Mesh(
    metreUv(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), 4, WORLD_PER_METER),
    photoMaterial('apron_concrete', '#cfcdc6'),
  )
  pad.rotation.x = -Math.PI / 2
  pad.position.y = 0.02
  pad.receiveShadow = true
  shell.add(pad)

  shell.add(baseBox(w, eave, d, wall, hx, 0.12, cz))

  const r = w / 2 + 0.2
  const archGeo = new THREE.CylinderGeometry(r, r, d + 0.3, 24, 1, true, Math.PI / 2, Math.PI)
  archGeo.rotateX(Math.PI / 2)
  archGeo.scale(1, archH / r, 1)
  const arch = new THREE.Mesh(metreUv(archGeo, SKIN_TILE_M.roof, WORLD_PER_METER), roofMat)
  arch.position.set(hx, 0.12 + eave, cz)
  arch.castShadow = true
  shell.add(arch)

  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.045, 4, 18, Math.PI), dark)
    rib.scale.set(1, archH / r, 1)
    rib.position.set(hx, 0.12 + eave, cz - d / 2 + (d / 3) * i)
    shell.add(rib)
  }
  const sky = baseBox(0.7, 0.06, d * 0.8, glass, hx, 0.12 + h - 0.04, cz)
  shell.add(sky)

  const capGeo = new THREE.CircleGeometry(r, 24, 0, Math.PI)
  const cap = new THREE.Mesh(capGeo, wall)
  cap.scale.set(1, archH / r, 1)
  cap.position.set(hx, 0.12 + eave, fz + 0.02)
  shell.add(cap)
  const back = new THREE.Mesh(capGeo, wall)
  back.scale.set(1, archH / r, 1)
  back.position.set(hx, 0.12 + eave, cz - d / 2 - 0.02)
  back.rotation.y = Math.PI
  shell.add(back)

  const clerestory = new THREE.Mesh(new THREE.BoxGeometry(w - 1.1, archH * 0.42, 0.06), glass)
  clerestory.position.set(hx, 0.12 + doorH + archH * 0.28, fz + 0.04)
  shell.add(clerestory)

  for (const sx of [-1, 1]) {
    const px = hx + sx * (w / 2 + (tier === 'small' ? 0.3 : 0.25))
    const pw = tier === 'small' ? 0.7 : 0.48
    shell.add(baseBox(pw, eave + archH * 0.55, 1.15, concrete, px, 0.12, fz - 0.35))
    shell.add(baseBox(pw + 0.06, 0.1, 1.2, dark, px, 0.12 + eave + archH * 0.55, fz - 0.35))
  }

  const leaves = tier === 'jumbo' ? 6 : 4
  shell.add(baseBox(doorW, doorH, 0.04, dark, hx, 0.12, fz - 0.06))
  for (let i = 0; i < leaves; i++) {
    const x = hx - doorW / 2 + (doorW / leaves) * (i + 0.5)
    const leaf = baseBox(doorW / leaves - 0.05, doorH, 0.08, doorMat, x, 0.12, fz + 0.02 - (i % 2) * 0.06)
    leaf.name = 'hangar-leaf'
    shell.add(leaf)
  }
  const header = new THREE.Mesh(
    skinBox(doorW + 0.3, 0.28, 0.14, SKIN_TILE_M.wall, WORLD_PER_METER),
    photoMaterial('chevron_stripe', '#f4f0e4'),
  )
  header.position.set(hx, 0.12 + doorH + 0.14, fz + 0.05)
  shell.add(header)
  mountSign(
    shell,
    WORD[tier],
    { w: 2.2, h: 0.4, x: hx, y: 0.12 + doorH + 0.48, z: fz + 0.1 },
    ACCENT[tier],
    '#ffffff',
  )

  if (tier === 'small') {
    const ow = 1.6
    const ox = hx - w / 2 - ow / 2 - 0.15
    shell.add(baseBox(ow, 2.6, 3.4, concrete, ox, 0.12, cz - 1.2))
    shell.add(baseBox(ow, 1.7, 2.4, wall, ox, 0.12, cz + 1.6))
  }

  mountDock(shell, doorW * 0.92, 1.05, hx, fz + 0.85)
  mountServiceBay(shell, 'nose', doorW * 0.7, 0.95, hx, fz + 0.42, '#d7a21a')

  const lot = HANGAR_DESIGN[tier].lot
  const yScale = 0.55 + 0.45 * lot
  shell.scale.set(lot, yScale, lot)
  const lo = -Math.floor((lot - 1) / 2)
  const mid = lo + (lot - 1) / 2
  shell.position.set(mid * CELL, 0, mid * CELL)
  g.add(shell)
}
