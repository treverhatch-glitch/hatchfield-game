/**
 * Copy and targets for the dedicate picker. Pure. The sim writes the rows.
 * Desk and lane checklist lines stay on the allocator even after a lock.
 */
import { LEASE_SCORE_CAP, SCORE_PER_LEASE, VEHICLE_ROLES, type VehicleRole } from './config.ts'
import { isVehicleRole } from './vehicles.ts'

export const ASSIGN_KINDS = ['desk', 'lane', 'gate', 'lounge', 'hangar', 'vehicle'] as const

export type AssignKind = (typeof ASSIGN_KINDS)[number]

export function isAssignKind(value: unknown): value is AssignKind {
  return typeof value === 'string' && (ASSIGN_KINDS as readonly string[]).includes(value)
}

export interface AssignSentences {
  relationship: string
  rival: string
  flexibility: string
}

/** Three sentences the picker shows before Dedicate. */
export function assignSentences(input: {
  airlineName: string
  kind: AssignKind
  anger: string
  spared: string
  feeNote?: string | null
}): AssignSentences {
  const waits = input.kind === 'desk' || input.kind === 'lane'
  const relationship = waits
    ? 'This lock does not add dedicated score yet. The checklist still waits on the desk allocator.'
    : `+${SCORE_PER_LEASE.dedicated} per day on Dedicated leases, capped at ${LEASE_SCORE_CAP}.`
  const rival = ['No rival hit for the lease.', input.anger.trim(), input.spared.trim()].filter(Boolean).join(' ')
  const flexibility = input.feeNote
    ? `Serves only ${input.airlineName}. Taken out of the common pool. ${input.feeNote}`
    : `Serves only ${input.airlineName}. Taken out of the common pool.`
  return { relationship, rival, flexibility }
}

/** Bulk paint is desks or stands (gates). One kind at a time. */
export function bulkKindFor(kind: AssignKind): 'desk' | 'gate' | null {
  if (kind === 'desk') return 'desk'
  if (kind === 'gate') return 'gate'
  return null
}

export interface AssignTarget {
  kind: AssignKind
  role?: VehicleRole
}

/** Which picker an unmet checklist line opens. Null when the line is not a place. */
export function checklistAssignTarget(lineId: string): AssignTarget | null {
  if (lineId === 'desk') return { kind: 'desk' }
  if (lineId === 'lane') return { kind: 'lane' }
  if (lineId === 'pier' || lineId === 'stand') return { kind: 'gate' }
  if (lineId === 'lounge') return { kind: 'lounge' }
  if (lineId === 'hangar' || lineId === 'ramp') return { kind: 'hangar' }
  if (lineId === 'fuel') return { kind: 'vehicle', role: 'fuelTruck' }
  if (lineId.startsWith('veh-')) {
    const role = lineId.slice('veh-'.length)
    if (isVehicleRole(role)) return { kind: 'vehicle', role }
  }
  return null
}

export function isVehicleRoleId(role: string | undefined): role is VehicleRole {
  return role != null && (VEHICLE_ROLES as readonly string[]).includes(role)
}

/** `stand:c,r`, `hangar:c,r`, or `lounge:c,r:index`. */
export function leaseCell(id: string): { c: number; r: number; index: number } | null {
  const parts = id.split(':')
  const cell = parts[1]?.split(',')
  if (!cell || cell.length < 2) return null
  const c = Number(cell[0])
  const r = Number(cell[1])
  const index = parts[2] != null ? Number(parts[2]) : 0
  if (!Number.isFinite(c) || !Number.isFinite(r)) return null
  return { c, r, index: Number.isFinite(index) ? index : 0 }
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
