/**
 * Lane geometry for the public road, in metres.
 *
 * The route is one loop: the city edge, along the approach and past the
 * curb, a U-turn in the last paved cell (or off the map edge when the road
 * goes through), then back along the same cells. Every lane is the loop
 * centreline offset toward the side traffic keeps, so one sample index
 * means the same place in every lane.
 */
import { LANDSIDE } from './config.ts'
import { onMapBorder } from './network.ts'
import type { Cell, Network } from './types.ts'

interface Vec2 {
  x: number
  y: number
}

interface Line {
  kind: 'line'
  from: Vec2
  dir: Vec2
  len: number
}

interface Arc {
  kind: 'arc'
  centre: Vec2
  /** Start radius vector, from the centre. */
  start: Vec2
  /** Tangent at the start. */
  tangent: Vec2
  sign: number
  radius: number
  len: number
}

type Piece = Line | Arc

export interface SpineCell {
  cell: Cell
  /** Centreline metres from the start of the loop to this cell's centre. */
  station: number
  /** Unit direction of travel through the cell on the way in. */
  dir: Vec2
  /** True where the road turns inside this cell. */
  corner: boolean
}

export interface LaneGeometry {
  count: number
  /** Centreline point per sample, metres (x is columns, y is rows). */
  px: Float64Array
  py: Float64Array
  /** Unit normal toward the side traffic keeps. */
  nx: Float64Array
  ny: Float64Array
  /** Lateral offset of each lane, metres. Through lanes inner first, then the layby. */
  lat: number[]
  /** Metres along each lane at every sample. */
  cum: Float64Array[]
  /** Lane next to the layby. Stalls are reached from this lane. */
  curbLane: number
  layby: number
  /** Last sample of the outbound half. The U-turn starts here. */
  forwardEnd: number
  /** First sample of the return half, or -1 when the road leaves at the map edge. */
  backStart: number
  /** Centreline metres per outbound sample. */
  step: number
  cells: SpineCell[]
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

function add(a: Vec2, b: Vec2, k = 1): Vec2 {
  return { x: a.x + b.x * k, y: a.y + b.y * k }
}

function unit(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y)
  return len > 1e-9 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 }
}

/** Rotate by `angle`. +90° turns south into west: the right-hand side of travel, rows growing south. */
function rot(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

/** +1 when traffic keeps right. */
export function sideSign(): number {
  return LANDSIDE.drivingSide === 'left' ? -1 : 1
}

/** Lateral offsets: through lanes from the median outward, then the layby. */
export function laneOffsets(): number[] {
  const half = LANDSIDE.medianM / 2
  const out: number[] = []
  for (let k = 0; k < LANDSIDE.lanesEachWay; k++) out.push(half + LANDSIDE.laneWidthM * (k + 0.5))
  out.push(half + LANDSIDE.laneWidthM * LANDSIDE.lanesEachWay + LANDSIDE.laybyWidthM / 2)
  return out
}

function at(cell: Cell): Vec2 {
  return { x: cell.c * LANDSIDE.cellM, y: cell.r * LANDSIDE.cellM }
}

function evalPiece(piece: Piece, s: number): { p: Vec2; t: Vec2 } {
  if (piece.kind === 'line') return { p: add(piece.from, piece.dir, s), t: piece.dir }
  const angle = (s / piece.radius) * piece.sign
  return { p: add(piece.centre, rot(piece.start, angle)), t: rot(piece.tangent, angle) }
}

export function buildLanes(net: Network): LaneGeometry | null {
  if (net.path.length < 2 || net.exit.length < 1) return null
  const cells = [...net.path, ...net.exit.slice(1)]
  if (cells.length < 2) return null
  const half = LANDSIDE.cellM / 2
  const pts: Vec2[] = cells.map(at)
  const first = unit(sub(pts[1], pts[0]))
  const last = unit(sub(pts[pts.length - 1], pts[pts.length - 2]))
  const behind = { c: cells[0].c - Math.round(first.x), r: cells[0].r - Math.round(first.y) }
  const lead = onMapBorder(cells[0]) && (behind.c < 0 || behind.r < 0 || behind.c > 31 || behind.r > 31)
  const verts: Vec2[] = [...pts]
  if (lead) verts.unshift(add(pts[0], first, -half))
  if (net.edgeExit) verts.push(add(pts[pts.length - 1], last, half))
  const cellOffset = lead ? 1 : 0

  const pieces: Piece[] = []
  const stations: number[] = new Array(verts.length).fill(0)
  const corners: boolean[] = new Array(verts.length).fill(false)
  let cur = verts[0]
  let length = 0
  const pushLine = (to: Vec2) => {
    const d = sub(to, cur)
    const len = Math.hypot(d.x, d.y)
    if (len > 1e-9) pieces.push({ kind: 'line', from: cur, dir: unit(d), len })
    length += len
    cur = to
  }
  for (let i = 1; i < verts.length - 1; i++) {
    const a = unit(sub(verts[i], verts[i - 1]))
    const b = unit(sub(verts[i + 1], verts[i]))
    const cross = a.x * b.y - a.y * b.x
    if (Math.abs(cross) < 1e-9) {
      pushLine(verts[i])
      stations[i] = length
      continue
    }
    const startPt = add(verts[i], a, -half)
    pushLine(startPt)
    const centre = add(startPt, b, half)
    const len = (Math.PI / 2) * half
    pieces.push({ kind: 'arc', centre, start: sub(startPt, centre), tangent: a, sign: Math.sign(cross), radius: half, len })
    stations[i] = length + len / 2
    corners[i] = true
    length += len
    cur = add(verts[i], b, half)
  }
  pushLine(verts[verts.length - 1])
  stations[verts.length - 1] = length

  const forwardCount = Math.max(2, Math.ceil(length / 1) + 1)
  const step = length / (forwardCount - 1)
  const fp: Vec2[] = []
  const ft: Vec2[] = []
  let pieceIdx = 0
  let pieceStart = 0
  for (let i = 0; i < forwardCount; i++) {
    const s = Math.min(length, i * step)
    while (pieceIdx < pieces.length - 1 && s > pieceStart + pieces[pieceIdx].len) {
      pieceStart += pieces[pieceIdx].len
      pieceIdx++
    }
    const piece = pieces[pieceIdx]
    const local = Math.max(0, Math.min(piece.len, s - pieceStart))
    const { p, t } = evalPiece(piece, local)
    fp.push(p)
    ft.push(t)
  }

  const sign = sideSign()
  const lat = laneOffsets()
  const curbLane = LANDSIDE.lanesEachWay - 1
  const turn = !net.edgeExit
  // The semicircle sits this far short of the kerb so a bus body stays on the asphalt.
  const insetSamples = turn ? Math.min(forwardCount - 2, Math.max(0, Math.round(LANDSIDE.loopInsetM / step))) : 0
  const kept = forwardCount - insetSamples
  const turnSteps = turn ? Math.max(8, Math.ceil(Math.PI * lat[curbLane])) : 0
  const count = turn ? kept * 2 + turnSteps - 1 : forwardCount
  const px = new Float64Array(count)
  const py = new Float64Array(count)
  const nx = new Float64Array(count)
  const ny = new Float64Array(count)
  const put = (i: number, p: Vec2, t: Vec2) => {
    const n = rot(t, (sign * Math.PI) / 2)
    px[i] = p.x
    py[i] = p.y
    nx[i] = n.x
    ny[i] = n.y
  }
  for (let i = 0; i < kept; i++) put(i, fp[i], ft[i])
  if (turn) {
    const o = fp[kept - 1]
    const t0 = ft[kept - 1]
    for (let j = 1; j < turnSteps; j++) put(kept - 1 + j, o, rot(t0, -sign * (Math.PI * j) / turnSteps))
    const backStart = kept - 1 + turnSteps
    for (let j = 0; j < kept; j++) {
      const src = kept - 1 - j
      put(backStart + j, fp[src], { x: -ft[src].x, y: -ft[src].y })
    }
  }

  const cum = lat.map((off) => {
    const out = new Float64Array(count)
    for (let i = 1; i < count; i++) {
      const dx = px[i] + nx[i] * off - (px[i - 1] + nx[i - 1] * off)
      const dy = py[i] + ny[i] * off - (py[i - 1] + ny[i - 1] * off)
      out[i] = out[i - 1] + Math.hypot(dx, dy)
    }
    return out
  })

  const spine: SpineCell[] = cells.map((cell, j) => {
    const v = j + cellOffset
    const dir = j > 0 ? unit(sub(pts[j], pts[j - 1])) : first
    return { cell, station: stations[v], dir, corner: corners[v] }
  })

  return {
    count,
    px,
    py,
    nx,
    ny,
    lat,
    cum,
    curbLane,
    layby: lat.length - 1,
    forwardEnd: kept - 1,
    backStart: turn ? kept - 1 + turnSteps : -1,
    step,
    cells: spine,
  }
}

/**
 * Sample index of a point `along` metres past a spine cell's centre, in the
 * direction of travel on that half. `back` is the return half after the U-turn.
 */
export function indexAt(geo: LaneGeometry, spineIdx: number, along: number, back: boolean): number {
  const station = geo.cells[spineIdx].station
  if (!back) return clampIndex(geo, (station + along) / geo.step)
  if (geo.backStart < 0) return -1
  return clampIndex(geo, geo.backStart + geo.forwardEnd - (station - along) / geo.step)
}

function clampIndex(geo: LaneGeometry, x: number): number {
  return Math.max(0, Math.min(geo.count - 1, x))
}

/** Metres along `lane` at fractional sample `x`. */
export function laneMetres(geo: LaneGeometry, lane: number, x: number): number {
  const cum = geo.cum[lane]
  const cx = clampIndex(geo, x)
  const i = Math.min(geo.count - 2, Math.floor(cx))
  const t = cx - i
  return cum[i] + (cum[i + 1] - cum[i]) * t
}

/** Fractional sample where `lane` has run `metres`. */
export function indexAtMetres(geo: LaneGeometry, lane: number, metres: number): number {
  const cum = geo.cum[lane]
  if (metres <= 0) return 0
  if (metres >= cum[geo.count - 1]) return geo.count - 1
  let lo = 0
  let hi = geo.count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= metres) lo = mid
    else hi = mid
  }
  const span = cum[hi] - cum[lo]
  return lo + (span > 1e-9 ? (metres - cum[lo]) / span : 0)
}

/** Point at sample `x`, `lat` metres toward the side traffic keeps. Metres. */
export function pointAt(geo: LaneGeometry, x: number, lat: number): Vec2 {
  const cx = clampIndex(geo, x)
  const i = Math.min(geo.count - 2, Math.floor(cx))
  const t = cx - i
  const pxv = geo.px[i] + (geo.px[i + 1] - geo.px[i]) * t
  const pyv = geo.py[i] + (geo.py[i + 1] - geo.py[i]) * t
  const n = unit({ x: geo.nx[i] + (geo.nx[i + 1] - geo.nx[i]) * t, y: geo.ny[i] + (geo.ny[i + 1] - geo.ny[i]) * t })
  return { x: pxv + n.x * lat, y: pyv + n.y * lat }
}

/** Heading of travel at sample `x` in a lane `lat` metres off the centre, radians (atan2 of rows over columns). */
export function headingAt(geo: LaneGeometry, x: number, lat: number): number {
  const cx = clampIndex(geo, x)
  const i = Math.min(geo.count - 2, Math.floor(cx))
  const a = pointAt(geo, i, lat)
  const b = pointAt(geo, i + 1, lat)
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/**
 * Through lanes other than the curb lane end at the U-turn: their radius is
 * too tight for a car. They reopen on the return half.
 */
export function laneOpenAt(geo: LaneGeometry, lane: number, x: number): boolean {
  if (lane >= geo.curbLane || geo.backStart < 0) return true
  return x <= geo.forwardEnd || x >= geo.backStart
}
