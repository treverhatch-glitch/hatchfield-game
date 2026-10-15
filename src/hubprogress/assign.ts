/**
 * Copy for the assign screen. Pure. The sim writes the existing lease rows.
 * Desk and lane checklist lines stay on the allocator even after a name.
 */
import { LEASE_SCORE_CAP, SCORE_PER_LEASE } from './config.ts'

export interface AssignSentences {
  relationship: string
  rival: string
  flexibility: string
}

/** Three sentences the picker shows for one kind. */
export function assignSentences(input: {
  airlineName: string
  waits: boolean
  anger: string
  spared: string
}): AssignSentences {
  const relationship = input.waits
    ? 'This lock does not add dedicated score yet. The checklist still waits on the desk allocator.'
    : `+${SCORE_PER_LEASE.dedicated} per day on Dedicated leases, capped at ${LEASE_SCORE_CAP}.`
  const rival = ['No rival hit for the lease.', input.anger.trim(), input.spared.trim()].filter(Boolean).join(' ')
  const flexibility = `Serves only ${input.airlineName}. Taken out of the common pool.`
  return { relationship, rival, flexibility }
}

export interface LaneLock {
  laneId: string
  airlineId: string
}

export function readLaneLocks(raw: unknown): LaneLock[] {
  if (!Array.isArray(raw)) return []
  const out: LaneLock[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const laneId = (row as { laneId?: unknown }).laneId
    const airlineId = (row as { airlineId?: unknown }).airlineId
    if (typeof laneId === 'string' && laneId && typeof airlineId === 'string' && airlineId) {
      out.push({ laneId, airlineId })
    }
  }
  return out
}
