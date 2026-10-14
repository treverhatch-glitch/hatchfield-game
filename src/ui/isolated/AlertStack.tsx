import type { CSSProperties } from 'react'
import type { Game } from '../../game/sim.ts'
import type { AlertSeverity } from '../../game/alerts.ts'
import { ALERT_TUNING } from '../../game/alertsData.ts'
import { DISRUPTION_ALERT_PREFIX } from '../../disruptions/alertFeed.ts'

const SEV_COLOR: Record<AlertSeverity, string> = {
  critical: '#e0574a',
  warning: '#f0c14a',
  info: '#7eb6e0',
}

/**
 * Live operational alerts, a small stack on the left edge — never over the field centre.
 * Each row pans to the problem, dismisses, or is ignored. The stack minimises to a counter.
 */
export function AlertStackView({ game }: { game: Game }) {
  const stack = game.alerts
  const rows = stack.ranked()
  if (!rows.length) return null
  const worst = rows[0].severity
  if (stack.minimised) {
    return (
      <button
        type="button"
        className="alert-counter"
        data-testid="alert-counter"
        onClick={() => game.minimiseAlerts(false)}
        title="Show alerts"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          left: 312,
          top: 'calc(var(--hud-top) + 8px)',
          background: 'rgb(15 23 42 / 0.94)',
          color: '#e2e8f0',
          border: `1px solid ${SEV_COLOR[worst]}`,
          borderRadius: 999,
          padding: '3px 10px',
          font: '700 12px sans-serif',
        }}
      >
        ⚠ {rows.length}
      </button>
    )
  }
  const shown = rows.slice(0, ALERT_TUNING.visible)
  return (
    <div
      className="alert-stack"
      data-testid="alert-stack"
      style={{
        pointerEvents: 'auto',
        position: 'absolute',
        left: 312,
        top: 'calc(var(--hud-top) + 8px)',
        width: 250,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        font: '12px sans-serif',
        color: '#e2e8f0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ font: '700 11px sans-serif', opacity: 0.85 }}>
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
          data-testid={`alert-${a.key}`}
          style={{
            background: 'rgb(15 23 42 / 0.94)',
            border: '1px solid rgb(255 255 255 / 0.12)',
            borderLeft: `3px solid ${SEV_COLOR[a.severity]}`,
            borderRadius: 12,
            padding: '5px 8px',
          }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <strong>
              {a.title}
              {a.count > 1 ? ` ×${a.count}` : ''}
            </strong>
            <button
              type="button"
              data-testid={`alert-dismiss-${a.key}`}
              onClick={() => game.dismissAlert(a.id)}
              title="Dismiss"
              style={iconBtn}
            >
              ×
            </button>
          </span>
          <span style={{ display: 'block', opacity: 0.85 }}>{a.detail}</span>
          <span style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {a.at && a.at.cells.length ? (
              <button type="button" data-testid={`alert-pan-${a.key}`} onClick={() => game.panToAlert(a.id)} style={btn}>
                Pan to problem
              </button>
            ) : null}
            {a.key.startsWith(DISRUPTION_ALERT_PREFIX) ? (
              <button
                type="button"
                data-testid={`alert-fix-${a.key}`}
                onClick={() => game.recoverDisruption(a.key.slice(DISRUPTION_ALERT_PREFIX.length))}
                style={btn}
              >
                Apply fix
              </button>
            ) : null}
            <button
              type="button"
              data-testid={`alert-ignore-${a.key}`}
              onClick={() => game.ignoreAlert(a.id)}
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
  color: '#e2e8f0',
  border: '1px solid rgb(125 211 252 / 0.55)',
  borderRadius: 999,
  padding: '1px 7px',
  font: '600 11px sans-serif',
  cursor: 'pointer',
}

const iconBtn: CSSProperties = {
  background: 'transparent',
  color: '#e2e8f0',
  border: 'none',
  font: '700 14px sans-serif',
  cursor: 'pointer',
  lineHeight: 1,
  padding: '0 4px',
}
