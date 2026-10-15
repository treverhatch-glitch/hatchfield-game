import type { FieldProgress } from '../../game/catalog.ts'
import { LiveText } from '../LiveText.tsx'
import { nextUnlockLine, unlocksAtLevel } from './levelUnlocks.ts'

/** Toolbar badge: field level, XP bar, and the research-points counter. */
export function FieldBadge({
  progress,
  points,
  title,
  onOpen,
}: {
  progress: FieldProgress
  points: () => string
  title: string
  onOpen: () => void
}) {
  const pct = Math.round(progress.pct * 100)
  const next = nextUnlockLine(progress)
  return (
    <button
      type="button"
      className="stat field-badge"
      data-testid="field-level"
      title={title}
      onClick={onOpen}
    >
      <span className="field-badge-label">Field {progress.label}</span>
      <span className="xp-track" aria-hidden>
        <span className="xp-fill" style={{ width: `${pct}%` }} />
      </span>
      <LiveText className="field-rp" testId="research-points" read={points} />
      {next ? (
        <span className="field-next" data-testid="field-next">
          {next}
        </span>
      ) : null}
    </button>
  )
}

/** Corner card when the field levels up. It does not cover the apron. */
export function LevelUpCard({
  level,
  onClose,
  onProgression,
}: {
  level: number
  onClose: () => void
  onProgression: () => void
}) {
  const rows = unlocksAtLevel(level)
  return (
    <aside className="level-up" data-testid="level-up" aria-label={`Field level ${level} unlocked`}>
      <h2>Field level {level} unlocked</h2>
      {rows.length === 0 ? (
        <p className="muted">No new stamp at this level.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`}>{row.kind === 'research' ? `Research: ${row.name}` : row.name}</li>
          ))}
        </ul>
      )}
      <div className="row">
        <button type="button" className="on" data-testid="level-up-progression" onClick={onProgression}>
          Open Progression
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  )
}
