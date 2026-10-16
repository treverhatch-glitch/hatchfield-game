/**
 * S1 starter: one floor, arrivals and departures apart.
 * 88 m × 44 m. North (y = 0) is the apron. South (y = 44) is the curb.
 * No second storey. `stacked2f` is WP6.
 */
import { STARTER_STORIES } from '../floors.ts'
import type { BuildLayout, BuildZone, Door, DoorKind, Edge, Equip, Fitting, FittingSocket, Room } from '../types.ts'

const W = 88
const H = 44

function grid<T>(fill: T): T[][] {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => fill))
}

function paint(zones: (BuildZone | null)[][], x: number, y: number, w: number, h: number, zone: BuildZone) {
  for (let yy = y; yy < y + h && yy < H; yy++) {
    for (let xx = x; xx < x + w && xx < W; xx++) zones[yy][xx] = zone
  }
}

function edgeId(e: Edge): string {
  return `${e.x},${e.y},${e.dir}`
}

/** Closed rectangle, including the map border when the rect sits on it. */
function addRect(walls: Map<string, Edge>, x: number, y: number, w: number, h: number) {
  for (let i = 0; i < w; i++) {
    const north: Edge = y === 0 ? { x: x + i, y: -1, dir: 'S' } : { x: x + i, y: y - 1, dir: 'S' }
    walls.set(edgeId(north), north)
    const south: Edge = { x: x + i, y: y + h - 1, dir: 'S' }
    walls.set(edgeId(south), south)
  }
  for (let j = 0; j < h; j++) {
    const west: Edge = x === 0 ? { x: -1, y: y + j, dir: 'E' } : { x: x - 1, y: y + j, dir: 'E' }
    walls.set(edgeId(west), west)
    const east: Edge = { x: x + w - 1, y: y + j, dir: 'E' }
    walls.set(edgeId(east), east)
  }
}

function openDoor(walls: Map<string, Edge>, doors: Door[], x: number, y: number, dir: 'E' | 'S', kind: DoorKind, n = 1, along: 'x' | 'y' = 'x') {
  for (let i = 0; i < n; i++) {
    const e: Door = along === 'x' ? { x: x + i, y, dir, kind } : { x, y: y + i, dir, kind }
    walls.delete(edgeId(e))
    doors.push(e)
  }
}

function fitting(
  id: string,
  kind: Fitting['kind'],
  x: number,
  y: number,
  extra?: Partial<Pick<Fitting, 'rot' | 'staffed' | 'gateId'>>,
): Fitting {
  return { id, kind, x, y, floor: 0, rot: extra?.rot ?? 0, wear: 0, staffed: extra?.staffed, gateId: extra?.gateId }
}

function socket(id: string, kind: FittingSocket['kind'], x: number, y: number, gateId?: string): FittingSocket {
  return { id, kind, x, y, floor: 0, rot: 0, gateId }
}

/** The 1-story split-flow starter. A new object on every call. */
export function split1f(): BuildLayout {
  const zones = grid<BuildZone | null>('landside')
  paint(zones, 24, 0, 64, 14, 'airside')
  paint(zones, 0, 0, 24, 26, 'claim')
  paint(zones, 0, 26, 24, 12, 'checkin')
  paint(zones, 28, 14, 32, 12, 'security')
  paint(zones, 60, 14, 12, 12, 'office')
  paint(zones, 72, 14, 8, 12, 'office')
  paint(zones, 80, 14, 8, 12, 'airside')
  paint(zones, 28, 0, 22, 14, 'gates')
  paint(zones, 60, 0, 20, 14, 'gates')
  paint(zones, 24, 0, 4, 8, 'retail')
  paint(zones, 80, 0, 8, 10, 'retail')
  paint(zones, 60, 34, 12, 10, 'retail')
  paint(zones, 72, 34, 8, 10, 'retail')

  const rooms: Room[] = [
    { id: 'checkin', kind: 'checkin', x: 0, y: 26, w: 24, h: 12, floor: 0 },
    { id: 'security', kind: 'security', x: 28, y: 14, w: 32, h: 12, floor: 0 },
    { id: 'rd', kind: 'office', x: 60, y: 14, w: 12, h: 12, floor: 0 },
    { id: 'office', kind: 'office', x: 72, y: 14, w: 8, h: 12, floor: 0 },
    { id: 'wc-air', kind: 'toilets', x: 80, y: 14, w: 8, h: 12, floor: 0 },
    { id: 'wc-land', kind: 'toilets', x: 24, y: 14, w: 4, h: 12, floor: 0 },
    { id: 'gate1', kind: 'gate', x: 28, y: 0, w: 22, h: 14, floor: 0 },
    { id: 'gate2', kind: 'gate', x: 60, y: 0, w: 20, h: 14, floor: 0 },
    { id: 'news', kind: 'retail', x: 24, y: 0, w: 4, h: 8, floor: 0 },
    { id: 'food', kind: 'retail', x: 80, y: 0, w: 8, h: 10, floor: 0 },
    { id: 'cafe', kind: 'retail', x: 60, y: 34, w: 12, h: 10, floor: 0 },
    { id: 'shop', kind: 'retail', x: 72, y: 34, w: 8, h: 10, floor: 0 },
  ]

  const walls = new Map<string, Edge>()
  addRect(walls, 0, 0, W, H)
  addRect(walls, 0, 0, 24, 26)
  addRect(walls, 28, 14, 32, 12)
  addRect(walls, 60, 14, 12, 12)
  addRect(walls, 72, 14, 8, 12)
  addRect(walls, 80, 14, 8, 12)
  addRect(walls, 24, 14, 4, 12)
  addRect(walls, 60, 34, 12, 10)
  addRect(walls, 72, 34, 8, 10)
  addRect(walls, 24, 0, 4, 8)
  addRect(walls, 80, 0, 8, 10)

  const doors: Door[] = []
  openDoor(walls, doors, 8, -1, 'S', 'arrivals_in', 4)
  openDoor(walls, doors, 30, -1, 'S', 'gate_apron', 4)
  openDoor(walls, doors, 72, -1, 'S', 'gate_apron', 4)
  openDoor(walls, doors, 8, H - 1, 'S', 'curb', 6)
  openDoor(walls, doors, 22, H - 1, 'S', 'curb', 6)
  openDoor(walls, doors, 20, 25, 'S', 'exit', 4)
  openDoor(walls, doors, 28, 13, 'S', 'public', 8)
  openDoor(walls, doors, 28, 25, 'S', 'public', 32)
  openDoor(walls, doors, 64, 25, 'S', 'staff', 2)
  openDoor(walls, doors, 74, 25, 'S', 'staff', 2)
  openDoor(walls, doors, 82, 13, 'S', 'public', 2)
  openDoor(walls, doors, 25, 25, 'S', 'public', 2)
  openDoor(walls, doors, 59, 38, 'E', 'public', 2, 'y')
  openDoor(walls, doors, 71, 38, 'E', 'public', 2, 'y')
  openDoor(walls, doors, 25, 7, 'S', 'public', 2)
  openDoor(walls, doors, 79, 4, 'E', 'public', 2, 'y')

  const fittings: Fitting[] = [
    fitting('s1-desk-0', 'checkin_desk', 0, 27, { staffed: true }),
    fitting('s1-desk-1', 'checkin_desk', 2, 27, { staffed: false }),
    fitting('s1-bag', 'bag_drop', 5, 27),
    fitting('s1-kiosk', 'checkin_kiosk', 12, 36),
    fitting('s1-lane-0', 'security_lane', 28, 14, { staffed: true }),
    fitting('s1-lane-1', 'security_lane', 32, 14, { staffed: true }),
    fitting('s1-bp-0', 'bp_podium', 29, 24),
    fitting('s1-bp-1', 'bp_podium', 33, 24),
    fitting('s1-carousel', 'claim_carousel', 2, 12),
    fitting('s1-gate-1', 'gate_desk', 32, 2, { gateId: 'gate1' }),
    fitting('s1-gate-2', 'gate_desk', 74, 2, { gateId: 'gate2' }),
    fitting('s1-cafe', 'shop_counter', 62, 36),
    fitting('s1-shop', 'shop_counter', 73, 36),
    fitting('s1-news', 'shop_counter', 24, 2),
    fitting('s1-food', 'shop_counter', 82, 2),
    fitting('s1-wc-land', 'wc_block', 25, 18),
    fitting('s1-wc-air', 'wc_block', 82, 18),
    fitting('s1-fids', 'fids', 40, 40),
    fitting('s1-way', 'wayfinding', 50, 40),
    fitting('s1-bench', 'bench', 44, 41),
  ]
  for (let i = 0; i < 6; i++) fittings.push(fitting(`s1-rail-${i}`, 'queue_rail', i, 31))
  for (let i = 0; i < 12; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    fittings.push(fitting(`s1-seat-g1-${i}`, 'seat_row', 34 + col * 3, 6 + row * 2, { gateId: 'gate1' }))
    fittings.push(fitting(`s1-seat-g2-${i}`, 'seat_row', 64 + col * 3, 6 + row * 2, { gateId: 'gate2' }))
  }

  const equipment: Equip[] = [
    { id: 's1-desk-0', kind: 'checkin_desk', x: 0, y: 29, wear: 0 },
    { id: 's1-desk-1', kind: 'checkin_desk', x: 3, y: 29, wear: 0 },
    { id: 's1-kiosk', kind: 'checkin_desk', x: 12, y: 37, wear: 0 },
    { id: 's1-lane-0', kind: 'security_lane', x: 30, y: 23, wear: 0 },
    { id: 's1-lane-1', kind: 'security_lane', x: 34, y: 23, wear: 0 },
    { id: 's1-gate-1', kind: 'gate_desk', x: 33, y: 4, wear: 0 },
    { id: 's1-gate-2', kind: 'gate_desk', x: 75, y: 4, wear: 0 },
  ]

  const sockets: FittingSocket[] = [
    socket('s1-socket-lane-2', 'security_lane', 36, 14),
    socket('s1-socket-lane-3', 'security_lane', 40, 14),
    socket('s1-socket-lane-4', 'security_lane', 44, 14),
    socket('s1-socket-lane-5', 'security_lane', 48, 14),
    socket('s1-socket-lane-6', 'security_lane', 52, 14),
    socket('s1-socket-lane-7', 'security_lane', 56, 14),
    socket('s1-socket-desk-2', 'checkin_desk', 8, 27),
    socket('s1-socket-desk-3', 'checkin_desk', 10, 27),
    socket('s1-socket-desk-4', 'checkin_desk', 12, 27),
    socket('s1-socket-desk-5', 'checkin_desk', 14, 27),
    socket('s1-socket-desk-6', 'checkin_desk', 16, 27),
    socket('s1-socket-pass-0', 'passport_booth', 2, 8),
    socket('s1-socket-pass-1', 'passport_booth', 6, 8),
    socket('s1-socket-pass-2', 'passport_booth', 10, 8),
    socket('s1-socket-pass-3', 'passport_booth', 14, 8),
    socket('s1-socket-carousel-2', 'claim_carousel', 2, 18),
    socket('s1-socket-kiosk-2', 'checkin_kiosk', 14, 36),
  ]

  const outBelt = Array.from({ length: 8 }, (_, x) => ({ x, y: 26 }))
  const inBelt = [
    { x: 0, y: 14 },
    { x: 1, y: 14 },
  ]

  return {
    version: 2,
    tileM: 1,
    w: W,
    h: H,
    stories: STARTER_STORIES,
    floor: grid(true),
    zones,
    walls: [...walls.values()],
    doors,
    rooms,
    equipment,
    verticals: [],
    slabs: [],
    fittings,
    belts: [
      { id: 's1-belt-out', floor: 0, tiles: outBelt, dir: 'out' },
      { id: 's1-belt-in', floor: 0, tiles: inBelt, dir: 'in' },
    ],
    ports: [
      { id: 'bag-out', kind: 'bag_out', edge: { x: -1, y: 26, dir: 'E' }, socket: 'terminal:starter:bag_out:bag-out' },
      { id: 'bag-in', kind: 'bag_in', edge: { x: -1, y: 14, dir: 'E' }, socket: 'terminal:starter:bag_in:bag-in' },
    ],
    sockets,
    unplaced: [],
  }
}
