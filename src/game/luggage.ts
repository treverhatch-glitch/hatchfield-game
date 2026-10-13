import type { BagFlowStage } from './types.ts'

/**
 * One book per flight. Suitcases stay as units, not pathfinding agents.
 * The hall and apron draw a capped parade from these counters.
 */
export interface BagBook {
  flightId: string
  units: number
  dropped: number
  screened: number
  sorted: number
  loaded: number
  unloaded: number
  onClaim: number
  claimed: number
  lost: number
  /** Seconds the current drop has sat in the hold-bag scanner. */
  screenT: number
}

export interface LuggageMotion {
  belt: boolean
  screen: boolean
  carousel: boolean
  sort: boolean
  phase: number
}

export function freshBook(flightId: string, units: number): BagBook {
  return {
    flightId,
    units: Math.max(0, units),
    dropped: 0,
    screened: 0,
    sorted: 0,
    loaded: 0,
    unloaded: 0,
    onClaim: 0,
    claimed: 0,
    lost: 0,
    screenT: 0,
  }
}

const SCREEN_WAIT = 1.1

/**
 * Hold-bag screening. Prefabs always pass. A custom hall with a bag building
 * or a belt also passes. A custom hall with neither loses the unscreened drop.
 */
export function advanceScreen(
  book: BagBook,
  dt: number,
  opts: { prefab: boolean; hallReady: boolean },
): 'wait' | 'pass' | 'lose' {
  if (book.dropped <= 0) return 'wait'
  if (book.screened >= book.dropped && book.lost === 0) return 'pass'
  book.screenT += dt
  if (book.screenT < SCREEN_WAIT) return 'wait'
  if (opts.prefab || opts.hallReady) {
    book.screened = book.dropped
    if (opts.prefab) book.lost = 0
    return 'pass'
  }
  const miss = Math.max(0, book.dropped - book.screened)
  book.lost += miss
  book.screened = book.dropped
  return 'lose'
}

const PAST_SCREEN = new Set<BagFlowStage>([
  'outbound_sort',
  'load_aircraft',
  'inflight',
  'unload_aircraft',
  'inbound_sort',
  'deliver_claim',
  'on_claim',
  'complete',
])

const INBOUND = new Set<BagFlowStage>([
  'unload_aircraft',
  'inbound_sort',
  'deliver_claim',
  'on_claim',
  'complete',
])

/**
 * Prefab bags are never lost. Later stages fill from what was dropped,
 * and an inbound claim fills from the flight's units, so a skipped cart
 * cannot erase a suitcase.
 */
export function keepPrefabBags(book: BagBook, stage: BagFlowStage | undefined): void {
  book.lost = 0
  book.units = Math.max(book.units, book.dropped)
  if (!stage || stage === 'hold_screen' || !PAST_SCREEN.has(stage)) return
  book.screened = Math.max(book.screened, book.dropped)
  book.sorted = Math.max(book.sorted, book.screened)
  if (
    stage === 'load_aircraft' ||
    stage === 'inflight' ||
    INBOUND.has(stage)
  ) {
    book.loaded = Math.max(book.loaded, book.sorted)
  }
  if (INBOUND.has(stage)) {
    book.unloaded = Math.max(book.unloaded, book.units)
    book.loaded = Math.max(book.loaded, book.unloaded)
  }
  if (stage === 'on_claim' || stage === 'complete') {
    book.onClaim = Math.max(book.onClaim, book.unloaded)
  }
  if (stage === 'complete') {
    book.claimed = Math.max(book.claimed, book.onClaim)
    book.lost = 0
  }
}
