import { useEffect, useState } from 'react'
import type { Game } from '../../game/sim.ts'

/**
 * Isolated chrome for the flow overlay, the Design Advisor, and build tooltips.
 * Inline styles so a HUD redesign can lift this without the old stylesheet.
 */
export function OwnerChrome({ game }: { game: Game }) {
  const [, setN] = useState(0)
  useEffect(() => {
    const off = game.subscribe(() => setN((n) => n + 1))
    return () => {
      off()
    }
  }, [game])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        game.toggleFlows()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game])

  const site = game.hover ? game.siteAt(game.hover) : undefined
  const advice = game.advice
  const ground = game.groundSnapshot()

  return (
    <div className="owner-chrome" data-testid="owner-chrome" style={{ position: 'absolute', zIndex: 40, pointerEvents: 'none' }}>
      <label
        data-testid="flow-toggle"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          background: 'rgba(12, 22, 28, 0.82)',
          color: '#e7eee9',
          font: '600 12px sans-serif',
          padding: '6px 8px',
          borderRadius: 6,
        }}
      >
        <input
          type="checkbox"
          checked={game.showFlows}
          onChange={() => game.toggleFlows()}
        />
        Show passenger flows
        <span style={{ opacity: 0.7 }}>F</span>
      </label>
      {ground && (
        <div
          data-testid="ground-stock"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(12, 22, 28, 0.82)',
            color: '#e7eee9',
            font: '600 12px sans-serif',
            padding: '6px 8px',
            borderRadius: 6,
          }}
        >
          Fuel farm {Math.round(ground.fuelLitres).toLocaleString('en-US')} L · Kitchen {ground.meals} meals ·{' '}
          {ground.busyVehicles}/{ground.totalVehicles} trucks out
        </div>
      )}
      {advice.length > 0 && (
        <div
          data-testid="advisor"
          style={{
            pointerEvents: 'auto',
            position: 'absolute',
            left: 8,
            bottom: 8,
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {advice.map((note) => (
            <button
              key={note.id}
              type="button"
              data-testid={`advice-${note.id}`}
              onClick={() => game.focusAdvice(note.id)}
              style={{
                textAlign: 'left',
                background: 'rgba(12, 22, 28, 0.92)',
                color: '#e7eee9',
                border: '1px solid #c9a27a',
                borderRadius: 6,
                padding: '8px 10px',
                font: '13px sans-serif',
              }}
            >
              <strong style={{ display: 'block', marginBottom: 2 }}>{note.title}</strong>
              <span style={{ display: 'block', opacity: 0.9 }}>{note.detail}</span>
              <span style={{ display: 'block', marginTop: 4, color: '#f0c14a' }}>{note.fix}</span>
            </button>
          ))}
        </div>
      )}
      {site && (
        <div
          data-testid="build-tooltip"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 72,
            transform: 'translateX(-50%)',
            background: 'rgba(12, 22, 28, 0.92)',
            color: '#e7eee9',
            font: '600 13px sans-serif',
            padding: '6px 10px',
            borderRadius: 6,
          }}
        >
          {site.name} · {Math.min(100, Math.round((site.elapsed / site.duration) * 100))}%
        </div>
      )}
    </div>
  )
}
