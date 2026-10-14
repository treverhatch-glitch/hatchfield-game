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

/**
 * Road walk from the city edge to the road cell beside the farm.
 * Connectors (the guard post) can be crossed. They are not a destination.
 */
export function deliveryPath(
  roads: Cell[],
  farms: Cell[],
  connectors: Cell[] = [],
): { path: Cell[]; farm: Cell | null } {
  const farm = farms[0] ?? null
  if (!roads.length || !farm) return { path: [], farm }
  const drive = [...roads, ...connectors]
  const driveSet = new Set(drive.map(id))
  const goals = new Set(
    roads.filter((road) => manhattan(road, farm) <= 1).map(id),
  )
  const entry = [...roads].sort((a, b) => a.r - b.r || a.c - b.c).find(onBorder) ?? [...roads].sort((a, b) => a.r - b.r || a.c - b.c)[0]
  if (!entry) return { path: [], farm }
  if (goals.has(id(entry))) return { path: [entry], farm }
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
        return { path, farm }
      }
      queue.push(next)
    }
  }
  return { path: [], farm }
}
