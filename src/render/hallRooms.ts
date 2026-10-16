/**
 * Fit one apron terminal (planTerminal / TerminalBuilding) into the 48×32 m hall.
 * Guests keep the sim's doorway polyline; this only maps it into the hall frame.
 */
import { HALL_D, HALL_W } from '../game/terminal'
import { clusterCenter, type TerminalInfo } from './world/layout'
import type { RoomPlan } from './world/rooms'
import { CELL, cellX, cellZ } from './world/view'

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

/**
 * Fit the shell into the hall. Without an anchor the whole cluster is scaled
 * into the 48×32 m box. An anchor keeps the original stamp's scale and centre,
 * so cells added on the apron stick out as extra floor instead of shrinking.
 */
export function hallFitFor(
  info: TerminalInfo,
  pad = PAD_M,
  anchor?: { cx: number; cz: number; basisW: number; basisD: number },
): HallFit {
  const inset = pad ?? PAD_M
  const w = (info.cluster.maxC - info.cluster.minC + 1) * CELL
  const d = (info.cluster.maxR - info.cluster.minR + 1) * CELL
  const c = clusterCenter(info.cluster)
  const spanW = Math.max(CELL, anchor?.basisW ?? w)
  const spanD = Math.max(CELL, anchor?.basisD ?? d)
  const scale = Math.min((HALL_W - inset * 2) / spanW, (HALL_D - inset * 2) / spanD)
  return { scale, cx: anchor?.cx ?? c.x, cz: anchor?.cz ?? c.z }
}

/** Centre and size of the stamp the player first placed. Later tiles grow past this. */
export function stampAnchor(origin: { c: number; r: number }, premade: boolean): { cx: number; cz: number; basisW: number; basisD: number } {
  // Premade starter is 2 cells east-west and 4 cells north-south (44 × 88 m).
  const cols = 2
  const rows = premade ? 4 : 2
  const maxC = origin.c + cols - 1
  const maxR = origin.r + rows - 1
  return {
    cx: (cellX(origin.c) + cellX(maxC)) / 2,
    cz: (cellZ(origin.r) + cellZ(maxR)) / 2,
    basisW: cols * CELL,
    basisD: rows * CELL,
  }
}

/** Shell footprint in hall metres for a fit that already has a scale and centre. */
export function shellHallBounds(info: TerminalInfo, fit: HallFit): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const x0 = cellX(info.cluster.minC) - CELL / 2
  const x1 = cellX(info.cluster.maxC) + CELL / 2
  const z0 = cellZ(info.cluster.minR) - CELL / 2
  const z1 = cellZ(info.cluster.maxR) + CELL / 2
  const a = apronToHall(x0, z0, fit)
  const b = apronToHall(x1, z1, fit)
  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minZ: Math.min(a.z, b.z),
    maxZ: Math.max(a.z, b.z),
  }
}

export interface ShellBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/**
 * Outer walls that hug the room plan. The hall is wider than a square terminal,
 * so a full-hall shell leaves an empty floor band beside the rooms.
 */
export function roomShellBounds(plan: RoomPlan, fit: HallFit, margin = 0.45): ShellBounds {
  const a = apronToHall(plan.x0, plan.z0, fit)
  const b = apronToHall(plan.x0 + plan.w * plan.size, plan.z0 + plan.h * plan.size, fit)
  return {
    minX: Math.min(a.x, b.x) - margin,
    maxX: Math.max(a.x, b.x) + margin,
    minZ: Math.min(a.z, b.z) - margin,
    maxZ: Math.max(a.z, b.z) + margin,
  }
}

/** The old zone boxes, carousel and columns stay only when the nine-room plan is off. */
export function showLegacyHallFurniture(hasRoomPlan: boolean): boolean {
  return !hasRoomPlan
}

export function apronToHall(x: number, z: number, fit: HallFit): { x: number; z: number } {
  return { x: (x - fit.cx) * fit.scale, z: (z - fit.cz) * fit.scale }
}

export function hallToApron(x: number, z: number, fit: HallFit): { x: number; z: number } {
  return { x: x / fit.scale + fit.cx, z: z / fit.scale + fit.cz }
}
