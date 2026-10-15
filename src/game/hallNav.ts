/**
 * Glue between the sim and the terminal walker (src/paxnav): one PaxNav for
 * the active hall, fed by the sim's departing show-up guests and drawn by the
 * Terminal view.
 *
 * The layout is the hall's own build (`fit.build`) when it has one. Prefab
 * and zone-painted halls are read as a build layout on 4 m tiles: painted
 * zones, the placed kit as desks / lanes / toilets / counters / boarding
 * desks, curb doors at the entrance kit, apron doors along the gates, and
 * walls everywhere else on the outside. Nothing here costs or refunds cash;
 * it is a read of what the player already built.
 *
 * The walk is the hall's picture and queue read-out. Fares, ratings and
 * boarding still come from the sim's own hall model.
 */
import { BUILD_TUNING, ZONE_SIDE } from '../terminalbuild/config.ts'
import type { BuildLayout, BuildZone, Door, Edge, Equip, EquipKind, Room, Tile } from '../terminalbuild/types.ts'
import {
  CrewNav,
  PaxNav,
  PAXNAV_TUNING,
  feedbackReputation,
  hashId as navHash,
  type CrewRole,
  type FacilityMetrics,
  type GuestCard,
  type GuestFeedback,
  type GuestPurpose,
  type PaxEvent,
  type PaxWait,
  type Signage,
  serviceSecOf,
} from '../paxnav/index.ts'
import type { HallQueue } from '../terminalplay/queues.ts'
import type { HallNode } from './guests.ts'
import { facilityBlockers } from '../terminalplay/facilities.ts'
import { HALL_D, HALL_W, itemDef, type PlacedItem, type ZoneId } from './terminal.ts'
import { SERVICE_POINT_TUNING, openPointIds, type HiredPosts, type StaffPoint } from '../servicepoints/index.ts'
import { HALL_CREW_TUNING, HALL_NAV_TUNING, HALL_QUEUE_TUNING, PREFAB_CLAIM_KIT, PREFAB_ROOM_KIT } from './hallNavData.ts'
import { HallArrivals, type ClaimHall } from './hallArrivals.ts'

type Zones = readonly (readonly (ZoneId | null)[])[]

/** What the sim needs to say about one hall guest. */
export interface NavGuest {
  id: string
  job: 'depart' | 'arrive'
  dead: boolean
  flightId: string
  hallId?: string
  releaseAt?: number
  /** Day-one walker: walks again from the curb once boarded, until real passengers replace it. */
  preview?: boolean
  /** Arrival connecting to another flight: stays airside, so it keeps the old hall figure. */
  transfer?: boolean
  /** Fare persona (business / premium / family / budget): seeds the walker's purpose and family groups. */
  tag?: string
  /**
   * When set, this walker does or does not stop at check-in. Unset keeps the
   * walk's own roll. A carry-on bank can be sent straight at security.
   */
  bags?: boolean
  /** Airline this departure is checking in with. */
  airlineId?: string
}

/** Sim fare persona -> walker purpose. Family fares are leisure or family trips, so they roll. */
const TAG_PURPOSE: Record<string, GuestPurpose | undefined> = {
  business: 'business',
  premium: 'business',
  budget: 'budget',
}

/**
 * Wayfinding a hall offers its walkers: placed sign items, info screens and
 * kiosks as departure boards, and the prefab scheme's own signs everywhere.
 */
export function hallSignage(fit: { build?: BuildLayout; zones?: (string | null)[][]; items?: readonly unknown[]; signs?: number }): Signage {
  const items = (fit.items ?? []) as PlacedItem[]
  const zones = fit.zones ?? []
  const cols = zones[0]?.length ?? 0
  const rows = zones.length
  const signs: Signage['signs'] = []
  const boards: Signage['boards'] = []
  let placed = 0
  if (!fit.build && cols && rows) {
    const cw = HALL_W / cols
    const rh = HALL_D / rows
    for (const it of items) {
      const def = itemDef(it.def)
      const spot = { x: (it.c + 0.5) * cw, z: (it.r + 0.5) * rh }
      if (def?.signs) {
        signs.push(spot)
        placed += def.signs
      } else if (HALL_NAV_TUNING.boardItems.includes(it.def)) boards.push(spot)
    }
  }
  return { signs, boards, schemeSigns: Math.max(0, (fit.signs ?? 0) - placed) }
}

const PREFAB_ZONE: Record<ZoneId, BuildZone | null> = {
  checkin: 'checkin',
  security: 'security',
  gates: 'gates',
  // Claim hall: bag side, never on a departure's walk.
  arrivals: 'baggage',
  retail: 'retail',
  // Toilets take the side of the floor around them (see toiletSide).
  toilets: null,
}

function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Toilet cells open onto the gates side if any neighbour is a gate, else the check-in side. */
function toiletSide(zones: Zones, c: number, r: number): BuildZone {
  for (const [dc, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    if (zones[r + dr]?.[c + dc] === 'gates') return 'airside'
  }
  return 'landside'
}

/**
 * A prefab or zone-painted hall as a build layout. The 48 m x 32 m hall is
 * 12 x 8 tiles; each hall cell covers the tiles whose centres fall in it.
 */
export function prefabNavLayout(zones: Zones, items: readonly PlacedItem[], tileM = BUILD_TUNING.tileMetres): BuildLayout {
  const rows = zones.length
  const cols = zones[0]?.length ?? 0
  const w = Math.round(HALL_W / tileM)
  const h = Math.round(HALL_D / tileM)
  const cw = HALL_W / Math.max(1, cols)
  const rh = HALL_D / Math.max(1, rows)
  const cellOf = (x: number, y: number) => ({
    c: Math.min(cols - 1, Math.floor(((x + 0.5) * tileM) / cw)),
    r: Math.min(rows - 1, Math.floor(((y + 0.5) * tileM) / rh)),
  })
  // Placed walls and belts fill their hall cell: no floor there, nothing stands on it.
  const blocked = facilityBlockers(items)
  const tilesOf = new Map<string, Tile[]>()
  const zoneGrid: (BuildZone | null)[][] = []
  const floor: boolean[][] = []
  for (let y = 0; y < h; y++) {
    const row: (BuildZone | null)[] = []
    const floorRow: boolean[] = []
    for (let x = 0; x < w; x++) {
      const { c, r } = cellOf(x, y)
      const k = `${c},${r}`
      if (!tilesOf.has(k)) tilesOf.set(k, [])
      tilesOf.get(k)!.push({ x, y })
      const z = blocked.has(k) ? null : (zones[r]?.[c] ?? null)
      row.push(z === 'toilets' ? toiletSide(zones, c, r) : z ? PREFAB_ZONE[z] : null)
      floorRow.push(!blocked.has(k))
    }
    zoneGrid.push(row)
    floor.push(floorRow)
  }
  const zoneAt = (t: Tile) => zoneGrid[t.y]?.[t.x] ?? null
  const landside = (t: Tile) => zoneAt(t) === 'checkin' || zoneAt(t) === 'landside'

  const equipment: Equip[] = []
  const rooms: Room[] = []
  const used = new Set<string>()
  const put = (id: string, kind: Equip['kind'], t: Tile, wear: number) => {
    used.add(`${t.x},${t.y}`)
    equipment.push({ id, kind, x: t.x, y: t.y, wear })
  }

  // Security lanes: one per server, on security tiles that face the check-in side.
  const laneSpots: Tile[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = { x, y }
      if (zoneAt(t) !== 'security') continue
      if ([{ x, y: y - 1 }, { x, y: y + 1 }, { x: x - 1, y }, { x: x + 1, y }].some(landside)) laneSpots.push(t)
    }
  }
  let lanes = 0
  let laneWear = 0
  for (const it of items) {
    const def = itemDef(it.def)
    if (def?.room !== 'security') continue
    lanes += Math.max(1, def.servers)
    laneWear = Math.max(laneWear, it.wear)
  }
  lanes = Math.min(lanes, laneSpots.length)
  for (let i = 0; i < lanes; i++) {
    const t = laneSpots[Math.floor(((i + 0.5) * laneSpots.length) / lanes)]
    put(`lane-${i}`, 'security_lane', t, laneWear)
  }

  // Desks, toilets, counters and boarding desks sit on their item's own tiles,
  // leaving at least one tile of the cell to stand on.
  for (const it of items) {
    const def = itemDef(it.def)
    if (!def) continue
    const kind = (def.seats ?? 0) > 0 ? 'seat' : def.room ? PREFAB_ROOM_KIT[def.room] : undefined
    if (!kind || kind === 'security_lane') continue
    const tiles = (tilesOf.get(`${it.c},${it.r}`) ?? []).filter((t) => {
      const z = zoneAt(t)
      return z && z !== 'baggage' && !used.has(`${t.x},${t.y}`)
    })
    if (!tiles.length) continue
    const fit = tiles.length === 1 ? 1 : tiles.length - 1
    const n = kind === 'seat' ? 1 : Math.min(fit, Math.max(1, def.servers))
    for (let i = 0; i < n; i++) put(`${it.id}-${i}`, kind, tiles[i], it.wear)
    if (kind === 'gate_desk') {
      // Gate room: the desk's cell plus a tile of floor round it, on the gates side.
      const xs = tiles.map((t) => t.x)
      const ys = tiles.map((t) => t.y)
      const x0 = Math.max(0, Math.min(...xs) - 1)
      const y0 = Math.max(0, Math.min(...ys) - 1)
      const x1 = Math.min(w - 1, Math.max(...xs) + 1)
      const y1 = Math.min(h - 1, Math.max(...ys) + 1)
      rooms.push({ id: `gate-${it.c}-${it.r}`, kind: 'gate', x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })
    }
  }

  // Outside edges: curb doors at the entrance kit (else along all check-in
  // floor), a jet bridge door on each gate room's outside wall (else along
  // all gates floor), walls on the rest.
  const key = (t: Tile) => `${t.x},${t.y}`
  const entrance = new Set<string>()
  for (const it of items) {
    if (it.def !== 'entrance') continue
    for (const t of tilesOf.get(`${it.c},${it.r}`) ?? []) entrance.add(key(t))
  }
  const outerOf = (t: Tile): Edge[] => {
    const out: Edge[] = []
    if (t.x === w - 1) out.push({ x: t.x, y: t.y, dir: 'E' })
    if (t.x === 0) out.push({ x: -1, y: t.y, dir: 'E' })
    if (t.y === h - 1) out.push({ x: t.x, y: t.y, dir: 'S' })
    if (t.y === 0) out.push({ x: t.x, y: -1, dir: 'S' })
    return out
  }
  const free = (t: Tile) => !used.has(key(t))
  const bridge = new Set<string>()
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        const t = { x, y }
        if (zoneAt(t) === 'gates' && free(t) && outerOf(t).length) bridge.add(key(t))
      }
    }
  }
  const doors: Door[] = []
  const walls: Edge[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = { x, y }
      const curb = free(t) && landside(t) && (entrance.size ? entrance.has(key(t)) : true)
      const apron = free(t) && zoneAt(t) === 'gates' && (bridge.size ? bridge.has(key(t)) : true)
      for (const e of outerOf(t)) {
        if (curb) doors.push({ ...e, kind: 'curb' })
        else if (apron) doors.push({ ...e, kind: 'apron' })
        else walls.push(e)
      }
    }
  }

  // Inside walls, as the hall draws them: security is walled off from the
  // check-in side except where a lane opens onto it, and the two sides of
  // security never share an open edge.
  const lane = new Set(equipment.filter((e) => e.kind === 'security_lane').map(key))
  const side = (t: Tile) => {
    const z = zoneAt(t)
    return z ? ZONE_SIDE[z] : null
  }
  const parts = (a: Tile, b: Tile) => {
    const sa = side(a)
    const sb = side(b)
    if (!sa || !sb || sa === sb || sa === 'staff' || sb === 'staff') return false
    if (sa === 'security' || sb === 'security') {
      const [sec, other] = sa === 'security' ? [a, sb] : [b, sa]
      return other === 'landside' && !lane.has(key(sec))
    }
    return (sa === 'landside' && sb === 'airside') || (sa === 'airside' && sb === 'landside')
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x + 1 < w && parts({ x, y }, { x: x + 1, y })) walls.push({ x, y, dir: 'E' })
      if (y + 1 < h && parts({ x, y }, { x, y: y + 1 })) walls.push({ x, y, dir: 'S' })
    }
  }

  return {
    w,
    h,
    floor,
    zones: zoneGrid,
    walls,
    doors,
    rooms,
    equipment,
  }
}

/**
 * A prefab hall's claim hall (its painted arrivals zone) on the same 4 m
 * tiles as `prefabNavLayout`: the floor arrivals cross to the curb side, the
 * solid belt kit on it, and the belts they wait beside. Null when the hall
 * has no arrivals paint.
 */
export function prefabClaimHall(zones: Zones, items: readonly PlacedItem[], tileM = BUILD_TUNING.tileMetres): ClaimHall | null {
  const rows = zones.length
  const cols = zones[0]?.length ?? 0
  const w = Math.round(HALL_W / tileM)
  const h = Math.round(HALL_D / tileM)
  const cw = HALL_W / Math.max(1, cols)
  const rh = HALL_D / Math.max(1, rows)
  const tiles: Tile[] = []
  const solid: Tile[] = []
  const belts: Tile[] = []
  const solidAt = new Map<string, string>()
  for (const it of items) if (PREFAB_CLAIM_KIT.solid.includes(it.def)) solidAt.set(`${it.c},${it.r}`, it.def)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = Math.min(cols - 1, Math.floor(((x + 0.5) * tileM) / cw))
      const r = Math.min(rows - 1, Math.floor(((y + 0.5) * tileM) / rh))
      if (zones[r]?.[c] !== 'arrivals') continue
      const t = { x, y }
      const kit = solidAt.get(`${c},${r}`)
      if (!kit) tiles.push(t)
      else {
        solid.push(t)
        if (PREFAB_CLAIM_KIT.belts.includes(kit)) belts.push(t)
      }
    }
  }
  if (!tiles.length) return null
  return { tiles: [...tiles, ...solid], solid, belts }
}

/** The layout a hall's walkers use: its own build, else a read of its prefab zones and kit. */
export function hallNavLayout(fit: {
  build?: BuildLayout
  zones?: (string | null)[][]
  items?: readonly unknown[]
}): BuildLayout | null {
  if (fit.build) return fit.build
  if (!fit.zones?.length) return null
  return prefabNavLayout(fit.zones as Zones, (fit.items ?? []) as PlacedItem[])
}

/** A hall's claim hall for arrivals. Built halls have none (their bag hall is staff only): arrivals use the exit doors. */
export function hallClaimHall(fit: { build?: BuildLayout; zones?: (string | null)[][]; items?: readonly unknown[] }): ClaimHall | null {
  if (fit.build || !fit.zones?.length) return null
  return prefabClaimHall(fit.zones as Zones, (fit.items ?? []) as PlacedItem[])
}

/** Hall node each kind of queued kit reports under (badges, info panel). */
const NODE_OF: Partial<Record<EquipKind, { node: HallNode; label: string }>> = {
  checkin_desk: { node: 'checkin', label: 'Check-in' },
  security_lane: { node: 'security', label: 'Security' },
  toilet: { node: 'bathroom', label: 'Restrooms' },
  shop_counter: { node: 'shop', label: 'Shops & food' },
  gate_desk: { node: 'gate', label: 'Gate' },
}

/** Marked line length, metres. */
function lineLength(line: readonly { x: number; z: number }[]): number {
  let d = 0
  for (let i = 1; i < line.length; i++) d += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z)
  return d
}

/** Too slow for what the player built: a long wait for the next in line, or the line spilling past its floor marks. */
export function isNavBottleneck(m: FacilityMetrics): boolean {
  const limit = HALL_QUEUE_TUNING.bottleneckSec[m.kind]
  if (limit == null) return false
  if (m.estWaitSec >= limit) return true
  return m.queueLength * PAXNAV_TUNING.queueSpacingM > lineLength(m.line) + PAXNAV_TUNING.queueSpacingM
}

/** Happiness change for one finished wait: a little for a quick one, a hit past tolerance. */
export function waitMoodDelta(kind: EquipKind, waitSec: number): number {
  const T = HALL_QUEUE_TUNING
  const tol = T.toleranceSec[kind]
  if (tol == null || !(waitSec >= 0)) return 0
  if (waitSec < tol * 0.25) return T.quickMood
  if (waitSec <= tol) return 0
  return -Math.min(T.maxMoodHit, ((waitSec - tol) / 60) * T.moodPerMinOver)
}

/** One facility's live read, for overlays and the info panel. */
export interface NavFacilityLoad {
  id: string
  kind: EquipKind
  node: HallNode | null
  queueLength: number
  estWaitSec: number
  avgWaitSec: number
  bottleneck: boolean
}

/** A hall node's live queue: `HallQueue` plus the worst wait and where to pin its badge (hall metres). */
export interface NavHallQueue extends HallQueue {
  waitSec: number
  at: { x: number; z: number }
}

/**
 * Group per-facility metrics by hall node. Count is everyone standing in
 * line; wait is the worst at that node; the badge sits at the back of the
 * longest line. `ox` / `oz` move terminal metres to hall metres.
 */
export function navHallQueues(metrics: readonly FacilityMetrics[], ox = 0, oz = 0): NavHallQueue[] {
  const rows = new Map<HallNode, { row: NavHallQueue; longest: number }>()
  for (const m of metrics) {
    const mark = NODE_OF[m.kind]
    if (!mark || m.queueLength <= 0 || !m.line.length) continue
    let entry = rows.get(mark.node)
    if (!entry) {
      entry = { row: { node: mark.node, label: mark.label, count: 0, bottleneck: false, waitSec: 0, at: { x: 0, z: 0 } }, longest: -1 }
      rows.set(mark.node, entry)
    }
    const row = entry.row
    row.count += m.queueLength
    row.waitSec = Math.max(row.waitSec, m.estWaitSec)
    row.bottleneck ||= isNavBottleneck(m)
    if (m.queueLength > entry.longest) {
      entry.longest = m.queueLength
      // Back of the line, as far as the floor marks go.
      const back = m.line[Math.min(m.line.length - 1, Math.round(m.queueLength * PAXNAV_TUNING.queueSpacingM))]
      row.at = { x: back.x + ox, z: back.z + oz }
    }
  }
  return [...rows.values()].map((e) => e.row)
}

/** Bundle security items: one included lane per server. Player-added lanes are not included. */
export function includedSecurityLanes(items: readonly { def: string; bundle?: boolean }[]): number {
  let n = 0
  for (const it of items) {
    if (!it.bundle) continue
    const def = itemDef(it.def)
    if (def?.room !== 'security' || def.servers <= 0) continue
    n += def.servers
  }
  return n
}

/** A placed piece the walk can match to a desk. Flags come from the item, not its id. */
export interface StaffItemRef {
  id: string
  def: string
  bundle?: boolean
}

/**
 * The placed piece that spawned this desk. Layout desks are `${item.id}-${n}`.
 * The longest matching item id wins, so one piece cannot claim another's desk.
 */
function itemForDesk(facilityId: string, items: readonly StaffItemRef[]): StaffItemRef | undefined {
  let best: StaffItemRef | undefined
  for (const it of items) {
    if (!it.id) continue
    if (facilityId !== it.id && !facilityId.startsWith(`${it.id}-`)) continue
    if (!best || it.id.length > best.id.length) best = it
  }
  return best
}

/**
 * A piece with servers and a staff of 0 runs itself: a self-service kiosk
 * or a bag drop. Staff and room live on the item def, not the id.
 */
function pointRunsItself(defId: string): boolean {
  const def = itemDef(defId)
  if (!def || def.servers <= 0 || def.staff > 0) return false
  const kind = def.room ? PREFAB_ROOM_KIT[def.room] : undefined
  return kind === 'checkin_desk' || kind === 'security_lane'
}

/** A self-serve check-in kiosk. Bag drops run themselves and keep desk speed. */
function isKioskDef(defId: string): boolean {
  const def = itemDef(defId)
  return Boolean(def && def.room === 'checkin' && def.servers > 0 && def.staff <= 0)
}

/**
 * Check-in desks and security lanes on the walk, in facility order.
 * A bundle piece is part of the building. A def with no staff serves itself.
 * Security inclusion is the bundle lanes' server count, in facility order.
 */
export function staffPoints(
  facilities: readonly { id: string; kind: string }[],
  items: readonly StaffItemRef[],
): StaffPoint[] {
  const includedLanes = includedSecurityLanes(items)
  let lane = 0
  const out: StaffPoint[] = []
  for (const f of facilities) {
    if (f.kind === 'security_lane') {
      out.push({ id: f.id, kind: 'security_lane', included: lane < includedLanes, automatic: false })
      lane += 1
    } else if (f.kind === 'checkin_desk') {
      const it = itemForDesk(f.id, items)
      out.push({
        id: f.id,
        kind: 'checkin_desk',
        included: Boolean(it?.bundle),
        automatic: it ? pointRunsItself(it.def) : false,
      })
    }
  }
  return out
}

function countOpen(
  facilities: readonly { id: string; kind: string }[],
  items: readonly StaffItemRef[],
  hired: HiredPosts,
  kind: 'checkin_desk' | 'security_lane',
): number {
  const points = staffPoints(facilities, items)
  const open = openPointIds(points, hired)
  let n = 0
  for (const p of points) if (p.kind === kind && open.has(p.id)) n += 1
  return n
}

/** Open security lanes: the same set the walk will serve. */
export function openSecurityCount(
  facilities: readonly { id: string; kind: string }[],
  items: readonly StaffItemRef[],
  screenersOnPost: number,
): number {
  const hired = Number.isFinite(screenersOnPost) ? Math.max(0, Math.floor(screenersOnPost)) : 0
  return countOpen(facilities, items, { checkin: 0, security: hired }, 'security_lane')
}

/** Open check-in desks: bundle desks, self-serve kiosks, and desks with a clerk on the post. */
export function openCheckinCount(
  facilities: readonly { id: string; kind: string }[],
  items: readonly StaffItemRef[],
  clerksOnPost: number,
): number {
  const hired = Number.isFinite(clerksOnPost) ? Math.max(0, Math.floor(clerksOnPost)) : 0
  return countOpen(facilities, items, { checkin: hired, security: 0 }, 'checkin_desk')
}

/**
 * The active hall's walkers. `Game` calls `setHall`, `admit` and `tick`
 * every tick; the Terminal view reads `writePoses`, `origin` and `metrics`.
 */
export class HallNav {
  private navObj: PaxNav | null = null
  private arr = new HallArrivals()
  private crewObj = HallNav.newCrew()
  private crewRev = -1
  private waitsOut: PaxWait[] = []
  private readAt = -Infinity
  private loadRows: NavFacilityLoad[] = []
  private queueRows: NavHallQueue[] = []
  private hall = ''
  private stamp = ''
  private shape = ''
  private seen = new Set<string>()
  /** Sim arrivals walking (or done walking) on the nav grid: the old hall figure is not drawn for them. */
  private owned = new Set<string>()
  private gates: string[] = []
  /** Departure ids in PaxNav's pose order, so colours follow people without reading `poses()`. */
  private depOrder: string[] = []
  /** Reused by `locate` so a follow camera does not allocate every frame. */
  private poseScratch = new Float32Array(256 * 4)
  /** Nav seconds since this hall's walk started. */
  navNow = 0
  boarded = 0
  missed = 0
  stuck = 0
  /** Missed walkers who finished at a rebooking desk. */
  rebooked = 0
  /** Arrivals that reached a curb door and left. */
  left = 0
  /** Bumps whenever someone joins or leaves, so a renderer can re-read ids and colours. */
  roster = 0
  /** Guest feedback since this hall's walk started (thoughts, misses, complaints, spend). */
  feedback: GuestFeedback = emptyFeedback()
  /** Reputation the walk has earned or lost and the sim has not taken yet. */
  private repOwed = 0
  private signKey = ''
  /** Hired bodies on each post. Null until the sim says; then points follow it. */
  private hired: HiredPosts | null = null
  private staffItems: readonly { id: string; def: string; bundle?: boolean }[] = []
  /** Open family group per flight: leader id and places left. */
  private openGroup = new Map<string, { leader: string; left: number }>()
  /** Check-in allocation. Empty until the sim says; then the walk filters desks. */
  private deskPlanSet = false
  private deskRows: { id: string; airlineId: string | null; general: boolean; serviceShare: number }[] = []
  private deskPace = new Map<string, number>()

  get nav(): PaxNav | null {
    return this.navObj
  }

  /** Hall key the walk is reading. Empty until `setHall`. */
  get hallId(): string {
    return this.hall
  }

  private static newCrew(): CrewNav {
    return new CrewNav({ shiftSec: HALL_CREW_TUNING.shiftClockSec * HALL_NAV_TUNING.navSecPerClockSec })
  }

  /** Staff walking to, from and between their posts. */
  get crew(): CrewNav {
    return this.crewObj
  }

  /** Jet bridge to curb walkers. */
  get arrivals(): HallArrivals {
    return this.arr
  }

  /** True when the hall has a curb door and a gate, so walkers replace the old hall figures. */
  get live(): boolean {
    const n = this.navObj
    return Boolean(n && n.nav.spawns.length && this.gates.length)
  }

  /** Everyone walking: departures, then arrivals, then crew (pose order). */
  get count(): number {
    return (this.navObj?.count ?? 0) + this.arr.count + this.crewObj.count
  }

  /** Passengers walking (departures and arrivals); crew not counted. */
  get passengers(): number {
    return (this.navObj?.count ?? 0) + this.arr.count
  }

  /** The sim arrival is drawn by the walk, not as an old hall figure. */
  drawsArrival(id: string): boolean {
    return this.live && this.owned.has(id)
  }

  /**
   * Point the walk at a hall. A new hall starts a fresh walk; a new `stamp`
   * (the sim's hall revision) re-reads the layout and everyone re-plans.
   */
  setHall(
    hall: string,
    stamp: string,
    layout: () => BuildLayout | null,
    claim: () => ClaimHall | null = () => null,
    signage: () => Signage | null = () => null,
  ) {
    if (hall === this.hall && stamp === this.stamp) return
    const next = layout()
    if (!next) {
      this.reset()
      this.hall = hall
      this.stamp = stamp
      this.shape = ''
      return
    }
    const claimHall = claim()
    const signs = signage() ?? undefined
    // Many sim edits bump the revision without moving any kit; only re-plan on a real change.
    const shape = JSON.stringify(next) + JSON.stringify(claimHall)
    const signKey = JSON.stringify(signs ?? null)
    if (hall !== this.hall || !this.navObj) {
      this.reset()
      this.navObj = new PaxNav(next, { seed: HALL_NAV_TUNING.seed, guests: HALL_NAV_TUNING.guests, signage: signs })
      this.arr.setLayout(next, claimHall)
      this.crewObj.setGrid(this.navObj.nav, this.navObj.facilities)
    } else {
      if (shape !== this.shape) {
        this.navObj.setLayout(next)
        this.arr.setLayout(next, claimHall)
        this.crewObj.setGrid(this.navObj.nav, this.navObj.facilities)
        this.readAt = -Infinity
      }
      if (signKey !== this.signKey && signs) this.navObj.setSignage(signs)
    }
    this.signKey = signKey
    this.hall = hall
    this.stamp = stamp
    this.shape = shape
    this.gates = next.rooms.filter((r) => r.kind === 'gate').map((r) => r.id)
    if (this.shelfFood != null || this.shelfShop != null) this.navObj?.mirrorShelves(this.shelfFood, this.shelfShop)
  }

  private shelfFood: number | null = null
  private shelfShop: number | null = null

  /** Counters read the catering shelf. This walk does not refill them. */
  setShopStock(food: number, shop: number): void {
    this.shelfFood = food
    this.shelfShop = shop
    this.navObj?.mirrorShelves(food, shop)
  }

  /**
   * Walk the guests the sim has released into this hall. Departures step out
   * at a curb door and keep the flight's departure, scaled to nav time.
   * Arrivals step off at their gate's jet bridge door and walk out to the curb.
   */
  admit(guests: readonly NavGuest[], clock: number, stdOf: (flightId: string) => number | undefined) {
    const nav = this.navObj
    if (!nav || !this.live) return
    const L = HALL_NAV_TUNING.departLeadScale
    const still = new Set<string>()
    for (const g of guests) {
      if (g.dead || (g.hallId && g.hallId !== this.hall)) continue
      if (g.releaseAt != null && g.releaseAt > clock) continue
      const gate = this.gates[hashId(g.flightId) % this.gates.length]
      if (g.job === 'arrive') {
        if (g.transfer) continue
        still.add(g.id)
        if (this.seen.has(g.id)) continue
        this.seen.add(g.id)
        // No way from the jet bridge to a curb: the old figure keeps them.
        if (this.arr.spawn({ id: g.id, gate })) {
          this.owned.add(g.id)
          this.roster++
        }
        continue
      }
      if (g.job !== 'depart') continue
      still.add(g.id)
      if (this.seen.has(g.id) && !(g.preview && nav.cellOf(g.id) < 0)) continue
      this.seen.add(g.id)
      const std = stdOf(g.flightId) ?? clock + HALL_NAV_TUNING.unknownLeadClockSec
      const ok = nav.spawn({
        id: g.id,
        gate,
        departAt: this.navNow + Math.max(0, std - clock) * L,
        purpose: g.tag ? TAG_PURPOSE[g.tag] : undefined,
        groupOf: this.groupFor(g),
        bags: g.bags,
        airlineId: g.airlineId,
      })
      if (ok) {
        this.depOrder.push(g.id)
        this.roster++
      }
    }
    // Forget ids the sim has dropped so the sets do not grow all day.
    for (const id of this.seen) if (!still.has(id)) this.seen.delete(id)
    for (const id of this.owned) if (!still.has(id)) this.owned.delete(id)
  }

  /**
   * Family fares on the same flight walk as one party: the first opens a
   * group of a seeded size, the next ones join it until it is full.
   */
  private groupFor(g: NavGuest): string | undefined {
    if (!this.navObj?.guests || g.tag !== 'family' || g.preview) return undefined
    const T = HALL_NAV_TUNING.familyGroups
    const open = this.openGroup.get(g.flightId)
    if (open && open.left > 0 && this.navObj.has(open.leader)) {
      open.left--
      return open.leader
    }
    const h = navHash(g.id)
    if ((h % 1000) / 1000 < T.share) this.openGroup.set(g.flightId, { leader: g.id, left: 1 + ((h >>> 10) % T.maxFollowers) })
    else this.openGroup.delete(g.flightId)
    return undefined
  }

  /** Advance by `step` clock seconds (game speed already applied). */
  tick(step: number): PaxEvent[] {
    const nav = this.navObj
    if (!nav || !(step > 0)) return []
    this.applyStaffing(nav)
    const dt = step * HALL_NAV_TUNING.navSecPerClockSec
    this.navNow += dt
    nav.tick(dt, this.navNow)
    this.arr.tick(dt, this.navNow, nav)
    this.crewObj.tick(dt, this.navNow)
    if (this.crewObj.rev !== this.crewRev) {
      this.crewRev = this.crewObj.rev
      this.roster++
    }
    for (const w of nav.drainWaits()) this.waitsOut.push(w)
    if (this.navNow - this.readAt >= HALL_QUEUE_TUNING.readEveryNavSec) this.readQueues()
    const events = nav.drainEvents()
    let gone: Set<string> | null = null
    for (const e of events) {
      if (e.kind === 'boarded') this.boarded++
      else if (e.kind === 'missed') this.missed++
      else if (e.kind === 'rebooked') this.rebooked++
      else this.stuck++
      // A guest who missed still walks to the rebooking desk.
      if (e.kind !== 'stuck' && !nav.has(e.id)) {
        this.roster++
        ;(gone ??= new Set()).add(e.id)
      }
    }
    const fb = nav.drainFeedback()
    const f = this.feedback
    f.satDelta += fb.satDelta
    f.missed += fb.missed
    f.rebooked += fb.rebooked
    f.complaints += fb.complaints
    f.leftQueue += fb.leftQueue
    f.lost += fb.lost
    f.outOfStock += fb.outOfStock
    f.spent += fb.spent
    this.repOwed += feedbackReputation(fb)
    if (gone) this.depOrder = this.depOrder.filter((id) => !gone.has(id))
    for (const e of this.arr.drainEvents()) {
      if (e.kind === 'left') {
        this.left++
        this.roster++
      } else this.stuck++
    }
    return events
  }

  /** Id of the walker in pose slot `i` (departures, then arrivals, then crew). */
  idAt(i: number): string {
    const nav = this.navObj
    const n = nav?.count ?? 0
    const na = n + this.arr.count
    if (i >= na) return this.crewObj.idAt(i - na)
    if (i >= n) return this.arr.idAt(i - n)
    // Spawned outside `admit` (tests, the smoke's waves): re-read the order once.
    if (this.depOrder.length !== n) this.depOrder = nav!.poses().map((p) => p.id)
    return this.depOrder[i] ?? ''
  }

  /** Slot `i` is an arriving passenger. */
  isArrival(i: number): boolean {
    const n = this.navObj?.count ?? 0
    return i >= n && i < n + this.arr.count
  }

  /** Crew role in slot `i`; null for a passenger. */
  crewRole(i: number): CrewRole | null {
    const na = (this.navObj?.count ?? 0) + this.arr.count
    return i >= na ? this.crewObj.roleAt(i - na) : null
  }

  /** Hall-view metres of terminal (0, 0): the layout is centred on the hall origin. */
  origin(): { x: number; z: number } {
    const l = this.navObj?.layout
    if (!l) return { x: 0, z: 0 }
    const m = BUILD_TUNING.tileMetres
    return { x: (-l.w * m) / 2, z: (-l.h * m) / 2 }
  }

  /** `origin().x` without allocating (per-frame callers). */
  get originX(): number {
    const l = this.navObj?.layout
    return l ? (-l.w * BUILD_TUNING.tileMetres) / 2 : 0
  }

  /** `origin().z` without allocating (per-frame callers). */
  get originZ(): number {
    const l = this.navObj?.layout
    return l ? (-l.h * BUILD_TUNING.tileMetres) / 2 : 0
  }

  /**
   * Hired clerks and screeners, plus the placed items (bundle pieces are the
   * building's own points). Applied on the next tick, before anyone is served.
   */
  setStaffPlan(hired: HiredPosts, items: readonly { id: string; def: string; bundle?: boolean }[]): void {
    this.hired = hired
    this.staffItems = items
  }

  /**
   * Branded desks for this moment. Applied before anyone is admitted, so a
   * passenger released on this tick already walks to their airline.
   */
  setDeskPlan(rows: readonly { id: string; airlineId: string | null; general: boolean; serviceShare: number }[]): void {
    this.deskPlanSet = true
    this.deskRows = rows.slice()
    this.deskPace = new Map(rows.map((row) => [row.id, row.serviceShare]))
    if (this.navObj) this.applyStaffing(this.navObj)
  }

  /** x, y, z, yaw per walker (stride 4), terminal metres: departures, then arrivals, then crew. */
  writePoses(out: Float32Array): number {
    const n = this.navObj?.writePoses(out) ?? 0
    const na = n + this.arr.writePoses(out, n)
    return na + this.crewObj.writePoses(out, na)
  }

  /** Serve / queue byte per walker, same order as `writePoses`. 2 = being served. */
  writePhases(out: Uint8Array): number {
    const n = this.navObj?.writePhases(out) ?? 0
    const total = Math.min(this.count, out.length)
    for (let i = n; i < total; i++) out[i] = 0
    return total
  }

  /**
   * Kiosk time and a Trusted dedicated desk are shares of the base service
   * time, recomputed each tick so they do not compound.
   */
  private applyDeskPace(nav: PaxNav): void {
    const kioskShare = SERVICE_POINT_TUNING.kioskServiceShare
    for (const eq of nav.layout.equipment) {
      if (eq.kind !== 'checkin_desk') continue
      const facility = nav.facilities.byId.get(eq.id)
      if (!facility) continue
      let sec = serviceSecOf(eq)
      const it = itemForDesk(eq.id, this.staffItems)
      if (it && isKioskDef(it.def) && kioskShare > 0 && kioskShare <= 1) sec *= kioskShare
      const trusted = this.deskPace.get(eq.id)
      if (trusted != null && trusted > 0 && trusted < 1) sec *= trusted
      facility.serviceSec = sec
    }
  }

  private applyStaffing(nav: PaxNav): void {
    this.applyDeskPace(nav)
    if (this.hired) {
      const points = staffPoints(nav.facilities.list, this.staffItems)
      nav.setStaffing(openPointIds(points, this.hired))
    }
    if (!this.deskPlanSet) return
    nav.setDeskPlan(
      this.deskRows.map((row) => ({ id: row.id, airlineId: row.airlineId, general: row.general })),
    )
  }

  metrics(): FacilityMetrics[] {
    return this.navObj?.metrics() ?? []
  }

  /** Reputation the walk's guests earned or cost since the last call (sim 0–100 scale). */
  takeReputation(): number {
    const r = this.repOwed
    this.repOwed = 0
    return r
  }

  /** Guest card for a departing walker (traits, needs, thoughts), or null. */
  guestCard(id: string): GuestCard | null {
    return this.live ? (this.navObj?.guest(id) ?? null) : null
  }

  /** Mean satisfaction of the departing walkers now. */
  satisfaction(): { avg: number; count: number } {
    return this.navObj?.satisfaction() ?? { avg: 0, count: 0 }
  }

  /** Bubble flags per walker in pose order (departures, then arrivals with none). */
  writeFlags(out: Uint8Array): number {
    const n = this.navObj?.writeFlags(out) ?? 0
    const m = Math.min(this.arr.count, out.length - n)
    out.fill(0, n, n + m)
    return n + m
  }

  /** Walker nearest a hall-view floor point (metres), within `maxM`. Departures, then arrivals. */
  pickAt(hx: number, hz: number, maxM = 1): string | null {
    if (!this.live) return null
    const lx = hx - this.originX
    const lz = hz - this.originZ
    return this.navObj?.pick(lx, lz, maxM) ?? this.arr.pick(lx, lz, maxM)
  }

  /** Hall-view metres of a passenger (departures and arrivals). Null when they have left. */
  locate(id: string): { x: number; z: number } | null {
    if (!this.live || !id) return null
    const pax = this.passengers
    if (pax <= 0) return null
    if (this.poseScratch.length < pax * 4) this.poseScratch = new Float32Array(pax * 4)
    this.writePoses(this.poseScratch)
    const ox = this.originX
    const oz = this.originZ
    for (let i = 0; i < pax; i++) {
      if (this.idAt(i) !== id) continue
      return { x: this.poseScratch[i * 4] + ox, z: this.poseScratch[i * 4 + 2] + oz }
    }
    return null
  }

  /** Waits that ended since the last drain (who, at which kit, how long). The sim turns them into mood. */
  drainWaits(): PaxWait[] {
    const out = this.waitsOut
    this.waitsOut = []
    return out
  }

  /** Per-facility live load at the last read (every `readEveryNavSec`). */
  loads(): readonly NavFacilityLoad[] {
    return this.loadRows
  }

  /** Live queues by hall node, hall metres, at the last read. Empty lines are left out. */
  queues(): readonly NavHallQueue[] {
    return this.queueRows
  }

  /** Facilities flagged as bottlenecks at the last read. */
  get bottlenecks(): number {
    let n = 0
    for (const l of this.loadRows) if (l.bottleneck) n++
    return n
  }

  private readQueues() {
    this.readAt = this.navNow
    const metrics = this.metrics()
    this.loadRows = metrics.map((m) => ({
      id: m.id,
      kind: m.kind,
      node: NODE_OF[m.kind]?.node ?? null,
      queueLength: m.queueLength,
      estWaitSec: m.estWaitSec,
      avgWaitSec: m.avgWaitSec,
      bottleneck: isNavBottleneck(m),
    }))
    this.queueRows = navHallQueues(metrics, this.originX, this.originZ)
  }

  private reset() {
    this.navObj = null
    this.arr = new HallArrivals()
    this.crewObj = HallNav.newCrew()
    this.crewRev = -1
    this.waitsOut = []
    this.readAt = -Infinity
    this.loadRows = []
    this.queueRows = []
    this.seen.clear()
    this.owned.clear()
    this.openGroup.clear()
    this.depOrder = []
    this.gates = []
    this.navNow = 0
    this.boarded = 0
    this.missed = 0
    this.stuck = 0
    this.rebooked = 0
    this.left = 0
    this.feedback = emptyFeedback()
    this.signKey = ''
    this.roster++
  }
}

function emptyFeedback(): GuestFeedback {
  return { satDelta: 0, missed: 0, rebooked: 0, complaints: 0, leftQueue: 0, lost: 0, outOfStock: 0, spent: 0 }
}
