import type { CSSProperties, MouseEvent } from 'react'
import type { Game } from '../../game/sim.ts'
import type { Alert } from '../../game/alerts.ts'
import { ALERT_TUNING } from '../../game/alertsData.ts'
import { DISRUPTION_ALERT_PREFIX } from '../../disruptions/alertFeed.ts'
import { AlertMarks } from '../alerts/AlertMark.tsx'

/** The stack shows these two levels. Info notes stay in the sim and off this dock. */
const STACK_SEVERITY = ['critical', 'warning'] as const
type StackSeverity = (typeof STACK_SEVERITY)[number]

const SEV_COLOR: Record<StackSeverity, string> = {
  critical: '#e0574a',
  warning: '#f0c14a',
}

const SEV_LABEL: Record<StackSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
}

function isStackAlert(alert: Alert): alert is Alert & { severity: StackSeverity } {
  return alert.severity === 'critical' || alert.severity === 'warning'
}

function keepClick(run: () => void) {
  return (event: MouseEvent) => {
    event.stopPropagation()
    run()
  }
}

/**
 * Live operational alerts, bottom right, above the build bar.
 * Critical and warning only. Clicking a card jumps the camera to the problem.
 * Dismiss, ignore, and apply-fix stay on the card and do not pan.
 * Emergencies are letters, not rows here, and they never go through the phone.
 */
export function AlertStackView({ game }: { game: Game }) {
  return (
    <>
      <AlertMarks game={game} />
      <AlertDock game={game} />
    </>
  )
}

function AlertDock({ game }: { game: Game }) {
  const stack = game.alerts
  const rows = stack.ranked().filter(isStackAlert)
  if (!rows.length) return null
  const worst = rows[0].severity
  if (stack.minimised) {
    return (
      <button
        type="button"
        className="alert-dock alert-dock-min"
        data-testid="alert-counter"
        onClick={() => game.minimiseAlerts(false)}
        title="Show alerts"
        style={{ borderColor: SEV_COLOR[worst] }}
      >
        {SEV_LABEL[worst]} · {rows.length}
      </button>
    )
  }
  const shown = rows.slice(0, ALERT_TUNING.visible)
  return (
    <div className="alert-dock" data-testid="alert-stack">
      <div className="alert-dock-head">
        <span>
          Alerts · {rows.length}
          {rows.length > shown.length ? ` (${rows.length - shown.length} more)` : ''}
        </span>
        <button
          type="button"
          data-testid="alert-minimise"
          onClick={() => game.minimiseAlerts(true)}
          title="Minimise alerts"
          style={iconBtn}
        >
          –
        </button>
      </div>
      {shown.map((a) => (
        <div
          key={a.id}
          className="alert-card"
          data-testid={`alert-${a.key}`}
          data-severity={a.severity}
          title="Jump the camera to this problem"
          onClick={() => game.panToAlert(a.id)}
        >
          <span className="alert-card-title">
            <strong>
              <span className="alert-sev" data-severity={a.severity}>
                {SEV_LABEL[a.severity]}
              </span>
              {a.title}
              {a.count > 1 ? ` ×${a.count}` : ''}
            </strong>
            <button
              type="button"
              data-testid={`alert-dismiss-${a.key}`}
              onClick={keepClick(() => game.dismissAlert(a.id))}
              title="Dismiss"
              style={iconBtn}
            >
              ×
            </button>
          </span>
          <span className="alert-card-detail">{a.detail}</span>
          <span className="alert-card-actions">
            <button
              type="button"
              data-testid={`alert-pan-${a.key}`}
              onClick={keepClick(() => game.panToAlert(a.id))}
              style={btn}
            >
              Pan to problem
            </button>
            {a.key.startsWith(DISRUPTION_ALERT_PREFIX) ? (
              <button
                type="button"
                data-testid={`alert-fix-${a.key}`}
                onClick={keepClick(() => game.recoverDisruption(a.key.slice(DISRUPTION_ALERT_PREFIX.length)))}
                style={btn}
              >
                Apply fix
              </button>
            ) : null}
            <button
              type="button"
              data-testid={`alert-ignore-${a.key}`}
              onClick={keepClick(() => game.ignoreAlert(a.id))}
              title="Stay quiet about this until it clears"
              style={{ ...btn, opacity: 0.75 }}
            >
              Ignore
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}

const btn: CSSProperties = {
  background: 'transparent',
  color: '#e7eee9',
  border: '1px solid #c9a27a',
  borderRadius: 4,
  padding: '1px 7px',
  font: '600 11px sans-serif',
  cursor: 'pointer',
}

const iconBtn: CSSProperties = {
  background: 'transparent',
  color: '#e7eee9',
  border: 'none',
  font: '700 14px sans-serif',
  cursor: 'pointer',
  lineHeight: 1,
  padding: '0 4px',
}
