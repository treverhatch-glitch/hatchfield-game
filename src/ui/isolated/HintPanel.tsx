import { useMemo } from 'react'
import type { Game } from '../../game/sim.ts'
import { hintSeverity, worstSeverity } from '../../game/advisorBridge.ts'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../../game/advisorData.ts'

/** Sits above the bottom dock, clear of the field centre. */
const ANCHOR = { right: 12, bottom: 176 } as const

/**
 * Terminal Advisor hints — one list for layout, kit, litter, and ops notes.
 * Collapsed to a badge (count + worst severity). Open, it lists hints worst
 * first with a "Show me" that pans the camera and highlights the cells.
 * Opening it closes any other floating panel (`game.claimPanel`).
 */
export function HintPanel({ game }: { game: Game }) {
  const advice = game.advice
  // `advice` is replaced, never mutated, on refresh — so this only re-runs then.
  const rows = useMemo(
    () => advice.map((note) => ({ note, severity: hintSeverity(note) })),
    [advice],
  )
  const worst = useMemo(() => worstSeverity(advice), [advice])
  const open = game.openPanel === 'hints'
  const tone = worst ? SEVERITY_COLOR[worst] : '#7dcea0'

  return (
    <div
      data-testid="advisor"
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        right: ANCHOR.right,
        bottom: ANCHOR.bottom,
        width: 300,
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
          data-testid="hint-panel"
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxHeight: '38vh',
            overflowY: 'auto',
            background: 'rgba(12, 22, 28, 0.94)',
            border: '1px solid #c9a27a',
            borderRadius: 8,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {rows.length === 0 && (
            <div style={{ padding: '6px 4px', opacity: 0.85 }}>No problems spotted. Keep building.</div>
          )}
          {rows.map(({ note, severity }) => (
            <div
              key={note.id}
              data-testid={`advice-${note.id}`}
              data-severity={severity}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderLeft: `3px solid ${SEVERITY_COLOR[severity]}`,
                borderRadius: 4,
                padding: '6px 8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    font: '700 10px sans-serif',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: SEVERITY_COLOR[severity],
                  }}
                >
                  {SEVERITY_LABEL[severity]}
                </span>
                <strong style={{ flex: 1 }}>{note.title}</strong>
              </div>
              {note.detail && <div style={{ opacity: 0.85, marginTop: 2 }}>{note.detail}</div>}
              {note.fix && <div style={{ marginTop: 3, color: '#f0c14a' }}>{note.fix}</div>}
              {note.cells.length > 0 && (
                <button
                  type="button"
                  data-testid={`show-me-${note.id}`}
                  onClick={() => game.showHint(note.id)}
                  style={{
                    marginTop: 5,
                    background: 'transparent',
                    color: '#8fd0ff',
                    border: '1px solid rgba(143, 208, 255, 0.5)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    font: '600 12px sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  Show me
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        data-testid="hint-badge"
        data-worst={worst ?? 'none'}
        aria-expanded={open}
        title={open ? 'Hide hints' : 'Show hints'}
        onClick={() => game.toggleHints()}
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(12, 22, 28, 0.9)',
          color: '#e7eee9',
          border: `1px solid ${tone}`,
          borderRadius: 999,
          padding: '4px 10px',
          font: '700 12px sans-serif',
          cursor: 'pointer',
        }}
      >
        <span
          style={{ width: 9, height: 9, borderRadius: '50%', background: tone, display: 'inline-block' }}
        />
        {advice.length ? `${advice.length} hint${advice.length === 1 ? '' : 's'}` : 'Advisor'}
        {worst && <span style={{ color: tone }}>· {SEVERITY_LABEL[worst]}</span>}
      </button>
    </div>
  )
}
