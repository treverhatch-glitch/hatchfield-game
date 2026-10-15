import { useState } from 'react'
import type { Game } from '../../game/sim.ts'
import { RELATION_MAX, RELATION_MIN } from '../../wave3/config.ts'
import { RELATION_PART_LABELS } from '../../wave3/relations.ts'
import type { RelationParts } from '../../wave3/types.ts'

/** Signed-carrier feelings. This is the bottom-left Airlines tab, not a floating list. */
export function RelationsTab({ game }: { game: Game }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const span = RELATION_MAX - RELATION_MIN
  return (
    <div className="relations-tab" data-testid="relations-tab">
      <strong>Airline relations</strong>
      {game.signed.length === 0 ? (
        <p className="muted">No signed carriers yet. A kept contract is what starts the climb.</p>
      ) : (
        game.signed.map((id) => {
          const rel = game.wave3.relation(id)
          const open = openId === id
          const pct = Math.max(0, Math.min(100, ((rel.score - RELATION_MIN) / span) * 100))
          const lines = (Object.keys(RELATION_PART_LABELS) as (keyof RelationParts)[]).filter((key) => rel.parts[key] !== 0)
          return (
            <div key={id}>
              <button type="button" data-testid={`relations-row-${id}`} onClick={() => setOpenId(open ? null : id)}>
                <span>{game.airline(id).name}</span>
                <span>
                  T{rel.tier} {rel.label} {rel.score > 0 ? `+${rel.score.toFixed(1)}` : rel.score.toFixed(1)}
                </span>
              </button>
              {open ? (
                <div data-testid="relations-detail">
                  <p>
                    {game.wave3.feeLine(id)} · {game.wave3.slotLine(id)}
                  </p>
                  <div className="rel-meter" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <ul>
                    {lines.map((key) => (
                      <li key={key}>
                        {RELATION_PART_LABELS[key]} {rel.parts[key] > 0 ? `+${rel.parts[key].toFixed(1)}` : rel.parts[key].toFixed(1)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}
