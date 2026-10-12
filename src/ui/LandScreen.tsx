import { LAND, money } from '../game/catalog'
import type { Game } from '../game/sim'
import type { SiteKind } from '../game/types'

export function LandScreen({
  game,
  onBought,
}: {
  game: Game
  onBought: () => void
}) {
  const buy = (kind: SiteKind) => {
    if (game.buyLand(kind)) onBought()
  }

  return (
    <div className="title-wrap">
      <div className="title-card">
        <p className="kicker">Purchase land · {money(game.cash)} on hand</p>
        <h1>Choose the plot</h1>
        <p className="lede">
          Like Airport Tycoon — where you build is who you serve. City land is
          expensive and fills passenger flights. Factory land is cheaper and feeds
          cargo carriers (Umazon, UPPS, EXFED).
        </p>
        <div className="starts">
          <button type="button" className="primary" onClick={() => buy('city')}>
            {LAND.city.name}
            <span>
              {money(LAND.city.cost)} · {LAND.city.blurb}
            </span>
          </button>
          <button type="button" onClick={() => buy('factory')}>
            {LAND.factory.name}
            <span>
              {money(LAND.factory.cost)} · {LAND.factory.blurb}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
