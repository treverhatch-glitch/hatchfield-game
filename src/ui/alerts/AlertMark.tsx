import { useSyncExternalStore } from 'react'
import type { Game } from '../../game/sim.ts'
import { ALERT_TUNING } from '../../game/alertsData.ts'
import { alertPoint, alertPointsRev, subscribeAlertPoints } from './alertScreen.ts'
import { criticalAlertMarks } from './marks.ts'

/**
 * One pin on the apron for each visible critical alert.
 * Clicking it pans the same way the dock card does. Not a letter, not a phone card.
 */
export function AlertMarks({ game }: { game: Game }) {
  useSyncExternalStore(subscribeAlertPoints, alertPointsRev, () => 0)
  const marks = criticalAlertMarks(game.alerts.ranked(), ALERT_TUNING.visible)
  if (!marks.length) return null
  return (
    <div className="alert-marks" data-testid="alert-marks">
      {marks.map((mark) => {
        const pt = alertPoint(mark.id)
        const placed = pt?.on === true
        return (
          <button
            key={mark.id}
            type="button"
            className="alert-mark"
            data-testid={`alert-mark-${mark.key}`}
            data-cell={`${mark.cell.c},${mark.cell.r}`}
            title={`${mark.title}. Pan to problem`}
            aria-label={`${mark.title}. Pan to problem`}
            hidden={!placed}
            style={placed ? { left: `${pt.x * 100}%`, top: `${pt.y * 100}%` } : undefined}
            onClick={() => game.panToAlert(mark.id)}
          />
        )
      })}
    </div>
  )
}
