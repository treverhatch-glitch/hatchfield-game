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

export function onMapBorder(cell: Cell): boolean {
  return onBorder(cell)
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

/**
 * Road from the curb onward, never back down the approach, on paved cells only.
 * It keeps straight where it can and stops at a dead end or at the map edge.
 * The first cell is the curb. A dead end is where traffic U-turns.
 */
export function exitPath(drive: Cell[], approach: Cell[]): Cell[] {
  if (approach.length < 2) return []
  const curb = approach[approach.length - 1]
  const driveSet = new Set(drive.map(cellId))
  const seen = new Set(approach.map(cellId))
  const out: Cell[] = [curb]
  let prev = approach[approach.length - 2]
  let cur = curb
  for (;;) {
    if (out.length > 1 && onBorder(cur)) break
    const dc = cur.c - prev.c
    const dr = cur.r - prev.r
    const straight = { c: cur.c + dc, r: cur.r + dr }
    const options = [straight, ...ortho(cur)].filter((next) => {
      const id = cellId(next)
      return driveSet.has(id) && !seen.has(id)
    })
    const next = options[0]
    if (!next) break
    seen.add(cellId(next))
    out.push(next)
    prev = cur
    cur = next
  }
  return out
}

/** True when the far end of the route leaves the map instead of ending in a U-turn. */
export function exitsAtEdge(path: Cell[], exit: Cell[]): boolean {
  if (exit.length < 2 || !path.length) return false
  const far = exit[exit.length - 1]
  return onBorder(far) && cellId(far) !== cellId(path[0])
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
  const exit = exitPath(drive, path)
  return {
    roads,
    frontage,
    entry,
    path,
    lanes: approachLanes(path, drive) + uniq(field.curbLanes ?? []).length,
    curbStalls:
      frontage.length * LANDSIDE.stallsPerCurbCell +
      uniq(field.busBays).length * LANDSIDE.stallsPerBusBay +
      uniq(field.curbLanes ?? []).length * LANDSIDE.stallsPerCurbLane +
      uniq(field.taxiRanks ?? []).length * LANDSIDE.stallsPerTaxiRank,
    parkSpaces: countParkSpaces(field.parks),
    busBays: uniq(field.busBays).length,
    curbLanes: uniq(field.curbLanes ?? []).length,
    taxiRanks: uniq(field.taxiRanks ?? []).length,
    door: nearestDoor(frontage, terminals),
    exit,
    edgeExit: exitsAtEdge(path, exit),
  }
}
