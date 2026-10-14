/**
 * Tip chips. Pure: a snapshot of the field goes in, the chips that should
 * exist come out. Rendering never decides that a player is stuck.
 *
 * Each id is shown at most once. Dismissing it, or the problem clearing,
 * spends that id for the rest of the save. The settings toggle only hides
 * them; it does not spend an id the player has not finished.
 */
import type { Tile, Vec } from './types.ts'
import {
  TIP_CASH,
  TIP_COPY,
  TIP_HALL_QUEUE,
  TIP_MAX_OPEN,
  TIP_QUEUE_SEC,
  type TipCopy,
} from './tipsData.ts'

export interface TipCell {
  c: number
  r: number
}

export type TipAnchor =
  | { kind: 'hud'; slot: 'cash' | 'build' }
  | { kind: 'world'; cell: TipCell }

export interface TipOffer {
  id: string
  title: string
  text: string
  anchor: TipAnchor
}

export interface TipWorld {
  /** No plot yet — nothing is stuck. */
  site: boolean
  sandbox: boolean
  cash: number
  hasRunway: boolean
  stands: number
  /** Taxi or stand cells touching the strip. */
  exits: number
  /** Stands that cannot path onto a strip. */
  orphans: number
  queueWait: number
  queueCount: number
  hallQueue: number
  fuelEmpty: boolean
  stuck: boolean
  runwayCell: TipCell | null
  queueCell: TipCell | null
  hallCell: TipCell | null
  fuelCell: TipCell | null
  stuckCell: TipCell | null
}

export interface TipBook {
  enabled: boolean
  /** Ids that have already had their one appearance. */
  spent: string[]
  /** Ids on screen right now. */
  open: string[]
}

const COPY = new Map<string, TipCopy>(TIP_COPY.map((row) => [row.id, row]))

export function newTipBook(enabled = true): TipBook {
  return { enabled, spent: [], open: [] }
}

export function sanitizeTipBook(raw: unknown): TipBook {
  if (!raw || typeof raw !== 'object') return newTipBook()
  const r = raw as Partial<TipBook>
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return { enabled: r.enabled !== false, spent: ids(r.spent), open: ids(r.open) }
}

export function setTipsEnabled(book: TipBook, on: boolean): TipBook {
  return { ...book, enabled: on }
}

export function dismissTip(book: TipBook, id: string): TipBook {
  return {
    enabled: book.enabled,
    open: book.open.filter((x) => x !== id),
    spent: book.spent.includes(id) ? book.spent : [...book.spent, id],
  }
}

function offer(id: string, anchor: TipAnchor): TipOffer | null {
  const copy = COPY.get(id)
  if (!copy) return null
  return { id, title: copy.title, text: copy.text, anchor }
}

function worldAnchor(cell: TipCell | null, fallback: TipAnchor): TipAnchor {
  return cell ? { kind: 'world', cell } : fallback
}

/** Which stuck states are true right now, in display order. */
export function evaluateTips(world: TipWorld): TipOffer[] {
  if (!world.site) return []
  const out: TipOffer[] = []
  const push = (row: TipOffer | null) => {
    if (row) out.push(row)
  }
  if (world.hasRunway && world.stands === 0) {
    push(offer('no-stand', { kind: 'hud', slot: 'build' }))
  }
  if (!world.hasRunway && world.stands > 0) {
    push(offer('no-runway', { kind: 'hud', slot: 'build' }))
  }
  if (world.hasRunway && world.stands > 0 && (world.exits === 0 || world.orphans >= world.stands)) {
    push(offer('no-runway-exit', worldAnchor(world.runwayCell, { kind: 'hud', slot: 'build' })))
  }
  if (world.queueCount > 0 && world.queueWait >= TIP_QUEUE_SEC) {
    push(offer('queue-backing-up', worldAnchor(world.queueCell, { kind: 'hud', slot: 'build' })))
  }
  if (world.hallQueue >= TIP_HALL_QUEUE) {
    push(offer('hall-queue', worldAnchor(world.hallCell, { kind: 'hud', slot: 'build' })))
  }
  if (!world.sandbox && world.cash < TIP_CASH) {
    push(offer('out-of-cash', { kind: 'hud', slot: 'cash' }))
  }
  if (world.stuck) {
    push(offer('taxi-stuck', worldAnchor(world.stuckCell, { kind: 'hud', slot: 'build' })))
  }
  if (world.fuelEmpty) {
    push(offer('fuel-dry', worldAnchor(world.fuelCell, { kind: 'hud', slot: 'build' })))
  }
  return out
}

/**
 * Advance the once-only book. A chip that leaves the field is spent.
 * While the toggle is off, nothing new opens and nothing is spent.
 */
export function stepTips(book: TipBook, live: readonly TipOffer[]): { book: TipBook; visible: TipOffer[] } {
  const liveIds = new Set(live.map((t) => t.id))
  const spent = new Set(book.spent)
  const open: string[] = []
  for (const id of book.open) {
    if (spent.has(id)) continue
    if (!book.enabled) {
      open.push(id)
      continue
    }
    if (!liveIds.has(id)) {
      spent.add(id)
      continue
    }
    open.push(id)
  }
  if (book.enabled) {
    for (const tip of live) {
      if (open.length >= TIP_MAX_OPEN) break
      if (spent.has(tip.id) || open.includes(tip.id)) continue
      open.push(tip.id)
    }
  }
  const visible = book.enabled ? live.filter((t) => open.includes(t.id)) : []
  const next: TipBook = { enabled: book.enabled, spent: [...spent], open }
  return { book: next, visible }
}

const EXIT_TILE: ReadonlySet<Tile> = new Set(['taxi', 'stand'])

/** Taxi or stand cells that touch the strip. That is a runway exit. */
export function runwayExitCells(tiles: Tile[][]): Vec[] {
  const out: Vec[] = []
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const tile = row[c]
      if (!tile || !EXIT_TILE.has(tile)) continue
      const n =
        tiles[r - 1]?.[c] === 'runway' ||
        tiles[r + 1]?.[c] === 'runway' ||
        row[c - 1] === 'runway' ||
        row[c + 1] === 'runway'
      if (n) out.push({ c, r })
    }
  }
  return out
}
