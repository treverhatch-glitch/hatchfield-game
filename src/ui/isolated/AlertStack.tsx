import type { CSSProperties } from 'react'
import type { Game } from '../../game/sim.ts'
import type { AlertSeverity } from '../../game/alerts.ts'
import { ALERT_TUNING } from '../../game/alertsData.ts'

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
        data-testid="alert-counter"
        onClick={() => game.minimiseAlerts(false)}
        title="Show alerts"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          left: 8,
          top: 44,
          background: 'rgba(12, 22, 28, 0.92)',
          color: '#e7eee9',
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
      data-testid="alert-stack"
      style={{
        pointerEvents: 'auto',
        position: 'absolute',
        left: 8,
        top: 44,
        width: 250,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        font: '12px sans-serif',
        color: '#e7eee9',
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
            background: 'rgba(12, 22, 28, 0.92)',
            borderLeft: `3px solid ${SEV_COLOR[a.severity]}`,
            borderRadius: 6,
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
