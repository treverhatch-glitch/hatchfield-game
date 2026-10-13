import type { RivalPanelModel } from './types.ts'

function cash(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}

/**
 * Compact rival sheet. It renders inside the existing bottom panel,
 * so only one sheet is open and the field stays visible.
 */
export function RivalPanel({
  model,
  onCourt,
}: {
  model: RivalPanelModel
  onCourt: (id: string) => void
}) {
  return (
    <section data-testid="rival-panel" className="rival-sheet">
      <h3>
        {model.name}{' '}
        <span className="muted">
          {model.code} · day {model.day} · loads {model.demand.playerFactor.toFixed(2)}×
        </span>
      </h3>
      <p className="muted rival-kicker">
        <span>Rep {model.reputation}</span>
        <span>Service {model.service}</span>
        <span>
          Stands {model.capacity}/{model.maxCapacity}
        </span>
        <span>Books {cash(model.treasury)}</span>
        <span>Upkeep {cash(model.dailyUpkeep)}/day</span>
        <span>
          Fees L {model.fees.landing.toFixed(2)}× · P {model.fees.passenger.toFixed(2)}× · C{' '}
          {model.fees.cargo.toFixed(2)}×
        </span>
      </p>
      <div className="rival-grid" data-testid="rival-compare">
        <div className="rival-row head">
          <span />
          <strong>You</strong>
          <strong>Bellwater</strong>
        </div>
        {model.comparison.map((row) => (
          <div key={row.label} className="rival-row">
            <span>{row.label}</span>
            <span className={row.edge === 'you' ? 'win' : undefined}>{row.player}</span>
            <span className={row.edge === 'bellwater' ? 'win' : undefined}>{row.rival}</span>
          </div>
        ))}
      </div>
      <p className="rival-roster">
        {model.roster.length === 0
          ? 'No based carriers.'
          : model.roster.map((c) => `${c.name} T${c.tier}`).join(' · ')}
      </p>
      <div className="rival-courts">
        {model.court.length === 0 ? (
          <span className="muted">Nobody left to pitch.</span>
        ) : (
          model.court.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={!c.ok}
              title={c.ok ? `Offer ${c.name} a base. A matched field keeps today's loads.` : c.reason}
              data-testid={`court-${c.id}`}
              onClick={() => onCourt(c.id)}
            >
              Court {c.name} · {cash(c.cost)} · {Math.round(c.chance * 100)}%
            </button>
          ))
        )}
      </div>
      <ul className="rival-moves" data-testid="rival-moves">
        {model.moves.map((m, i) => (
          <li key={`${m.day}-${i}`} data-tone={m.tone}>
            <span className="muted">D{m.day}</span> {m.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
