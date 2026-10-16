/**
 * Arrival-side helpers for the stage graph.
 * Sterile claim cells carry ARR and never AIR or LANE. Passport is a stop
 * only when the flight is international. Claim can wait on a bag sequence.
 */
import { outsideDoors, edgeTiles } from '../terminalbuild/grid.ts'
import type { BuildLayout, Door } from '../terminalbuild/types.ts'
import { PAXNAV_TUNING } from './config.ts'
import { ARR, tileOfCell, type NavGrid } from './grid.ts'
import { arrivalStops, noteStage, type StageTrace, emptyTrace } from './stages.ts'

const OPEN_E = 1
const OPEN_S = 2

export function claimZoneKeys(layout: BuildLayout): Set<string> {
  const keys = new Set<string>()
  for (let y = 0; y < layout.h; y++) {
    for (let x = 0; x < layout.w; x++) {
      const z = layout.zones[y]?.[x]
      if (z === 'claim' || z === 'arrivals') keys.add(`${x},${y}`)
    }
  }
  return keys
}

/** True when this hall has a sterile claim or arrivals zone (the split starter). */
export function sterileHall(layout: BuildLayout): boolean {
  return claimZoneKeys(layout).size > 0
}

/**
 * Claim and arrivals tiles that the departure grid left empty, or that the
 * arrival layout painted as either-side floor, become ARR only.
 * Exit doors between that floor and landside open so arrivals can leave.
 */
export function paintSterileArrivals(g: NavGrid, claimKeys: ReadonlySet<string>): void {
  if (!claimKeys.size) return
  for (let c = 0; c < g.mask.length; c++) {
    const t = tileOfCell(g, c)
    if (!claimKeys.has(`${t.x},${t.y}`)) continue
    if (g.mask[c]) g.mask[c] = ARR
  }
  for (const door of g.layout.doors) {
    if (door.kind !== 'exit') continue
    openDoorEdge(g, door)
  }
}

function openDoorEdge(g: NavGrid, door: Door) {
  const [a, b] = edgeTiles(door)
  const k = g.k
  const m = g.margin
  if (door.dir === 'S') {
    const ay = (a.y + m) * k + (k - 1)
    const by = (b.y + m) * k
    const x0 = (a.x + m) * k
    if (ay < 0 || by >= g.gh) return
    for (let i = 0; i < k; i++) {
      const ca = ay * g.gw + x0 + i
      const cb = by * g.gw + x0 + i
      if (ca < 0 || cb < 0 || ca >= g.mask.length || cb >= g.mask.length) continue
      if (!g.mask[ca] || !g.mask[cb]) continue
      g.open[ca] |= OPEN_S
    }
    return
  }
  const ax = (a.x + m) * k + (k - 1)
  const bx = (b.x + m) * k
  const y0 = (a.y + m) * k
  for (let i = 0; i < k; i++) {
    const ca = (y0 + i) * g.gw + ax
    const cb = (y0 + i) * g.gw + bx
    if (ca < 0 || cb < 0 || ca >= g.mask.length || cb >= g.mask.length) continue
    if ((ca % g.gw) >= g.gw - 1) continue
    if (!g.mask[ca] || !g.mask[cb]) continue
    g.open[ca] |= OPEN_E
  }
}

export function freshJourney(opts: { intl: boolean; bags: boolean; needs: readonly ('toilet' | 'shop')[] }): {
  stops: ReturnType<typeof arrivalStops>['stops']
  trace: StageTrace
} {
  const planned = arrivalStops(opts)
  const trace = emptyTrace()
  noteStage(trace, 'DEPLANE')
  noteStage(trace, 'ARR_CORRIDOR')
  for (const skip of planned.skips) noteStage(trace, skip.stage, skip.reason)
  return { stops: planned.stops, trace }
}

/** Inside cells of an arrivals door on the sterile layer. */
export function arrivalsDoorCells(g: NavGrid): number[] {
  const doors = outsideDoors(g.layout, ['arrivals_in'])
  const out: number[] = []
  const span = g.tileM <= 1 ? g.k : PAXNAV_TUNING.doorCells
  const lo = Math.floor((g.k - span) / 2)
  for (const { door, tile } of doors) {
    const ox = (tile.x + g.margin) * g.k
    const oy = (tile.y + g.margin) * g.k
    const east = door.dir === 'E' && door.x === tile.x
    const west = door.dir === 'E' && door.x !== tile.x
    const south = door.dir === 'S' && door.y === tile.y
    for (let i = lo; i < lo + span; i++) {
      const cx = east ? ox + g.k - 1 : west ? ox : ox + i
      const cy = south ? oy + g.k - 1 : door.dir === 'S' ? oy : oy + i
      const c = cy * g.gw + cx
      if (c >= 0 && c < g.mask.length && g.mask[c] & ARR) out.push(c)
    }
  }
  return out
}
