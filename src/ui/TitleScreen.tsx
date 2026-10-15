import { useState } from 'react'
import { money } from '../game/catalog.ts'
import { sandboxChoiceLabel } from '../game/economy.ts'
import { AUTOSAVE_ID, activateSlot, listSlots } from '../features/save/library.ts'
import { Game } from '../game/sim.ts'
import { MenuRail } from './menu/MenuRail.tsx'
import { SaveBrowser } from './menu/SaveBrowser.tsx'
import { SettingsPane } from './menu/SettingsPane.tsx'
import type { MenuSection } from './menu/sections.ts'
import type { SettingsTab } from './pauseState.ts'

export function TitleScreen({
  game,
  section,
  onSection,
  sandbox,
  onSandboxChange,
  enableHints,
  onEnableHintsChange,
  onNewGame,
  onContinue,
}: {
  game: Game
  section: MenuSection
  onSection: (section: MenuSection) => void
  sandbox: boolean
  onSandboxChange: (on: boolean) => void
  /** Pregame setup: unchecked starts the new game with hints off. */
  enableHints: boolean
  onEnableHintsChange: (on: boolean) => void
  onNewGame: () => void
  onContinue: () => void
}) {
  const [tick, setTick] = useState(0)
  const [sandboxOn, setSandboxOn] = useState(sandbox)
  const [hintsOn, setHintsOn] = useState(enableHints)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('game')
  const [quitNote, setQuitNote] = useState('')
  const [loadNote, setLoadNote] = useState('')
  const hasSave = tick >= 0 && Game.hasSave()
  const latest = listSlots().find((slot) => slot.id === AUTOSAVE_ID)

  const load = (id: string) => {
    if (!activateSlot(id) || !game.load()) {
      setLoadNote('That save could not be read.')
      return
    }
    onContinue()
  }

  return (
    <div className="hf-shell" data-testid="start-menu">
      <MenuRail
        current={section}
        hasSave={hasSave}
        onContinue={onContinue}
        onNew={onNewGame}
        onLoad={() => onSection('load')}
        onSettings={() => onSection('settings')}
        onCredits={() => onSection('credits')}
        onQuit={() => {
          setQuitNote('Close this tab to leave. The autosave stays in this browser.')
          try {
            window.close()
          } catch {
            /* a tab the player opened will not close itself */
          }
        }}
        quitNote={quitNote}
        footer={
          <>
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
            <label className="sandbox-toggle" title="Leave this off for the usual first-session hints. Turn them back on later in Settings.">
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
          </>
        }
      />
      <section className="hf-stage" key={section} data-testid="menu-stage">
        {section === 'home' ? (
          <div className="hf-home">
            <p className="hf-kicker">The field</p>
            <h2>A desk airport</h2>
            <p className="lede">
              Buy the plot, stamp a starter kit, and sign the first carrier. The jet on the
              screen and the money in the book are the same flight.
            </p>
            {latest ? (
              <p className="hf-summary" data-testid="continue-summary">
                {latest.airport} · Day {latest.gameDay + 1} · {money(latest.cash)}
              </p>
            ) : null}
          </div>
        ) : null}
        {section === 'load' ? (
          <>
            <SaveBrowser onLoad={load} onChanged={() => setTick((n) => n + 1)} />
            {loadNote ? (
              <p className="hf-note" data-testid="load-note">
                {loadNote}
              </p>
            ) : null}
          </>
        ) : null}
        {section === 'settings' ? (
          <SettingsPane game={game} tab={settingsTab} onTab={setSettingsTab} />
        ) : null}
        {section === 'credits' ? (
          <div className="hf-credits" data-testid="credits">
            <h2>Credits</h2>
            <p>
              Hatchfield is a desk airport. The aeroplane on the apron and the line in the book
              are the same flight.
            </p>
            <p className="hf-kicker">Play</p>
            <p>
              Buy a plot, stamp a starter kit, and sign the first carrier. Staff, fuel, and the
              hall are the bottlenecks. Nothing on the field is free.
            </p>
            <p className="hf-kicker">This screen</p>
            <p>The menu sits on a live field. Esc holds the clock. Saves stay in this browser.</p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
