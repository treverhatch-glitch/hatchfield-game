/**
 * True footprints for items placed inside Terminal view.
 * Sizes are hall metres on the 48×32 m floor. The nine-room plan decides
 * which room a piece may sit in. Walls, doorways, and built-in fixtures reject it.
 */
import { HALL_D, HALL_W } from '../game/terminal.ts'
import { apronToHall, hallToApron, type HallFit } from '../render/hallRooms.ts'
import { roomAt, squareAt, type RoomKind, type RoomPlan } from '../render/world/rooms.ts'

export interface FootprintSpec {
  /** Width along local x before rotation, hall metres. */
  w: number
  /** Depth along local z before rotation, hall metres. */
  d: number
  rooms: readonly RoomKind[]
}

/**
 * Catalogue footprints for the pieces the player operates in the hall.
 * A quarter-turn swaps width and depth. The ghost uses this rectangle, not a zone cell.
 */
export const FOOTPRINTS: Record<string, FootprintSpec> = {
  checkin_belt: { w: 3, d: 1.2, rooms: ['checkin'] },
  checkin_express: { w: 3.2, d: 1.2, rooms: ['checkin'] },
  kiosk: { w: 1, d: 1, rooms: ['checkin'] },
  security_small: { w: 3.2, d: 4, rooms: ['security'] },
  security_medium: { w: 4.4, d: 5, rooms: ['security'] },
  security_large: { w: 6, d: 6, rooms: ['security'] },
  newsagent: { w: 3, d: 3, rooms: ['shops'] },
  cafe: { w: 2.8, d: 2.4, rooms: ['shops'] },
  fast_food: { w: 3, d: 3, rooms: ['shops'] },
  restaurant: { w: 5, d: 4, rooms: ['shops'] },
  toilet: { w: 4, d: 3, rooms: ['checkin', 'airside', 'shops'] },
  toilet_plus: { w: 4, d: 3, rooms: ['checkin', 'airside', 'shops'] },
  seat_row: { w: 4, d: 1, rooms: ['gate'] },
  bench: { w: 2, d: 0.8, rooms: ['gate', 'airside'] },
}

const ROOM_WORD: Record<string, string> = {
  checkin: 'the check-in hall',
  security: 'security',
  shops: 'the shops',
  gate: 'a gate holdroom',
  airside: 'the airside concourse',
}

export function footprintSpec(def: string): FootprintSpec | null {
  return FOOTPRINTS[def] ?? null
}

export interface FootprintStamp {
  hx: number
  hz: number
  rot: number
  /** Rotated width and depth, hall metres. */
  w: number
  d: number
}

export interface PlacedFoot {
  id?: string
  def: string
  hx?: number
  hz?: number
  /** Unrotated footprint, hall metres. */
  fw?: number
  fd?: number
  rot?: number
}

export function snapMetre(n: number): number {
  return Math.round(n * 4) / 4
}

export function rotatedFoot(w: number, d: number, rot: number): { w: number; d: number } {
  const q = ((Math.round(rot) % 4) + 4) % 4
  return q % 2 === 0 ? { w, d } : { w: d, d: w }
}

export function stampFrom(def: string, hx: number, hz: number, rot: number): FootprintStamp | null {
  const spec = footprintSpec(def)
  if (!spec) return null
  const size = rotatedFoot(spec.w, spec.d, rot)
  return {
    hx: snapMetre(hx),
    hz: snapMetre(hz),
    rot: ((Math.round(rot) % 4) + 4) % 4,
    w: size.w,
    d: size.d,
  }
}

function roomWords(rooms: readonly RoomKind[]): string {
  return rooms.map((r) => ROOM_WORD[r] ?? r).join(' or ')
}

interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function rectOf(hx: number, hz: number, w: number, d: number): Rect {
  return { minX: hx - w / 2, maxX: hx + w / 2, minZ: hz - d / 2, maxZ: hz + d / 2 }
}

function rectsOverlap(a: Rect, b: Rect, gap = 0.05): boolean {
  return a.minX < b.maxX - gap && a.maxX > b.minX + gap && a.minZ < b.maxZ - gap && a.maxZ > b.minZ + gap
}

function samples(stamp: FootprintStamp): { x: number; z: number }[] {
  const inset = 0.06
  const w = Math.max(0.2, stamp.w - inset * 2)
  const d = Math.max(0.2, stamp.d - inset * 2)
  const step = 0.35
  const nx = Math.max(1, Math.ceil(w / step))
  const nz = Math.max(1, Math.ceil(d / step))
  const out: { x: number; z: number }[] = []
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      out.push({
        x: stamp.hx - w / 2 + (w * i) / nx,
        z: stamp.hz - d / 2 + (d * j) / nz,
      })
    }
  }
  return out
}

function segHitsRect(x0: number, z0: number, x1: number, z1: number, rect: Rect, pad: number): boolean {
  const minX = rect.minX - pad
  const maxX = rect.maxX + pad
  const minZ = rect.minZ - pad
  const maxZ = rect.maxZ + pad
  const len = Math.hypot(x1 - x0, z1 - z0)
  const n = Math.max(1, Math.ceil(len / 0.15))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = x0 + (x1 - x0) * t
    const z = z0 + (z1 - z0) * t
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true
  }
  return false
}

function placedRect(it: PlacedFoot): Rect | null {
  if (it.hx == null || it.hz == null) return null
  const spec = footprintSpec(it.def)
  const w = it.fw ?? spec?.w ?? 1.5
  const d = it.fd ?? spec?.d ?? 1.5
  const size = rotatedFoot(w, d, it.rot ?? 0)
  return rectOf(it.hx, it.hz, size.w, size.d)
}

/**
 * Why this footprint cannot sit here. Null means the rooms, walls, and doors allow it.
 * Cash and field level are the sim's job.
 */
export function footprintReason(
  plan: RoomPlan,
  fit: HallFit,
  items: readonly PlacedFoot[],
  def: string,
  hx: number,
  hz: number,
  rot: number,
  ignoreId?: string,
): string | null {
  const spec = footprintSpec(def)
  const stamp = stampFrom(def, hx, hz, rot)
  if (!spec || !stamp) return 'Not a hall piece'
  const rect = rectOf(stamp.hx, stamp.hz, stamp.w, stamp.d)
  if (rect.minX < -HALL_W / 2 || rect.maxX > HALL_W / 2 || rect.minZ < -HALL_D / 2 || rect.maxZ > HALL_D / 2) {
    return 'Outside the hall'
  }
  // A footprint sitting on the partition reads as a wall, even when one side is the right room.
  for (const wall of plan.walls) {
    if (wall.header) continue
    const a = apronToHall(wall.x0, wall.z0, fit)
    const b = apronToHall(wall.x1, wall.z1, fit)
    if (segHitsRect(a.x, a.z, b.x, b.z, rect, 0.08)) return 'On a wall'
  }
  let roomId = -1
  let wrongRoom: string | null = null
  let onFixture = false
  for (const p of samples(stamp)) {
    const apron = hallToApron(p.x, p.z, fit)
    const room = roomAt(plan, apron.x, apron.z)
    if (!room) return 'Outside the hall'
    if (!spec.rooms.includes(room.kind)) wrongRoom = `Goes in ${roomWords(spec.rooms)}`
    else if (roomId < 0) roomId = room.id
    else if (room.id !== roomId) return 'Crosses a wall'
    const s = squareAt(plan, apron.x, apron.z)
    if (s >= 0 && plan.blocked[s]) onFixture = true
  }
  for (const door of plan.doors) {
    const c = apronToHall(door.x, door.z, fit)
    const along = (door.width * fit.scale) / 2
    const across = 0.7
    const doorRect =
      door.axis === 'x'
        ? rectOf(c.x, c.z, along * 2, across * 2)
        : rectOf(c.x, c.z, across * 2, along * 2)
    if (rectsOverlap(rect, doorRect, 0)) return 'Blocks a door'
  }
  if (onFixture) return 'On a fixture'
  if (wrongRoom) return wrongRoom
  for (const it of items) {
    if (ignoreId && it.id === ignoreId) continue
    const other = placedRect(it)
    if (other && rectsOverlap(rect, other)) return 'Overlaps another item'
  }
  return null
}

/** First hall point where this piece fits, scanning allowed rooms. */
export function findFootprint(
  plan: RoomPlan,
  fit: HallFit,
  items: readonly PlacedFoot[],
  def: string,
  rot = 0,
): FootprintStamp | null {
  const spec = footprintSpec(def)
  if (!spec) return null
  for (const room of plan.rooms) {
    if (!spec.rooms.includes(room.kind)) continue
    for (const s of room.squares) {
      const i = s % plan.w
      const j = (s - i) / plan.w
      const apron = {
        x: plan.x0 + (i + 0.5) * plan.size,
        z: plan.z0 + (j + 0.5) * plan.size,
      }
      const hall = apronToHall(apron.x, apron.z, fit)
      if (footprintReason(plan, fit, items, def, hall.x, hall.z, rot)) continue
      return stampFrom(def, hall.x, hall.z, rot)
    }
  }
  return null
}

/** Topmost footprint under a hall point, for bulldoze and move. */
export function footprintHit(items: readonly PlacedFoot[], hx: number, hz: number): PlacedFoot | null {
  let hit: PlacedFoot | null = null
  for (const it of items) {
    const rect = placedRect(it)
    if (!rect) continue
    if (hx >= rect.minX && hx <= rect.maxX && hz >= rect.minZ && hz <= rect.maxZ) hit = it
  }
  return hit
}
