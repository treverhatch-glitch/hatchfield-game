import { money, START_CASH } from '../game/catalog'
import { Game } from '../game/sim'

export function TitleScreen({
  game,
  onPlay,
}: {
  game: Game
  onPlay: () => void
}) {
  const hasSave = Game.hasSave()
  return (
    <div className="title-wrap">
      <div className="title-card">
        <p className="kicker">Steam sketch · 3D field</p>
        <h1>Hatchfield</h1>
        <p className="lede">
          An airport you watch from above — runways, trucks, and people. The jet on
          the screen and the money in the book are the same flight. Built in the
          spirit of Airport Tycoon 3, with Airport CEO’s bags, fuel, and hall.
        </p>
        <ul className="beats">
          <li>Easy grant opens a live starter field. Buildings stamp in one click, Airport Tycoon style.</li>
          <li>A jet lands, parks, gets bags and fuel, boards, and pays only for what actually happened.</li>
          <li>Left drag pans. Right drag orbits. Scroll zooms. Click a jet to read its ledger.</li>
        </ul>
        <div className="starts">
          <button
            type="button"
            className="primary"
            onClick={() => {
              game.newGame('easy')
              onPlay()
            }}
          >
            Easy grant
            <span>{money(START_CASH.easy)} · starter airport, a jet already inbound</span>
          </button>
          <button
            type="button"
            onClick={() => {
              game.newGame('standard')
              onPlay()
            }}
          >
            Standard field
            <span>{money(START_CASH.standard)} · every tile has to earn</span>
          </button>
          {hasSave ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (game.load()) onPlay()
              }}
            >
              Continue field
              <span>Paused clock from the last session</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
