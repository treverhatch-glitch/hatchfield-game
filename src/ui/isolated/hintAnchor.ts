import { ALERT_TUNING } from '../../game/alertsData.ts'
import type { Game } from '../../game/sim.ts'

/** Today's place, when the alert dock has nothing to clear. */
export const HINT_REST_BOTTOM = 120

/** Matches `.alert-dock` `bottom`. The badge moves; the dock stays. */
export const ALERT_DOCK_BOTTOM = 168

const DOCK_HEAD_PX = 28
const DOCK_CARD_PX = 96
const DOCK_GAP_PX = 4
const DOCK_MIN_PX = 32
const DOCK_MAX_PX = 320
const CLEAR_GAP_PX = 8

export interface DockAnchor {
  rows: number
  minimised: boolean
}

/** Visible dock block. Capped at the dock's max-height so a long stack still clears. */
export function dockBlockHeight(anchor: DockAnchor): number {
  if (anchor.rows <= 0) return 0
  if (anchor.minimised) return DOCK_MIN_PX
  const shown = Math.min(anchor.rows, ALERT_TUNING.visible)
  const raw = DOCK_HEAD_PX + shown * DOCK_CARD_PX + Math.max(0, shown - 1) * DOCK_GAP_PX
  return Math.min(DOCK_MAX_PX, raw)
}

/** Badge bottom edge. Empty dock keeps today's offset; a dock with rows sits below the badge. */
export function hintBadgeBottom(anchor: DockAnchor): number {
  if (anchor.rows <= 0) return HINT_REST_BOTTOM
  return ALERT_DOCK_BOTTOM + dockBlockHeight(anchor) + CLEAR_GAP_PX
}

export function dockAnchor(game: Game): DockAnchor {
  let rows = 0
  for (const alert of game.alerts.ranked()) {
    if (alert.severity === 'critical' || alert.severity === 'warning') rows += 1
  }
  return { rows, minimised: game.alerts.minimised }
}
