/**
 * Capacity forecast for the processing points the live walk runs (check-in
 * desks, security lanes, and a bag drop once one is on the walk). Glue only:
 * the maths is `src/throughput` (`checkinMix`, `securityPlan`); this reads the
 * walk's own metrics, so the forecast uses the kit the player built and staffed
 * and the passengers who are actually on their way, never a made-up arrival
 * stream. The passenger sign sentence is a different clock and stays desks
 * and kiosks only.
 */
import { checkinMix, securityPlan } from '../throughput/index.ts'
import type { FacilityMetrics } from '../paxnav/paxnav.ts'
import type { EquipKind } from '../terminalbuild/types.ts'
import { HALL_CAPACITY_TUNING } from './hallNavData.ts'
import { itemDef } from './terminal.ts'

/** A placed piece, so a bag drop on the walk is a bag drop and not another desk. */
export interface HallForecastPiece {
  id: string
  def: string
}

export interface HallForecast {
  kind: 'checkin' | 'security'
  /** Staffed points / all points of this kind. */
  openPoints: number
  totalPoints: number
  /** Passengers committed to this kind of point now (in line, being served, walking to it). */
  committed: number
  /** 0..1+, offered load over the open capacity. */
  utilisation: number
  /** Predicted wait for the next passenger, minutes of the walk's clock. */
  waitMinutes: number
  bottleneck: boolean
  /** One player-facing line. */
  text: string
}

const KIND: Record<'checkin' | 'security', EquipKind> = { checkin: 'checkin_desk', security: 'security_lane' }
const LABEL: Record<'checkin' | 'security', string> = { checkin: 'Check-in', security: 'Security' }

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/**
 * The placed piece that spawned this point. Layout points are `${item.id}-${n}`.
 * The longest matching item id wins, the same rule the walk uses for staffing.
 */
function pieceForPoint(facilityId: string, pieces: readonly HallForecastPiece[]): HallForecastPiece | undefined {
  let best: HallForecastPiece | undefined
  for (const piece of pieces) {
    if (!piece.id) continue
    if (facilityId !== piece.id && !facilityId.startsWith(`${piece.id}-`)) continue
    if (!best || piece.id.length > best.id.length) best = piece
  }
  return best
}

/** Room `bagdrop` on the item def: that point is a bag drop in the mix, not a second desk. */
function isBagDrop(piece: HallForecastPiece | undefined): boolean {
  return piece != null && itemDef(piece.def)?.room === 'bagdrop'
}

/** Forecast one kind of point from the walk's live metrics. Null when the hall has none of that kit. */
export function hallForecast(
  kind: 'checkin' | 'security',
  metrics: readonly FacilityMetrics[],
  pieces: readonly HallForecastPiece[] = [],
): HallForecast | null {
  const T = HALL_CAPACITY_TUNING
  const points = metrics.filter((m) => m.kind === KIND[kind])
  if (!points.length) return null
  const open = points.filter((m) => m.staffed)
  const committed = points.reduce((sum, m) => sum + m.queueLength + (m.serving ? 1 : 0) + m.incoming, 0)
  const paxPerHr = (committed * 3600) / T.planWindowNavSec
  const rateOf = (m: FacilityMetrics) => (m.serviceSec > 0 ? 3600 / m.serviceSec : 0)

  let utilisation: number
  let waitMinutes: number
  let bottleneck: boolean
  if (kind === 'security') {
    const plan = securityPlan(
      points.map((m) => ({ tech: 'xray' as const, open: m.staffed, ratePerHr: rateOf(m) })),
      paxPerHr,
    )
    ;({ utilisation, waitMinutes, bottleneck } = plan)
  } else {
    const bagOpen = open.filter((m) => isBagDrop(pieceForPoint(m.id, pieces)))
    const deskOpen = open.filter((m) => !isBagDrop(pieceForPoint(m.id, pieces)))
    const meanRate = (rows: readonly FacilityMetrics[]) => rows.reduce((sum, m) => sum + rateOf(m), 0) / rows.length
    const deskRate = deskOpen.length ? meanRate(deskOpen) : rateOf(points[0])
    const ratesPerHr: { desk: number; bagDrop?: number } = { desk: deskRate }
    if (bagOpen.length) ratesPerHr.bagDrop = meanRate(bagOpen)
    const mix = checkinMix(
      { desks: deskOpen.length, kiosks: 0, bagDrops: bagOpen.length, ratesPerHr },
      paxPerHr,
      1,
    )
    utilisation = mix.overallUtilisation
    waitMinutes = mix.maxWaitMinutes
    bottleneck = mix.bottleneck
  }

  const label = LABEL[kind]
  let text: string
  if (!open.length) text = `${label} forecast: no staffed ${kind === 'checkin' ? 'desk' : 'lane'}. Hire onto a post.`
  else if (committed <= 0) text = `${label} forecast: clear, ${open.length} of ${points.length} open.`
  else if (bottleneck) text = `${label} forecast: ${pct(utilisation)} loaded, about ${Math.round(waitMinutes)} min wait. Add a ${kind === 'checkin' ? 'desk' : 'lane'} or staff.`
  else text = `${label} forecast: ${pct(utilisation)} loaded, about ${Math.round(waitMinutes)} min wait.`
  return { kind, openPoints: open.length, totalPoints: points.length, committed, utilisation, waitMinutes, bottleneck, text }
}
