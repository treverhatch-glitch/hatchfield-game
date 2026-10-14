/**
 * Terminal build kit — placement rules, seats, comfort aura, food outlets.
 * Pure helpers. The sim owns cash and guests; this file only reads a hall.
 */
import type { HallNode, PaxTag } from './guests.ts'
import { unlockLevel } from '../progression/unlocks.ts'
import { itemDef, type ItemDef, type PlacedItem, type ZoneId } from './terminal.ts'
import { CELL_SLOTS, KIT_TUNING, OUTLETS, type OutletSpec } from './terminalKitData.ts'
import { collisionReason } from '../terminalplay/place.ts'

export type HallZones = readonly (readonly (string | null)[])[]

export interface PlacementCheck {
  ok: boolean
  reason: string
  cost: number
}

/** Slots an item takes in its cell. */
export function itemSize(def: ItemDef | undefined): number {
  return def?.size ?? CELL_SLOTS
}

/** Slots already used in one cell. */
export function cellLoad(items: readonly PlacedItem[], c: number, r: number): number {
  let n = 0
  for (const it of items) {
    if (it.hx != null && it.hz != null) continue
    if (it.c === c && it.r === r) n += itemSize(itemDef(it.def))
  }
  return n
}

/** Zone labels for a readable "goes in" line. */
const ZONE_WORD: Record<ZoneId, string> = {
  checkin: 'Check-in',
  security: 'Security',
  gates: 'Gates',
  arrivals: 'Arrivals',
  retail: 'Shops / Food',
  toilets: 'Toilets',
}

/**
 * Can this item go in this cell? The ghost and the click both use it,
 * so a red ghost and a refused click always agree.
 */
export function placementCheck(
  zones: HallZones,
  items: readonly PlacedItem[],
  def: ItemDef,
  c: number,
  r: number,
  opts: { fieldLevel: number; cash: number; sandbox?: boolean },
): PlacementCheck {
  const cost = def.cost
  const row = zones[r]
  if (!row || c < 0 || c >= row.length) return { ok: false, reason: 'Outside the hall', cost }
  const zone = row[c] as ZoneId | null
  if (!zone) return { ok: false, reason: 'Paint a zone here first', cost }
  if (!def.zones.includes(zone)) {
    return {
      ok: false,
      reason: `Goes in ${def.zones.map((z) => ZONE_WORD[z]).join(' / ')}`,
      cost,
    }
  }
  const blocked = collisionReason(items, def, c, r)
  if (blocked) return { ok: false, reason: blocked, cost }
  if (cellLoad(items, c, r) + itemSize(def) > CELL_SLOTS) {
    return { ok: false, reason: 'Cell is full', cost }
  }
  const needLevel = Math.max(def.minFieldLevel, unlockLevel(def.id))
  if (opts.fieldLevel < needLevel) {
    return { ok: false, reason: `Needs Field level ${needLevel}`, cost }
  }
  if (!opts.sandbox && opts.cash < cost) return { ok: false, reason: 'Not enough cash', cost }
  return { ok: true, reason: 'Click to place', cost }
}

/** Cash back when a placed (non-bundle) item is bulldozed. */
export function refundFor(def: ItemDef): number {
  return Math.round(def.cost * KIT_TUNING.refundShare)
}

/**
 * Seats the player placed. Prefab bundle seats are already priced into the
 * prefab's tuned flow, so they do not change it.
 */
export function seatCount(items: readonly PlacedItem[]): number {
  let n = 0
  for (const it of items) if (!it.bundle) n += itemDef(it.def)?.seats ?? 0
  return n
}

/** Placed seats per painted zone. A bench only serves people in its own zone. */
export function seatsByZone(zones: HallZones, items: readonly PlacedItem[]): Map<ZoneId, number> {
  const out = new Map<ZoneId, number>()
  for (const it of items) {
    const zone = zones[it.r]?.[it.c] as ZoneId | null | undefined
    if (!zone || it.bundle) continue
    const seats = itemDef(it.def)?.seats ?? 0
    if (seats) out.set(zone, (out.get(zone) ?? 0) + seats)
  }
  return out
}

/** Comfort at one cell from every decoration in range. Fades linearly, capped. */
export function comfortAtCell(items: readonly PlacedItem[], c: number, r: number): number {
  let sum = 0
  for (const it of items) {
    const def = itemDef(it.def)
    if (!def?.comfort) continue
    const radius = def.comfortRadius ?? 0
    const d = Math.max(Math.abs(it.c - c), Math.abs(it.r - r))
    if (d > radius) continue
    sum += def.comfort * (1 - d / (radius + 1))
  }
  return Math.min(KIT_TUNING.comfortCap, sum)
}

/** Where each hall node stands on the painted floor. */
export const NODE_ZONE: Partial<Record<HallNode, ZoneId>> = {
  entrance: 'checkin',
  info: 'checkin',
  checkin: 'checkin',
  security: 'security',
  gate: 'gates',
  lounge: 'gates',
  claim: 'arrivals',
  exit: 'arrivals',
  food: 'retail',
  shop: 'retail',
  bathroom: 'toilets',
}

/** Best comfort a guest at this node can feel — the nicest cell of its zone. */
export function nodeComfort(zones: HallZones, items: readonly PlacedItem[], node: HallNode): number {
  const zone = NODE_ZONE[node]
  if (!zone) return 0
  let best = 0
  for (let r = 0; r < zones.length; r++) {
    for (let c = 0; c < zones[r].length; c++) {
      if (zones[r][c] !== zone) continue
      best = Math.max(best, comfortAtCell(items, c, r))
    }
  }
  return best
}

export function outletSpec(defId: string): OutletSpec | undefined {
  return OUTLETS[defId]
}

/**
 * Which counter a hungry guest walks to. Tag-matched outlets win, then the
 * first outlet placed. Null means only the legacy food room or the prefab
 * bundle counter, which keep the old counter numbers.
 */
export function pickOutlet(
  items: PlacedItem[],
  tag: PaxTag,
): { item: PlacedItem; spec: OutletSpec } | null {
  let first: { item: PlacedItem; spec: OutletSpec } | null = null
  for (const item of items) {
    if (item.bundle) continue
    const spec = OUTLETS[item.def]
    if (!spec) continue
    if (spec.tags.includes(tag)) return { item, spec }
    first ??= { item, spec }
  }
  return first
}

/** Servings the hall's outlets add on top of the per-room shelf. */
export function outletExtraStock(items: readonly PlacedItem[]): number {
  let n = 0
  for (const it of items) n += OUTLETS[it.def]?.extraStock ?? 0
  return n
}
