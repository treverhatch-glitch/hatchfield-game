/**
 * Terminal Advisor bridge — turns the live hall (painted zones + kit items)
 * into the pure advisor's plan, and folds every hall note into one hint list.
 *
 * The live hall has no wall tool, so the walls come from the security gate rule:
 * - Check-in and Arrivals never open straight onto Gates (the sterile partition).
 * - Shops / Food and Toilets take the side they touch: next to Gates (or only
 *   Security) they are after security, otherwise before it.
 * - Security is open on both sides, but a Security strip without a lane in it is
 *   just floor, so it becomes a walkway and the advisor reports the bypass.
 *
 * Pure. No DOM, Three, or sim state.
 */
import {
  adviseTerminal,
  blankPlan,
  type Door,
  type Hint,
  type RoomId,
  type TerminalPlan,
} from '../terminaladvisor/index.ts'
import type { Advice, AdviceCell } from './advisor.ts'
import { itemDef, schemeItems, schemeZones, type ZoneId } from './terminal.ts'
import {
  HINT_DUPES,
  ITEM_EQUIPMENT,
  LAYOUT_COPY,
  LAYOUT_DROP,
  NEED_WORD,
  NOTE_SEVERITY,
  NOTE_SEVERITY_PREFIX,
  ROOM_ZONE_LABEL,
  SEVERITY_RANK,
  type HintSeverity,
} from './advisorData.ts'

/** The slice of a TerminalFit the adapter reads. */
export interface AdvisorHall {
  zones?: readonly (readonly (string | null)[])[]
  items?: readonly { def: string; c: number; r: number }[]
  premade?: boolean
  redesigned?: boolean
  tier?: 1 | 2 | 3
}

type Side = 'before' | 'after' | 'security'

const FIXED_SIDE: Partial<Record<ZoneId, Side>> = {
  checkin: 'before',
  arrivals: 'before',
  gates: 'after',
  security: 'security',
}

const STEPS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** Painted floor, falling back to the prefab scheme a stock hall was stamped with. */
export function hallZones(hall: AdvisorHall): (ZoneId | null)[][] {
  if (hall.zones?.length) return hall.zones.map((row) => row.map((z) => (z as ZoneId | null) ?? null))
  return hall.premade ? schemeZones(hall.tier ?? 1) : []
}

function hallItems(hall: AdvisorHall): readonly { def: string; c: number; r: number }[] {
  return hall.items ?? (hall.premade ? schemeItems(hall.tier ?? 1) : [])
}

/** 4-neighbour groups of cells whose zone passes `pick`. */
function groups(zones: (ZoneId | null)[][], pick: (z: ZoneId | null) => boolean): AdviceCell[][] {
  const seen = new Set<string>()
  const out: AdviceCell[][] = []
  for (let r = 0; r < zones.length; r++) {
    for (let c = 0; c < zones[r].length; c++) {
      if (!pick(zones[r][c]) || seen.has(`${c},${r}`)) continue
      const group: AdviceCell[] = []
      const q: AdviceCell[] = [{ c, r }]
      seen.add(`${c},${r}`)
      while (q.length) {
        const cell = q.pop()!
        group.push(cell)
        for (const [dc, dr] of STEPS) {
          const nc = cell.c + dc
          const nr = cell.r + dr
          const key = `${nc},${nr}`
          if (seen.has(key) || !pick(zones[nr]?.[nc] ?? null)) continue
          seen.add(key)
          q.push({ c: nc, r: nr })
        }
      }
      out.push(group)
    }
  }
  return out
}

function touches(zones: (ZoneId | null)[][], group: AdviceCell[], want: (z: ZoneId) => boolean): boolean {
  return group.some(({ c, r }) =>
    STEPS.some(([dc, dr]) => {
      const z = zones[r + dr]?.[c + dc]
      return Boolean(z && want(z))
    }),
  )
}

/** Convert the live hall into the advisor's single-floor plan. Cell (c, r) is plan (x, y). */
export function hallPlan(hall: AdvisorHall): TerminalPlan {
  const zones = hallZones(hall)
  const items = hallItems(hall)
  const h = zones.length
  const w = zones.reduce((m, row) => Math.max(m, row.length), 0)
  const plan = blankPlan(Math.max(1, w), Math.max(1, h))
  const level = plan.floors[0]
  const side: (Side | null)[][] = zones.map((row) => row.map((z) => (z ? (FIXED_SIDE[z] ?? null) : null)))
  const room: (RoomId | null)[][] = zones.map((row) => row.map(() => null))
  const itemsAt = (c: number, r: number) => items.filter((it) => it.c === c && it.r === r)

  // Shops / Food and Toilets: one side per connected patch.
  const either = (z: ZoneId | null) => z === 'retail' || z === 'toilets'
  for (const group of groups(zones, either)) {
    const gates = touches(zones, group, (z) => z === 'gates')
    const security = touches(zones, group, (z) => z === 'security')
    const landside = touches(zones, group, (z) => z === 'checkin' || z === 'arrivals')
    const s: Side = gates || (security && !landside) ? 'after' : 'before'
    for (const { c, r } of group) side[r][c] = s
  }

  // Security strips: a lane makes a checkpoint, no lane is just a walkway.
  for (const group of groups(zones, (z) => z === 'security')) {
    const lane = group.some(({ c, r }) => itemsAt(c, r).some((it) => itemDef(it.def)?.room === 'security'))
    for (const { c, r } of group) room[r][c] = lane ? 'security' : 'corridor'
  }

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < zones[r].length; c++) {
      const z = zones[r][c]
      if (!z) continue
      if (z === 'checkin') room[r][c] = 'checkin'
      else if (z === 'gates') room[r][c] = 'gates'
      else if (z === 'arrivals') room[r][c] = 'bagclaim'
      else if (z === 'toilets') room[r][c] = 'restrooms'
      else if (z === 'retail') {
        // After security, shops count as concourse so a walk-through duty free
        // between the lanes and the gates still leads to the gates.
        const food = itemsAt(c, r).some((it) => itemDef(it.def)?.category === 'food')
        room[r][c] = side[r][c] === 'after' ? 'lounge' : food ? 'food' : 'shops'
      }
      level.cells[r][c] = { floor: true, room: room[r][c] }
    }
  }

  // Partition walls between the two sides. Security edges stay open.
  const walled = new Set<string>()
  const split = (a: Side | null | undefined, b: Side | null | undefined) =>
    (a === 'before' && b === 'after') || (a === 'after' && b === 'before')
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < zones[r].length; c++) {
      if (split(side[r][c], side[r]?.[c + 1])) {
        level.walls.push({ x: c, y: r, dir: 'E' })
        walled.add(`${c},${r},E`)
      }
      if (split(side[r][c], side[r + 1]?.[c])) {
        level.walls.push({ x: c, y: r, dir: 'S' })
        walled.add(`${c},${r},S`)
      }
    }
  }

  // Entrance doors are the curb. A door sits on an open edge of its cell, so it
  // never punches through the partition.
  for (const it of items) {
    if (it.def !== 'entrance' || !zones[it.r]?.[it.c]) continue
    const door = curbDoor(it.c, it.r, side, walled)
    if (door) level.doors.push(door)
  }

  for (const it of items) {
    const id = ITEM_EQUIPMENT[it.def]
    if (!id || !zones[it.r]?.[it.c]) continue
    plan.equipment.push({ id, x: it.c, y: it.r, floor: 0 })
  }
  return plan
}

function curbDoor(c: number, r: number, side: (Side | null)[][], walled: Set<string>): Door | null {
  if (!walled.has(`${c},${r},E`)) return { x: c, y: r, dir: 'E', kind: 'curb' }
  if (!walled.has(`${c},${r},S`)) return { x: c, y: r, dir: 'S', kind: 'curb' }
  // Both own edges are partition: start from a same-side neighbour to the west or north.
  const here = side[r]?.[c]
  if (c > 0 && side[r][c - 1] === here) return { x: c - 1, y: r, dir: 'E', kind: 'curb' }
  if (r > 0 && side[r - 1]?.[c] === here) return { x: c, y: r - 1, dir: 'S', kind: 'curb' }
  return null
}

function roomCells(plan: TerminalPlan, room: RoomId): AdviceCell[] {
  const out: AdviceCell[] = []
  plan.floors[0].cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.room === room) out.push({ c, r })
    }),
  )
  return out
}

function fill(text: string, words: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => words[k] ?? '')
}

/** Advisor hint → the hall note shape the panel and highlight already use. */
function toAdvice(hint: Hint, plan: TerminalPlan): Advice {
  const at = hint.at ? [{ c: hint.at.x, r: hint.at.y }] : []
  const base = { id: hint.id, detail: hint.text, severity: hint.severity, source: 'layout' as const }
  const exact = LAYOUT_COPY[hint.id]
  if (exact) {
    // No doors: point at check-in. No checkpoint: point at the lane-less Security paint.
    const fallback: RoomId | null =
      hint.id === 'no_curb' ? 'checkin' : hint.id === 'missing_security' ? 'corridor' : null
    const cells = at.length ? at : fallback ? roomCells(plan, fallback) : []
    return { ...base, title: exact.title, fix: exact.fix, cells }
  }
  if (hint.id.startsWith('dead_')) {
    const room = hint.id.slice(5) as RoomId
    const copy = LAYOUT_COPY.dead_
    const words = { zone: ROOM_ZONE_LABEL[room] ?? room }
    return { ...base, title: fill(copy.title, words), fix: fill(copy.fix, words), cells: at }
  }
  const equip = /^equip_(\w+?)_(\w+)$/.exec(hint.id)
  if (equip) {
    const room = equip[1] as RoomId
    const need = NEED_WORD[equip[2] as keyof typeof NEED_WORD]
    const copy = LAYOUT_COPY.equip_
    const words = {
      zone: ROOM_ZONE_LABEL[room] ?? room,
      need: need?.noun ?? equip[2].replace('_', ' '),
      place: need?.place ?? equip[2].replace('_', ' '),
    }
    return {
      ...base,
      title: fill(copy.title, words),
      fix: fill(copy.fix, words),
      cells: roomCells(plan, room),
    }
  }
  return { ...base, title: hint.text, detail: '', fix: '', cells: at }
}

/** Layout hints for one hall, as hall notes. Worst first. */
export function layoutHints(hall: AdvisorHall): Advice[] {
  if (!hallZones(hall).length) return []
  const plan = hallPlan(hall)
  return adviseTerminal(plan)
    .filter((h) => !LAYOUT_DROP.includes(h.id))
    .map((h) => toAdvice(h, plan))
}

/** Cheap key for "did the layout change". Litter and wear do not count. */
export function layoutKey(hall: AdvisorHall): string {
  const zones = hallZones(hall)
    .map((row) => row.map((z) => (z ? z[0] : '.')).join(''))
    .join('/')
  const items = hallItems(hall)
    .map((it) => `${it.def}@${it.c},${it.r}`)
    .join(';')
  return `${hall.tier ?? 1}|${zones}|${items}`
}

export function hintSeverity(note: Pick<Advice, 'id' | 'severity'>): HintSeverity {
  if (note.severity) return note.severity
  const exact = NOTE_SEVERITY[note.id]
  if (exact) return exact
  for (const [prefix, sev] of NOTE_SEVERITY_PREFIX) if (note.id.startsWith(prefix)) return sev
  return 'warning'
}

/**
 * One hint list from every reporter: layout, kit, litter, ops. Tags each note
 * with a severity, drops duplicates of the same problem, sorts worst first.
 * The sort is stable, so reporters keep their own order inside a severity.
 */
export function mergeHints(lists: readonly (readonly Advice[])[]): Advice[] {
  const all: Advice[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const note of list) {
      if (seen.has(note.id)) continue
      seen.add(note.id)
      all.push({ ...note, severity: hintSeverity(note) })
    }
  }
  const drop = new Set<string>()
  for (const group of HINT_DUPES) {
    const keep = group.find((id) => seen.has(id))
    for (const id of group) if (id !== keep) drop.add(id)
  }
  return all
    .filter((n) => !drop.has(n.id))
    .sort((a, b) => SEVERITY_RANK[a.severity!] - SEVERITY_RANK[b.severity!])
}

/** Worst severity in a list, for the collapsed badge. */
export function worstSeverity(notes: readonly Advice[]): HintSeverity | null {
  let worst: HintSeverity | null = null
  for (const n of notes) {
    const s = hintSeverity(n)
    if (!worst || SEVERITY_RANK[s] < SEVERITY_RANK[worst]) worst = s
  }
  return worst
}
