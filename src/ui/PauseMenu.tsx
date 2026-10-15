import { useEffect, useState, useSyncExternalStore } from 'react'
import { activateSlot, writeManualSlot } from '../features/save/library.ts'
import { money } from '../game/catalog.ts'
import { Game } from '../game/sim.ts'
import { SaveBrowser } from './menu/SaveBrowser.tsx'
import { SettingsPane } from './menu/SettingsPane.tsx'
import { captureFieldThumb } from './menu/thumb.ts'
import { pauseState } from './pauseState.ts'

export { GameSettings } from './menu/GameSettings.tsx'

/** Side sheet. The field stays visible behind a light scrim, and the clock waits. */
export function PauseMenu({
  game,
  onQuit,
  onNewGame,
}: {
  game: Game
  onQuit: () => void
  onNewGame?: () => void
}) {
  const snap = useSyncExternalStore(pauseState.subscribe, pauseState.getSnapshot)
  const [, setRev] = useState(0)
  const [copyName, setCopyName] = useState('')
  useEffect(() => {
    const off = game.subscribe(() => setRev((n) => n + 1))
    return () => {
      off()
    }
  }, [game])
  if (!snap.open) return null
  const suggested = `${game.branding.airportName || 'Hatchfield'} · day ${game.gameDay() + 1}`

  const saveNamed = (name: string) => {
    game.persist()
    const named = writeManualSlot({
      savedAt: Date.now(),
      gameDay: game.gameDay(),
      cash: game.cash,
      airport: game.branding.airportName || 'Hatchfield',
      name: name.trim() || suggested,
      thumb: captureFieldThumb(),
    })
    return named ? `Kept “${named.name}”.` : 'Could not store that copy. The autosave is still here.'
  }

  return (
    <div className="pause-layer" data-testid="pause-menu">
      <button type="button" className="pause-scrim" aria-label="Resume" onClick={() => pauseState.close()} />
      <aside className="pause-sheet hf-pause">
        <div className="hf-rail">
          <p className="hf-kicker">Paused</p>
          <p className="hf-word">Hatchfield</p>
          <nav className="hf-nav" aria-label="Paused">
            <button type="button" className={snap.page === 'main' ? 'on' : ''} data-testid="pause-resume" onClick={() => pauseState.close()}>
              Resume
            </button>
            <button
              type="button"
              className={snap.page === 'save' ? 'on' : ''}
              data-testid="pause-save"
              onClick={() => {
                game.persist()
                pauseState.showSave()
                pauseState.setNote(game.site ? 'Saved.' : 'Nothing to save yet.')
              }}
            >
              Save
            </button>
            <button
              type="button"
              className={snap.page === 'load' ? 'on' : ''}
              data-testid="pause-load"
              onClick={() => pauseState.showLoad()}
            >
              Load
            </button>
            <button
              type="button"
              className={snap.page === 'settings' ? 'on' : ''}
              data-testid="pause-settings"
              onClick={() => pauseState.showSettings('game')}
            >
              Settings
            </button>
            <button
              type="button"
              className="hf-quit"
              data-testid="pause-quit"
              onClick={() => {
                pauseState.close()
                game.shelveForTitle()
                onQuit()
              }}
            >
              Exit to menu
            </button>
            {onNewGame ? (
              <button
                type="button"
                className="hf-quiet"
                data-testid="pause-new-game"
                onClick={() => {
                  pauseState.close()
                  onNewGame()
                }}
              >
                New game
              </button>
            ) : null}
          </nav>
          {snap.note ? (
            <p className="hf-note" data-testid="pause-note">
              {snap.note}
            </p>
          ) : null}
        </div>
        {snap.page !== 'main' ? (
          <div className="hf-stage" key={snap.page}>
            {snap.page === 'save' ? (
              <div data-testid="pause-save-panel">
                <h2>Save</h2>
                <p className="hf-muted">
                  Autosave updated{game.site ? ` · ${game.branding.airportName} · Day ${game.gameDay() + 1} · ${money(game.cash)}` : ''}.
                  Keep a named copy if you want this day to stay.
                </p>
                <form
                  className="hf-save-as"
                  onSubmit={(e) => {
                    e.preventDefault()
                    pauseState.setNote(saveNamed(copyName))
                  }}
                >
                  <input
                    type="text"
                  value={copyName}
                  placeholder={suggested}
                  maxLength={48}
                  aria-label="Save name"
                  data-testid="pause-save-name"
                  onChange={(e) => setCopyName(e.target.value)}
                />
                <button type="submit" data-testid="pause-save-copy">
                  Save a copy
                </button>
              </form>
            </div>
          ) : null}
          {snap.page === 'load' ? (
            <SaveBrowser
              onLoad={(id) => {
                if (!activateSlot(id) || !game.load()) {
                  pauseState.setNote('That save could not be read.')
                  return
                }
                pauseState.close()
              }}
              onChanged={() => setRev((n) => n + 1)}
              saveCopy={{
                defaultName: copyName || suggested,
                onSave: (name) => saveNamed(name),
              }}
            />
          ) : null}
            {snap.page === 'settings' ? (
              <SettingsPane
                game={game}
                tab={snap.settingsTab}
                onTab={(tab) => pauseState.setTab(tab)}
                onNewGame={onNewGame}
              />
            ) : null}
            <button type="button" className="wide" data-testid="pause-back" onClick={() => pauseState.back()}>
              Back
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
