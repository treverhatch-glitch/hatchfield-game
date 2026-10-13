import type { CSSProperties } from 'react'
import type { PlaytestYearReport, YearSectionView } from './yearEnd.ts'

const cardStyle: CSSProperties = {
  pointerEvents: 'auto',
  position: 'absolute',
  top: 74,
  right: 16,
  width: 'min(320px, calc(100vw - 32px))',
  maxHeight: 'min(46vh, 420px)',
  overflow: 'auto',
  zIndex: 33,
  background: 'rgba(12, 22, 18, 0.94)',
  border: '1px solid rgba(201, 162, 39, 0.55)',
  borderRadius: 10,
  padding: '12px 14px 14px',
  boxShadow: '0 8px 22px rgba(0, 0, 0, 0.35)',
  color: '#e8eef4',
  font: '13px/1.4 sans-serif',
}

/**
 * Corner card. The field stays visible: this is not a blocking modal.
 * PR #63's year card can render `PlaytestYearSections` inside its own body
 * and skip mounting this card once both reports share one close.
 */
export function PlaytestYearPanel({
  report,
  onDismiss,
}: {
  report: PlaytestYearReport
  onDismiss: () => void
}) {
  return (
    <aside
      style={cardStyle}
      role="dialog"
      aria-modal="false"
      aria-labelledby="playtest-year-title"
      data-testid="playtest-year-report"
    >
      <h2 id="playtest-year-title" style={{ margin: 0, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c9a227' }}>
        Year {report.year}
      </h2>
      <p style={{ margin: '4px 0 8px', color: '#9eb0a0' }}>
        Days {report.fromDay + 1}–{report.toDay}
      </p>
      <PlaytestYearSections sections={report.sections} />
      <button type="button" data-testid="playtest-year-dismiss" onClick={onDismiss}>
        Close report
      </button>
    </aside>
  )
}

export function PlaytestYearSections({ sections }: { sections: readonly YearSectionView[] }) {
  return (
    <div data-testid="playtest-year-sections">
      {sections.map((section) => (
        <section key={section.id} data-testid={`year-section-${section.id}`} style={{ marginBottom: 10 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e7c56a' }}>
            {section.title}
          </h3>
          {section.emptyNote ? (
            <p data-testid={`year-empty-${section.id}`} style={{ margin: '0 0 4px', color: '#9eb0a0' }}>
              {section.emptyNote}
            </p>
          ) : null}
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', margin: 0 }}>
            {section.lines.map((line) => (
              <div key={line.id} style={{ display: 'contents' }}>
                <dt style={{ color: '#9eb0a0' }}>{line.label}</dt>
                <dd style={{ margin: 0, textAlign: 'right' }} data-testid={`year-line-${section.id}-${line.id}`}>
                  {line.value}
                </dd>
                {line.detail ? (
                  <dd style={{ gridColumn: '1 / -1', margin: '0 0 4px', color: '#d5dece', textAlign: 'left' }}>
                    {line.detail}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
