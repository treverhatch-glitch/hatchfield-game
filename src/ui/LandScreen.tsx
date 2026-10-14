import { useState } from 'react'
import { LAND, money } from '../game/catalog'
import { STARTER_KITS } from '../game/starterLayout'
import type { Game } from '../game/sim'
import type { SiteKind, StartFocus } from '../game/types'
import { MAP_LIST, mapById, mapSwatch } from '../maps/index'

const PAX_NEEDS = STARTER_KITS.pax.includes
const CARGO_NEEDS = STARTER_KITS.cargo.includes
const HYBRID_NEEDS = STARTER_KITS.hybrid.includes

export function LandScreen({
  game,
  enableHints,
  onEnableHintsChange,
  onBought,
  onBack,
}: {
  game: Game
  enableHints: boolean
  onEnableHintsChange: (on: boolean) => void
  onBought: () => void
  onBack: () => void
}) {
  const [hintsOn, setHintsOn] = useState(enableHints)
  const [mapId, setMapId] = useState(game.mapId)
  const buy = (kind: SiteKind, focus: StartFocus) => {
    if (game.buyLand(kind, focus)) onBought()
  }

  return (
    <div className="menu-sheet" data-testid="new-game-sheet">
      <button type="button" className="ghost back-link" data-testid="back-to-title" onClick={onBack}>
        Back
      </button>
      <p className="kicker">
        New game · {money(game.cash)} on hand
        {game.sandbox ? ' · sandbox' : ''}
      </p>
      <h1>New game</h1>
      <p className="lede">
        Pick a climate, then a starter kit. The coach offers that kit on the empty
        plot. Stamp it before a lone runway spends the opening budget.
      </p>
      <label className="sandbox-toggle" title="The first-session hints stay hidden until Settings.">
        <input
          type="checkbox"
          checked={!hintsOn}
          data-testid="new-game-hints-off"
          onChange={(e) => {
            setHintsOn(!e.target.checked)
            onEnableHintsChange(!e.target.checked)
          }}
        />
        <span>Start with hints off</span>
      </label>
      <p className="menu-label">Climate</p>
      <div className="map-cards" data-testid="map-select">
        {MAP_LIST.map((id) => {
          const map = mapById(id)
          const on = mapId === id
          return (
            <button
              key={id}
              type="button"
              className={`map-card${on ? ' on' : ''}`}
              data-testid={`map-${id}`}
              aria-pressed={on}
              onClick={() => {
                setMapId(id)
                game.setMap(id)
              }}
            >
              <i className="map-swatch" style={{ background: mapSwatch(id) }} />
              <strong>{map.name}</strong>
              <em>{map.region}</em>
              <p>{map.blurb}</p>
              <ul>
                {map.challenges.map((goal) => (
                  <li key={goal.id}>{goal.title}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
      <p className="menu-label">Starter kit</p>
      <div className="route-cards">
        <button
          type="button"
          className={`route-card${game.startFocus === 'pax' ? ' primary' : ''}`}
          data-testid="start-pax"
          aria-pressed={game.startFocus === 'pax'}
          onClick={() => buy('city', 'pax')}
        >
          <strong>{STARTER_KITS.pax.label}</strong>
          <em>
            City plot · {money(LAND.city.cost)}
          </em>
          <p>{STARTER_KITS.pax.summary}</p>
          <ul>
            {PAX_NEEDS.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </button>
        <button
          type="button"
          className={`route-card${game.startFocus === 'cargo' ? ' primary' : ''}`}
          data-testid="start-cargo"
          aria-pressed={game.startFocus === 'cargo'}
          onClick={() => buy('factory', 'cargo')}
        >
          <strong>{STARTER_KITS.cargo.label}</strong>
          <em>
            Factory plot · {money(LAND.factory.cost)}
          </em>
          <p>{STARTER_KITS.cargo.summary}</p>
          <ul>
            {CARGO_NEEDS.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </button>
      </div>
      <button
        type="button"
        className={`ghost hybrid-link${game.startFocus === 'hybrid' ? ' on' : ''}`}
        data-testid="start-hybrid"
        aria-pressed={game.startFocus === 'hybrid'}
        onClick={() => buy('city', 'hybrid')}
      >
        {STARTER_KITS.hybrid.label}
        <span>{HYBRID_NEEDS.join(' · ')}</span>
      </button>
    </div>
  )
}
