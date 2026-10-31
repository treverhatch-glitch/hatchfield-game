/**
 * Litter, trash cans, restroom dirt, and hall janitors.
 * Pure helpers. The sim owns guests and cash; this file reads and mutates one
 * hall's litter state so it can be tested without a field.
 */
import { simRandom } from './simRng.ts'
import type { Advice, AdviceCell } from './advisor.ts'
import type { PaxTag } from './guests.ts'
import { itemDef, type PlacedItem, type ZoneId } from './terminal.ts'
import { LITTER_TUNING, TRASH_CAN } from './litterData.ts'
import { OUTLETS } from './terminalKitData.ts'

/** One piece of rubbish on the floor. Offsets place the decal inside its cell (−0.5…0.5). */
export interface LitterSpot {
  id: string
  c: number
  r: number
  ox: number
  oz: number
}

/** The slice of a hall this module reads. `TerminalFit` satisfies it. */
export interface LitterHall {
  zones?: (string | null)[][]
  items?: PlacedItem[]
  litter?: LitterSpot[]
  /** 0–100. Rises with every restroom visit; janitors bring it down. */
  restroomDirt?: number
}

export type JanitorTask =
  | { kind: 'litter'; id: string; c: number; r: number }
  | { kind: 'bin'; id: string; c: number; r: number }
  | { kind: 'wc'; id: 'wc'; c: number; r: number }

/** A janitor walking a hall. Position is in cell units (cell c spans c…c+1). */
export interface HallJanitor {
  id: string
  hallId: string
  x: number
  z: number
  task: JanitorTask | null
  /** Seconds spent on the current task after arriving. */
  work: number
}

const cheb = (ac: number, ar: number, bc: number, br: number) =>
  Math.max(Math.abs(ac - bc), Math.abs(ar - br))

export function isBin(item: PlacedItem): boolean {
  return item.def === TRASH_CAN
}

export function binFull(item: PlacedItem): boolean {
  return (item.fill ?? 0) >= LITTER_TUNING.binCap
}

/** Nearest trash can in range that still has room. */
export function binInRange(items: readonly PlacedItem[], c: number, r: number): PlacedItem | null {
  let best: PlacedItem | null = null
  let bestD = Infinity
  for (const it of items) {
    if (!isBin(it) || binFull(it)) continue
    const d = cheb(it.c, it.r, c, r)
    if (d <= LITTER_TUNING.binRadius && d < bestD) {
      best = it
      bestD = d
    }
  }
  return best
}

/**
 * A guest finished a meal or drink at (c, r). A can in range takes it;
 * otherwise it lands on the floor. `rand` is injectable for tests.
 */
export function dropLitter(
  hall: LitterHall,
  c: number,
  r: number,
  id: string,
  rand: () => number = simRandom,
): 'bin' | 'floor' {
  return dropLitterAt(hall, { c, r, ox: rand() * 0.8 - 0.4, oz: rand() * 0.8 - 0.4 }, id)
}

/** Same as `dropLitter`, at an exact spot. A full can counts as no can. */
export function dropLitterAt(
  hall: LitterHall,
  at: { c: number; r: number; ox: number; oz: number },
  id: string,
): 'bin' | 'floor' {
  const bin = binInRange(hall.items ?? [], at.c, at.r)
  if (bin) {
    bin.fill = (bin.fill ?? 0) + 1
    return 'bin'
  }
  hall.litter = hall.litter ?? []
  if (hall.litter.length >= LITTER_TUNING.maxFloorPieces) hall.litter.shift()
  hall.litter.push({ id, c: at.c, r: at.r, ox: at.ox, oz: at.oz })
  return 'floor'
}

export type SnackKind = 'drink' | 'meal'

/** The café sells coffee; every other counter sells a meal. */
export function snackKind(outletDef: string | null | undefined): SnackKind {
  return outletDef === 'cafe' ? 'drink' : 'meal'
}

/** Game minutes to finish a snack. `u` in 0…1 picks inside the tuned range. */
export function snackMinutes(kind: SnackKind, u: number): number {
  const [lo, hi] = kind === 'drink' ? LITTER_TUNING.drinkMinutes : LITTER_TUNING.mealMinutes
  return lo + (hi - lo) * Math.min(1, Math.max(0, u))
}

/**
 * Hall cell under a normalized point (0…1 across the hall, like NODE_POS),
 * with the decal offset inside that cell.
 */
export function cellAt(x: number, y: number, cols: number, rows: number) {
  const fx = Math.min(0.999, Math.max(0, x)) * cols
  const fy = Math.min(0.999, Math.max(0, y)) * rows
  const c = Math.floor(fx)
  const r = Math.floor(fy)
  const clamp = (v: number) => Math.min(0.45, Math.max(-0.45, v))
  return { c, r, ox: clamp(fx - c - 0.5), oz: clamp(fy - r - 0.5) }
}

/** Restroom dirt added by one visit. */
export function restroomDirtFor(tag: PaxTag): number {
  const t = LITTER_TUNING.restroomDirtPerUse
  return (t as Record<string, number>)[tag] ?? t.default
}

/** Happiness lost on a restroom visit at this dirt level. Zero while clean enough. */
export function restroomJoyHit(dirt: number): number {
  const at = LITTER_TUNING.restroomDirtyAt
  if (dirt <= at) return 0
  return (LITTER_TUNING.restroomJoyHit * (Math.min(100, dirt) - at)) / (100 - at)
}

/** Floor pieces lying in cells painted with this zone. */
export function litterInZone(hall: LitterHall, zone: ZoneId): number {
  const zones = hall.zones ?? []
  let n = 0
  for (const s of hall.litter ?? []) if (zones[s.r]?.[s.c] === zone) n++
  return n
}

/** Happiness drained per second by `pieces` of litter around a guest. */
export function litterJoyDrain(pieces: number): number {
  return Math.min(LITTER_TUNING.joyDrainCapPerSec, pieces * LITTER_TUNING.joyPerPiecePerSec)
}

/** Comfort points litter takes off a zone. */
export function litterComfortHit(pieces: number): number {
  return pieces * LITTER_TUNING.comfortPerPiece
}

function zoneCells(zones: readonly (readonly (string | null)[])[], zone: ZoneId): AdviceCell[] {
  const out: AdviceCell[] = []
  for (let r = 0; r < zones.length; r++) {
    for (let c = 0; c < zones[r].length; c++) if (zones[r][c] === zone) out.push({ c, r })
  }
  return out
}

/** Where janitors service the WC: the restroom item, else the first painted toilet cell. */
export function restroomCell(hall: LitterHall): AdviceCell | null {
  const wc = (hall.items ?? []).find((it) => itemDef(it.def)?.room === 'bathroom')
  if (wc) return { c: wc.c, r: wc.r }
  return zoneCells(hall.zones ?? [], 'toilets')[0] ?? null
}

/** Cells where food is sold — placed outlets, else the painted food court. */
export function foodCells(hall: LitterHall): AdviceCell[] {
  const outlets = (hall.items ?? []).filter((it) => OUTLETS[it.def])
  if (outlets.length) return outlets.map((it) => ({ c: it.c, r: it.r }))
  return zoneCells(hall.zones ?? [], 'retail')
}

/**
 * Pick the next job. Full bins first (they make new litter), then a dirty WC,
 * then the nearest floor piece, then light upkeep. `claimed` stops two
 * janitors chasing the same thing.
 */
export function nextJanitorTask(
  j: HallJanitor,
  hall: LitterHall,
  claimed: ReadonlySet<string>,
): JanitorTask | null {
  const T = LITTER_TUNING
  const jc = Math.floor(j.x)
  const jr = Math.floor(j.z)
  const nearest = <X extends { c: number; r: number }>(list: X[]): X | null => {
    let best: X | null = null
    let bestD = Infinity
    for (const x of list) {
      const d = cheb(x.c, x.r, jc, jr)
      if (d < bestD) {
        best = x
        bestD = d
      }
    }
    return best
  }
  const bins = (hall.items ?? []).filter(isBin)
  const fullBins = bins.filter(
    (b) => !claimed.has(b.id) && (b.fill ?? 0) >= T.binCap * T.binEmptyAt,
  )
  const bin = nearest(fullBins)
  if (bin) return { kind: 'bin', id: bin.id, c: bin.c, r: bin.r }
  const dirt = hall.restroomDirt ?? 0
  const wc = restroomCell(hall)
  if (wc && !claimed.has('wc') && dirt >= T.restroomDirtyAt) return { kind: 'wc', id: 'wc', ...wc }
  const spot = nearest((hall.litter ?? []).filter((s) => !claimed.has(s.id)))
  if (spot) return { kind: 'litter', id: spot.id, c: spot.c, r: spot.r }
  if (wc && !claimed.has('wc') && dirt >= T.restroomServiceAt) return { kind: 'wc', id: 'wc', ...wc }
  return null
}

function taskSec(task: JanitorTask): number {
  if (task.kind === 'bin') return LITTER_TUNING.emptyBinSec
  if (task.kind === 'wc') return LITTER_TUNING.restroomServiceSec
  return LITTER_TUNING.sweepSec
}

/** Is the task's target still there? Another janitor or a bulldoze may have taken it. */
function taskLive(task: JanitorTask, hall: LitterHall): boolean {
  if (task.kind === 'litter') return (hall.litter ?? []).some((s) => s.id === task.id)
  if (task.kind === 'bin') return (hall.items ?? []).some((it) => it.id === task.id)
  return (hall.restroomDirt ?? 0) > 0
}

function finishTask(task: JanitorTask, hall: LitterHall) {
  if (task.kind === 'litter') {
    hall.litter = (hall.litter ?? []).filter((s) => s.id !== task.id)
  } else if (task.kind === 'bin') {
    const bin = (hall.items ?? []).find((it) => it.id === task.id)
    if (bin) bin.fill = 0
  } else {
    hall.restroomDirt = Math.max(0, (hall.restroomDirt ?? 0) - LITTER_TUNING.restroomCleanPerVisit)
  }
}

/**
 * One janitor tick: pick a job, walk to it in a straight line at walking
 * pace, work it, finish it. `cellMeters` converts the walk speed into cells.
 * Returns the task finished this tick, if any.
 */
export function stepJanitor(
  j: HallJanitor,
  hall: LitterHall,
  dt: number,
  cellMeters: number,
  claimed: Set<string>,
): JanitorTask | null {
  if (j.task && !taskLive(j.task, hall)) {
    j.task = null
    j.work = 0
  }
  if (!j.task) {
    j.task = nextJanitorTask(j, hall, claimed)
    j.work = 0
    if (!j.task) return null
  }
  claimed.add(j.task.id)
  const tx = j.task.c + 0.5
  const tz = j.task.r + 0.5
  const dx = tx - j.x
  const dz = tz - j.z
  const dist = Math.hypot(dx, dz)
  const step = (LITTER_TUNING.janitorSpeedMps * dt) / Math.max(0.1, cellMeters)
  if (dist > 0.05) {
    if (step >= dist) {
      j.x = tx
      j.z = tz
    } else {
      j.x += (dx / dist) * step
      j.z += (dz / dist) * step
      return null
    }
  }
  j.work += dt
  if (j.work < taskSec(j.task)) return null
  const done = j.task
  finishTask(done, hall)
  j.task = null
  j.work = 0
  return done
}

/** Advisor notes for rubbish and restrooms in one hall. */
export function litterAdvice(hall: LitterHall, janitors: number, cleaningBudget: number): Advice[] {
  const T = LITTER_TUNING
  const out: Advice[] = []
  const items = hall.items ?? []
  const zones = hall.zones ?? []
  const food = foodCells(hall)
  const bins = items.filter(isBin)
  const hasFood = items.some((it) => OUTLETS[it.def])
  if (hasFood && !food.some((f) => bins.some((b) => cheb(b.c, b.r, f.c, f.r) <= T.binRadius))) {
    out.push({
      id: 'litter-no-bins',
      title: 'No trash cans near food court',
      detail: 'Diners drop their wrappers on the floor. Litter makes everyone around it unhappy.',
      fix: 'Place a trash can (Service tab) within two cells of the food counters.',
      cells: food,
    })
  }
  const pieces = hall.litter?.length ?? 0
  const crewIdle = janitors < 1 || cleaningBudget < T.minCleaningBudget
  if (pieces >= T.adviseLitterAt) {
    out.push({
      id: 'litter-floor',
      title: crewIdle ? 'Litter piling up: hire janitors' : 'Litter piling up',
      detail: `${pieces} pieces of rubbish on the floor.`,
      fix: crewIdle
        ? 'Hire janitors and fund the cleaning budget. Add trash cans where people eat.'
        : 'Hire another janitor or add trash cans where people eat.',
      cells: [...new Map((hall.litter ?? []).map((s) => [`${s.c},${s.r}`, { c: s.c, r: s.r }])).values()],
    })
  }
  const full = bins.filter(binFull)
  if (full.length) {
    out.push({
      id: 'litter-bins-full',
      title: crewIdle ? 'Trash cans full: hire janitors' : 'Trash cans full',
      detail: `${full.length} can${full.length === 1 ? ' is' : 's are'} full. New rubbish goes on the floor.`,
      fix: crewIdle ? 'Hire janitors to empty the cans.' : 'More janitors, or more cans to spread the load.',
      cells: full.map((b) => ({ c: b.c, r: b.r })),
    })
  }
  const dirt = hall.restroomDirt ?? 0
  if (dirt >= T.restroomDirtyAt) {
    const wc = restroomCell(hall)
    out.push({
      id: 'restroom-dirty',
      title: crewIdle ? 'Restrooms dirty: hire janitors' : 'Restrooms dirty',
      detail: `Restroom dirt ${Math.round(dirt)}/100. Visitors leave unhappy.`,
      fix: crewIdle
        ? 'Hire janitors and fund the cleaning budget.'
        : 'Hire another janitor so the WC gets serviced more often.',
      cells: wc ? [wc] : zoneCells(zones, 'toilets'),
    })
  }
  return out
}
