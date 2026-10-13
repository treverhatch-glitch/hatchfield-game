import { LAND, money } from '../game/catalog'
import type { Game } from '../game/sim'
import type { SiteKind, StartFocus } from '../game/types'

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
      <div className="title-card">
        <p className="kicker">Purchase land · {money(game.cash)} on hand</p>
        <h1>Choose the plot</h1>
        <p className="lede">
          Pick a start focus — passengers, cargo, or hybrid. Plot biases letters; Starter kit
          matches the focus. You can always grow the other path later.
        </p>
        <div className="starts">
          <button type="button" className="primary" onClick={() => buy('city', 'pax')}>
            Passengers · {LAND.city.name}
            <span>
              {money(LAND.city.cost)} · Hall + jetways. Northline / Bushline first hour.
            </span>
          </button>
          <button type="button" onClick={() => buy('factory', 'cargo')}>
            Cargo · {LAND.factory.name}
            <span>
              {money(LAND.factory.cost)} · Shed, guard, freighter stand — no pax hall required.
            </span>
          </button>
          <button type="button" onClick={() => buy('city', 'hybrid')}>
            Hybrid · {LAND.city.name}
            <span>
              {money(LAND.city.cost)} · Lean hall + cargo road. Day pax, night freight.
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
