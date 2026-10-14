/**
 * Fit one apron terminal (planTerminal / TerminalBuilding) into the 48×32 m hall.
 * Guests keep the sim's doorway polyline; this only maps it into the hall frame.
 */
import { WORLD_PER_METER } from './aircraft/specs'
import { legRoute, legTargetKind, pointAlong, seededRand, type RouteGuest } from '../game/hallRoute'
import { HALL_D, HALL_W } from '../game/terminal'
import { clusterCenter, type TerminalInfo } from './world/layout'
import { pointInRoom, type RoomPlan } from './world/rooms'
import { CELL } from './world/view'
import { HALL_FIGURE_M } from './hallCamera'

/** Inset so room walls sit inside the hall shell instead of z-fighting it. */
const PAD_M = 1.1

export interface HallFit {
  /** Hall metres per apron world unit. Uniform, so desks stay in proportion. */
  scale: number
  /** Apron point that lands on the hall origin. */
  cx: number
  cz: number
}

/** The terminal cluster that belongs to this hall, same match the sim uses. */
export function matchTerminal(
  list: readonly TerminalInfo[],
  origin: { c: number; r: number } | null,
): { info: TerminalInfo; index: number } | null {
  if (!list.length) return null
  if (origin) {
    const key = `${origin.c},${origin.r}`
    const index = list.findIndex(
      (t) =>
        `${t.cluster.minC},${t.cluster.minR}` === key ||
        t.cluster.cells.some((p) => p.c === origin.c && p.r === origin.r),
    )
    if (index >= 0) return { info: list[index], index }
  }
  return { info: list[0], index: 0 }
}

export function hallFitFor(info: TerminalInfo, pad = PAD_M): HallFit {
  const w = (info.cluster.maxC - info.cluster.minC + 1) * CELL
  const d = (info.cluster.maxR - info.cluster.minR + 1) * CELL
  const c = clusterCenter(info.cluster)
  const spanW = Math.max(CELL, w)
  const spanD = Math.max(CELL, d)
  const scale = Math.min((HALL_W - pad * 2) / spanW, (HALL_D - pad * 2) / spanD)
  return { scale, cx: c.x, cz: c.z }
}

export function apronToHall(x: number, z: number, fit: HallFit): { x: number; z: number } {
  return { x: (x - fit.cx) * fit.scale, z: (z - fit.cz) * fit.scale }
}

export function hallToApron(x: number, z: number, fit: HallFit): { x: number; z: number } {
  return { x: x / fit.scale + fit.cx, z: z / fit.scale + fit.cz }
}

/**
 * Hall figures are authored at HALL_FIGURE_M. Terminal people are 1.75 m
 * drawn in apron units, then scaled with the building. Match that height.
 */
export function hallGuestScale(fit: HallFit): number {
  return (1.75 * WORLD_PER_METER * fit.scale) / HALL_FIGURE_M
}

export interface HallGuestPose {
  x: number
  z: number
  yaw: number
  /** Sim already sampled wx/wz along its doorway polyline. */
  fromSim: boolean
}

/**
 * Where one hall guest stands in apron space: the sim polyline when it has
 * one, otherwise a cached doorway walk from the current node to the next.
 */
export function poseOnPlan(
  plan: RoomPlan,
  guest: RouteGuest & { t: number; wyaw?: number; route?: readonly { x: number; z: number }[] | null },
  next: string | null,
  cache: Map<string, { x: number; z: number }[] | null>,
): HallGuestPose | null {
  if (guest.route && guest.route.length >= 2 && guest.wx != null && guest.wz != null) {
    return { x: guest.wx, z: guest.wz, yaw: guest.wyaw ?? 0, fromSim: true }
  }
  if (!next) {
    const kind = legTargetKind(guest.node, guest)
    const rooms = plan.rooms.filter((r) => r.kind === kind)
    if (!rooms.length) return null
    const rand = seededRand(`${guest.id}:${guest.node}:stand`)
    const room = rooms[Math.floor(rand() * rooms.length) % rooms.length]
    const p = pointInRoom(plan, room, rand)
    return { x: p.x, z: p.z, yaw: guest.wyaw ?? 0, fromSim: false }
  }
  const key = `${guest.id}|${guest.node}|${next}|${guest.job}|${guest.clearedSec ? 1 : 0}`
  let route = cache.get(key)
  if (route === undefined) {
    route = legRoute(plan, guest, next)
    cache.set(key, route)
  }
  if (!route || route.length < 2) return null
  const at = pointAlong(route, guest.t)
  return { x: at.x, z: at.z, yaw: at.yaw, fromSim: false }
}
