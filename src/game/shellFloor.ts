/**
 * Interior floor that follows the apron shell.
 * The original stamp keeps the 48×32 m hall. Cells added beside that stamp
 * append zone columns and rows at the same cell size, so the playable floor grows.
 */
import { HALL_D, HALL_W, type ZoneId } from './terminal.ts'
import type { PlacedItem } from './terminal.ts'
import type { Vec } from './types.ts'

export interface FloorExtra {
  /** Zone columns added to the left of the original hall box. */
  left: number
  right: number
  top: number
  bottom: number
  /** Column and row counts of the hall before any expansion. */
  baseCols: number
  baseRows: number
}

export interface ApronGrowth {
  left: number
  right: number
  top: number
  bottom: number
}

export function stampCells(premade: boolean): number {
  return premade ? 3 : 2
}

export function terminalCluster(tiles: readonly (readonly string[])[], seed: Vec): Vec[] | null {
  if (tiles[seed.r]?.[seed.c] !== 'terminal') return null
  const seen = new Set<string>()
  const out: Vec[] = []
  const stack: Vec[] = [seed]
  while (stack.length) {
    const p = stack.pop()!
    const key = `${p.c},${p.r}`
    if (seen.has(key)) continue
    if (tiles[p.r]?.[p.c] !== 'terminal') continue
    seen.add(key)
    out.push(p)
    stack.push(
      { c: p.c + 1, r: p.r },
      { c: p.c - 1, r: p.r },
      { c: p.c, r: p.r + 1 },
      { c: p.c, r: p.r - 1 },
    )
  }
  return out
}

/** Fits whose origin sits in the cluster the new cells would join. */
export function hallsTouched(
  tiles: readonly (readonly string[])[],
  cells: readonly Vec[],
  fits: readonly { origin: Vec }[],
): number[] {
  const extra = new Set(cells.map((p) => `${p.c},${p.r}`))
  const isTerm = (p: Vec) => extra.has(`${p.c},${p.r}`) || tiles[p.r]?.[p.c] === 'terminal'
  const seen = new Set<string>()
  const stack: Vec[] = [...cells]
  while (stack.length) {
    const p = stack.pop()!
    const key = `${p.c},${p.r}`
    if (seen.has(key) || !isTerm(p)) continue
    seen.add(key)
    stack.push(
      { c: p.c + 1, r: p.r },
      { c: p.c - 1, r: p.r },
      { c: p.c, r: p.r + 1 },
      { c: p.c, r: p.r - 1 },
    )
  }
  const hit: number[] = []
  fits.forEach((fit, index) => {
    if (seen.has(`${fit.origin.c},${fit.origin.r}`)) hit.push(index)
  })
  return hit
}

export function apronGrowth(
  origin: Vec,
  premade: boolean,
  cluster: { minC: number; maxC: number; minR: number; maxR: number },
): ApronGrowth {
  const n = stampCells(premade)
  return {
    left: Math.max(0, origin.c - cluster.minC),
    right: Math.max(0, cluster.maxC - (origin.c + n - 1)),
    top: Math.max(0, origin.r - cluster.minR),
    bottom: Math.max(0, cluster.maxR - (origin.r + n - 1)),
  }
}

/** Zone cells to add so each new apron cell keeps the original cell size. */
export function extraForGrowth(
  growth: ApronGrowth,
  baseCols: number,
  baseRows: number,
  premade: boolean,
): FloorExtra {
  const stamp = stampCells(premade)
  const perC = baseCols / stamp
  const perR = baseRows / stamp
  return {
    left: Math.round(growth.left * perC),
    right: Math.round(growth.right * perC),
    top: Math.round(growth.top * perR),
    bottom: Math.round(growth.bottom * perR),
    baseCols,
    baseRows,
  }
}

export function extraIdle(extra: FloorExtra | null | undefined): boolean {
  if (!extra) return true
  return extra.left + extra.right + extra.top + extra.bottom === 0
}

export function extraSame(a: FloorExtra | null | undefined, b: FloorExtra): boolean {
  if (!a) return extraIdle(b)
  return a.left === b.left && a.right === b.right && a.top === b.top && a.bottom === b.bottom
}

function blankRow<T>(cols: number): (T | null)[] {
  return Array.from({ length: cols }, () => null)
}

/** Insert the delta between two extras. Existing cells keep their neighbours; indexes shift. */
export function growZoneGrid(
  zones: (ZoneId | null)[][],
  items: PlacedItem[],
  prev: FloorExtra | null | undefined,
  next: FloorExtra,
): { zones: (ZoneId | null)[][]; items: PlacedItem[] } {
  const addL = next.left - (prev?.left ?? 0)
  const addR = next.right - (prev?.right ?? 0)
  const addT = next.top - (prev?.top ?? 0)
  const addB = next.bottom - (prev?.bottom ?? 0)
  let grid = zones.map((row) => row.slice())
  const placed = items.map((item) => ({ ...item }))
  if (addL > 0) {
    grid = grid.map((row) => [...blankRow<ZoneId>(addL), ...row])
    for (const item of placed) item.c += addL
  }
  if (addR > 0) grid = grid.map((row) => [...row, ...blankRow<ZoneId>(addR)])
  if (addT > 0) {
    const cols = grid[0]?.length ?? 0
    grid = [...Array.from({ length: addT }, () => blankRow<ZoneId>(cols)), ...grid]
    for (const item of placed) item.r += addT
  }
  if (addB > 0) {
    const cols = grid[0]?.length ?? 0
    grid = [...grid, ...Array.from({ length: addB }, () => blankRow<ZoneId>(cols))]
  }
  return { zones: grid, items: placed }
}

/**
 * Zone cell under a hall-metre point.
 * With no extra, this is the original 48×32 m mapping.
 * Added wings sit outside that box at the original cell size.
 */
export function cellInFloor(
  hx: number,
  hz: number,
  extra: FloorExtra | null | undefined,
  cols: number,
  rows: number,
): { c: number; r: number } {
  if (extraIdle(extra) || !extra) {
    return {
      c: Math.max(0, Math.min(cols - 1, Math.floor(((hx + HALL_W / 2) / HALL_W) * cols))),
      r: Math.max(0, Math.min(rows - 1, Math.floor(((hz + HALL_D / 2) / HALL_D) * rows))),
    }
  }
  const cw = HALL_W / extra.baseCols
  const rh = HALL_D / extra.baseRows
  const leftEdge = -HALL_W / 2 - extra.left * cw
  const topEdge = -HALL_D / 2 - extra.top * rh
  const width = (extra.left + extra.baseCols + extra.right) * cw
  const depth = (extra.top + extra.baseRows + extra.bottom) * rh
  const c = Math.floor((hx - leftEdge) / cw)
  const r = Math.floor((hz - topEdge) / rh)
  return {
    c: Math.max(0, Math.min(cols - 1, Number.isFinite(width) ? c : 0)),
    r: Math.max(0, Math.min(rows - 1, Number.isFinite(depth) ? r : 0)),
  }
}

/** Centre of a zone cell. Unexpanded halls match `cellCenter`. */
export function cellCenterInFloor(
  c: number,
  r: number,
  extra: FloorExtra | null | undefined,
  cols: number,
  rows: number,
): { x: number; z: number } {
  if (extraIdle(extra) || !extra) {
    const cw = HALL_W / Math.max(1, cols)
    const rh = HALL_D / Math.max(1, rows)
    return { x: -HALL_W / 2 + (c + 0.5) * cw, z: -HALL_D / 2 + (r + 0.5) * rh }
  }
  const cw = HALL_W / extra.baseCols
  const rh = HALL_D / extra.baseRows
  const leftEdge = -HALL_W / 2 - extra.left * cw
  const topEdge = -HALL_D / 2 - extra.top * rh
  return { x: leftEdge + (c + 0.5) * cw, z: topEdge + (r + 0.5) * rh }
}
