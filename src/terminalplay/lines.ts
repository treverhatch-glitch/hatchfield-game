/**
 * Live queue lines in the hall. People who have arrived at a desk stand
 * in a spaced line back toward the door they came through. Walking passengers
 * stay on their doorway route.
 */
import type { HallNode } from '../game/guests.ts'
import { apronToHall, type HallFit } from '../render/hallRooms.ts'
import { HALL_NODE_ROOM, type RoomPlan } from '../render/world/rooms.ts'
import { PLAY_TUNING } from './config.ts'

const NODE_DEFS: Partial<Record<HallNode, readonly string[]>> = {
  checkin: ['checkin_belt', 'checkin_express', 'kiosk'],
  security: ['security_small', 'security_medium', 'security_large'],
  bathroom: ['toilet', 'toilet_plus'],
  food: ['cafe', 'fast_food', 'restaurant'],
  shop: ['newsagent'],
  gate: ['seat_row', 'bench', 'boarding_desk'],
}

export interface LineGuest {
  id: string
  node: string
  dead?: boolean
  preview?: boolean
  job?: 'depart' | 'arrive'
  clearedSec?: boolean
  serviceLeft?: number
  path?: readonly string[]
  seg?: number
  queueSeq?: number
  releaseAt?: number
}

export interface QueueAnchor {
  x: number
  z: number
  dirX: number
  dirZ: number
}

export interface QueueSlot {
  x: number
  z: number
  /** Facing back toward the desk. */
  yaw: number
}

interface AnchoredItem {
  def: string
  hx?: number
  hz?: number
  bundle?: boolean
}

/** Same people the badge counts, and only once they have stopped walking. */
export function standingInQueue(g: LineGuest, node: string, clock: number): boolean {
  if (g.dead || g.preview || g.node !== node) return false
  if (g.releaseAt != null && g.releaseAt > clock) return false
  if (node === 'security') {
    if (!(g.job === 'depart' && !g.clearedSec && (g.serviceLeft ?? 0) <= 0)) return false
  }
  const path = g.path ?? []
  const seg = g.seg ?? 0
  if (path.length > 1 && seg < path.length - 1) return false
  return true
}

function norm(x: number, z: number): { x: number; z: number } {
  const len = Math.hypot(x, z)
  if (len < 1e-4) return { x: 0, z: 1 }
  return { x: x / len, z: z / len }
}

/**
 * Desk the line forms at, and the direction back toward the doorway.
 * A placed piece wins. Otherwise the line starts at the room's centre.
 */
export function queueAnchor(
  plan: RoomPlan,
  fit: HallFit,
  items: readonly AnchoredItem[],
  node: HallNode,
): QueueAnchor | null {
  const kind = HALL_NODE_ROOM[node]
  if (!kind) return null
  const rooms = plan.rooms.filter((r) => r.kind === kind)
  if (!rooms.length) return null
  const defs = NODE_DEFS[node] ?? []
  const placed = items.find((it) => it.hx != null && it.hz != null && !it.bundle && defs.includes(it.def))
  const room = rooms[0]
  let ax: number
  let az: number
  if (placed && placed.hx != null && placed.hz != null) {
    ax = placed.hx
    az = placed.hz
  } else {
    const hall = apronToHall(room.x, room.z, fit)
    ax = hall.x
    az = hall.z
  }
  const doors = plan.doors.filter((d) => d.a === room.id || d.b === room.id)
  let dir = { x: 0, z: 1 }
  if (doors.length) {
    const center = apronToHall(room.x, room.z, fit)
    let best = doors[0]
    let bestD = Infinity
    for (const door of doors) {
      const at = apronToHall(door.x, door.z, fit)
      const dist = Math.hypot(at.x - center.x, at.z - center.z)
      if (dist < bestD) {
        best = door
        bestD = dist
      }
    }
    const doorHall = apronToHall(best.x, best.z, fit)
    dir = norm(doorHall.x - ax, doorHall.z - az)
  }
  return { x: ax, z: az, dirX: dir.x, dirZ: dir.z }
}

/** Slot 0 is at the desk. The tail runs back toward the door. */
export function slotsAlong(anchor: QueueAnchor, count: number, spacing = PLAY_TUNING.queueSpacingM): QueueSlot[] {
  const yaw = Math.atan2(-anchor.dirX, -anchor.dirZ)
  const out: QueueSlot[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      x: anchor.x + anchor.dirX * spacing * (i + 0.6),
      z: anchor.z + anchor.dirZ * spacing * (i + 0.6),
      yaw,
    })
  }
  return out
}

export function queueOrder(guests: readonly LineGuest[]): LineGuest[] {
  return [...guests].sort((a, b) => (a.queueSeq ?? 0) - (b.queueSeq ?? 0) || a.id.localeCompare(b.id))
}
