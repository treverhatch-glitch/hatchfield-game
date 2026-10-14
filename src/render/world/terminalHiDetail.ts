/**
 * High / Ultra graphics: swap the low-poly terminal plan props for the
 * detailed instanced models in render/terminalProps. Each plan prop kind maps
 * to one detailed type, scaled down to fit the footprint the plan already
 * reserves for it, so layouts and walk lanes are unchanged. Low / Medium keep
 * the baked low-poly props.
 */
import * as THREE from 'three'
import { buildTerminalProps, capTerminalPropMetal, fitScale, type PropPlacement, type TerminalPropType } from '../terminalProps'
import type { QualityLevel } from './quality'
import type { PropKind, Prop } from './plan'
import type { PropPart } from './kit'

/**
 * Plan prop kind → detailed model. Kinds not listed keep their low-poly mesh.
 * Desks (counter, monitor, podium) stay on the low-poly path: they are culled
 * per room for the cutaway (roomDraw DESK_KINDS).
 */
export const HI_DETAIL_KIND: Partial<Record<PropKind, TerminalPropType>> = {
  xray: 'xray_machine',
  arch: 'body_scanner',
  kiosk: 'shop_kiosk',
  board: 'departures_wall',
  bench: 'seat_row',
  planter: 'planter',
  bin: 'bin',
  stanchion: 'stanchion',
}
/** Kinds dropped at High because the detailed model already includes them. */
export const HI_DETAIL_ABSORBED: ReadonlySet<PropKind> = new Set<PropKind>(['awning'])

export function hiDetailOn(level: QualityLevel | undefined): boolean {
  return level === 'high' || level === 'ultra'
}

/** Is this kind drawn by the detailed layer at this quality? */
export function hiDetailOwns(kind: PropKind, on: boolean): boolean {
  return on && (kind in HI_DETAIL_KIND || HI_DETAIL_ABSORBED.has(kind))
}

const footCache = new Map<string, { w: number; d: number }>()
/** Footprint in metres of the low-poly prop, from its part geometries. */
export function lowPolyFootprint(kind: string, parts: PropPart[] | undefined): { w: number; d: number } {
  const hit = footCache.get(kind)
  if (hit) return hit
  const box = new THREE.Box3()
  for (const p of parts ?? []) {
    if (!p.geo.boundingBox) p.geo.computeBoundingBox()
    if (p.geo.boundingBox) box.union(p.geo.boundingBox)
  }
  const size = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.getSize(new THREE.Vector3())
  const out = { w: Math.max(0.3, size.x), d: Math.max(0.3, size.z) }
  footCache.set(kind, out)
  return out
}

/** Slack over the low-poly footprint; the detailed models carry more trim. */
const SLACK = 1.35

/**
 * Detailed group for a plan's props, in world units (props are authored in
 * metres, the world is WORLD_PER_METER per metre).
 */
export function buildHiDetailProps(
  props: readonly Prop[],
  parts: Record<string, PropPart[]>,
  worldPerMeter: number,
  floorY: number,
): THREE.Group {
  // The world has no environment map; keep chrome and steel from going black.
  capTerminalPropMetal(0.4)
  const placements: PropPlacement[] = []
  for (const p of props) {
    const type = HI_DETAIL_KIND[p.kind]
    if (!type) {
      // Gate podiums stay low-poly; a lit gate pylon stands beside each one.
      if (p.kind === 'podium') placements.push({ type: 'gate_pylon', x: p.x / worldPerMeter + Math.cos(p.yaw) * 1.4, z: p.z / worldPerMeter - Math.sin(p.yaw) * 1.4, y: floorY / worldPerMeter, yaw: p.yaw, scale: 0.6 })
      continue
    }
    const foot = lowPolyFootprint(p.kind, parts[p.kind])
    const fit = fitScale(type, foot.w * SLACK, foot.d * SLACK)
    placements.push({ type, x: p.x / worldPerMeter, z: p.z / worldPerMeter, y: floorY / worldPerMeter, yaw: p.yaw, scale: Math.max(0.35, fit) })
  }
  const g = buildTerminalProps(placements, { shadows: false })
  g.scale.setScalar(worldPerMeter)
  g.name = 'props-hidetail'
  return g
}
