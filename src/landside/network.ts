import { LANDSIDE, type ParkKind } from './config.ts'
import type { Cell, LandsideField, Network } from './types.ts'

const DIRS: Cell[] = [
  { c: 1, r: 0 },
  { c: -1, r: 0 },
  { c: 0, r: 1 },
  { c: 0, r: -1 },
]

export function cellId(cell: Cell): string {
  return `${cell.c},${cell.r}`
}

function uniq(cells: Cell[]): Cell[] {
  const seen = new Set<string>()
  const out: Cell[] = []
  for (const cell of cells) {
    if (!Number.isInteger(cell.c) || !Number.isInteger(cell.r)) continue
    const id = cellId(cell)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ c: cell.c, r: cell.r })
  }
  return out
}

function ortho(cell: Cell): Cell[] {
  return DIRS.map((d) => ({ c: cell.c + d.c, r: cell.r + d.r }))
}

function onBorder(cell: Cell): boolean {
  return cell.c === 0 || cell.r === 0 || cell.c === 31 || cell.r === 31
}

/** Road cell the city traffic uses as the way in. */
export function pickEntry(roads: Cell[]): Cell | null {
  if (!roads.length) return null
  const ranked = [...roads].sort((a, b) => a.r - b.r || a.c - b.c)
  return ranked.find(onBorder) ?? ranked[0]
}

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r)
}

/** Road cells that touch the hall. A slightly wider reach is used when none touch. */
export function curbFrontage(roads: Cell[], terminals: Cell[]): Cell[] {
  if (!roads.length || !terminals.length) return []
  const within = (reach: number) =>
    roads.filter((road) => terminals.some((hall) => manhattan(road, hall) <= reach))
  const touching = within(1)
  return touching.length ? touching : within(2)
}

function nearestDoor(frontage: Cell[], terminals: Cell[]): Cell | null {
  if (!terminals.length) return null
  const from = frontage[0] ?? null
  if (!from) return terminals[0]
  let best = terminals[0]
  let bestD = manhattan(from, best)
  for (const hall of terminals) {
    const d = manhattan(from, hall)
    if (d < bestD) {
      best = hall
      bestD = d
    }
  }
  return best
}

/** Shortest road walk from the city entry to the nearest curb cell. */
export function approachPath(roads: Cell[], entry: Cell | null, frontage: Cell[]): Cell[] {
  if (!entry || !frontage.length) return []
  const roadSet = new Set(roads.map(cellId))
  const goals = new Set(frontage.map(cellId))
  if (goals.has(cellId(entry))) return [entry]
  const queue: Cell[] = [entry]
  const prev = new Map<string, string | null>([[cellId(entry), null]])
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]
    for (const next of ortho(cur)) {
      const id = cellId(next)
      if (!roadSet.has(id) || prev.has(id)) continue
      prev.set(id, cellId(cur))
      if (goals.has(id)) {
        const path: Cell[] = [next]
        let walk: string | null = cellId(cur)
        while (walk) {
          const [c, r] = walk.split(',').map(Number)
          path.push({ c, r })
          walk = prev.get(walk) ?? null
        }
        path.reverse()
        return path
      }
      queue.push(next)
    }
  }
  return []
}

function rebuild(prev: Map<string, string | null>, goal: Cell): Cell[] {
  const path: Cell[] = [goal]
  let walk: string | null = prev.get(cellId(goal)) ?? null
  while (walk) {
    const [c, r] = walk.split(',').map(Number)
    path.push({ c, r })
    walk = prev.get(walk) ?? null
  }
  path.reverse()
  return path
}

/**
 * Road from the curb onward, never back down the approach.
 * Cars leave forward and drop off the far end. A dead-end curb still
 * gets two cells of departure so they do not turn around on the way in.
 */
export function exitPath(drive: Cell[], approach: Cell[]): Cell[] {
  if (approach.length < 2) return []
  const curb = approach[approach.length - 1]
  const driveSet = new Set(drive.map(cellId))
  const inbound = new Set(approach.slice(0, -1).map(cellId))
  const queue: Cell[] = [curb]
  const prev = new Map<string, string | null>([[cellId(curb), null]])
  let farthest = curb
  let farthestD = 0
  let border: Cell | null = null
  const entryId = cellId(approach[0])
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]
    for (const next of ortho(cur)) {
      const id = cellId(next)
      if (!driveSet.has(id) || prev.has(id) || inbound.has(id)) continue
      prev.set(id, cellId(cur))
      const d = manhattan(next, curb)
      if (d > farthestD) {
        farthest = next
        farthestD = d
      }
      if (!border && onBorder(next) && id !== entryId) border = next
      queue.push(next)
    }
  }
  const goal = border ?? (farthestD > 0 ? farthest : null)
  const walked = goal ? rebuild(prev, goal) : [curb]
  const tail = walked.length > 1 ? walked[walked.length - 1] : curb
  const prevCell = walked.length > 1 ? walked[walked.length - 2] : approach[approach.length - 2]
  const dc = Math.sign(tail.c - prevCell.c)
  const dr = Math.sign(tail.r - prevCell.r)
  const stepC = dc || 0
  const stepR = dr || 1
  return [
    ...walked,
    { c: tail.c + stepC, r: tail.r + stepR },
    { c: tail.c + stepC * 2, r: tail.r + stepR * 2 },
  ]
}

/**
 * Lanes are the narrowest cross-section of the approach.
 * A parallel road beside every cell of the approach adds a lane.
 */
export function approachLanes(path: Cell[], roads: Cell[]): number {
  if (!path.length) return 0
  const roadSet = new Set(roads.map(cellId))
  let narrowest = Infinity
  for (let i = 0; i < path.length; i++) {
    const prev = i > 0 ? path[i - 1] : null
    const next = i + 1 < path.length ? path[i + 1] : null
    let side = 0
    for (const n of ortho(path[i])) {
      if (!roadSet.has(cellId(n))) continue
      if (prev && n.c === prev.c && n.r === prev.r) continue
      if (next && n.c === next.c && n.r === next.r) continue
      side++
    }
    if (side < narrowest) narrowest = side
  }
  return 1 + (Number.isFinite(narrowest) ? narrowest : 0)
}

export function countParkSpaces(parks: { kind: ParkKind }[]): number {
  let n = 0
  for (const park of parks) n += LANDSIDE.parkSpaces[park.kind] ?? 0
  return n
}

export function buildNetwork(field: LandsideField): Network {
  const roads = uniq(field.roads)
  const drive = uniq([...field.roads, ...(field.connectors ?? [])])
  const terminals = uniq(field.terminals)
  const frontage = curbFrontage(roads, terminals)
  const entry = pickEntry(roads)
  const path = approachPath(drive, entry, frontage)
  return {
    roads,
    frontage,
    entry,
    path,
    lanes: approachLanes(path, drive),
    curbStalls: frontage.length * LANDSIDE.stallsPerCurbCell,
    parkSpaces: countParkSpaces(field.parks),
    busBays: uniq(field.busBays).length,
    door: nearestDoor(frontage, terminals),
    exit: exitPath(drive, path),
  }
}
