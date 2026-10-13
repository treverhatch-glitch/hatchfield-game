import { SANDBOX_CASH } from '../game/types'
import { money } from '../game/catalog'
import { Game } from '../game/sim'

export function TitleScreen({
  sandbox,
  onSandboxChange,
  enableHints,
  onEnableHintsChange,
  onNewGame,
  onContinue,
}: {
  sandbox: boolean
  onSandboxChange: (on: boolean) => void
  /** Pregame setup: unchecked starts the new game with hints off. */
  enableHints: boolean
  onEnableHintsChange: (on: boolean) => void
  onNewGame: () => void
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
        <label className="sandbox-toggle" title="Dev / trial: spend never fails">
          <input
            type="checkbox"
            checked={sandbox}
            onChange={(e) => onSandboxChange(e.target.checked)}
            data-testid="sandbox-toggle"
          />
          <span>
            Sandbox (unlimited money)
            {sandbox ? ` · ${money(SANDBOX_CASH)}` : ' · off'}
          </span>
        </label>
        <label className="sandbox-toggle" title="Advisor hints in the bottom-right panel. Change later in Settings.">
          <input
            type="checkbox"
            checked={enableHints}
            onChange={(e) => onEnableHintsChange(e.target.checked)}
            data-testid="enable-hints-toggle"
          />
          <span>Enable hints{enableHints ? '' : ' · off'}</span>
        </label>
        <div className="starts">
          <button
            type="button"
            className="primary"
            data-testid="new-game"
            onClick={onNewGame}
          >
            New Game
            <span>
              Pick Passenger or Cargo — then stamp the field
              {sandbox ? ' · sandbox cash' : ''}
            </span>
          </button>
          {hasSave ? (
            <button
              type="button"
              className="ghost"
              data-testid="continue-game"
              onClick={onContinue}
            >
              Continue
              <span>Paused clock from the last session</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
