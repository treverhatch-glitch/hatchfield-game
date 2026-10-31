/**
 * Stores cart, render-free. The cart leaves `stores_dock` and the crate
 * walks onto `counter_restock`. Samples stay within 40 cm, the same hop
 * the socket hand-off uses. Stock is not part of this file: the caller
 * raises the shelf only after the crate has docked.
 */
import type { SupplyPhase } from './types.ts'
import { detAtan2, detCos, detHypot, detSin } from '../game/detMath.ts'

/** Longest hop while the cart or the crate is moving. Matches the socket hand-off. */
export const RESTOCK_STEP_M = 0.4
/** Cart nose is docked when it sits inside this of the counter approach. */
export const DOCK_TOLERANCE_M = 0.05

export interface Pt {
  x: number
  y: number
  z: number
}

export interface RunnerClock {
  phase: SupplyPhase | 'idle'
  phaseEndsAt: number
  shopId?: string
}

export interface SupplyCartPose {
  id: string
  shopId: string
  kind: 'food' | 'shop'
  phase: SupplyPhase | 'idle'
  x: number
  y: number
  z: number
  yaw: number
  docked: boolean
  /** 0 at the start of the unload, 1 when the crate is on the counter. */
  unloadU: number
  crateX: number
  crateY: number
  crateZ: number
  /** Metres from the crate to `counter_restock`. */
  dockGap: number
}

/** Prefab hall, metres. Food and shop sit on the retail nodes. */
export const PREFAB_SOCKETS = {
  stores_dock: { x: -16, y: 0, z: 6 },
  food_counter_restock: { x: 3.84, y: 0.92, z: 0.64 },
  shop_counter_restock: { x: 8.64, y: 0.92, z: -4.48 },
} as const

/** Crate sits this far forward of the cart origin, on the bed. */
const CRATE_LOCAL: Pt = { x: 0.55, y: 0.82, z: 0 }
/** Nose lock sits this far forward of the cart origin. */
const NOSE_LOCAL = 1.15

const DRIVE: Record<SupplyPhase, readonly [number, number]> = {
  loading_at_depot: [0, 0],
  driving_to_dock: [0, 0.42],
  security_screening: [0.42, 0.42],
  trolley_to_shop: [0.42, 1],
  shelving: [1, 1],
  returning: [1, 0],
}

export function dist(a: Pt, b: Pt): number {
  return detHypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** Points along a polyline, never more than `step` apart. Endpoints stay. */
export function resamplePath(points: readonly Pt[], step = RESTOCK_STEP_M): Pt[] {
  if (points.length === 0) return []
  const out: Pt[] = [{ ...points[0] }]
  let remain = step
  for (let i = 1; i < points.length; i++) {
    let a = out[out.length - 1]
    const b = points[i]
    let seg = dist(a, b)
    if (seg < 1e-8) continue
    while (seg >= remain - 1e-8) {
      const t = seg < 1e-8 ? 1 : Math.min(1, remain / seg)
      const p = lerp(a, b, t)
      out.push(p)
      a = p
      seg = dist(a, b)
      remain = step
      if (seg < 1e-6) break
    }
    remain -= seg
  }
  const last = points[points.length - 1]
  if (dist(out[out.length - 1], last) > 1e-4) out.push({ ...last })
  return out
}

export function counterSocket(kind: 'food' | 'shop'): Pt {
  return kind === 'food' ? { ...PREFAB_SOCKETS.food_counter_restock } : { ...PREFAB_SOCKETS.shop_counter_restock }
}

/** Dock → aisle → park. The nose meets the counter; hops stay within 40 cm. */
export function counterRoute(kind: 'food' | 'shop'): Pt[] {
  const from = PREFAB_SOCKETS.stores_dock
  const to = counterSocket(kind)
  const aisle: Pt = { x: to.x, y: 0, z: from.z }
  const floor: Pt = { x: to.x, y: 0, z: to.z }
  const dx = floor.x - aisle.x
  const dz = floor.z - aisle.z
  const len = detHypot(dx, dz) || 1
  const park: Pt = {
    x: floor.x - (dx / len) * NOSE_LOCAL,
    y: 0,
    z: floor.z - (dz / len) * NOSE_LOCAL,
  }
  return resamplePath([from, aisle, park])
}

export function poseOnRoute(route: readonly Pt[], u: number): { pos: Pt; yaw: number } {
  if (route.length === 0) return { pos: { x: 0, y: 0, z: 0 }, yaw: 0 }
  const clamped = clamp01(u)
  if (route.length === 1 || clamped <= 0) return { pos: { ...route[0] }, yaw: yawOf(route[0], route[Math.min(1, route.length - 1)]) }
  const span = route.length - 1
  const f = clamped * span
  const i = Math.min(span - 1, Math.floor(f))
  const t = f - i
  const pos = lerp(route[i], route[i + 1], t)
  return { pos, yaw: yawOf(route[i], route[i + 1]) }
}

/**
 * Where the cart is for this runner. `docked` is true through the unload.
 * The crate is still on the bed at the start of shelving and on
 * `counter_restock` at the end. The shelf itself is not touched here.
 */
export function supplyPose(
  runner: RunnerClock & { id: string },
  now: number,
  durations: Record<SupplyPhase, number>,
  kind: 'food' | 'shop',
): SupplyCartPose {
  const route = counterRoute(kind)
  const phase = runner.phase
  const moving = phase !== 'idle'
  const span = moving ? DRIVE[phase] : ([0, 0] as const)
  const u = moving ? phaseU(runner.phaseEndsAt, now, durations[phase]) : 0
  const along = span[0] + (span[1] - span[0]) * u
  const at = poseOnRoute(route, along)
  const yaw = at.yaw
  const origin = at.pos
  const bed = offset(origin, yaw, CRATE_LOCAL)
  const counter = counterSocket(kind)
  const unloadU = phase === 'shelving' ? u : phase === 'returning' ? 1 : 0
  const crate = lerp(bed, counter, unloadU)
  const nose = offset(origin, yaw, { x: NOSE_LOCAL, y: 0, z: 0 })
  const approach = offset(counter, yaw, { x: -NOSE_LOCAL, y: -counter.y, z: 0 })
  const docked = phase === 'shelving' || phase === 'returning' || dist(nose, approach) <= DOCK_TOLERANCE_M
  return {
    id: runner.id,
    shopId: runner.shopId ?? '',
    kind,
    phase,
    x: origin.x,
    y: origin.y,
    z: origin.z,
    yaw,
    docked: phase === 'shelving' || phase === 'returning' ? true : docked && along > 0.98,
    unloadU,
    crateX: crate.x,
    crateY: crate.y,
    crateZ: crate.z,
    dockGap: dist(crate, counter),
  }
}

/** Game minutes from `now` until the unload that fills `shopId` finishes. */
export function etaToUnload(
  runners: readonly RunnerClock[],
  now: number,
  durations: Record<SupplyPhase, number>,
  shopId: string,
): number {
  const full = unloadMinutes(durations)
  const mine = runners.find((r) => r.phase !== 'idle' && r.shopId === shopId)
  if (mine) return remainingUntilUnload(mine, now, durations)
  const other = runners.find((r) => r.phase !== 'idle')
  if (other) return remainingUntilIdle(other, now, durations) + full
  return full
}

function unloadMinutes(durations: Record<SupplyPhase, number>): number {
  return (
    durations.loading_at_depot +
    durations.driving_to_dock +
    durations.security_screening +
    durations.trolley_to_shop +
    durations.shelving
  )
}

function remainingUntilUnload(runner: RunnerClock, now: number, durations: Record<SupplyPhase, number>): number {
  const order: SupplyPhase[] = ['loading_at_depot', 'driving_to_dock', 'security_screening', 'trolley_to_shop', 'shelving']
  if (runner.phase === 'idle' || runner.phase === 'returning') return 0
  const i = order.indexOf(runner.phase)
  if (i < 0) return unloadMinutes(durations)
  let left = Math.max(0, runner.phaseEndsAt - now)
  for (let k = i + 1; k < order.length; k++) left += durations[order[k]]
  return left
}

function remainingUntilIdle(runner: RunnerClock, now: number, durations: Record<SupplyPhase, number>): number {
  const order: SupplyPhase[] = [
    'loading_at_depot',
    'driving_to_dock',
    'security_screening',
    'trolley_to_shop',
    'shelving',
    'returning',
  ]
  if (runner.phase === 'idle') return 0
  const i = order.indexOf(runner.phase)
  if (i < 0) return unloadMinutes(durations) + durations.returning
  let left = Math.max(0, runner.phaseEndsAt - now)
  for (let k = i + 1; k < order.length; k++) left += durations[order[k]]
  return left
}

function phaseU(endsAt: number, now: number, dur: number): number {
  if (!(dur > 0)) return 1
  return clamp01(1 - (endsAt - now) / dur)
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
}

function yawOf(a: Pt, b: Pt): number {
  return detAtan2(b.x - a.x, b.z - a.z)
}

function offset(origin: Pt, yaw: number, local: Pt): Pt {
  const c = detCos(yaw)
  const s = detSin(yaw)
  return {
    x: origin.x + local.x * s + local.z * c,
    y: origin.y + local.y,
    z: origin.z + local.x * c - local.z * s,
  }
}
