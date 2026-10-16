/**
 * Layout fittings as terminalProps, one instanced group per kind, scale 1.
 * The round-5 check-in desk, the bag-drop kiosk, the carousel and the
 * passport booth keep their builders. Plates stay on those builders.
 * A bigger carousel passes a longer straight run; the 2.7 × 1.5 m plate does not grow.
 */
import * as THREE from 'three'
import { layoutTileM } from '../../terminalbuild/config.ts'
import { fittingSize, fittingSpec } from '../../terminalbuild/fittings.ts'
import type { BuildLayout, Fitting, FittingKind } from '../../terminalbuild/types.ts'
import { buildTerminalProps, TERMINAL_PROP_TYPES, type PropPlacement, type TerminalPropType } from '../terminalProps/index.ts'

const PROP_SET = new Set<string>(TERMINAL_PROP_TYPES)

export function fittingPropType(kind: FittingKind): TerminalPropType | null {
  const prop = fittingSpec(kind).prop
  return PROP_SET.has(prop) ? (prop as TerminalPropType) : null
}

export function fittingWorld(layout: BuildLayout, f: Pick<Fitting, 'kind' | 'x' | 'y' | 'rot'>): { x: number; z: number; yaw: number } {
  const tile = layoutTileM(layout)
  const size = fittingSize(f.kind, f.rot)
  const ox = (-layout.w * tile) / 2
  const oz = (-layout.h * tile) / 2
  return {
    x: ox + (f.x + size.w / 2) * tile,
    z: oz + (f.y + size.d / 2) * tile,
    yaw: (f.rot * Math.PI) / 2,
  }
}

function tileWorld(layout: BuildLayout, x: number, y: number): { x: number; z: number } {
  const tile = layoutTileM(layout)
  return {
    x: (-layout.w * tile) / 2 + (x + 0.5) * tile,
    z: (-layout.h * tile) / 2 + (y + 0.5) * tile,
  }
}

/** Invisible click volume. Raycasts hit it; the material does not draw. */
export function fittingPickMesh(layout: BuildLayout, f: Fitting): THREE.Mesh {
  const spec = fittingSpec(f.kind)
  const at = fittingWorld(layout, f)
  const h = Math.max(1.2, spec.h)
  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.4, spec.w), h, Math.max(0.4, spec.d)),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  pick.name = 'hall-pick'
  pick.position.set(at.x, h / 2, at.z)
  pick.rotation.y = at.yaw
  pick.userData.facilityId = f.id
  pick.userData.piece = spec.prop === 'belt' || f.kind === 'belt' || f.kind === 'belt_incline' ? 'belt' : 'fitting'
  pick.userData.servicePick = spec.servers > 0
  pick.frustumCulled = false
  return pick
}

function fallbackBox(layout: BuildLayout, f: Fitting): THREE.Mesh {
  const spec = fittingSpec(f.kind)
  const at = fittingWorld(layout, f)
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w, spec.h, spec.d),
    new THREE.MeshLambertMaterial({ color: f.kind === 'belt' || f.kind === 'belt_incline' ? '#2a3238' : '#d7d2c8' }),
  )
  mesh.position.set(at.x, spec.h / 2, at.z)
  mesh.rotation.y = at.yaw
  mesh.name = `fitting-box-${f.kind}`
  mesh.userData.facilityId = f.id
  mesh.userData.piece = f.kind === 'belt' || f.kind === 'belt_incline' ? 'belt' : 'fitting'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function beltTileMesh(layout: BuildLayout, x: number, y: number): THREE.Mesh {
  const at = tileWorld(layout, x, y)
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.42, 0.72),
    new THREE.MeshLambertMaterial({ color: '#2a3238' }),
  )
  mesh.position.set(at.x, 0.21, at.z)
  mesh.name = 'belt-tile'
  mesh.userData.piece = 'belt'
  mesh.userData.beltTile = `${x},${y}`
  return mesh
}

/** Instanced props for every fitting on the layout, plus belt tiles and pick boxes. */
export function buildFittingMeshes(layout: BuildLayout): THREE.Group {
  const root = new THREE.Group()
  root.name = 'hall-fittings'
  const buckets = new Map<FittingKind, PropPlacement[]>()
  const plain: Fitting[] = []
  for (const f of layout.fittings ?? []) {
    if ((f.floor ?? 0) !== 0) continue
    const type = fittingPropType(f.kind)
    if (!type) {
      plain.push(f)
      continue
    }
    const at = fittingWorld(layout, f)
    const list = buckets.get(f.kind) ?? []
    list.push({ type, x: at.x, z: at.z, y: 0, yaw: at.yaw, scale: 1 })
    buckets.set(f.kind, list)
  }
  for (const [kind, placements] of buckets) {
    const group = buildTerminalProps(placements, { shadows: false })
    group.name = `fitting-${kind}`
    const belt = kind === 'belt' || kind === 'belt_incline'
    group.userData.piece = belt ? 'belt' : 'fitting'
    group.userData.fittingKind = kind
    root.add(group)
  }
  for (const f of plain) root.add(fallbackBox(layout, f))
  for (const f of layout.fittings ?? []) {
    if ((f.floor ?? 0) !== 0) continue
    root.add(fittingPickMesh(layout, f))
  }
  const seen = new Set<string>()
  for (const run of layout.belts ?? []) {
    if ((run.floor ?? 0) !== 0) continue
    for (const t of run.tiles) {
      const key = `${t.x},${t.y}`
      if (seen.has(key)) continue
      seen.add(key)
      root.add(beltTileMesh(layout, t.x, t.y))
    }
  }
  return root
}

/** Draw calls the S1 hall spends on fittings (instanced meshes that have instances). */
export function fittingDrawCalls(group: THREE.Object3D): number {
  let n = 0
  group.traverse((obj) => {
    const mesh = obj as THREE.InstancedMesh
    if (mesh.isInstancedMesh && mesh.count > 0) n += 1
    else if ((obj as THREE.Mesh).isMesh && obj.name !== 'hall-pick') n += 1
  })
  return n
}
