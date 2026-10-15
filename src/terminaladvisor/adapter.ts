/**
 * Live adapter: turns a painted hall (zones + placed kit items) into the
 * advisor's TerminalPlan, runs adviseTerminal, and rewrites the hints in the
 * game's Advice shape so they share one list with the kit and litter notes.
 *
 * The live hall has no wall or door tool, so the plan is built from the same
 * rules the hall walks by:
 * - Front row (r = 0) is the curb. Check-in or arrivals on it, or an
 *   entrance item anywhere, is a curb door.
 * - Security gate rule: security is the only bridge between the before-security
 *   side (check-in, arrivals) and the after-security side (gates). Every other
 *   before/after seam is a partition, so a hall can never leak around the lane —
 *   it can only fail to connect.
 * - Shops/food and toilets sit on either side. A cell that touches a gate cell
 *   is sterile (after security); otherwise it is landside.
 * - Arrivals and gates only meet through the one-way inbound door, which is
 *   closed to departures, so the plan walls it.
 */
import type { Advice, AdviceCell } from '../game/advisor.ts'
import { adviseTerminal } from './advisor.ts'
import { blankPlan } from './plan.ts'
import type { EquipmentId, Hint, RoomId, TerminalPlan } from './types.ts'

export interface LiveHallItem {
  def: string
  c: number
  r: number
}

export interface LiveHall {
  zones?: readonly (readonly (string | null)[])[]
  items?: readonly LiveHallItem[]
}

type Side = 'before' | 'choke' | 'after' | 'either'

/** Painted zone -> advisor room. */
export const ZONE_ROOM: Record<string, RoomId> = {
  checkin: 'checkin',
  security: 'security',
  gates: 'gates',
  arrivals: 'bagclaim',
  retail: 'food',
  toilets: 'restrooms',
}

const ZONE_SIDE: Record<string, Side> = {
  checkin: 'before',
  arrivals: 'before',
  security: 'choke',
  gates: 'after',
  retail: 'either',
  toilets: 'either',
}

/** Kit item -> advisor equipment. Decor, bins, and rails have no advisor role. */
export const ITEM_EQUIP: Readonly<Record<string, EquipmentId>> = {
  checkin_belt: 'desk',
  checkin_express: 'desk',
  kiosk: 'kiosk',
  security_small: 'scanner',
  security_medium: 'scanner',
  security_large: 'scanner',
  boarding_desk: 'gate_desk',
  seat_row: 'seat',
  bench: 'seat',
  claim_carousel: 'carousel',
  bag_drop: 'bagdrop',
  passport_booth: 'passport_booth',
  bag_system: 'belt',
  toilet: 'toilet',
  toilet_plus: 'toilet',
  cafe: 'shop_unit',
  fast_food: 'shop_unit',
  restaurant: 'shop_unit',
  wayfinding: 'sign',
  info_screen: 'sign',
  departures_wall: 'sign',
  gate_pylon: 'sign',
  info_kiosk: 'sign',
}

/** Advisor checks with no live counterpart: no bag hall room, bridges live on the apron. */
const SKIP = new Set(['no_baghall', 'no_bridges'])

function sideAt(zones: LiveHall['zones'], c: number, r: number): Side | null {
  const z = zones?.[r]?.[c]
  if (!z) return null
  const side = ZONE_SIDE[z]
  if (side !== 'either') return side ?? null
  const touchesGate = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dc, dr]) => zones?.[r + dr]?.[c + dc] === 'gates')
  return touchesGate ? 'after' : 'before'
}

/** Partition between two cells? Different rooms that the security gate rule keeps apart. */
function walled(a: Side, b: Side, za: string, zb: string): boolean {
  if (za === zb) return false
  if (a === 'choke' || b === 'choke') return false
  return a !== b
}

/** Build the advisor's plan from a live hall. Null when nothing is painted yet. */
export function planFromHall(hall: LiveHall): TerminalPlan | null {
  const zones = hall.zones
  const rows = zones?.length ?? 0
  const cols = zones?.[0]?.length ?? 0
  if (!rows || !cols || !zones!.some((row) => row.some(Boolean))) return null
  const p = blankPlan(cols, rows)
  const L = p.floors[0]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const z = zones![r][c]
      if (!z) continue
      L.cells[r][c].floor = true
      L.cells[r][c].room = ZONE_ROOM[z] ?? null
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const za = zones![r][c]
      if (!za) continue
      const sa = sideAt(zones, c, r)!
      for (const [dir, dc, dr] of [
        ['E', 1, 0],
        ['S', 0, 1],
      ] as const) {
        const zb = zones![r + dr]?.[c + dc]
        if (!zb || zb === za) continue
        // Walls go between every room pair; a door opens the seam unless the gate rule shuts it.
        L.walls.push({ x: c, y: r, dir })
        if (!walled(sa, sideAt(zones, c + dc, r + dr)!, za, zb)) {
          L.doors.push({ x: c, y: r, dir, kind: 'public' })
        }
      }
    }
  }
  const curb = new Set<string>()
  for (let c = 0; c < cols; c++) {
    const z = zones![0][c]
    if (z === 'checkin' || z === 'arrivals') curb.add(`${c},0`)
  }
  for (const it of hall.items ?? []) {
    if (it.def === 'entrance' && zones![it.r]?.[it.c]) curb.add(`${it.c},${it.r}`)
    const id = ITEM_EQUIP[it.def]
    if (id && zones![it.r]?.[it.c]) p.equipment.push({ id, x: it.c, y: it.r, floor: 0 })
  }
  for (const k of curb) {
    const [x, y] = k.split(',').map(Number)
    L.doors.push({ x, y, dir: 'S', kind: 'curb' })
  }
  return p
}

const ROOM_WORD: Record<string, string> = {
  checkin: 'Check-in',
  security: 'Security',
  gates: 'Gates',
  bagclaim: 'Arrivals',
  restrooms: 'Toilets',
  food: 'Shops / Food',
}

const NEED_WORD: Partial<Record<EquipmentId, string>> = {
  desk: 'check-in desk',
  scanner: 'security lane',
  gate_desk: 'boarding desk',
  seat: 'seat row or bench',
  carousel: 'claim carousel',
  toilet: 'toilet',
  shop_unit: 'food counter',
}

function cellsOfRoom(p: TerminalPlan, room: string): AdviceCell[] {
  const out: AdviceCell[] = []
  p.floors[0].cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.room === room) out.push({ c, r })
    }),
  )
  return out
}

/** Player copy for one advisor hint. The advisor speaks in doors; the hall speaks in paint. */
function toAdvice(h: Hint, p: TerminalPlan): Advice {
  const cells: AdviceCell[] = h.at ? [{ c: h.at.x, r: h.at.y }] : []
  const base = { id: `plan-${h.id}`, severity: h.severity, cells }
  if (h.id === 'no_curb') {
    return {
      ...base,
      title: 'No way in from the curb',
      detail: 'No check-in or arrivals floor touches the front row, and no entrance is placed.',
      fix: 'Paint check-in along the front row, or place entrance doors.',
    }
  }
  if (h.id.startsWith('missing_')) {
    const room = h.id.slice('missing_'.length)
    const word = ROOM_WORD[room] ?? room
    return {
      ...base,
      title: `No ${word} zone`,
      detail: `The hall has no ${word.toLowerCase()} floor yet.`,
      fix: `Paint a ${word} zone.`,
    }
  }
  if (h.id === 'gates_unreachable') {
    return {
      ...base,
      title: 'Gates cannot be reached through security',
      detail: 'No gate cell touches a security cell, so cleared passengers have nowhere to go.',
      fix: 'Paint the gates right up against the security zone.',
      cells: cellsOfRoom(p, 'gates'),
    }
  }
  if (h.id === 'claim_unreachable') {
    return {
      ...base,
      title: 'Arrivals has no way out',
      detail: 'Arrivals does not reach the front row or check-in, so arriving passengers cannot leave.',
      fix: 'Run arrivals to the front row, or beside check-in.',
      cells: cellsOfRoom(p, 'bagclaim'),
    }
  }
  if (h.id.startsWith('dead_')) {
    const room = h.id.slice('dead_'.length)
    const word = ROOM_WORD[room] ?? room
    return {
      ...base,
      title: `${word} is cut off`,
      detail: `Nobody can walk to that ${word.toLowerCase()} floor from the doors.`,
      fix: 'Join it to the hall on its own side of security.',
      cells: cellsOfRoom(p, room),
    }
  }
  if (h.id.startsWith('equip_')) {
    const [, room, ...rest] = h.id.split('_')
    const need = rest.join('_') as EquipmentId
    const word = ROOM_WORD[room] ?? room
    const thing = NEED_WORD[need] ?? need.replace('_', ' ')
    return {
      ...base,
      title: `${word} has no ${thing}`,
      detail: `The ${word.toLowerCase()} zone is painted but nothing serves it.`,
      fix: `Place a ${thing} in it.`,
      cells: cellsOfRoom(p, room).slice(0, 1),
    }
  }
  return { ...base, title: h.text, detail: '', fix: '' }
}

/** Advisor hints for a live hall, in the shared Advice shape. */
export function liveHallAdvice(hall: LiveHall): Advice[] {
  const plan = planFromHall(hall)
  if (!plan) return []
  return adviseTerminal(plan)
    .filter((h) => !SKIP.has(h.id))
    .map((h) => toAdvice(h, plan))
}
