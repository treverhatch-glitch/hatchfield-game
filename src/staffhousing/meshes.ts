import type * as THREE from 'three'
import type { HousingTierId, MeshPart } from './types.ts'

/** Low-poly shells in real meters. The renderer scales by world-units per meter. */

export function housingParts(tier: HousingTierId): MeshPart[] {
  if (tier === 'apartments') return apartmentParts()
  if (tier === 'village') return villageParts()
  return dormParts()
}

export function workerParts(tier: HousingTierId): MeshPart[] {
  const vest = tier === 'apartments' ? '#3d7ea6' : tier === 'village' ? '#6a8f4e' : '#e0a15a'
  return [
    { w: 0.42, h: 0.85, d: 0.26, x: 0, y: 0.95, z: 0, color: vest },
    { w: 0.28, h: 0.28, d: 0.28, x: 0, y: 1.61, z: 0, color: '#f0d2b4' },
    { w: 0.16, h: 0.7, d: 0.16, x: -0.16, y: 0.4, z: 0, color: '#2c3338' },
    { w: 0.16, h: 0.7, d: 0.16, x: 0.16, y: 0.4, z: 0, color: '#2c3338' },
  ]
}

/** Tallest point of the shell, meters above the ground. */
export function housingHeightM(tier: HousingTierId): number {
  return housingParts(tier).reduce((top, part) => Math.max(top, part.y + part.h / 2), 0)
}

export function workerHeightM(): number {
  return workerParts('dorm').reduce((top, part) => Math.max(top, part.y + part.h / 2), 0)
}

type BoxFactory = {
  BoxGeometry: new (w: number, h: number, d: number) => THREE.BufferGeometry
  MeshStandardMaterial: new (params: { color: string; roughness: number }) => THREE.Material
  Mesh: new (geo: THREE.BufferGeometry, mat: THREE.Material) => THREE.Mesh
  Group: new () => THREE.Group
}

/** Builds a group. `worldPerMeter` is the shared apron scale (0.45). */
export function buildParts(parts: readonly MeshPart[], worldPerMeter: number, three: BoxFactory): THREE.Group {
  const group = new three.Group()
  const scale = worldPerMeter
  for (const part of parts) {
    const mesh = new three.Mesh(
      new three.BoxGeometry(part.w * scale, part.h * scale, part.d * scale),
      new three.MeshStandardMaterial({ color: part.color, roughness: 0.72 }),
    )
    mesh.position.set(part.x * scale, part.y * scale, part.z * scale)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return group
}

function dormParts(): MeshPart[] {
  return [
    { w: 16, h: 0.3, d: 11, x: 0, y: 0.15, z: 0, color: '#6a6258' },
    { w: 14.5, h: 6.4, d: 9.5, x: 0, y: 3.5, z: 0, color: '#8d5a45' },
    { w: 15.2, h: 0.45, d: 10.4, x: 0, y: 6.9, z: 0, color: '#4e3428' },
    { w: 1.2, h: 2.2, d: 0.2, x: 0, y: 1.3, z: 4.85, color: '#2a211c' },
    { w: 1.4, h: 1.1, d: 0.15, x: -3.2, y: 2.4, z: 4.8, color: '#d7e4ee' },
    { w: 1.4, h: 1.1, d: 0.15, x: 3.2, y: 2.4, z: 4.8, color: '#d7e4ee' },
    { w: 1.4, h: 1.1, d: 0.15, x: -3.2, y: 4.6, z: 4.8, color: '#d7e4ee' },
    { w: 1.4, h: 1.1, d: 0.15, x: 3.2, y: 4.6, z: 4.8, color: '#d7e4ee' },
  ]
}

function apartmentParts(): MeshPart[] {
  return [
    { w: 18, h: 0.35, d: 12, x: 0, y: 0.18, z: 0, color: '#5c656e' },
    { w: 16.5, h: 12.8, d: 11, x: -0.4, y: 6.75, z: 0, color: '#8ea0b0' },
    { w: 3.2, h: 14.2, d: 3.2, x: 7.2, y: 7.2, z: 0, color: '#6d7c8a' },
    { w: 17.2, h: 0.4, d: 11.6, x: -0.2, y: 13.35, z: 0, color: '#3e4a55' },
    { w: 1.6, h: 2.4, d: 0.2, x: -0.4, y: 1.4, z: 5.6, color: '#1f3a4a' },
  ]
}

function villageParts(): MeshPart[] {
  const cottage = (x: number, z: number, wall: string): MeshPart[] => [
    { w: 6.2, h: 3.2, d: 5.2, x, y: 1.8, z, color: wall },
    { w: 6.8, h: 1.3, d: 5.8, x, y: 3.9, z, color: '#3f6b45' },
  ]
  return [
    { w: 10, h: 4.2, d: 7.5, x: 0, y: 2.3, z: 0, color: '#efe6d2' },
    { w: 10.6, h: 0.4, d: 8.1, x: 0, y: 4.6, z: 0, color: '#8d5a45' },
    ...cottage(-7.2, -3.4, '#f4efe4'),
    ...cottage(7.2, -3.4, '#e7d7c3'),
    ...cottage(-7.2, 4.2, '#efe2cc'),
    ...cottage(7.2, 4.2, '#f7f1e6'),
  ]
}
