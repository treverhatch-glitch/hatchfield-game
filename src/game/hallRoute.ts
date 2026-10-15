/**
 * World-space doorway routes for hall guests. The node graph still decides
 * where they are going; this polyline is how they get there without crossing a wall.
 */
import type { HallNode } from './guests.ts'
import { rng } from './mulberry.ts'
import {
  HALL_NODE_ROOM,
  STERILE_ROOMS,
  navPath,
  pointInRoom,
  roomAt,
  type Room,
  type RoomKind,
  type RoomPlan,
} from '../render/world/rooms.ts'

const STAFF: ReadonlySet<RoomKind> = new Set(['office', 'lab'])

export interface RouteGuest {
  id: string
  node: string
  job: 'depart' | 'arrive'
  clearedSec: boolean
  wx?: number
  wz?: number
}

/** Stable 0..1 stream for a guest id plus a node, so the target does not jitter. */
export function seededRand(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return rng((h >>> 0) || 1)
}

/**
 * Room kind for a hall node. Uncleared departures never receive a sterile target:
 * security is the only bridge, and a sterile goal would ask `navPath` to cross it.
 */
export function legTargetKind(node: string, guest: { job: 'depart' | 'arrive'; clearedSec: boolean }): RoomKind {
  const kind = HALL_NODE_ROOM[node] ?? 'airside'
  if (guest.job === 'depart' && !guest.clearedSec && STERILE_ROOMS.has(kind)) return 'security'
  return kind
}

function roomOfKind(plan: RoomPlan, kind: RoomKind, rand: () => number): Room | null {
  if (!plan || !plan.rooms) return null
  const list = plan.rooms.filter((r) => r.kind === kind)
  if (!list.length) return null
  return list[Math.floor(rand() * list.length) % list.length]
}

/**
 * Doorway polyline from where the guest stands to a stable point in the next node's room.
 * `strict` is on: a blocked path is null, not a shortcut through furniture.
 */
export function legRoute(plan: RoomPlan, guest: RouteGuest, next: HallNode | string): { x: number; z: number }[] | null {
  if (!plan) return null
  const goalKind = legTargetKind(next, guest)
  const goalRand = seededRand(`${guest.id}:${next}`)
  const goal = roomOfKind(plan, goalKind, goalRand)
  if (!goal) return null
  const target = pointInRoom(plan, goal, goalRand)
  if (guest.job === 'depart' && !guest.clearedSec) {
    const landed = roomAt(plan, target.x, target.z)
    if (landed && STERILE_ROOMS.has(landed.kind)) return null
  }

  let from: { x: number; z: number } | null =
    guest.wx != null && guest.wz != null && Number.isFinite(guest.wx) && Number.isFinite(guest.wz)
      ? { x: guest.wx, z: guest.wz }
      : null
  if (from) {
    const here = roomAt(plan, from.x, from.z)
    if (!here) from = null
    else if (guest.job === 'depart' && !guest.clearedSec && STERILE_ROOMS.has(here.kind)) from = null
  }
  const startKind = legTargetKind(guest.node, guest)
  if (!from) {
    const startRand = seededRand(`${guest.id}:${guest.node}:at`)
    const start = roomOfKind(plan, startKind, startRand)
    if (!start) return null
    from = pointInRoom(plan, start, startRand)
  }
  const here = roomAt(plan, from.x, from.z)
  const staff = STAFF.has(goalKind) || STAFF.has(startKind) || (here != null && STAFF.has(here.kind))
  return navPath(plan, from, target, { strict: true, staff })
}

export function polylineLength(route: readonly { x: number; z: number }[]): number {
  if (!route) return 0
  let n = 0
  for (let i = 1; i < route.length; i++) n += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z)
  return n
}

/** Position at fraction `t` (0..1) along a doorway polyline. */
export function pointAlong(route: readonly { x: number; z: number }[], t: number): { x: number; z: number; yaw: number } {
  if (!route || route.length === 0) return { x: 0, z: 0, yaw: 0 }
  const p0 = route[0] ?? { x: 0, z: 0 }
  if (route.length < 2) return { x: p0.x, z: p0.z, yaw: 0 }
  const cum = [0]
  for (let i = 1; i < route.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z))
  }
  const total = cum[cum.length - 1] || 1
  const d = Math.min(1, Math.max(0, t)) * total
  let k = 1
  while (k < cum.length - 1 && cum[k] < d) k++
  const p = route[k - 1]
  const q = route[k]
  const seg = cum[k] - cum[k - 1] || 1
  const f = Math.min(1, Math.max(0, (d - cum[k - 1]) / seg))
  return {
    x: p.x + (q.x - p.x) * f,
    z: p.z + (q.z - p.z) * f,
    yaw: Math.atan2(q.x - p.x, q.z - p.z),
  }
}

/** Room kinds stepped along a polyline. Used to prove a walk stays landside or crosses a door. */
export function routeRoomKinds(plan: RoomPlan, route: readonly { x: number; z: number }[]): RoomKind[] {
  if (!plan || !route || route.length === 0) return []
  const out: RoomKind[] = []
  const step = Math.max(plan.size * 0.5, 0.05)
  const push = (x: number, z: number) => {
    const room = roomAt(plan, x, z)
    if (room) out.push(room.kind)
  }
  if (route.length === 1) push(route[0].x, route[0].z)
  for (let i = 1; i < route.length; i++) {
    const p = route[i - 1]
    const q = route[i]
    const len = Math.hypot(q.x - p.x, q.z - p.z)
    const n = Math.max(1, Math.ceil(len / step))
    for (let k = 0; k <= n; k++) push(p.x + ((q.x - p.x) * k) / n, p.z + ((q.z - p.z) * k) / n)
  }
  return out
}
