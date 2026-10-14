import { useEffect, useRef, useState } from 'react'
import type { Game } from '../../game/sim.ts'
import { useHudBandVar } from '../hudBand.ts'
import { LiveText } from '../LiveText.tsx'
import { AlertStackView } from './AlertStack.tsx'
import { HintPanel } from './HintPanel.tsx'

/**
 * Isolated chrome for the flow overlay, the hint panel, alerts, and build tooltips.
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
  const strip = useRef<HTMLDivElement>(null)
  // 4px above the strip and 4px below it before the panels hang underneath.
  useHudBandVar(strip, '--hud-strip-h', 'height', 8)

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
  const ground = game.groundSnapshot()

  return (
    <div
      className="owner-chrome"
      data-testid="owner-chrome"
      style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}
    >
      {/* Own row under the top bar: ground stock · info-view chips · flow toggle. */}
      <div
        ref={strip}
        data-testid="info-strip"
        style={{
          position: 'absolute',
          top: 'calc(var(--hud-bar-bottom) + 4px)',
          left: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ flex: '1 1 0', display: 'flex', minWidth: 0 }}>
          {ground && (
            <div
              data-testid="ground-stock"
              style={{
                background: 'rgba(12, 22, 28, 0.82)',
                color: '#e7eee9',
                font: '600 12px sans-serif',
                padding: '6px 8px',
                borderRadius: 6,
              }}
            >
              <LiveText read={() => groundLine(game)} />
            </div>
          )}
        </div>
        <div
          data-testid="info-hotspots"
          style={{
            pointerEvents: 'auto',
            flex: '0 1 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {game.infoHotspots().map((spot) => (
            <button
              key={spot.id}
              type="button"
              data-testid={`info-hotspot-${spot.id}`}
              onClick={() => game.toggleInfo(spot.id)}
              style={{
                background: game.infoOpen === spot.id ? '#f0c14a' : 'rgba(12, 22, 28, 0.88)',
                color: game.infoOpen === spot.id ? '#1a2a32' : '#e7eee9',
                border: '1px solid #c9a27a',
                borderRadius: 999,
                padding: '4px 10px',
                font: '700 12px sans-serif',
              }}
            >
              {spot.label}
            </button>
          ))}
        </div>
        <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
          <label
            data-testid="flow-toggle"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              whiteSpace: 'nowrap',
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
        </div>
      </div>
      {game.infoOpen ? (
        <div
          data-testid="info-panel"
          style={{
            position: 'absolute',
            top: 'calc(var(--hud-top) + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(12, 22, 28, 0.94)',
            color: '#e7eee9',
            border: '1px solid #c9a27a',
            borderRadius: 8,
            padding: '8px 12px',
            font: '13px sans-serif',
            minWidth: 220,
            pointerEvents: 'auto',
          }}
        >
          {game.infoLines(game.infoOpen).map((line) => (
            <div key={line}>{line}</div>
          ))}
          {game.infoOpen === 'links' && game.linkRepairOffer() ? (
            <button
              type="button"
              data-testid="repair-link"
              onClick={() => game.repairLink(game.linkRepairOffer()!.mode)}
              style={{
                marginTop: 8,
                background: '#f0c14a',
                color: '#1a2a32',
                border: 0,
                borderRadius: 6,
                padding: '4px 8px',
                font: '700 12px sans-serif',
              }}
            >
              {game.linkRepairOffer()!.label}
            </button>
          ) : null}
        </div>
      ) : null}
      <HintPanel game={game} />
      <AlertStackView game={game} />
      {game.view !== 'hall' && (game.diplomacyLetters().length > 0 || game.diplomacyRoster().length > 0) && (
        <div
          data-testid="diplomacy-panel"
          style={{
            pointerEvents: 'auto',
            position: 'absolute',
            left: 8,
            bottom: 8,
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            color: '#e7eee9',
            font: '13px sans-serif',
          }}
        >
          {game.diplomacyRoster().map((row) => (
            <div
              key={row.id}
              data-testid="diplomacy-card"
              style={{
                background: 'rgba(12, 22, 28, 0.88)',
                borderRadius: 6,
                padding: '6px 8px',
              }}
            >
              {row.name} · {row.band} · {Math.round(row.standing)}
            </div>
          ))}
          {game.diplomacyLetters().map((letter) => (
            <div
              key={letter.id}
              data-testid="diplomacy-letter"
              style={{
                background: 'rgba(12, 22, 28, 0.92)',
                border: '1px solid #c9a27a',
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              <strong style={{ display: 'block', marginBottom: 4 }}>{letter.airline}</strong>
              <span style={{ display: 'block', opacity: 0.9 }}>{letter.text}</span>
              <span style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" onClick={() => game.answerDiplomacy(letter.id, 'accept')}>
                  Accept
                </button>
                <button type="button" onClick={() => game.answerDiplomacy(letter.id, 'decline')}>
                  Decline
                </button>
              </span>
            </div>
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
          {site.name} · <LiveText read={() => sitePct(game)} />
        </div>
      )}
    </div>
  )
}

/** Ground stock moves every tick; the live pump writes it, not React. */
function groundLine(game: Game): string {
  const ground = game.groundSnapshot()
  if (!ground) return ''
  return `Fuel farm ${Math.round(ground.fuelLitres).toLocaleString('en-US')} L · Kitchen ${ground.meals} meals · ${ground.busyVehicles}/${ground.totalVehicles} trucks out`
}

function sitePct(game: Game): string {
  const site = game.hover ? game.siteAt(game.hover) : undefined
  return site ? `${Math.min(100, Math.round((site.elapsed / site.duration) * 100))}%` : ''
}
