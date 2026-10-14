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
  onBought,
}: {
  game: Game
  onBought: () => void
}) {
  const buy = (kind: SiteKind, focus: StartFocus) => {
    game.startFocus = focus
    if (game.buyLand(kind)) onBought()
  }

  return (
    <div className="title-wrap">
      <div className="title-card land-pick">
        <p className="kicker">
          New Game · {money(game.cash)} on hand
          {game.sandbox ? ' · sandbox' : ''}
        </p>
        <h1>Choose your start</h1>
        <p className="lede">
          Pick a climate, then a route. The temperate belt plays the field you
          already know. Starter kit matches the focus.
        </p>
        <div className="map-cards" data-testid="map-select">
          {MAP_LIST.map((id) => {
            const map = mapById(id)
            const on = game.mapId === id
            return (
              <button
                key={id}
                type="button"
                className={`map-card${on ? ' on' : ''}`}
                data-testid={`map-${id}`}
                aria-pressed={on}
                onClick={() => game.setMap(id)}
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
        <div className="route-cards">
          <button
            type="button"
            className="route-card primary"
            data-testid="start-pax"
            onClick={() => buy('city', 'pax')}
          >
            <strong>Passenger</strong>
            <em>
              {STARTER_KITS.pax.label} · {money(LAND.city.cost)}
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
            className="route-card"
            data-testid="start-cargo"
            onClick={() => buy('factory', 'cargo')}
          >
            <strong>Cargo</strong>
            <em>
              {STARTER_KITS.cargo.label} · {money(LAND.factory.cost)}
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
          className="ghost hybrid-link"
          data-testid="start-hybrid"
          onClick={() => buy('city', 'hybrid')}
        >
          {STARTER_KITS.hybrid.label}
          <span>{HYBRID_NEEDS.join(' · ')}</span>
        </button>
      </div>
    </div>
  )
}
