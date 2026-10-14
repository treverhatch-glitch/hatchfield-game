/**
 * Which check-in desks and security lanes are open, and what a building
 * can clear. A point serves only while it is staffed. Throughput is the
 * points that are staffed and actually in use, so an empty desk or a
 * closed lane shows up as a queue instead of a hidden cap.
 *
 * Prefab points that come with the building stay open (their upkeep is
 * already in the prefab). Points the player adds on top need a hired body
 * on that post, one body per extra point. A hall with no included points
 * (a terminal the player built) keeps every point open: that building is
 * the service, same as before.
 */
import { SERVICE_POINT_TUNING } from './config.ts'

export type PointKind = 'checkin_desk' | 'security_lane'

export interface StaffPoint {
  id: string
  kind: PointKind
  /** Came with the building (a prefab bundle piece). */
  included: boolean
  /** Runs with no clerk (a kiosk). */
  automatic: boolean
}

export interface HiredPosts {
  checkin: number
  security: number
}

/** Ids of points that will serve. Everyone else can still hold a queue. */
export function openPointIds(points: readonly StaffPoint[], hired: HiredPosts): Set<string> {
  const open = new Set<string>()
  for (const kind of ['checkin_desk', 'security_lane'] as const) {
    const group = points.filter((p) => p.kind === kind)
    const building = group.some((p) => p.included)
    let spare = Math.max(0, kind === 'security_lane' ? hired.security : hired.checkin)
    for (const p of group) {
      if (p.automatic || p.included || !building) {
        open.add(p.id)
        continue
      }
      if (spare > 0) {
        spare -= 1
        open.add(p.id)
      }
    }
  }
  return open
}

export interface PointLoad {
  id: string
  kind: string
  staffed: boolean
  /** People waiting, not counting the one being served. */
  queueLength: number
  serving: boolean
  /** Seconds to serve one passenger at this point. */
  serviceSec: number
  /** Wait for someone joining now, on the same clock as `serviceSec`. */
  estWaitSec: number
}

export interface Throughput {
  points: number
  staffed: number
  /** Staffed points with someone in line or at the desk. */
  inUse: number
  /** Passengers per minute the in-use points are clearing. */
  perMin: number
  queueLength: number
  /** Worst wait across the points, same clock as the loads. */
  waitSec: number
  bottleneck: boolean
}

export function pointInUse(p: PointLoad): boolean {
  return p.staffed && (p.serving || p.queueLength > 0)
}

/**
 * `perClock` turns a nav-second service time into passengers per clock minute.
 * Pass 1 when `serviceSec` is already on the clock you want to display.
 */
export function throughputOf(points: readonly PointLoad[], bottleneckSec: number, perClock = 1): Throughput {
  const scale = Number.isFinite(perClock) && perClock > 0 ? perClock : 1
  let staffed = 0
  let inUse = 0
  let perMin = 0
  let queueLength = 0
  let waitSec = 0
  let closedQueue = false
  for (const p of points) {
    queueLength += Math.max(0, p.queueLength)
    if (p.staffed) staffed += 1
    else if (p.queueLength > 0 || p.serving) closedQueue = true
    const wait = Number.isFinite(p.estWaitSec) ? p.estWaitSec : 0
    if (wait > waitSec) waitSec = wait
    if (!pointInUse(p) || !(p.serviceSec > 0)) continue
    inUse += 1
    perMin += (60 / p.serviceSec) * scale
  }
  const bottleneck = closedQueue || waitSec >= bottleneckSec
  return {
    points: points.length,
    staffed,
    inUse,
    perMin,
    queueLength,
    waitSec,
    bottleneck,
  }
}

/** A wait on the player's clock: seconds until it is long enough to say in minutes. */
export function formatWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  if (seconds < 90) return `${Math.round(seconds)}s`
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

export interface InfoPoint {
  id: string
  kind: string
  staffed: boolean
  queueLength: number
  serving: boolean
  /** Wait already on the clock the panel should print. */
  waitSec: number
}

/**
 * Click-open lines: how many points are staffed and in use, then each
 * point's queue and wait.
 */
export function serviceInfoLines(label: string, points: readonly InfoPoint[], throughput: Throughput): string[] {
  const noun = label === 'Security' ? 'lane' : 'desk'
  const lines = [
    `${label}`,
    `${throughput.staffed} of ${throughput.points} ${noun}${throughput.points === 1 ? '' : 's'} staffed · ${throughput.inUse} in use`,
    `Queue ${throughput.queueLength} · wait ${formatWait(throughput.waitSec)}`,
    `Throughput ${throughput.perMin.toFixed(1)}/min`,
  ]
  points.forEach((p, i) => {
    const name = p.kind === 'security_lane' ? `Lane ${i + 1}` : `Desk ${i + 1}`
    const state = !p.staffed ? 'unstaffed' : p.serving || p.queueLength > 0 ? 'in use' : 'idle'
    lines.push(`${name} · queue ${p.queueLength} · wait ${formatWait(p.waitSec)} · ${state}`)
  })
  if (throughput.bottleneck) lines.push('Bottleneck — staff another point, or add a desk')
  return lines
}

/** Extra lanes beyond the prefab, opened one per hired screener. */
export function extraOpenServers(extraServers: number, hired: number): number {
  const extra = Number.isFinite(extraServers) ? Math.max(0, Math.floor(extraServers)) : 0
  const bodies = Number.isFinite(hired) ? Math.max(0, Math.floor(hired)) : 0
  return Math.min(extra, bodies)
}

export { SERVICE_POINT_TUNING }
