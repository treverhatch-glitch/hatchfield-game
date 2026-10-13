import { LAND, money } from '../game/catalog'
import type { Game } from '../game/sim'
import type { SiteKind, StartFocus } from '../game/types'

const PAX_NEEDS = [
  'Runway',
  'Stand',
  'Terminal',
  'Check-in',
  'Security',
  'Gate',
] as const

const CARGO_NEEDS = [
  'Runway',
  'Cargo stand',
  'Truck gate (guard)',
  'Shed',
  'Warehouse',
] as const

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
          Each route needs a different kit. Starter kit matches the focus; you can
          grow the other path later.
        </p>
        <div className="route-cards">
          <button
            type="button"
            className="route-card primary"
            data-testid="start-pax"
            onClick={() => buy('city', 'pax')}
          >
            <strong>Passenger</strong>
            <em>
              {LAND.city.name} · {money(LAND.city.cost)}
            </em>
            <p>Hall + jetways. Northline / Bushline first hour.</p>
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
              {LAND.factory.name} · {money(LAND.factory.cost)}
            </em>
            <p>Shed, guard, freighter stand — no pax hall required.</p>
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
          Hybrid · {LAND.city.name}
          <span>Lean hall + cargo road. Day pax, night freight.</span>
        </button>
      </div>
    </div>
  )
}
