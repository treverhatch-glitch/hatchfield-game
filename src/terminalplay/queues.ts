/**
 * Read-only counts for the terminal info panel and the in-world badges.
 * How a queue forms is the pathing layer's job. This only reports who is
 * already standing at a node.
 */
import type { HallNode } from '../game/guests.ts'
import { isBottleneck } from './config.ts'

export interface QueueGuest {
  node: HallNode
  dead?: boolean
  preview?: boolean
  job?: 'depart' | 'arrive'
  clearedSec?: boolean
  serviceLeft?: number
}

export interface HallQueue {
  node: HallNode
  label: string
  count: number
  bottleneck: boolean
}

const MARKS: { node: HallNode; label: string }[] = [
  { node: 'checkin', label: 'Check-in' },
  { node: 'security', label: 'Security' },
  { node: 'bathroom', label: 'Restrooms' },
  { node: 'food', label: 'Food' },
  { node: 'shop', label: 'Shop' },
  { node: 'gate', label: 'Gate' },
]

export function queueAtNode(guests: readonly QueueGuest[], node: HallNode): number {
  let n = 0
  for (const g of guests) {
    if (g.dead || g.preview || g.node !== node) continue
    if (node === 'security') {
      if (g.job === 'depart' && !g.clearedSec && (g.serviceLeft ?? 0) <= 0) n += 1
      continue
    }
    n += 1
  }
  return n
}

/** Markers worth drawing. Empty lines stay off the floor. */
export function hallQueues(guests: readonly QueueGuest[]): HallQueue[] {
  const out: HallQueue[] = []
  for (const mark of MARKS) {
    const count = queueAtNode(guests, mark.node)
    if (count <= 0) continue
    out.push({
      node: mark.node,
      label: mark.label,
      count,
      bottleneck: isBottleneck(count),
    })
  }
  return out
}
