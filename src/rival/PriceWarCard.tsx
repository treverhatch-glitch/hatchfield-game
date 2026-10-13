import { useEffect, useState } from 'react'
import type { Game } from '../game/sim.ts'
import type { WarChoice } from './pricewar.ts'

/**
 * Non-blocking Bellwater card. The layer ignores hits; only the card takes
 * clicks, so the field stays visible. Same idea as the negotiation rival badge.
 */
export function PriceWarCard({ game }: { game: Game }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const off = game.subscribe(() => setTick((n) => n + 1))
    return () => {
      off()
    }
  }, [game])

  const card = game.priceWarCard()
  if (!card) return null
  const live = Math.round(game.rivalWalkInFactor() * 100)
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 38, pointerEvents: 'none' }}>
      <aside
        data-testid="price-war-card"
        aria-label="Bellwater price war"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          top: 300,
          left: 12,
          width: 280,
          maxHeight: 'calc(100% - 140px)',
          overflow: 'auto',
          background: 'rgba(10, 18, 16, 0.92)',
          color: '#e8eef4',
          border: '1px solid rgba(201, 162, 39, 0.45)',
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
          padding: '10px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          font: '13px/1.35 sans-serif',
        }}
      >
        <span style={{ font: '700 10px sans-serif', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c9a227' }}>
          {card.name}
        </span>
        <strong data-testid="price-war-headline">{card.headline}</strong>
        <span>{card.detail}</span>
        <span data-testid="price-war-walkin">
          Walk-in {live}% · rival loss capped at {card.capPct}%
        </span>
        {card.poachedName ? <span data-testid="price-war-poach">{card.poachedName} is talking to Bellwater.</span> : null}
        {card.actions.length ? (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {card.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                data-testid={`price-war-${action.id}`}
                title={action.hint}
                onClick={() => game.respondToPriceWar(action.id as WarChoice)}
                style={{
                  textAlign: 'left',
                  background: action.id === 'match' ? 'rgba(201, 162, 39, 0.2)' : 'rgba(255,255,255,0.06)',
                  color: '#e8eef4',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  cursor: 'pointer',
                }}
              >
                <strong style={{ display: 'block' }}>{action.label}</strong>
                <small style={{ opacity: 0.8 }}>{action.hint}</small>
              </button>
            ))}
          </span>
        ) : null}
      </aside>
    </div>
  )
}
