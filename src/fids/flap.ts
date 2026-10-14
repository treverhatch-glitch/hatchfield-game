import { COLUMNS, FLIP_SEC, GLYPHS, type ColumnKey } from './config'
import type { BoardKind, BoardSnapshot } from './types'

export interface FlapCell {
  shown: string
  target: string
  /** 0 at rest. Approaches 1 while the current leaf is falling. */
  anim: number
}

export interface FlapRowState {
  id: string
  cells: Record<ColumnKey, FlapCell>
}

export interface FlapState {
  clock: string
  airportName: string
  departures: FlapRowState[]
  arrivals: FlapRowState[]
}

export function fitFlap(text: string, width: number): string {
  const clean = text.toUpperCase().replace(/[^A-Z0-9:·.\- ]/g, ' ')
  return clean.slice(0, width).padEnd(width, ' ')
}

export function stepGlyph(current: string, target: string): string {
  if (current === target) return current
  const at = GLYPHS.indexOf(current)
  return GLYPHS[(at < 0 ? 0 : at + 1) % GLYPHS.length] ?? ' '
}

export function nextGlyphs(shown: string, target: string): string {
  let out = ''
  for (let i = 0; i < shown.length; i++) out += stepGlyph(shown[i] ?? ' ', target[i] ?? ' ')
  return out
}

export function blankFlaps(): FlapState {
  return { clock: '', airportName: '', departures: [], arrivals: [] }
}

function blankCell(width: number): FlapCell {
  const empty = ' '.repeat(width)
  return { shown: empty, target: empty, anim: 0 }
}

function cellsFor(row: BoardSnapshot['departures'][number], prev: FlapRowState | undefined): Record<ColumnKey, FlapCell> {
  const cells = {} as Record<ColumnKey, FlapCell>
  for (const col of COLUMNS) {
    const target = fitFlap(row[col.key], col.width)
    const prior = prev?.cells[col.key] ?? blankCell(col.width)
    cells[col.key] = {
      shown: prior.shown,
      target,
      anim: prior.target === target ? prior.anim : 0,
    }
  }
  return cells
}

function advanceCell(cell: FlapCell, dt: number): { cell: FlapCell; moved: boolean } {
  if (cell.shown === cell.target && cell.anim === 0) return { cell, moved: false }
  let shown = cell.shown
  let anim = cell.anim
  let left = dt
  let moved = false
  if (anim > 0 && shown !== cell.target) {
    const need = (1 - anim) * FLIP_SEC
    if (left < need) return { cell: { ...cell, anim: anim + left / FLIP_SEC }, moved: true }
    left -= need
    shown = nextGlyphs(shown, cell.target)
    anim = 0
    moved = true
  }
  while (left > 0 && shown !== cell.target) {
    if (left < FLIP_SEC) return { cell: { ...cell, shown, anim: left / FLIP_SEC }, moved: true }
    left -= FLIP_SEC
    shown = nextGlyphs(shown, cell.target)
    moved = true
  }
  return { cell: { ...cell, shown, anim: 0 }, moved }
}

function stepRows(prev: FlapRowState[], rows: BoardSnapshot['departures'], dt: number): { rows: FlapRowState[]; dirty: boolean } {
  let dirty = prev.length !== rows.length
  const byId = new Map(prev.map((row) => [row.id, row]))
  const next: FlapRowState[] = []
  for (const row of rows) {
    const prior = byId.get(row.id)
    if (!prior) dirty = true
    const built = cellsFor(row, prior)
    const cells = {} as Record<ColumnKey, FlapCell>
    for (const col of COLUMNS) {
      const stepped = advanceCell(built[col.key], dt)
      cells[col.key] = stepped.cell
      if (stepped.moved) dirty = true
    }
    if (prior && COLUMNS.some((col) => prior.cells[col.key].target !== cells[col.key].target)) dirty = true
    next.push({ id: row.id, cells })
  }
  if (!dirty && prev.some((row, i) => row.id !== next[i]?.id)) dirty = true
  return { rows: next, dirty }
}

/** Advance every flap toward the snapshot. Large `dt` settles the board. */
export function stepFlaps(state: FlapState, snapshot: BoardSnapshot, dt: number): { state: FlapState; dirty: boolean } {
  const departures = stepRows(state.departures, snapshot.departures, dt)
  const arrivals = stepRows(state.arrivals, snapshot.arrivals, dt)
  const clockChanged = state.clock !== snapshot.clock || state.airportName !== snapshot.airportName
  return {
    state: {
      clock: snapshot.clock,
      airportName: snapshot.airportName,
      departures: departures.rows,
      arrivals: arrivals.rows,
    },
    dirty: clockChanged || departures.dirty || arrivals.dirty,
  }
}

export function settleFlaps(snapshot: BoardSnapshot): FlapState {
  return stepFlaps(blankFlaps(), snapshot, 10_000).state
}

export function flapKind(state: FlapState, kind: BoardKind): FlapRowState[] {
  return kind === 'departures' ? state.departures : state.arrivals
}
