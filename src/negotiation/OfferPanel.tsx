import { useEffect, useState } from 'react'
import type { Game } from '../game/sim.ts'
import type { DepositTier, ServiceId } from './types.ts'

const money = (n: number) => {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  return `${sign}$${Math.round(abs)}`
}

/**
 * Cities: Skylines 2 style offer sheet. The layer ignores hits; only the
 * sheet and the rival card take clicks, so the field stays visible.
 */
export function OfferPanel({ game }: { game: Game }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const off = game.subscribe(() => setTick((n) => n + 1))
    return () => {
      off()
    }
  }, [game])
  const panel = game.negotiationPanel()
  const rival = game.rivalCard()
  if (!panel && !rival) return null
  return (
    <div className="negotiation-layer" data-testid="negotiation-layer">
      {rival ? (
        <aside className="rival-card" data-testid="rival-card" style={{ right: panel ? 384 : 12 }}>
          <span className="rival-kicker">{rival.name}</span>
          <strong data-testid="rival-headline">{rival.headline}</strong>
          <span>
            {rival.airlines.length} carrier{rival.airlines.length === 1 ? '' : 's'} · growth {rival.growthScore} ·
            walk-in {Math.round(rival.trafficFactor * 100)}%
          </span>
        </aside>
      ) : null}
      {panel ? (
        <aside className="negotiation-panel" data-testid="negotiation-panel" aria-label="Offer and counter">
          <header className="negotiation-head">
            <div>
              <p className="negotiation-kicker">Offer / Counter</p>
              <h2>{panel.airlineName}</h2>
            </div>
            <button type="button" className="ghost" data-testid="negotiation-close" onClick={() => game.closeNegotiationPanel()}>
              Close
            </button>
          </header>
          {panel.pitch ? <p className="negotiation-pitch">{panel.pitch}</p> : null}
          <p className="negotiation-note">{panel.note}</p>
          <div className="negotiation-meters">
            <span data-testid="negotiation-mood" data-mood={panel.mood.toFixed(3)} title="Mood">
              {panel.face}
            </span>
            <span className="patience" data-testid="negotiation-patience">
              <i style={{ width: `${Math.round(panel.patience * 100)}%` }} />
            </span>
            <span data-testid="negotiation-rounds">
              Round {panel.round} / {panel.maxRounds}
            </span>
            <span className={`capacity capacity-${panel.capacity}`} data-testid="negotiation-capacity">
              {panel.capacity}
            </span>
          </div>
          <table className="negotiation-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Current</th>
                <th>Ask</th>
                <th>Theirs</th>
              </tr>
            </thead>
            <tbody>
              {panel.rows.map((row) => (
                <tr key={row.service}>
                  <td>{row.label}</td>
                  <td>{money(row.current)}</td>
                  <td>
                    <input
                      data-testid={`fee-${row.service}`}
                      type="number"
                      aria-label={`${row.label} ask percent`}
                      value={Math.round(row.askPct)}
                      disabled={!panel.open}
                      onChange={(e) => game.setNegotiationFee(row.service as ServiceId, Number(e.target.value))}
                    />
                    <small>{money(row.ask)}</small>
                  </td>
                  <td>{money(row.theirs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="negotiation-chips">
            {panel.freebies.map((chip) => (
              <button
                key={chip.id}
                type="button"
                data-testid={`freebie-${chip.id}`}
                className={chip.on ? 'on' : ''}
                disabled={!panel.open}
                onClick={() => game.toggleNegotiationFreebie(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="negotiation-terms" data-testid="negotiation-deposit">
            {(['none', 'standard', 'high'] as DepositTier[]).map((tier) => (
              <label key={tier}>
                <input
                  type="radio"
                  name="deposit"
                  checked={panel.deposit === tier}
                  disabled={!panel.open}
                  onChange={() => game.setNegotiationDeposit(tier)}
                />
                {tier}
              </label>
            ))}
            <label>
              Term
              <select
                data-testid="negotiation-term"
                value={panel.termMonths}
                disabled={!panel.open}
                onChange={(e) => game.setNegotiationTerm(Number(e.target.value))}
              >
                {panel.termOptions.map((months) => (
                  <option key={months} value={months}>
                    {months} mo
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="negotiation-margin" data-testid="negotiation-margin">
            {money(panel.margin)}/day
            <small>
              {money(panel.marginLow)} – {money(panel.marginHigh)}
            </small>
          </p>
          {panel.advisor ? (
            <p className="negotiation-advisor" data-testid="negotiation-advisor">
              {panel.advisor}
            </p>
          ) : null}
          {panel.research.length ? (
            <div className="negotiation-research">
              {panel.research.map((tier) => (
                <button
                  key={tier.cost}
                  type="button"
                  data-testid={`research-${tier.cost}`}
                  disabled={tier.bought || !panel.open}
                  onClick={() => game.buyNegotiationResearch(tier.cost)}
                >
                  {tier.bought ? `Known ${tier.band}` : `Research ${money(tier.cost)} ${tier.band}`}
                </button>
              ))}
            </div>
          ) : null}
          {panel.actualSpend != null ? (
            <p data-testid="negotiation-actual">Actual spend ${panel.actualSpend.toFixed(2)} / pax</p>
          ) : null}
          <div className="negotiation-actions">
            <button type="button" className="on" data-testid="negotiation-accept" disabled={!panel.open} onClick={() => game.acceptNegotiation()}>
              Accept
            </button>
            <button type="button" data-testid="negotiation-counter" disabled={!panel.open} onClick={() => game.counterNegotiation()}>
              Counter
            </button>
            <button type="button" data-testid="negotiation-walk" disabled={!panel.open} onClick={() => game.walkNegotiation()}>
              Walk
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  )
}
