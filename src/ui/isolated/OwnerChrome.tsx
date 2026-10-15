import { useEffect, useRef, useState } from 'react'
import type { Game } from '../../game/sim.ts'
import { useHudBandVar } from '../hudBand.ts'
import { LiveText } from '../LiveText.tsx'
import { HintPanel } from './HintPanel.tsx'
import { TipChips } from './TipChips.tsx'

/**
 * Isolated chrome for the flow overlay, the hint panel, and build tooltips.
 * Operational alerts live on the HUD, bottom right.
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

  const site = game.hover ? game.siteAt(game.hover) : undefined
  const ground = game.groundSnapshot()

  return (
    <div
      className="owner-chrome"
      data-testid="owner-chrome"
      style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}
    >
      {/* Own row under the top bar: ground stock on the left, flow toggle on the right. */}
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
      <HintPanel game={game} />
      <TipChips game={game} />
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
