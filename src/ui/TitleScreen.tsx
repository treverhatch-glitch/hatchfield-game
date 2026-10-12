import { money, START_CASH } from '../game/catalog'
import { Game } from '../game/sim'

export function TitleScreen({
  onEasy,
  onStandard,
  onContinue,
}: {
  onEasy: () => void
  onStandard: () => void
  onContinue: () => void
}) {
  const hasSave = Game.hasSave()
  return (
    <div className="title-wrap">
      <div className="title-card">
        <p className="kicker">Airport Tycoon 3 loop · Steam sketch</p>
        <h1>Hatchfield</h1>
        <p className="lede">
          Limited funds. Buy land. Build the field. Sign fuel, fire, and police.
          Airlines only call when your airport meets their requirements — then the
          jet on the screen and the money in the book stay the same flight.
        </p>
        <ul className="beats">
          <li>Purchase a city plot (passengers) or industrial plot (cargo).</li>
          <li>Stamp runway, stands, fuel, fire, hall — then wait for a contract offer.</li>
          <li>Premade terminal or empty shell you furnish. Weak security invites threats.</li>
        </ul>
        <div className="starts">
          <button type="button" className="primary" onClick={onEasy}>
            Easy grant
            <span>{money(START_CASH.easy)} before land — room to learn AT3’s loop</span>
          </button>
          <button type="button" onClick={onStandard}>
            Standard field
            <span>{money(START_CASH.standard)} before land — every stamp matters</span>
          </button>
          {hasSave ? (
            <button type="button" className="ghost" onClick={onContinue}>
              Continue field
              <span>Paused clock from the last session</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
