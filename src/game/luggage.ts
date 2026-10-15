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
  /** Outbound units that never made the aircraft. */
  offloaded: number
  /** Inbound units that did not fit the claim hall. */
  claimLeft: number
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
  const safeUnits = Number.isFinite(units) ? Math.max(0, units) : 0
  return {
    flightId,
    units: safeUnits,
    dropped: 0,
    screened: 0,
    sorted: 0,
    loaded: 0,
    unloaded: 0,
    onClaim: 0,
    claimed: 0,
    lost: 0,
    offloaded: 0,
    claimLeft: 0,
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
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0
  book.screenT += safeDt
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
/** One checked bag. A record, not an agent. */
export type BagKind = 'out' | 'in' | 'transfer'

export interface BagTag {
  id: string
  ownerPassengerId: string
  flightId: string
  /** Onward flight for a transfer bag. Null when the owner is ending here. */
  connectFlightId: string | null
  /** out leaves on this flight, in is reclaimed here, transfer follows a connection. */
  kind: BagKind
  onClaim: boolean
  picked: boolean
  loaded: boolean
  fault: 'late' | 'missed_connection' | null
  /** Seconds since this bag's flight reached the carousel. */
  wait: number
  /** Stagger so each owner collects their own bags, not the whole flight at once. */
  releaseAt: number
}

/**
 * How long a tag stays after its passenger and both flights have left.
 * A connection check still reads the record once the guest has walked out.
 * Past this, a long soak does not keep every suitcase from the first day.
 */
export const BAG_RECORD_SEC = 1200

/** How many checked bags this passenger type drops. One record each. */
export function checkedPieceCount(tag: 'budget' | 'business' | 'family' | 'premium'): number {
  return tag === 'premium' || tag === 'family' ? 2 : 1
}

/** Stable 0–2.4s so the same passenger always waits the same length. */
export function releaseDelay(ownerPassengerId: string): number {
  let h = 0
  const safeId = ownerPassengerId ?? ''
  for (let i = 0; i < safeId.length; i++) {
    h = (h * 33 + safeId.charCodeAt(i)) >>> 0
  }
  return (h % 5) * 0.6
}

export function makeBagTag(
  ownerPassengerId: string,
  flightId: string,
  index: number,
  connectFlightId: string | null,
  kind: BagKind,
): BagTag {
  const safeIndex = Number.isFinite(index) ? index : 0
  return {
    id: `${ownerPassengerId}:${flightId}:${safeIndex}:${kind}`,
    ownerPassengerId,
    flightId,
    connectFlightId,
    kind,
    onClaim: false,
    picked: false,
    loaded: false,
    fault: null,
    wait: 0,
    releaseAt: releaseDelay(ownerPassengerId),
  }
}

/** True when every inbound bag for this passenger is on the belt or already picked up. */
export function ownerClaimReady(tags: readonly BagTag[], ownerId: string): boolean {
  const mine = tags.filter((t) => t.ownerPassengerId === ownerId && t.kind === 'in')
  return mine.length > 0 && mine.every((t) => t.onClaim || t.picked)
}

const INBOUND_READY = new Set<BagFlowStage>([
  'unload_aircraft',
  'inbound_sort',
  'deliver_claim',
  'on_claim',
  'complete',
  'inflight',
])

export interface TagClock {
  prefab: boolean
  /** Normal load. An overloaded prefab may mishandle a missed connection. */
  normal: boolean
  departed: (flightId: string) => boolean
  stage: (flightId: string) => BagFlowStage | undefined
}

/**
 * Move tags with their flight. Transfer tags retarget onto the connecting
 * flight. A connection that has already pushed is a missed bag unless this
 * is a prefab under normal load. Returns how many tags were newly mishandled.
 */
export function advanceBagTags(tags: BagTag[], dt: number, clock: TagClock): number {
  let fresh = 0
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0
  for (const tag of tags) {
    if (tag.picked || tag.fault) continue
    if (tag.kind === 'transfer' && tag.connectFlightId && tag.flightId !== tag.connectFlightId) {
      const stage = clock.stage(tag.flightId)
      const ready = stage == null || INBOUND_READY.has(stage)
      if (!ready) continue
      if (clock.departed(tag.connectFlightId) && !(clock.prefab && clock.normal)) {
        tag.fault = 'missed_connection'
        fresh += 1
        continue
      }
      tag.flightId = tag.connectFlightId
      tag.loaded = true
      continue
    }
    if (tag.kind === 'transfer') continue
    const stage = clock.stage(tag.flightId)
    if (tag.kind === 'out') {
      if (stage === 'load_aircraft' || stage === 'inflight' || stage === 'complete') tag.loaded = true
      continue
    }
    if (stage === 'on_claim' || stage === 'complete') {
      tag.wait += safeDt
      if (tag.wait >= tag.releaseAt) tag.onClaim = true
    }
  }
  return fresh
}

/** Seconds at the carousel before a missing bag is late. Prefabs under normal load never trip this. */
export const CLAIM_LATE_SEC = 22

/**
 * Mark this owner's bags late when the carousel has not produced them.
 * Prefab halls under normal load stay clean. Returns the tags just marked.
 */
export function markClaimLate(
  tags: BagTag[],
  ownerId: string,
  waited: number,
  opts: { prefab: boolean; normal: boolean },
): BagTag[] {
  if (opts.prefab && opts.normal) return []
  if (!Number.isFinite(waited) || waited < CLAIM_LATE_SEC) return []
  const mine = tags.filter(
    (t) =>
      t.ownerPassengerId === ownerId &&
      t.kind === 'in' &&
      !t.picked &&
      !t.onClaim &&
      !t.fault,
  )
  for (const tag of mine) tag.fault = 'late'
  return mine
}

export function keepPrefabBags(book: BagBook, stage: BagFlowStage | undefined): void {
  book.lost = 0
  book.units = Number.isFinite(book.units) ? Math.max(0, book.units) : 0
  book.dropped = Number.isFinite(book.dropped) ? Math.max(0, book.dropped) : 0
  book.units = Math.max(book.units, book.dropped)
  if (!stage || stage === 'hold_screen' || !PAST_SCREEN.has(stage)) return
  book.screened = Math.max(Number.isFinite(book.screened) ? book.screened : 0, book.dropped)
  book.sorted = Math.max(Number.isFinite(book.sorted) ? book.sorted : 0, book.screened)
  book.offloaded = Number.isFinite(book.offloaded) ? Math.max(0, book.offloaded) : 0
  const aboard = Math.max(0, book.sorted - book.offloaded)
  if (
    stage === 'load_aircraft' ||
    stage === 'inflight' ||
    INBOUND.has(stage)
  ) {
    book.loaded = Math.max(Number.isFinite(book.loaded) ? book.loaded : 0, aboard)
  }
  if (INBOUND.has(stage)) {
    book.claimLeft = Number.isFinite(book.claimLeft) ? Math.max(0, book.claimLeft) : 0
    const presented = Math.max(0, book.units - book.claimLeft)
    book.unloaded = Math.max(Number.isFinite(book.unloaded) ? book.unloaded : 0, presented)
    book.loaded = Math.max(book.loaded, book.unloaded)
  }
  if (stage === 'on_claim' || stage === 'complete') {
    book.onClaim = Math.max(Number.isFinite(book.onClaim) ? book.onClaim : 0, book.unloaded)
  }
  if (stage === 'complete') {
    book.claimed = Math.max(Number.isFinite(book.claimed) ? book.claimed : 0, book.onClaim)
    book.lost = 0
  }
}
