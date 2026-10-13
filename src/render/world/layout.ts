/**
 * Pure tile analysis for the world layer: clusters, runway axes, terminal edges,
 * stand lead-ins, jet bridges, airfield light spots, and paint markings.
 * Everything here is plain data so it can be unit tested without WebGL.
 */
import type { StandClass, Tile, Vec } from '../../game/types'
import { CELL, cellX, cellZ, tileAt, type WorldView } from './view'

export type Dir = 'n' | 's' | 'e' | 'w'
export const DIRS: readonly Dir[] = ['n', 'e', 's', 'w']
export const DIR_VEC: Record<Dir, { dc: number; dr: number }> = {
  n: { dc: 0, dr: -1 },
  s: { dc: 0, dr: 1 },
  e: { dc: 1, dr: 0 },
  w: { dc: -1, dr: 0 },
}
export const OPPOSITE: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' }

export interface P2 {
  x: number
  z: number
}

export interface Cluster {
  tile: Tile
  cells: Vec[]
  minC: number
  maxC: number
  minR: number
  maxR: number
}

export const PAVED: ReadonlySet<Tile> = new Set<Tile>(['runway', 'taxi', 'stand'])

/** 4-connected components of tiles that match `want`. */
export function clusters(view: WorldView, want: Tile): Cluster[] {
  const rows = view.tiles.length
  const seen = new Set<number>()
  const out: Cluster[] = []
  for (let r = 0; r < rows; r++) {
    const cols = view.tiles[r].length
    for (let c = 0; c < cols; c++) {
      const key = r * 1024 + c
      if (seen.has(key) || view.tiles[r][c] !== want) continue
      const cl: Cluster = { tile: want, cells: [], minC: c, maxC: c, minR: r, maxR: r }
      const stack: Vec[] = [{ c, r }]
      seen.add(key)
      while (stack.length) {
        const p = stack.pop()!
        cl.cells.push(p)
        cl.minC = Math.min(cl.minC, p.c)
        cl.maxC = Math.max(cl.maxC, p.c)
        cl.minR = Math.min(cl.minR, p.r)
        cl.maxR = Math.max(cl.maxR, p.r)
        for (const d of DIRS) {
          const nc = p.c + DIR_VEC[d].dc
          const nr = p.r + DIR_VEC[d].dr
          const k = nr * 1024 + nc
          if (seen.has(k) || tileAt(view, nc, nr) !== want) continue
          seen.add(k)
          stack.push({ c: nc, r: nr })
        }
      }
      cl.cells.sort((a, b) => a.r - b.r || a.c - b.c)
      out.push(cl)
    }
  }
  return out
}

export function clusterCenter(cl: Cluster): P2 {
  return {
    x: (cellX(cl.minC) + cellX(cl.maxC)) / 2,
    z: (cellZ(cl.minR) + cellZ(cl.maxR)) / 2,
  }
}

/** Bounding radius in world units (for LOD distance + culling). */
export function clusterRadius(cl: Cluster): number {
  const w = (cl.maxC - cl.minC + 1) * CELL
  const d = (cl.maxR - cl.minR + 1) * CELL
  return Math.hypot(w, d) / 2
}

// ---------------------------------------------------------------- runways

export interface Runway {
  cluster: Cluster
  axis: 'h' | 'v'
  /** World bounds of the paved strip. */
  x0: number
  x1: number
  z0: number
  z1: number
  /** Along-axis length and across width in world units. */
  length: number
  width: number
}

export function runways(view: WorldView): Runway[] {
  return clusters(view, 'runway').map((cl) => {
    const cols = cl.maxC - cl.minC + 1
    const rows = cl.maxR - cl.minR + 1
    const axis: 'h' | 'v' = cols >= rows ? 'h' : 'v'
    const x0 = cellX(cl.minC) - CELL / 2
    const x1 = cellX(cl.maxC) + CELL / 2
    const z0 = cellZ(cl.minR) - CELL / 2
    const z1 = cellZ(cl.maxR) + CELL / 2
    return {
      cluster: cl,
      axis,
      x0,
      x1,
      z0,
      z1,
      length: axis === 'h' ? x1 - x0 : z1 - z0,
      width: axis === 'h' ? z1 - z0 : x1 - x0,
    }
  })
}

/** Runway designators from the axis (north is −z). Low number first: west / north end. */
export function runwayDesignators(axis: 'h' | 'v'): [string, string] {
  return axis === 'h' ? ['09', '27'] : ['18', '36']
}

// ---------------------------------------------------------------- terminals

export interface Edge {
  c: number
  r: number
  side: Dir
}

export interface TerminalInfo {
  cluster: Cluster
  /** Faces the apron (stands / taxi). */
  airside: Dir
  /** Exterior cell sides that get a glazed facade. */
  edges: Edge[]
}

export function exteriorEdges(view: WorldView, cl: Cluster): Edge[] {
  const out: Edge[] = []
  for (const p of cl.cells) {
    for (const d of DIRS) {
      if (tileAt(view, p.c + DIR_VEC[d].dc, p.r + DIR_VEC[d].dr) !== cl.tile) {
        out.push({ c: p.c, r: p.r, side: d })
      }
    }
  }
  return out
}

/** Which side of a cluster faces the most apron tiles within `reach` cells. */
export function airsideOf(view: WorldView, cl: Cluster, reach = 3): Dir {
  const score: Record<Dir, number> = { n: 0, s: 0, e: 0, w: 0 }
  for (let r = cl.minR - reach; r <= cl.maxR + reach; r++) {
    for (let c = cl.minC - reach; c <= cl.maxC + reach; c++) {
      const t = tileAt(view, c, r)
      if (!t || !PAVED.has(t)) continue
      const w = t === 'stand' ? 3 : t === 'taxi' ? 1 : 0.5
      if (r > cl.maxR) score.s += w
      if (r < cl.minR) score.n += w
      if (c > cl.maxC) score.e += w
      if (c < cl.minC) score.w += w
    }
  }
  let best: Dir = 's'
  for (const d of DIRS) if (score[d] > score[best]) best = d
  return best
}

export function terminals(view: WorldView): TerminalInfo[] {
  return clusters(view, 'terminal').map((cl) => ({
    cluster: cl,
    airside: airsideOf(view, cl),
    edges: exteriorEdges(view, cl),
  }))
}

// ---------------------------------------------------------------- stands + jet bridges

export interface StandInfo {
  c: number
  r: number
  cls: StandClass
  jetway: boolean
  /** Side the aircraft taxis in from (lead-in line starts there). */
  entry: Dir
}

export function stands(view: WorldView): StandInfo[] {
  const out: StandInfo[] = []
  for (let r = 0; r < view.tiles.length; r++) {
    for (let c = 0; c < view.tiles[r].length; c++) {
      if (view.tiles[r][c] !== 'stand') continue
      let entry: Dir = 's'
      let found = false
      for (const d of ['s', 'n', 'e', 'w'] as const) {
        const t = tileAt(view, c + DIR_VEC[d].dc, r + DIR_VEC[d].dr)
        if (t === 'taxi' || t === 'runway') {
          entry = d
          found = true
          break
        }
      }
      if (!found) {
        for (const d of ['s', 'n', 'e', 'w'] as const) {
          if (tileAt(view, c + DIR_VEC[d].dc, r + DIR_VEC[d].dr) === 'stand') {
            entry = d
            break
          }
        }
      }
      out.push({
        c,
        r,
        cls: view.standClass?.[`${c},${r}`] ?? 'M',
        jetway: view.standAccessAt?.({ c, r }) === 'jetway',
        entry,
      })
    }
  }
  return out
}

export interface JetBridge {
  stand: Vec
  terminal: Vec
  /** Terminal side the rotunda sits on. */
  side: Dir
  /** Rotunda point on the facade (world). */
  root: P2
  /** Cab end, short of the stand centre where a nose door would be. */
  cab: P2
}

/** Nearest terminal facade for each jetway stand within `range` cells. */
export function jetBridges(view: WorldView, list: StandInfo[], range = 6): JetBridge[] {
  const terms = clusters(view, 'terminal')
  const out: JetBridge[] = []
  for (const s of list) {
    if (!s.jetway) continue
    let best: { cell: Vec; side: Dir; d: number } | null = null
    for (const cl of terms) {
      for (const e of exteriorEdges(view, cl)) {
        const nc = e.c + DIR_VEC[e.side].dc
        const nr = e.r + DIR_VEC[e.side].dr
        const d = Math.abs(nc - s.c) + Math.abs(nr - s.r)
        // Prefer facades that look toward the stand.
        const facing =
          (e.side === 'e' && s.c > e.c) ||
          (e.side === 'w' && s.c < e.c) ||
          (e.side === 's' && s.r > e.r) ||
          (e.side === 'n' && s.r < e.r)
        const score = d + (facing ? 0 : 2.5)
        if (!best || score < best.d) best = { cell: { c: e.c, r: e.r }, side: e.side, d: score }
      }
    }
    if (!best || best.d > range) continue
    const v = DIR_VEC[best.side]
    const root = {
      x: cellX(best.cell.c) + v.dc * CELL * 0.5,
      z: cellZ(best.cell.r) + v.dr * CELL * 0.5,
    }
    const sx = cellX(s.c)
    const sz = cellZ(s.r)
    const dx = sx - root.x
    const dz = sz - root.z
    const len = Math.hypot(dx, dz) || 1
    const reach = Math.max(1.2, len - CELL * 0.28)
    out.push({
      stand: { c: s.c, r: s.r },
      terminal: best.cell,
      side: best.side,
      root,
      cab: { x: root.x + (dx / len) * reach, z: root.z + (dz / len) * reach },
    })
  }
  return out
}

// ---------------------------------------------------------------- airfield lights

export type LightKind = 'rwEdge' | 'rwCenter' | 'threshold' | 'rwEnd' | 'twCenter' | 'twEdge' | 'apron'

export interface LightSpot extends P2 {
  kind: LightKind
}

export function runwayLightSpots(rw: Runway, spacing = 3.1): LightSpot[] {
  const out: LightSpot[] = []
  const inset = 0.35
  const along = (u: number, v: number): P2 =>
    rw.axis === 'h' ? { x: rw.x0 + u, z: rw.z0 + v } : { x: rw.x0 + v, z: rw.z0 + u }
  const n = Math.max(2, Math.round(rw.length / spacing))
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * rw.length
    out.push({ ...along(u, inset), kind: 'rwEdge' })
    out.push({ ...along(u, rw.width - inset), kind: 'rwEdge' })
    if (i > 0 && i < n && i % 2 === 0) out.push({ ...along(u, rw.width / 2), kind: 'rwCenter' })
  }
  const bars = Math.max(3, Math.round(rw.width / 1.2))
  for (let j = 0; j <= bars; j++) {
    const v = inset + (j / bars) * (rw.width - inset * 2)
    out.push({ ...along(0.25, v), kind: 'threshold' })
    out.push({ ...along(rw.length - 0.25, v), kind: 'threshold' })
    out.push({ ...along(0.9, v), kind: 'rwEnd' })
    out.push({ ...along(rw.length - 0.9, v), kind: 'rwEnd' })
  }
  return out
}

/** Taxi centre lights along links, edge lights where the taxiway meets grass. */
export function taxiLightSpots(view: WorldView): LightSpot[] {
  const out: LightSpot[] = []
  for (let r = 0; r < view.tiles.length; r++) {
    for (let c = 0; c < view.tiles[r].length; c++) {
      if (view.tiles[r][c] !== 'taxi') continue
      const x = cellX(c)
      const z = cellZ(r)
      out.push({ x, z, kind: 'twCenter' })
      for (const d of DIRS) {
        const t = tileAt(view, c + DIR_VEC[d].dc, r + DIR_VEC[d].dr)
        const v = DIR_VEC[d]
        if ((t === 'taxi' || t === 'stand') && !taxiLinkVisible(view, c, r, d)) continue
        if (t === 'taxi' || t === 'stand') {
          out.push({ x: x + v.dc * CELL * 0.33, z: z + v.dr * CELL * 0.33, kind: 'twCenter' })
        } else if (t !== 'runway') {
          // Two blue edge lights per open side.
          for (const k of [-0.25, 0.25]) {
            out.push({
              x: x + v.dc * CELL * 0.46 + (v.dc === 0 ? k * CELL : 0),
              z: z + v.dr * CELL * 0.46 + (v.dr === 0 ? k * CELL : 0),
              kind: 'twEdge',
            })
          }
        }
      }
    }
  }
  return out
}

export interface Mast extends P2 {
  /** Points toward the stand it floods. */
  yaw: number
}

/** One flood mast per stand at the head corner, de-duplicated when stands sit side by side. */
export function apronMasts(list: StandInfo[]): Mast[] {
  const out: Mast[] = []
  for (const s of list) {
    const head = DIR_VEC[OPPOSITE[s.entry]]
    const side = head.dc === 0 ? { dc: 1, dr: 0 } : { dc: 0, dr: 1 }
    const x = cellX(s.c) + head.dc * CELL * 0.46 + side.dc * CELL * 0.46
    const z = cellZ(s.r) + head.dr * CELL * 0.46 + side.dr * CELL * 0.46
    if (out.some((m) => Math.hypot(m.x - x, m.z - z) < CELL * 0.9)) continue
    out.push({ x, z, yaw: Math.atan2(cellX(s.c) - x, cellZ(s.r) - z) })
  }
  return out
}

// ---------------------------------------------------------------- paint markings

export type PaintColor = 'white' | 'yellow' | 'red' | 'black' | 'S' | 'M' | 'L'

export interface Paint {
  /** Centre (world). */
  x: number
  z: number
  /** Extent along world x and z (axis aligned). */
  w: number
  d: number
  color: PaintColor
}

const SEG: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcfgd',
}

/**
 * Seven-segment digit in glyph space (gx right, gy up, 0..1 × 0..2), mapped to world
 * with `right` and `up` unit vectors. Only axis-aligned frames are supported.
 */
function digit(ch: string, ox: number, oz: number, right: P2, up: P2, scale: number, out: Paint[]) {
  const segs = SEG[ch] ?? ''
  const t = 0.22
  const bars: Record<string, [number, number, number, number]> = {
    a: [0.5, 2 - t / 2, 1, t],
    g: [0.5, 1, 1, t],
    d: [0.5, t / 2, 1, t],
    f: [t / 2, 1.5, t, 1],
    b: [1 - t / 2, 1.5, t, 1],
    e: [t / 2, 0.5, t, 1],
    c: [1 - t / 2, 0.5, t, 1],
  }
  for (const s of segs) {
    const [gx, gy, gw, gh] = bars[s]
    const x = ox + (right.x * gx + up.x * gy) * scale
    const z = oz + (right.z * gx + up.z * gy) * scale
    const w = Math.abs(right.x * gw + up.x * gh) * scale
    const d = Math.abs(right.z * gw + up.z * gh) * scale
    out.push({ x, z, w: Math.max(w, 0.01), d: Math.max(d, 0.01), color: 'white' })
  }
}

export function runwayPaint(rw: Runway): Paint[] {
  const out: Paint[] = []
  const h = rw.axis === 'h'
  // Rect in runway-local (u along, v across) → world, axis aligned.
  const rect = (u: number, v: number, du: number, dv: number, color: PaintColor = 'white') => {
    out.push(
      h
        ? { x: rw.x0 + u, z: rw.z0 + v, w: du, d: dv, color }
        : { x: rw.x0 + v, z: rw.z0 + u, w: dv, d: du, color },
    )
  }
  const L = rw.length
  const W = rw.width
  rect(L / 2, 0.55, L - 1.2, 0.22)
  rect(L / 2, W - 0.55, L - 1.2, 0.22)
  const keys = Math.max(4, Math.floor((W - 2) / 0.9))
  const keyW = 0.42
  const span = W - 2.2
  for (const end of [0, 1]) {
    const u0 = end === 0 ? 2.6 : L - 2.6
    for (let k = 0; k < keys; k++) {
      const v = 1.1 + (span * (k + 0.5)) / keys
      if (Math.abs(v - W / 2) < 0.5) continue
      rect(u0, v, 3.2, keyW)
    }
    // Aiming point + touchdown zone bars.
    const aim = end === 0 ? Math.min(L * 0.3, 14) : L - Math.min(L * 0.3, 14)
    rect(aim, W / 2 - W * 0.22, 4.2, 0.8)
    rect(aim, W / 2 + W * 0.22, 4.2, 0.8)
    const tdz = end === 0 ? aim + 6 : aim - 6
    if (tdz > 9 && tdz < L - 9) {
      rect(tdz, W / 2 - W * 0.2, 2.4, 0.35)
      rect(tdz, W / 2 + W * 0.2, 2.4, 0.35)
    }
  }
  // Centreline dashes between the designators.
  const dash = 3
  const gap = 2.4
  for (let u = 11; u + dash < L - 11; u += dash + gap) rect(u + dash / 2, W / 2, dash, 0.28)
  // Designators, read from the approach end.
  const [lo, hi] = runwayDesignators(rw.axis)
  const scale = Math.min(1.2, (W - 2) / 5)
  const ends: { label: string; u: number; dir: number }[] = [
    { label: lo, u: 5.2, dir: 1 },
    { label: hi, u: L - 5.2, dir: -1 },
  ]
  for (const e of ends) {
    // North is −z, so a pilot's right hand is (−heading.z, heading.x).
    const heading: P2 = h ? { x: e.dir, z: 0 } : { x: 0, z: e.dir }
    const right: P2 = { x: -heading.z, z: heading.x }
    const base = h ? { x: rw.x0 + e.u, z: rw.z0 + W / 2 } : { x: rw.x0 + W / 2, z: rw.z0 + e.u }
    const gap = 0.45 * scale
    const total = e.label.length * scale + (e.label.length - 1) * gap
    for (let i = 0; i < e.label.length; i++) {
      const off = -total / 2 + i * (scale + gap)
      const ox = base.x + right.x * off - heading.x * scale
      const oz = base.z + right.z * off - heading.z * scale
      digit(e.label[i], ox, oz, right, heading, scale, out)
    }
  }
  return out
}

function isLink(t: Tile | null): boolean {
  return t === 'taxi' || t === 'stand'
}

function runLength(view: WorldView, c: number, r: number, axis: 'h' | 'v'): number {
  const dc = axis === 'h' ? 1 : 0
  const dr = axis === 'h' ? 0 : 1
  let n = 1
  for (let k = 1; tileAt(view, c + dc * k, r + dr * k) === 'taxi'; k++) n++
  for (let k = 1; tileAt(view, c - dc * k, r - dr * k) === 'taxi'; k++) n++
  return n
}

/** Dominant axis of the taxi strip a cell belongs to (null on a tie, e.g. a junction). */
export function taxiAxis(view: WorldView, c: number, r: number): 'h' | 'v' | null {
  const h = runLength(view, c, r, 'h')
  const v = runLength(view, c, r, 'v')
  return h > v ? 'h' : v > h ? 'v' : null
}

/**
 * Wide taxiways are several parallel strips; a centreline link across two cells that
 * both run perpendicular to it would paint a ladder, so skip it.
 */
export function taxiLinkVisible(view: WorldView, c: number, r: number, d: Dir): boolean {
  const nc = c + DIR_VEC[d].dc
  const nr = r + DIR_VEC[d].dr
  if (tileAt(view, nc, nr) !== 'taxi') return true
  const across: 'h' | 'v' = d === 'n' || d === 's' ? 'h' : 'v'
  return !(taxiAxis(view, c, r) === across && taxiAxis(view, nc, nr) === across)
}

export function taxiPaint(view: WorldView): Paint[] {
  const out: Paint[] = []
  for (let r = 0; r < view.tiles.length; r++) {
    for (let c = 0; c < view.tiles[r].length; c++) {
      if (view.tiles[r][c] !== 'taxi') continue
      const x = cellX(c)
      const z = cellZ(r)
      let links = 0
      for (const d of DIRS) {
        const t = tileAt(view, c + DIR_VEC[d].dc, r + DIR_VEC[d].dr)
        const v = DIR_VEC[d]
        if ((isLink(t) || t === 'runway') && !taxiLinkVisible(view, c, r, d)) continue
        if (isLink(t) || t === 'runway') {
          links++
          const len = t === 'runway' ? CELL * 0.5 : CELL * 0.5 + 0.09
          const mx = x + v.dc * len * 0.5
          const mz = z + v.dr * len * 0.5
          out.push({
            x: mx,
            z: mz,
            w: v.dc ? len : 0.2,
            d: v.dr ? len : 0.2,
            color: 'yellow',
          })
          if (t === 'runway') {
            // Hold-short bar: two solid + two dashed lines across the link.
            for (const k of [0.38, 0.44]) {
              out.push({
                x: x + v.dc * CELL * k,
                z: z + v.dr * CELL * k,
                w: v.dc ? 0.12 : CELL * 0.86,
                d: v.dr ? 0.12 : CELL * 0.86,
                color: 'yellow',
              })
            }
          }
        } else {
          // Solid edge line where the taxiway meets grass or buildings.
          const ex = x + v.dc * CELL * 0.43
          const ez = z + v.dr * CELL * 0.43
          out.push({
            x: ex,
            z: ez,
            w: v.dc ? 0.12 : CELL * 0.98,
            d: v.dr ? 0.12 : CELL * 0.98,
            color: 'yellow',
          })
        }
      }
      if (links === 0) out.push({ x, z, w: 0.6, d: 0.6, color: 'yellow' })
    }
  }
  return out
}

export function standPaint(list: StandInfo[]): Paint[] {
  const out: Paint[] = []
  for (const s of list) {
    const x = cellX(s.c)
    const z = cellZ(s.r)
    const into = DIR_VEC[OPPOSITE[s.entry]]
    const half = CELL * 0.5
    // Lead-in from the entry edge to the stop bar.
    const stop = CELL * 0.22
    const from = -half
    const len = stop - from
    const mid = (from + stop) / 2
    out.push({
      x: x + into.dc * mid,
      z: z + into.dr * mid,
      w: into.dc ? len : 0.2,
      d: into.dr ? len : 0.2,
      color: 'yellow',
    })
    out.push({
      x: x + into.dc * stop,
      z: z + into.dr * stop,
      w: into.dc ? 0.3 : 1.6,
      d: into.dr ? 0.3 : 1.6,
      color: 'yellow',
    })
    // Red safety envelope.
    const inset = CELL * 0.44
    const t = 0.12
    out.push({ x, z: z - inset, w: inset * 2, d: t, color: 'red' })
    out.push({ x, z: z + inset, w: inset * 2, d: t, color: 'red' })
    out.push({ x: x - inset, z, w: t, d: inset * 2, color: 'red' })
    out.push({ x: x + inset, z, w: t, d: inset * 2, color: 'red' })
    // Stand plate at the head, tinted by class.
    const hx = x + into.dc * CELL * 0.36
    const hz = z + into.dr * CELL * 0.36
    out.push({ x: hx + (into.dr ? 1.3 : 0), z: hz + (into.dc ? 1.3 : 0), w: 0.9, d: 0.9, color: 'black' })
    out.push({ x: hx + (into.dr ? 1.3 : 0), z: hz + (into.dc ? 1.3 : 0), w: 0.6, d: 0.6, color: s.cls })
  }
  return out
}

export function roadPaint(view: WorldView): Paint[] {
  const out: Paint[] = []
  for (let r = 0; r < view.tiles.length; r++) {
    for (let c = 0; c < view.tiles[r].length; c++) {
      if (view.tiles[r][c] !== 'road') continue
      const x = cellX(c)
      const z = cellZ(r)
      for (const d of DIRS) {
        const t = tileAt(view, c + DIR_VEC[d].dc, r + DIR_VEC[d].dr)
        const v = DIR_VEC[d]
        if (t === 'road') {
          // One dash per half-link.
          out.push({
            x: x + v.dc * CELL * 0.3,
            z: z + v.dr * CELL * 0.3,
            w: v.dc ? 1.4 : 0.14,
            d: v.dr ? 1.4 : 0.14,
            color: 'white',
          })
        } else {
          out.push({
            x: x + v.dc * CELL * 0.42,
            z: z + v.dr * CELL * 0.42,
            w: v.dc ? 0.12 : CELL * 0.98,
            d: v.dr ? 0.12 : CELL * 0.98,
            color: 'white',
          })
        }
      }
    }
  }
  return out
}
