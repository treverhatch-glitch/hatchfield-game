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
import { BUILD_TUNING } from '../terminalbuild/config.ts'
import type { BuildLayout, BuildZone, Door, Edge, Equip, Room, Tile } from '../terminalbuild/types.ts'
import { PaxNav, type FacilityMetrics, type PaxEvent } from '../paxnav/index.ts'
import { HALL_D, HALL_W, itemDef, type PlacedItem, type ZoneId } from './terminal.ts'
import { HALL_NAV_TUNING, PREFAB_ROOM_KIT } from './hallNavData.ts'

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
  const tilesOf = new Map<string, Tile[]>()
  const zoneGrid: (BuildZone | null)[][] = []
  for (let y = 0; y < h; y++) {
    const row: (BuildZone | null)[] = []
    for (let x = 0; x < w; x++) {
      const { c, r } = cellOf(x, y)
      const k = `${c},${r}`
      if (!tilesOf.has(k)) tilesOf.set(k, [])
      tilesOf.get(k)!.push({ x, y })
      const z = zones[r]?.[c] ?? null
      row.push(z === 'toilets' ? toiletSide(zones, c, r) : z ? PREFAB_ZONE[z] : null)
    }
    zoneGrid.push(row)
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
  // floor), apron doors along the gates, walls on the rest.
  const entrance = new Set<string>()
  for (const it of items) {
    if (it.def !== 'entrance') continue
    for (const t of tilesOf.get(`${it.c},${it.r}`) ?? []) entrance.add(`${t.x},${t.y}`)
  }
  const doors: Door[] = []
  const walls: Edge[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = { x, y }
      const outer: Edge[] = []
      if (x === w - 1) outer.push({ x, y, dir: 'E' })
      if (x === 0) outer.push({ x: -1, y, dir: 'E' })
      if (y === h - 1) outer.push({ x, y, dir: 'S' })
      if (y === 0) outer.push({ x, y: -1, dir: 'S' })
      const free = !used.has(`${x},${y}`)
      const curb = free && landside(t) && (entrance.size ? entrance.has(`${x},${y}`) : true)
      const apron = free && zoneAt(t) === 'gates'
      for (const e of outer) {
        if (curb) doors.push({ ...e, kind: 'curb' })
        else if (apron) doors.push({ ...e, kind: 'apron' })
        else walls.push(e)
      }
    }
  }

  return {
    w,
    h,
    floor: Array.from({ length: h }, () => Array.from({ length: w }, () => true)),
    zones: zoneGrid,
    walls,
    doors,
    rooms,
    equipment,
  }
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

/**
 * The active hall's walkers. `Game` calls `setHall`, `admit` and `tick`
 * every tick; the Terminal view reads `writePoses`, `origin` and `metrics`.
 */
export class HallNav {
  private navObj: PaxNav | null = null
  private hall = ''
  private stamp = ''
  private shape = ''
  private seen = new Set<string>()
  private gates: string[] = []
  /** Nav seconds since this hall's walk started. */
  navNow = 0
  boarded = 0
  missed = 0
  stuck = 0
  /** Bumps whenever someone joins or leaves, so a renderer can re-read ids and colours. */
  roster = 0

  get nav(): PaxNav | null {
    return this.navObj
  }

  /** True when the hall has a curb door and a gate, so walkers replace the old hall figures. */
  get live(): boolean {
    const n = this.navObj
    return Boolean(n && n.nav.spawns.length && this.gates.length)
  }

  get count(): number {
    return this.navObj?.count ?? 0
  }

  /**
   * Point the walk at a hall. A new hall starts a fresh walk; a new `stamp`
   * (the sim's hall revision) re-reads the layout and everyone re-plans.
   */
  setHall(hall: string, stamp: string, layout: () => BuildLayout | null) {
    if (hall === this.hall && stamp === this.stamp) return
    const next = layout()
    if (!next) {
      this.reset()
      this.hall = hall
      this.stamp = stamp
      this.shape = ''
      return
    }
    // Many sim edits bump the revision without moving any kit; only re-plan on a real change.
    const shape = JSON.stringify(next)
    if (hall !== this.hall || !this.navObj) {
      this.reset()
      this.navObj = new PaxNav(next, { seed: HALL_NAV_TUNING.seed })
    } else if (shape !== this.shape) {
      this.navObj.setLayout(next)
    }
    this.hall = hall
    this.stamp = stamp
    this.shape = shape
    this.gates = next.rooms.filter((r) => r.kind === 'gate').map((r) => r.id)
  }

  /**
   * Walk the departing guests the sim has released into this hall. Each one
   * steps out at a curb door and keeps the flight's departure, scaled to nav time.
   */
  admit(guests: readonly NavGuest[], clock: number, stdOf: (flightId: string) => number | undefined) {
    const nav = this.navObj
    if (!nav || !this.live) return
    const L = HALL_NAV_TUNING.departLeadScale
    const still = new Set<string>()
    for (const g of guests) {
      if (g.job !== 'depart' || g.dead || (g.hallId && g.hallId !== this.hall)) continue
      if (g.releaseAt != null && g.releaseAt > clock) continue
      still.add(g.id)
      if (this.seen.has(g.id) && !(g.preview && nav.cellOf(g.id) < 0)) continue
      this.seen.add(g.id)
      const std = stdOf(g.flightId) ?? clock + HALL_NAV_TUNING.unknownLeadClockSec
      const ok = nav.spawn({
        id: g.id,
        gate: this.gates[hashId(g.flightId) % this.gates.length],
        departAt: this.navNow + Math.max(0, std - clock) * L,
      })
      if (ok) this.roster++
    }
    // Forget ids the sim has dropped so the set does not grow all day.
    for (const id of this.seen) if (!still.has(id)) this.seen.delete(id)
  }

  /** Advance by `step` clock seconds (game speed already applied). */
  tick(step: number): PaxEvent[] {
    const nav = this.navObj
    if (!nav || !(step > 0)) return []
    const dt = step * HALL_NAV_TUNING.navSecPerClockSec
    this.navNow += dt
    nav.tick(dt, this.navNow)
    const events = nav.drainEvents()
    for (const e of events) {
      if (e.kind === 'boarded') this.boarded++
      else if (e.kind === 'missed') this.missed++
      else this.stuck++
      if (e.kind !== 'stuck') this.roster++
    }
    return events
  }

  /** Hall-view metres of terminal (0, 0): the layout is centred on the hall origin. */
  origin(): { x: number; z: number } {
    const l = this.navObj?.layout
    if (!l) return { x: 0, z: 0 }
    const m = BUILD_TUNING.tileMetres
    return { x: (-l.w * m) / 2, z: (-l.h * m) / 2 }
  }

  /** x, y, z, yaw per walker (stride 4), terminal metres. */
  writePoses(out: Float32Array): number {
    return this.navObj?.writePoses(out) ?? 0
  }

  metrics(): FacilityMetrics[] {
    return this.navObj?.metrics() ?? []
  }

  private reset() {
    this.navObj = null
    this.seen.clear()
    this.gates = []
    this.navNow = 0
    this.boarded = 0
    this.missed = 0
    this.stuck = 0
    this.roster++
  }
}
