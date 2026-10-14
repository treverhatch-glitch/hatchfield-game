/**
 * Service points and queue lines read off a built layout.
 *
 * A desk, counter, toilet or boarding desk serves from the floor cell beside
 * it; a security lane serves inside its own tile and lets people out the far
 * side. Each one gets a marked queue line that runs from the service cell
 * back toward where people come from, turning when it meets a wall or kit.
 */
import { EQUIP_SPEC } from '../terminalbuild/config.ts'
import { edgeBetween, edgeKey, outsideDoors, tileKey } from '../terminalbuild/grid.ts'
import type { Equip, EquipKind, Room, Tile } from '../terminalbuild/types.ts'
import { PAXNAV_TUNING } from './config.ts'
import { computeField, type Field } from './field.ts'
import { AIR, LANE, PRE, cellsOfTile, moveOpen, tileOfCell, type NavGrid } from './grid.ts'

export interface Facility {
  /** Equipment id. */
  id: string
  kind: EquipKind
  roomId: string | null
  /** PRE for check-in and security, AIR for everything after security. */
  layer: number
  /** Cell the passenger being served stands on. */
  service: number
  /** Queue line, service cell first. */
  line: number[]
  /** Cell -> index on `line`. */
  lineIdx: Map<number, number>
  /** Lane equipment index for security lanes, else -1. */
  lane: number
  /** Seconds per passenger, slowed by wear. */
  serviceSec: number
  /**
   * A clerk or officer is at this point. Closed points keep a queue but
   * do not serve. Defaults open; the hall sets it from staffing.
   */
  staffed: boolean
}

const QUEUED_KIT: readonly EquipKind[] = ['checkin_desk', 'security_lane', 'gate_desk', 'toilet', 'shop_counter']

export function serviceSecOf(eq: Equip): number {
  const base = EQUIP_SPEC[eq.kind].serviceSec
  return base * (1 + (PAXNAV_TUNING.wornSlowdown - 1) * Math.min(1, Math.max(0, eq.wear) / 100))
}

const N4 = (g: NavGrid) => [1, -1, g.gw, -g.gw]

/** Shared cost every field pays: other people's lanes are not corridors. */
export function lanePenalty(g: NavGrid): Float32Array {
  const p = new Float32Array(g.gw * g.gh)
  for (let c = 0; c < p.length; c++) if (g.mask[c] & LANE) p[c] = PAXNAV_TUNING.laneCorridorCost
  return p
}

function roomOf(g: NavGrid, t: Tile): Room | undefined {
  return g.ix.roomAt.get(tileKey(t.x, t.y))
}

/**
 * Service cell for kit that is not walk-through: the middle of the edge it
 * shares with a floor tile on the right side of security. Same-room sides
 * win, then the side closest to where people come from.
 */
function deskServiceCell(g: NavGrid, eq: Equip, layer: number, upstream: Field): number {
  const k = g.k
  const lo = Math.floor((k - PAXNAV_TUNING.doorCells) / 2)
  const room = roomOf(g, eq)
  let best = -1
  let bestScore = Infinity
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const t = { x: eq.x + dx, y: eq.y + dy }
    const key = edgeKey(edgeBetween(eq, t))
    if (g.ix.walls.has(key) || g.ix.doors.has(key)) continue
    const ox = (t.x + g.margin) * k
    const oy = (t.y + g.margin) * k
    // Cell on t's side of the shared edge, in the middle of it.
    const cx = dx === 1 ? ox : dx === -1 ? ox + k - 1 : ox + lo
    const cy = dy === 1 ? oy : dy === -1 ? oy + k - 1 : oy + lo
    if (cx < 0 || cy < 0 || cx >= g.gw || cy >= g.gh) continue
    const c = cy * g.gw + cx
    if (!(g.mask[c] & layer) || g.mask[c] & LANE) continue
    const sameRoom = room && roomOf(g, t)?.id === room.id ? 0 : 1e6
    const up = Number.isFinite(upstream.dist[c]) ? upstream.dist[c] : 1e5
    const score = sameRoom + up
    if (score < bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

/** Service cell for a lane: the middle of its tile. */
function laneServiceCell(g: NavGrid, eq: Equip): number {
  const cells = cellsOfTile(g, eq)
  const mid = Math.floor(g.k / 2)
  return cells[mid * g.k + mid - 1] ?? -1
}

/**
 * Walk back from the service cell, one cell farther each step, keeping
 * straight while it can and otherwise turning toward where people come from.
 */
function buildLine(g: NavGrid, f: Facility, own: Field, upstream: Field, taken: Uint8Array): number[] {
  const line = [f.service]
  const steps = N4(g)
  let dir = 0
  let cur = f.service
  for (let i = 1; i < PAXNAV_TUNING.maxLineCells; i++) {
    let pick = -1
    let pickScore = Infinity
    for (const s of steps) {
      const n = cur + s
      if (n < 0 || n >= own.dist.length) continue
      if (Math.abs(s) === 1 && Math.floor(n / g.gw) !== Math.floor(cur / g.gw)) continue
      if (taken[n] || !(g.mask[n] & f.layer)) continue
      // Stay off other lanes; our own lane tile is fine.
      if (g.mask[n] & LANE && g.laneOf[n] !== f.lane) continue
      if (Math.abs(own.dist[n] - own.dist[cur] - 1) > 1e-3) continue
      if (!moveOpen(g, n, cur, f.layer)) continue
      const up = Number.isFinite(upstream.dist[n]) ? upstream.dist[n] : 1e5
      const score = (s === dir ? 0 : 1e6) + up
      if (score < pickScore) {
        pickScore = score
        pick = n
      }
    }
    if (pick < 0) break
    dir = pick - cur
    line.push(pick)
    taken[pick] = 1
    cur = pick
  }
  return line
}

export interface FacilitySet {
  list: Facility[]
  byId: Map<string, Facility>
  /** Every field's base step-in cost: lanes and other people's queue lines. */
  basePenalty: Float32Array
}

export function buildFacilities(g: NavGrid): FacilitySet {
  const lanePen = lanePenalty(g)
  const upPre = computeField(g, g.spawns, PRE, lanePen)
  const laneCells: number[] = []
  for (let c = 0; c < g.mask.length; c++) if (g.mask[c] & LANE) laneCells.push(c)
  const upAir = computeField(g, laneCells, AIR, null)
  const lanes = g.layout.equipment.filter((e) => e.kind === 'security_lane')
  const taken = new Uint8Array(g.gw * g.gh)
  const list: Facility[] = []

  // Service cells first so no line runs through somebody's desk spot.
  const pending: { eq: Equip; layer: number; service: number; up: Field }[] = []
  for (const eq of g.layout.equipment) {
    if (!QUEUED_KIT.includes(eq.kind)) continue
    const layer = eq.kind === 'checkin_desk' || eq.kind === 'security_lane' ? PRE : AIR
    const up = layer === PRE ? upPre : upAir
    const service = eq.kind === 'security_lane' ? laneServiceCell(g, eq) : deskServiceCell(g, eq, layer, up)
    if (service < 0 || !(g.mask[service] & layer) || taken[service]) continue
    taken[service] = 1
    pending.push({ eq, layer, service, up })
  }
  for (const { eq, layer, service, up } of pending) {
    const lane = eq.kind === 'security_lane' ? lanes.indexOf(eq) : -1
    const f: Facility = {
      id: eq.id,
      kind: eq.kind,
      roomId: roomOf(g, eq)?.id ?? null,
      layer,
      service,
      line: [],
      lineIdx: new Map(),
      lane,
      serviceSec: serviceSecOf(eq),
      staffed: true,
    }
    const pen = lanePen.slice()
    if (lane >= 0) for (const c of cellsOfTile(g, eq)) pen[c] = 0
    const own = computeField(g, [service], layer, pen)
    f.line = buildLine(g, f, own, up, taken)
    f.line.forEach((c, i) => f.lineIdx.set(c, i))
    list.push(f)
  }

  const basePenalty = lanePen
  for (const f of list) for (const c of f.line) basePenalty[c] += PAXNAV_TUNING.foreignLineCost
  return { list, byId: new Map(list.map((f) => [f.id, f])), basePenalty }
}

/**
 * Step-in cost for a facility's own field: its line is free, its lane is
 * open, and the cells along the line (the rope) cost extra so people walk
 * in at the tail rather than cutting in from the side.
 */
export function facilityPenalty(g: NavGrid, set: FacilitySet, f: Facility): Float32Array {
  const pen = set.basePenalty.slice()
  for (const c of f.line) pen[c] = 0
  if (f.lane >= 0) for (let c = 0; c < pen.length; c++) if (g.laneOf[c] === f.lane) pen[c] = 0
  const tail = f.line[f.line.length - 1]
  const near = (a: number, b: number) =>
    Math.abs((a % g.gw) - (b % g.gw)) <= 1 && Math.abs(Math.floor(a / g.gw) - Math.floor(b / g.gw)) <= 1
  for (const c of f.line) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = c + dy * g.gw + dx
        if (n < 0 || n >= pen.length || Math.abs((n % g.gw) - (c % g.gw)) > 1) continue
        if (f.lineIdx.has(n) || near(n, tail)) continue
        if (f.lane >= 0 && g.laneOf[n] === f.lane) continue
        pen[n] += PAXNAV_TUNING.ropeCost
      }
    }
  }
  return pen
}

/** Where people wait for boarding: floor beside the gate's seat rows, else the gate room floor. */
export function seatCells(g: NavGrid, set: FacilitySet, roomId: string): number[] {
  const room = g.layout.rooms.find((r) => r.id === roomId)
  if (!room) return []
  const busy = new Set<number>()
  for (const f of set.list) for (const c of f.line) busy.add(c)
  const inRoom: number[] = []
  const bySeat: number[] = []
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      for (const c of cellsOfTile(g, { x, y })) {
        if (!(g.mask[c] & AIR) || g.mask[c] & LANE || busy.has(c)) continue
        inRoom.push(c)
        for (const s of N4(g)) {
          const n = c + s
          if (n < 0 || n >= g.mask.length) continue
          const t = tileOfCell(g, n)
          const eq = g.ix.equipAt.get(tileKey(t.x, t.y))
          if (eq?.kind !== 'seat') continue
          const here = tileOfCell(g, c)
          if (g.ix.walls.has(edgeKey(edgeBetween(here, t)))) continue
          bySeat.push(c)
          break
        }
      }
    }
  }
  return bySeat.length ? bySeat : inRoom
}

/** Inside face of the apron doors of a gate room (the jet bridge), else of any apron door. */
export function apronCells(g: NavGrid, roomId: string): number[] {
  const doors = outsideDoors(g.layout, ['apron'])
  const pick = (only: boolean) => {
    const out: number[] = []
    for (const { door, tile } of doors) {
      if (only && roomOf(g, tile)?.id !== roomId) continue
      const lo = Math.floor((g.k - PAXNAV_TUNING.doorCells) / 2)
      const ox = (tile.x + g.margin) * g.k
      const oy = (tile.y + g.margin) * g.k
      // Which side of the tile the door edge is on.
      const east = door.dir === 'E' && door.x === tile.x
      const west = door.dir === 'E' && door.x !== tile.x
      const south = door.dir === 'S' && door.y === tile.y
      for (let i = lo; i < lo + PAXNAV_TUNING.doorCells; i++) {
        const cx = east ? ox + g.k - 1 : west ? ox : ox + i
        const cy = south ? oy + g.k - 1 : door.dir === 'S' ? oy : oy + i
        const c = cy * g.gw + cx
        if (g.mask[c] & AIR) out.push(c)
      }
    }
    return out
  }
  const own = pick(true)
  return own.length ? own : pick(false)
}
