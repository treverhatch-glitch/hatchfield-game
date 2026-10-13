import type { CSSProperties } from 'react'
import type { Game } from '../../game/sim.ts'
import { severityOf, worstSeverity, type HintSeverity } from '../../game/hints.ts'

const SEV_COLOR: Record<HintSeverity, string> = {
  blocker: '#e0574a',
  warning: '#f0c14a',
  tip: '#7eb6e0',
}

const SEV_WORD: Record<HintSeverity, string> = {
  blocker: 'Blocker',
  warning: 'Warning',
  tip: 'Tip',
}

/**
 * Advisor hints, bottom-right. Collapsed to a badge (count + worst severity);
 * opens to a worst-first list. Shares the one-panel slot with the HUD rollout.
 * Inline styles so a HUD redesign can lift it.
 */
export function HintPanel({ game }: { game: Game }) {
  const hints = game.visibleHints()
  const open = game.sidePanel === 'hints'
  if (!hints.length) return null
  const worst = worstSeverity(hints) ?? 'tip'
  return (
    <div
      data-testid="hint-panel"
      style={{
        pointerEvents: 'auto',
        position: 'absolute',
        right: 12,
        bottom: 120,
        width: open ? 300 : 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        font: '13px sans-serif',
        color: '#e7eee9',
      }}
    >
      {open && (
        <div
          data-testid="hint-list"
          style={{
            width: '100%',
            maxHeight: 'min(40vh, 340px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {hints.map((note) => {
            const sev = severityOf(note)
            return (
              <div
                key={note.id}
                data-testid={`hint-${note.id}`}
                style={{
                  background: 'rgba(12, 22, 28, 0.94)',
                  borderLeft: `3px solid ${SEV_COLOR[sev]}`,
                  borderRadius: 6,
                  padding: '6px 8px',
                }}
              >
                <span style={{ color: SEV_COLOR[sev], font: '700 10px sans-serif', letterSpacing: 0.5 }}>
                  {SEV_WORD[sev].toUpperCase()}
                </span>
                <strong style={{ display: 'block', margin: '2px 0' }}>{note.title}</strong>
                {note.detail ? <span style={{ display: 'block', opacity: 0.85 }}>{note.detail}</span> : null}
                {note.fix ? <span style={{ display: 'block', marginTop: 3, color: '#f0c14a' }}>{note.fix}</span> : null}
                <span style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    type="button"
                    data-testid={`hint-show-${note.id}`}
                    onClick={() => game.showHint(note.id)}
                    style={btn}
                  >
                    Show me
                  </button>
                  <button
                    type="button"
                    data-testid={`hint-mute-${note.id}`}
                    title="Turn hints back on in Settings → All hints enabled"
                    onClick={() => game.muteHint(note.id)}
                    style={{ ...btn, opacity: 0.75 }}
                  >
                    Don't show hints of this type
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}
      <button
        type="button"
        data-testid="hint-badge"
        onClick={() => game.setSidePanel(open ? null : 'hints')}
        title={open ? 'Hide hints' : 'Show hints'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(12, 22, 28, 0.92)',
          color: '#e7eee9',
          border: `1px solid ${SEV_COLOR[worst]}`,
          borderRadius: 999,
          padding: '4px 10px',
          font: '700 12px sans-serif',
        }}
      >
        <span
          aria-hidden
          style={{ width: 8, height: 8, borderRadius: 999, background: SEV_COLOR[worst], display: 'inline-block' }}
        />
        {hints.length} hint{hints.length === 1 ? '' : 's'}
        <span style={{ opacity: 0.7, fontWeight: 400 }}>{open ? '▾' : '▴'}</span>
      </button>
    </div>
  )
}

const btn: CSSProperties = {
  background: 'transparent',
  color: '#e7eee9',
  border: '1px solid #c9a27a',
  borderRadius: 4,
  padding: '2px 8px',
  font: '600 11px sans-serif',
  cursor: 'pointer',
}
