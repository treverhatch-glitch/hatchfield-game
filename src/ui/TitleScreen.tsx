import { useState } from 'react'
import { money, START_CASH } from '../game/catalog'
import { sandboxChoiceLabel } from '../game/economy'
import { Game } from '../game/sim'
import { STARTER_KITS } from '../game/starterLayout'
import type { StartFocus } from '../game/types'

export function TitleScreen({
  sandbox,
  onSandboxChange,
  enableHints,
  onEnableHintsChange,
  onNewGame,
  onChooseKit,
  onContinue,
}: {
  sandbox: boolean
  onSandboxChange: (on: boolean) => void
  /** Pregame setup: unchecked starts the new game with hints off. */
  enableHints: boolean
  onEnableHintsChange: (on: boolean) => void
  onNewGame: () => void
  /** Open the new-game sheet with this kit already chosen. */
  onChooseKit: (focus: StartFocus) => void
  onContinue: () => void
}) {
  const hasSave = Game.hasSave()
  const [tilt, setTilt] = useState({ x: 0, y: 0, hot: false })
  const [sandboxOn, setSandboxOn] = useState(sandbox)
  const [hintsOn, setHintsOn] = useState(enableHints)
  const kits: StartFocus[] = ['pax', 'cargo']
  return (
    <div className="menu-panel" data-testid="start-menu">
      <p className="kicker">Airport tycoon</p>
      <div className="game-title-idle" data-testid="game-title-idle">
        <h1
          className="game-title"
          data-testid="game-title"
          style={{
            transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.hot ? 1.045 : 1})`,
          }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const px = (e.clientX - r.left) / r.width - 0.5
            const py = (e.clientY - r.top) / r.height - 0.5
            setTilt({ x: py * -12, y: px * 16, hot: true })
          }}
          onPointerLeave={() => setTilt({ x: 0, y: 0, hot: false })}
        >
          <img src="/assets/pack4/logo_hatchfield.jpg" alt="Hatchfield" />
        </h1>
      </div>
      <p className="lede">
        Buy the plot, stamp a starter kit, and sign the first carrier. The jet on the
        screen and the money in the book are the same flight.
      </p>
      <div className="starts">
        <button type="button" className="primary" data-testid="new-game" onClick={onNewGame}>
          New Game
          <span>
            {sandboxOn
              ? 'Choose a climate and a starter kit · sandbox cash'
              : `Choose a climate and a starter kit · ${money(START_CASH.standard)}`}
          </span>
        </button>
        {hasSave ? (
          <button type="button" className="ghost" data-testid="continue-game" onClick={onContinue}>
            Continue
            <span>Paused clock from the last session</span>
          </button>
        ) : null}
      </div>
      <p className="menu-label">Starter kits</p>
      <div className="kit-offers">
        {kits.map((focus) => {
          const kit = STARTER_KITS[focus]
          return (
            <button
              key={focus}
              type="button"
              className="kit-offer"
              data-testid={`offer-${focus}`}
              onClick={() => onChooseKit(focus)}
            >
              <strong>{kit.label}</strong>
              <p>{kit.summary}</p>
              <ul>
                {kit.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
      <label className="sandbox-toggle" title="Dev / trial: spend never fails">
        <input
          type="checkbox"
          checked={sandboxOn}
          onChange={(e) => {
            setSandboxOn(e.target.checked)
            onSandboxChange(e.target.checked)
          }}
          data-testid="sandbox-toggle"
        />
        <span>{sandboxChoiceLabel(sandboxOn)}</span>
      </label>
      <input
        type="checkbox"
        checked={hintsOn}
        hidden
        tabIndex={-1}
        data-testid="enable-hints-toggle"
        onChange={(e) => {
          setHintsOn(e.target.checked)
          onEnableHintsChange(e.target.checked)
        }}
      />
      <label
        className="sandbox-toggle"
        title="Leave this off for the usual first-session hints. Turn them back on later in Settings."
      >
        <input
          type="checkbox"
          checked={!hintsOn}
          data-testid="hints-off-toggle"
          onChange={(e) => {
            setHintsOn(!e.target.checked)
            onEnableHintsChange(!e.target.checked)
          }}
        />
        <span>Start with hints off</span>
      </label>
    </div>
  )
}
