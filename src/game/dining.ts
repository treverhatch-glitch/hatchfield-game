/**
 * Sit-down dining — which seats sit near a food counter, who has claimed them,
 * and whether a diner has time to sit. Pure helpers; the sim owns guests.
 */
import type { Advice, AdviceCell } from './advisor.ts'
import { itemDef, type PlacedItem } from './terminal.ts'
import { DINING_TUNING, TABLE_SEATS } from './diningData.ts'

/** One chair: a bench place, a seat-row place, or a restaurant table place. */
export interface DiningSeat {
  id: string
  /** The bench, seat row, or restaurant this place belongs to. */
  itemId: string
  c: number
  r: number
  /** Place along the bench or around the table (0…n−1). */
  slot: number
  table: boolean
}

/** Seat id → guest id. One per hall. A seat in the map is taken. */
export type SeatBook = Map<string, string>

/** A meal a guest is eating at a claimed seat. */
export interface SeatedMeal {
  seatId: string
  itemId: string
  c: number
  r: number
  slot: number
  table: boolean
  /** Seconds left on the walk from the counter. */
  walk: number
  walkSec: number
  /** Seconds of eating left once seated. */
  left: number
}

const cheb = (ac: number, ar: number, bc: number, br: number) =>
  Math.max(Math.abs(ac - bc), Math.abs(ar - br))

/**
 * Placed seats and restaurant tables within reach of the counter, nearest
 * first. Prefab bundle seats stay out — they are priced into the prefab flow.
 */
export function seatsNear(items: readonly PlacedItem[], c: number, r: number): DiningSeat[] {
  const out: (DiningSeat & { d: number })[] = []
  for (const it of items) {
    if (it.bundle) continue
    const d = cheb(it.c, it.r, c, r)
    if (d > DINING_TUNING.seatRadius) continue
    const table = TABLE_SEATS[it.def] ?? 0
    const n = table || (itemDef(it.def)?.seats ?? 0)
    for (let k = 0; k < n; k++) {
      out.push({ id: `${it.id}#${k}`, itemId: it.id, c: it.c, r: it.r, slot: k, table: table > 0, d })
    }
  }
  // Stable sort keeps placement order inside one distance ring — no RNG.
  out.sort((a, b) => a.d - b.d)
  return out.map(({ d: _d, ...seat }) => seat)
}

/** First free seat, booked for this guest. A guest holds at most one seat. */
export function claimSeat(book: SeatBook, seats: readonly DiningSeat[], guestId: string): DiningSeat | null {
  releaseSeat(book, guestId)
  const free = seats.find((s) => !book.has(s.id))
  if (!free) return null
  book.set(free.id, guestId)
  return free
}

/** Let go of whatever seat this guest holds. */
export function releaseSeat(book: SeatBook, guestId: string) {
  for (const [seat, who] of book) if (who === guestId) book.delete(seat)
}

/** Drop claims held by guests who are gone (boarded, left, or reset). */
export function sweepSeats(book: SeatBook, alive: (guestId: string) => boolean) {
  for (const [seat, who] of book) if (!alive(who)) book.delete(seat)
}

/** Seconds a meal takes at this outlet. */
export function consumeSec(outletDef: string): number {
  return DINING_TUNING.consumeSec[outletDef] ?? DINING_TUNING.consumeSec.default
}

/**
 * Does this diner have time to sit? Arrivals always do. A departure skips the
 * seat once boarding is called, or when the running clock would not cover
 * the meal plus a margin.
 */
export function hasTimeToSit(opts: {
  job: 'depart' | 'arrive'
  boardingCall: boolean
  clockRunning: boolean
  boarding: number
  mealSec: number
}): boolean {
  if (opts.job === 'arrive') return true
  if (opts.boardingCall) return false
  if (!opts.clockRunning) return true
  const secLeft = opts.boarding / DINING_TUNING.boardingDrainPerSec
  return secLeft >= opts.mealSec + DINING_TUNING.boardingMarginSec
}

/** Walk time from the counter cell to the seat cell. */
export function walkSecTo(fromC: number, fromR: number, seat: DiningSeat, cellMeters: number): number {
  const cells = Math.hypot(seat.c - fromC, seat.r - fromR)
  return (cells * cellMeters) / DINING_TUNING.walkMps
}

/** Advisor hint when diners keep eating on their feet. */
export function seatingAdvice(stoodRecently: number, outletCells: AdviceCell[]): Advice[] {
  if (stoodRecently < DINING_TUNING.adviseStandingAt || !outletCells.length) return []
  return [
    {
      id: 'dining-no-seats',
      title: 'Not enough seating near food court',
      detail: `${stoodRecently} diners ate standing in the last ${Math.round(DINING_TUNING.standWindowSec / 60)} min. They leave a little less happy.`,
      fix: 'Place benches or seat rows within two cells of the food counters, or a restaurant with tables.',
      cells: outletCells,
    },
  ]
}
