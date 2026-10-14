import { DEPLANE_MINUTES } from '../hub/config.ts'
import { linkTravelMinutes, minimumConnectionTime } from '../hub/connect.ts'
import type { ConnectionVerdict } from '../hub/types.ts'
import {
  LANDSIDE_RECHECK_MINUTES,
  MCT_ROUND_TO,
  MCT_WALK_PERCENTILE,
  TRANSFER_SECURITY_MINUTES,
} from './config.ts'
import { clamp01 } from './mix.ts'
import type { LayoutMct, LayoutMctInput } from './types.ts'

function percentile(values: readonly number[], p: number): number {
  const clean = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b)
  if (!clean.length) return 0
  const index = Math.min(clean.length - 1, Math.max(0, Math.ceil(clean.length * p) - 1))
  return clean[index]
}

/**
 * Published minimum connection time for this layout. The facility floor
 * comes from the hub layer; the walk is the long end of real gate pairs, and
 * screening is added whenever any transfer traffic is re-screened.
 * A spread-out pier or no transfer lane pushes MCT up.
 */
export function layoutMct(input: LayoutMctInput): LayoutMct {
  const base = minimumConnectionTime(input.facilities)
  const metres = percentile(input.pairMetres, MCT_WALK_PERCENTILE)
  const walk = linkTravelMinutes(input.link, metres, Math.max(0, input.walkwayMetres ?? 0))
  const walkMinutes = Number.isFinite(walk) ? walk : 0
  const lane = input.transferLane ? TRANSFER_SECURITY_MINUTES : LANDSIDE_RECHECK_MINUTES
  // Published for the worst routine case: if anyone is re-screened, MCT covers it.
  const screenMinutes = clamp01(input.screenShare) > 0 ? lane : 0
  const raw = Math.max(base, DEPLANE_MINUTES + walkMinutes + screenMinutes)
  const total = Math.ceil(raw / MCT_ROUND_TO) * MCT_ROUND_TO
  return { base, walkMinutes, screenMinutes, total }
}

/**
 * Re-judge a hub verdict once screening is on the route. Screening only slows
 * the passenger; the bag is already airside.
 */
export function withScreening(verdict: ConnectionVerdict, screenMinutes: number): ConnectionVerdict {
  const extra = Number.isFinite(screenMinutes) ? Math.max(0, screenMinutes) : 0
  if (extra <= 0) return verdict
  const paxMinutes = verdict.paxMinutes + extra
  const meetsMct = verdict.available + 1e-9 >= verdict.mct
  const paxMade = meetsMct && verdict.available + 1e-9 >= paxMinutes
  let reason = verdict.reason
  if (reason === 'ok' && !paxMade) reason = 'pax_late'
  return { ...verdict, paxMinutes, paxMade, reason, made: reason === 'ok' }
}
