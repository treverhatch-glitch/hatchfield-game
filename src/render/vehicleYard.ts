/**
 * Depot yard spacing. The logistics sim parks every idle vehicle on its depot
 * road node, so a dozen trucks share one point. Round A made tankers (10 m) and
 * baggage trains (9.6 m) much longer, so spread parked vehicles into rows sized
 * from the real model footprint: side by side across the heading, then rows
 * further back. Offsets are world-plane metres (x, z); drivers and vehicles at
 * an aircraft are never moved.
 */
export interface YardPose {
  type: string
  x: number
  y: number
  heading: number
  phase: string
}

export interface YardOffset {
  x: number
  z: number
}

const PARKED = new Set(['idle', 'in_bay', 'loading', 'waiting_stock', 'unloading', 'broken'])

/** Vehicles per row before the next row starts behind. */
export const YARD_ROW = 5
/** Clear gap between neighbours, metres. */
export const YARD_GAP = 1.6

export function yardOffsets(
  poses: readonly YardPose[],
  size: (type: string) => readonly [number, number, number],
): YardOffset[] {
  const out: YardOffset[] = poses.map(() => ({ x: 0, z: 0 }))
  const groups = new Map<string, number[]>()
  poses.forEach((p, i) => {
    if (!PARKED.has(p.phase)) return
    const k = `${Math.round(p.x * 4)}|${Math.round(p.y * 4)}`
    const g = groups.get(k)
    if (g) g.push(i)
    else groups.set(k, [i])
  })
  for (const idx of groups.values()) {
    if (idx.length < 2) continue
    // Stable order: by type then id position, so the yard doesn't reshuffle.
    idx.sort((a, b) => (poses[a].type < poses[b].type ? -1 : poses[a].type > poses[b].type ? 1 : a - b))
    let maxW = 0
    let maxL = 0
    for (const i of idx) {
      const [l, , w] = size(poses[i].type)
      maxL = Math.max(maxL, l)
      maxW = Math.max(maxW, w)
    }
    const h = poses[idx[0]].heading
    const fx = Math.cos(h)
    const fz = Math.sin(h)
    const lx = -fz
    const lz = fx
    const pitch = maxW + YARD_GAP
    const depth = maxL + YARD_GAP
    idx.forEach((i, n) => {
      const row = Math.floor(n / YARD_ROW)
      const inRow = Math.min(YARD_ROW, idx.length - row * YARD_ROW)
      const col = (n % YARD_ROW) - (inRow - 1) / 2
      const a = col * pitch
      const b = -row * depth
      out[i].x = lx * a + fx * b
      out[i].z = lz * a + fz * b
    })
  }
  return out
}

/** Smallest centre-to-centre distance allowed between two parked footprints. */
export function minYardClearance(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return (a[2] + b[2]) / 2 + YARD_GAP
}
