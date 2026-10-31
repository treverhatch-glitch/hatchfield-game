import type { Vec } from './types.ts'
import { detHypot } from './detMath.ts'

/**
 * Extend a landing route backward past the runway end so the jet
 * starts off the map and flies a visible approach.
 */
export function inboundApproach(route: Vec[], cells = 14): Vec[] {
  if (route.length < 2) {
    return route.map((pt) => ({
      c: Number.isFinite(pt.c) ? pt.c : 0,
      r: Number.isFinite(pt.r) ? pt.r : 0,
    }))
  }
  const cleanRoute = route.map((pt) => ({
    c: Number.isFinite(pt.c) ? pt.c : 0,
    r: Number.isFinite(pt.r) ? pt.r : 0,
  }))
  const a = cleanRoute[0]
  const b = cleanRoute[1]
  const ac = a.c
  const ar = a.r
  const bc = b.c
  const br = b.r
  let dc = ac - bc
  let dr = ar - br
  const len = detHypot(dc, dr)
  const safeLen = Number.isFinite(len) && len > 0 ? len : 1
  dc /= safeLen
  dr /= safeLen
  if (!Number.isFinite(dc)) dc = 0
  if (!Number.isFinite(dr)) dr = 0
  const lead: Vec[] = []
  const numCells = Number.isFinite(cells) && cells > 0 ? cells : 0
  for (let i = numCells; i >= 1; i--) {
    lead.push({ c: ac + dc * i, r: ar + dr * i })
  }
  return [...lead, ...cleanRoute]
}

/** True once the aircraft has cleared the playable grid. */
export function hasLeftMap(x: number, y: number, size: number, margin = 8): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || !Number.isFinite(margin)) {
    return false
  }
  return x < -margin || y < -margin || x > size + margin || y > size + margin
}

/**
 * Sample a position along a polyline flight path for progress parameter t (0 to 1).
 */
export function sampleFlightPath(path: readonly Vec[], t: number): Vec {
  if (!path || path.length === 0) {
    return { c: 0, r: 0 }
  }
  const p0 = path[0]
  const safeP0: Vec = {
    c: Number.isFinite(p0?.c) ? p0.c : 0,
    r: Number.isFinite(p0?.r) ? p0.r : 0,
  }
  if (path.length === 1) {
    return safeP0
  }

  // Clamp t to [0, 1] and handle NaN
  const safeT = !Number.isNaN(t) ? Math.min(1, Math.max(0, t)) : 0

  // Calculate cumulative distances
  const cum: number[] = [0]
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const curr = path[i]
    const pc = Number.isFinite(prev.c) ? prev.c : 0
    const pr = Number.isFinite(prev.r) ? prev.r : 0
    const cc = Number.isFinite(curr.c) ? curr.c : pc
    const cr = Number.isFinite(curr.r) ? curr.r : pr
    const dist = detHypot(cc - pc, cr - pr)
    const safeDist = Number.isFinite(dist) ? dist : 0
    cum.push(cum[i - 1] + safeDist)
  }

  const total = cum[cum.length - 1]
  if (!Number.isFinite(total) || total <= 0) {
    return safeP0
  }

  const targetDist = safeT * total
  let k = 1
  while (k < cum.length - 1 && cum[k] < targetDist) {
    k++
  }

  const p = path[k - 1]
  const q = path[k]
  const pc = Number.isFinite(p.c) ? p.c : 0
  const pr = Number.isFinite(p.r) ? p.r : 0
  const qc = Number.isFinite(q.c) ? q.c : pc
  const qr = Number.isFinite(q.r) ? q.r : pr

  const segLen = cum[k] - cum[k - 1]
  const safeSegLen = Number.isFinite(segLen) && segLen > 0 ? segLen : 1
  const segT = Math.min(1, Math.max(0, (targetDist - cum[k - 1]) / safeSegLen))

  const c = pc + (qc - pc) * segT
  const r = pr + (qr - pr) * segT

  return {
    c: Number.isFinite(c) ? c : safeP0.c,
    r: Number.isFinite(r) ? r : safeP0.r,
  }
}

export const pointAlongPath = sampleFlightPath
export const interpolateFlightPath = sampleFlightPath
