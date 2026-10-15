import type { Cell } from './types.ts'

const SIZE = 32
const DIRS: Cell[] = [
  { c: 1, r: 0 },
  { c: -1, r: 0 },
  { c: 0, r: 1 },
  { c: 0, r: -1 },
]

function id(cell: Cell): string {
  return `${cell.c},${cell.r}`
}

function onBorder(cell: Cell): boolean {
  return cell.c === 0 || cell.r === 0 || cell.c === SIZE - 1 || cell.r === SIZE - 1
}

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r)
}

export interface DeliveryRoute {
  path: Cell[]
  farm: Cell | null
  /** Road cell the tanker arrives on. */
  entry: Cell | null
  /** A different cell, straight through the farm when the grid allows it. */
  exit: Cell | null
  /** entry, then the farm, then the exit. Empty when the road never arrives. */
  through: Cell[]
}

function inside(cell: Cell): boolean {
  return cell.c >= 0 && cell.r >= 0 && cell.c < SIZE && cell.r < SIZE
}

function distinct(a: Cell, b: Cell): boolean {
  return a.c !== b.c || a.r !== b.r
}

/**
 * The tanker leaves through a different gate than it entered.
 * Prefer the road cell straight past the farm, then the road neighbor
 * farthest from the arrival, then the opposite grid cell even off the road.
 */
function depotExit(farm: Cell, entry: Cell, roads: Cell[]): Cell {
  const paved = new Set(roads.map(id))
  const straight = { c: farm.c * 2 - entry.c, r: farm.r * 2 - entry.r }
  if (distinct(straight, entry) && inside(straight) && paved.has(id(straight))) return straight
  let best: Cell | null = null
  let bestD = -1
  for (const dir of DIRS) {
    const next = { c: farm.c + dir.c, r: farm.r + dir.r }
    if (!distinct(next, entry) || !paved.has(id(next))) continue
    const d = manhattan(next, entry)
    if (d > bestD) {
      best = next
      bestD = d
    }
  }
  if (best) return best
  if (distinct(straight, entry) && inside(straight)) return straight
  for (const dir of DIRS) {
    const next = { c: farm.c + dir.c, r: farm.r + dir.r }
    if (distinct(next, entry) && inside(next)) return next
  }
  const shiftC = entry.c === farm.c ? (farm.c + 1 < SIZE ? 1 : -1) : 0
  const shiftR = shiftC !== 0 ? 0 : farm.r + 1 < SIZE ? 1 : -1
  return { c: farm.c + shiftC, r: farm.r + shiftR }
}

function arrived(path: Cell[], farm: Cell, roads: Cell[]): DeliveryRoute {
  const entry = path[path.length - 1] ?? null
  if (!entry) return { path, farm, entry: null, exit: null, through: [] }
  const exit = depotExit(farm, entry, roads)
  return { path, farm, entry, exit, through: [entry, farm, exit] }
}

const EMPTY: DeliveryRoute = { path: [], farm: null, entry: null, exit: null, through: [] }

/**
 * Road walk from the city edge to the road cell beside the farm.
 * Connectors (the guard post) can be crossed. They are not a destination.
 * The return trip leaves by a different gate: through is entry, farm, exit.
 */
export function deliveryPath(
  roads: Cell[],
  farms: Cell[],
  connectors: Cell[] = [],
): DeliveryRoute {
  const farm = farms[0] ?? null
  if (!roads.length || !farm) return { ...EMPTY, farm }
  const drive = [...roads, ...connectors]
  const driveSet = new Set(drive.map(id))
  const goals = new Set(
    roads.filter((road) => manhattan(road, farm) <= 1).map(id),
  )
  const entry = [...roads].sort((a, b) => a.r - b.r || a.c - b.c).find(onBorder) ?? [...roads].sort((a, b) => a.r - b.r || a.c - b.c)[0]
  if (!entry) return { ...EMPTY, farm }
  if (goals.has(id(entry))) return arrived([entry], farm, roads)
  const queue: Cell[] = [entry]
  const prev = new Map<string, string | null>([[id(entry), null]])
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]
    for (const dir of DIRS) {
      const next = { c: cur.c + dir.c, r: cur.r + dir.r }
      const key = id(next)
      if (!driveSet.has(key) || prev.has(key)) continue
      prev.set(key, id(cur))
      if (goals.has(key)) {
        const path: Cell[] = [next]
        let walk: string | null = id(cur)
        while (walk) {
          const [c, r] = walk.split(',').map(Number)
          path.push({ c, r })
          walk = prev.get(walk) ?? null
        }
        path.reverse()
        return arrived(path, farm, roads)
      }
      queue.push(next)
    }
  }
  return { ...EMPTY, farm }
}
