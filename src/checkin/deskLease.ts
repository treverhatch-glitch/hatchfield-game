/**
 * Desk and lane leases. Pure. The sim names the points and stores the rows.
 * `allocate` still reads the dedicated desk locks this writer produces.
 * The hub module does not keep a second desk table.
 */
export type DeskLeaseKind = 'desk' | 'lane'

export type DeskLeaseMode = 'preferred' | 'dedicated'

export interface DeskLease {
  pointId: string
  kind: DeskLeaseKind
  airlineId: string
  mode: DeskLeaseMode
}

export interface DeskLeasePoint {
  id: string
  kind: DeskLeaseKind
  built: boolean
  staffed: boolean
  /** A kiosk cannot be dedicated. The allocator ignores a lock on one. */
  kiosk: boolean
}

export type LeaseRefusal = 'not_built' | 'unstaffed' | 'taken' | 'kiosk'

const MODES: readonly DeskLeaseMode[] = ['preferred', 'dedicated']
const KINDS: readonly DeskLeaseKind[] = ['desk', 'lane']

export function leasesFor(leases: readonly DeskLease[], airlineId: string): DeskLease[] {
  return leases.filter((row) => row.airlineId === airlineId)
}

/**
 * Name a built, staffed desk or lane to one carrier.
 * Refuses a missing point, an unstaffed point, a kiosk, or a point
 * another carrier already holds.
 */
export function requestLease(
  leases: readonly DeskLease[],
  points: readonly DeskLeasePoint[],
  pointId: string,
  airlineId: string,
  mode: DeskLeaseMode,
): { ok: true; leases: DeskLease[] } | { ok: false; reason: LeaseRefusal } {
  if (!pointId || !airlineId || !MODES.includes(mode)) return { ok: false, reason: 'not_built' }
  const point = points.find((row) => row.id === pointId)
  if (!point || !point.built) return { ok: false, reason: 'not_built' }
  if (point.kiosk) return { ok: false, reason: 'kiosk' }
  if (!point.staffed) return { ok: false, reason: 'unstaffed' }
  const held = leases.find((row) => row.pointId === pointId)
  if (held && held.airlineId !== airlineId) return { ok: false, reason: 'taken' }
  const next = leases.filter((row) => row.pointId !== pointId)
  next.push({ pointId, kind: point.kind, airlineId, mode })
  return { ok: true, leases: next }
}

export function releaseLease(leases: readonly DeskLease[], pointId: string): DeskLease[] {
  return leases.filter((row) => row.pointId !== pointId)
}

export function readDeskLeases(raw: unknown): DeskLease[] {
  if (!Array.isArray(raw)) return []
  const out: DeskLease[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const src = row as Record<string, unknown>
    const pointId = typeof src.pointId === 'string' ? src.pointId : ''
    const airlineId = typeof src.airlineId === 'string' ? src.airlineId : ''
    const kind = src.kind
    const mode = src.mode
    if (!pointId || !airlineId || seen.has(pointId)) continue
    if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) continue
    if (typeof mode !== 'string' || !(MODES as readonly string[]).includes(mode)) continue
    seen.add(pointId)
    out.push({ pointId, airlineId, kind: kind as DeskLeaseKind, mode: mode as DeskLeaseMode })
  }
  return out
}
