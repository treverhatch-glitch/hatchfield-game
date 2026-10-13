import { useState } from 'react'
import type { Game } from '../game/sim.ts'

/** Rival names sit on the sign button. The standing deltas open on click. */
export function ReactionCard({
  game,
  airlineId,
  kind,
}: {
  game: Game
  airlineId: string
  kind: 'sign' | 'perk' | 'hub' | 'slots'
}) {
  const [open, setOpen] = useState(false)
  const preview = game.diplomacyReaction(airlineId, kind)
  if (!preview) return null
  if (!preview.rivals.length && !preview.allies.length && !preview.warnings.length) return null
  const names = preview.rivals.map((row) => row.name)
  return (
    <div className="dip-sub">
      <p className="muted">{names.length ? `${names.join(', ')} would react` : 'Check the field before you sign'}</p>
      <button type="button" data-testid="diplomacy-reaction-open" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide reaction' : 'Reaction'}
      </button>
      {open ? (
        <ul className="dip-lines" data-testid="diplomacy-reaction">
          {preview.rivals.map((row) => (
            <li key={row.airlineId}>
              <span>
                {row.name} · {row.why}
              </span>
              <span>{row.delta}</span>
            </li>
          ))}
          {preview.allies.map((row) => (
            <li key={row.airlineId}>
              <span>
                {row.name} · {row.why}
              </span>
              <span>+{row.delta}</span>
            </li>
          ))}
          {preview.warnings.map((warning) => (
            <li key={warning}>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
