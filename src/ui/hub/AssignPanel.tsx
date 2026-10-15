import { useEffect, useState } from 'react'
import type { Game } from '../../game/sim.ts'
import type { AssignKind } from '../../hubprogress/assign.ts'

const KIND_LABEL: Record<AssignKind, string> = {
  desk: 'Desks',
  lane: 'Lanes',
  gate: 'Stands',
  lounge: 'Lounges',
  hangar: 'Hangar bays',
  vehicle: 'Vehicles',
}

/** Side panel. The apron stays visible. Esc closes it before the hub profile. */
export function AssignPanel({ game }: { game: Game }) {
  const [, setRev] = useState(0)
  const [focus, setFocus] = useState('')
  useEffect(() => {
    const off = game.subscribe(() => setRev((n) => n + 1))
    return () => {
      off()
    }
  }, [game])

  const pick = game.assignPick
  if (!pick && !game.assignBulk) return null
  const kind = pick?.kind ?? 'gate'
  const points = game.assignPoints(kind, pick?.role)
  const point = pick?.id ? points.find((row) => row.id === pick.id) : undefined
  const signed = game.signed
  const preferred = point?.holderId && signed.includes(point.holderId) ? point.holderId : signed[0] ?? ''
  const shown = signed.includes(focus) ? focus : preferred
  const takenByOther = Boolean(point?.holderId && point.holderId !== shown)
  const canDedicate = Boolean(shown) && !point?.blocked && !takenByOther && (game.assignBulk ? game.assignSelection.length > 0 : Boolean(pick?.id))
  const selected = game.assignSelection.length

  return (
    <aside className="assign-panel" data-testid="assign-panel">
      <header className="building-panel-head">
        <div>
          <h2>Dedicate to airline…</h2>
          <p className="building-status">{point ? point.label : KIND_LABEL[kind]}</p>
        </div>
        <button type="button" className="building-close" data-testid="assign-close" onClick={() => game.closeAssign()}>
          Close
        </button>
      </header>
      {point?.blocked ? <p className="muted">{point.blocked}</p> : null}
      {point?.holderName ? (
        <p className="muted" data-testid="assign-holder">
          Dedicated to {point.holderName}
        </p>
      ) : null}
      {signed.length === 0 ? <p className="muted">Sign a carrier before dedicating.</p> : null}
      <ul className="hub-lines">
        {signed.map((id) => {
          const airline = game.airline(id)
          const paint = game.assignPreview(id, kind)
          const on = id === shown
          return (
            <li key={id}>
              <button type="button" data-testid={`assign-pick-${id}`} aria-pressed={on} onClick={() => setFocus(id)}>
                <span className="assign-swatch" style={{ background: airline.color, borderColor: airline.stripe }} />
                {airline.name}
              </button>
              {on && paint ? (
                <div className="assign-copy">
                  <p data-testid="assign-relationship">{paint.relationship}</p>
                  <p data-testid="assign-rival">{paint.rival}</p>
                  <p data-testid="assign-flexibility">{paint.flexibility}</p>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      {!pick?.id || game.assignBulk ? (
        <ul className="hub-lines" data-testid="assign-points">
          {points.map((row) => (
            <li key={row.id}>
              <button type="button" data-testid={`assign-point-${row.id}`} onClick={() => game.openAssign(kind, row.id, pick?.role)}>
                {row.label}
                {row.holderName ? ` · ${row.holderName}` : ''}
                {row.blocked ? ` · ${row.blocked}` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="hub-actions">
        <button type="button" data-testid="assign-bulk" aria-pressed={game.assignBulk} onClick={() => game.toggleAssignBulk()}>
          Paint desks and stands
        </button>
        {game.assignBulk ? <p className="muted">{selected} selected. Click desks in the hall, or stands on the apron.</p> : null}
        {point?.holderId && point.holderId === shown ? (
          <button type="button" data-testid="assign-unassign" onClick={() => game.unassignDedicated(shown, kind, point.id)}>
            Unassign
          </button>
        ) : (
          <button type="button" data-testid="assign-apply" disabled={!canDedicate} onClick={() => shown && game.applyAssign(shown)}>
            {game.assignBulk && selected > 1 ? `Dedicate ${selected}` : 'Dedicate'}
          </button>
        )}
      </div>
    </aside>
  )
}
