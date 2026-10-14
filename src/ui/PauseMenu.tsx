import { useEffect, useState, useSyncExternalStore } from 'react'
import { applyAudioSettings, audioSettings } from '../audio/prefs.ts'
import { type AudioBus } from '../features/settings/settings.ts'
import { Game } from '../game/sim.ts'
import {
  chooseGraphicsQuality,
  graphicsAuto,
  graphicsNote,
  graphicsQuality,
  QUALITY_LABEL,
  subscribeGraphicsQuality,
  type QualityLevel,
} from '../render/graphicsPrefs.ts'
import { ControlsPanel } from './ControlsPanel.tsx'
import { pauseState } from './pauseState.ts'

const AUDIO_ROWS: { id: AudioBus; label: string }[] = [
  { id: 'aircraft', label: 'Jets' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'ambient', label: 'Terminal' },
  { id: 'ambience', label: 'Outdoors' },
  { id: 'ui', label: 'Interface' },
  { id: 'sfx', label: 'Effects' },
]

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
  useEffect(() => {
    const off = game.subscribe(() => setRev((n) => n + 1))
    return () => {
      off()
    }
  }, [game])
  if (!snap.open) return null
  const hasSave = Game.hasSave()

  return (
    <div className="pause-layer" data-testid="pause-menu">
      <button type="button" className="pause-scrim" aria-label="Resume" onClick={() => pauseState.close()} />
      <aside className="pause-sheet">
        <h2>{snap.page === 'settings' ? 'Settings' : 'System'}</h2>
        <p className="muted">Esc holds the clock. Save, load, and settings live here. The field stays in view.</p>
        {snap.page === 'main' ? (
          <div className="pause-actions">
            <button type="button" className="wide on" data-testid="pause-resume" onClick={() => pauseState.close()}>
              Resume
            </button>
            <button
              type="button"
              className="wide"
              data-testid="pause-save"
              onClick={() => {
                game.persist()
                pauseState.setNote(game.site ? 'Saved.' : 'Nothing to save yet.')
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="wide"
              data-testid="pause-load"
              disabled={!hasSave}
              onClick={() => {
                if (game.load()) pauseState.close()
              }}
            >
              Load
            </button>
            <button type="button" className="wide" data-testid="pause-settings" onClick={() => pauseState.showSettings('game')}>
              Settings
            </button>
            {onNewGame ? (
              <button
                type="button"
                className="wide"
                data-testid="pause-new-game"
                onClick={() => {
                  pauseState.close()
                  onNewGame()
                }}
              >
                New game
              </button>
            ) : null}
            <button
              type="button"
              className="wide"
              data-testid="pause-quit"
              onClick={() => {
                pauseState.close()
                game.shelveForTitle()
                onQuit()
              }}
            >
              Quit to title
            </button>
            {snap.note ? (
              <p className="tycoon-note" data-testid="pause-note">
                {snap.note}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="settings-tabs">
              <button
                type="button"
                className={snap.settingsTab === 'game' ? 'on' : ''}
                data-testid="settings-tab-game"
                onClick={() => pauseState.setTab('game')}
              >
                Game
              </button>
              <button
                type="button"
                className={snap.settingsTab === 'controls' ? 'on' : ''}
                data-testid="settings-tab-controls"
                onClick={() => pauseState.setTab('controls')}
              >
                Controls
              </button>
            </div>
            {snap.settingsTab === 'game' ? <GameSettings game={game} onNewGame={onNewGame} /> : <ControlsPanel />}
            <button type="button" className="wide" data-testid="pause-back" onClick={() => pauseState.back()}>
              Back
            </button>
          </>
        )}
      </aside>
    </div>
  )
}

export function GameSettings({ game, onNewGame }: { game: Game; onNewGame?: () => void }) {
  const [audioMix, setAudioMix] = useState(() => audioSettings().get())
  const [gfx, setGfx] = useState<QualityLevel>(graphicsQuality)
  useEffect(() => subscribeGraphicsQuality(setGfx), [])
  return (
    <div data-testid="settings-game">
      {onNewGame ? (
        <>
          <button type="button" className="wide" data-testid="settings-new-game" onClick={onNewGame}>
            Back to title
          </button>
          <p className="muted">Back to the title. Start again from there, or continue this field.</p>
        </>
      ) : null}
      <h3>Sound</h3>
      <label className="sandbox-toggle">
        <input
          type="checkbox"
          data-testid="settings-audio-mute"
          checked={audioMix.audioMuted}
          onChange={(e) => {
            const next = audioSettings().update((s) => ({ ...s, audioMuted: e.target.checked }))
            applyAudioSettings(next)
            setAudioMix(next)
          }}
        />
        <span>Mute</span>
      </label>
      <ul className="budgets" data-testid="settings-audio">
        <li>
          <label>
            <span>
              Master <span className="muted">{Math.round(audioMix.masterVolume * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              data-testid="settings-audio-master"
              value={audioMix.masterVolume}
              onChange={(e) => {
                const masterVolume = Number(e.target.value)
                const next = audioSettings().update((s) => ({ ...s, masterVolume }))
                applyAudioSettings(next)
                setAudioMix(next)
              }}
            />
          </label>
        </li>
        {AUDIO_ROWS.map((row) => (
          <li key={row.id}>
            <label>
              <span>
                {row.label} <span className="muted">{Math.round(audioMix.busVolume[row.id] * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                data-testid={`settings-audio-${row.id}`}
                value={audioMix.busVolume[row.id]}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  const next = audioSettings().update((s) => ({
                    ...s,
                    busVolume: { ...s.busVolume, [row.id]: value },
                  }))
                  applyAudioSettings(next)
                  setAudioMix(next)
                }}
              />
            </label>
          </li>
        ))}
      </ul>
      <h3>Graphics</h3>
      <div className="gfx-quality" role="radiogroup" aria-label="Graphics quality">
        {(['low', 'med', 'high', 'ultra'] as const).map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={gfx === level}
            data-testid={`gfx-${level}`}
            className={gfx === level ? 'on' : ''}
            onClick={() => {
              chooseGraphicsQuality(level)
              setGfx(level)
            }}
          >
            {QUALITY_LABEL[level]}
          </button>
        ))}
      </div>
      <p className="muted" data-testid="gfx-note">
        {graphicsNote(gfx, graphicsAuto())}
      </p>
      <h3>Hints</h3>
      <label className="sandbox-toggle">
        <input
          type="checkbox"
          data-testid="settings-all-hints"
          checked={game.hintPrefs.allEnabled}
          onChange={(e) => game.setAllHints(e.target.checked)}
        />
        <span>All hints enabled</span>
      </label>
      <p className="muted">
        {game.hintPrefs.allEnabled
          ? 'Every advisor hint shows in the panel, bottom right.'
          : game.hintPrefs.muted.includes('*')
            ? 'Hints are off. Tick the box to turn every type back on.'
            : `${game.hintPrefs.muted.length} hint type${game.hintPrefs.muted.length === 1 ? '' : 's'} hidden. Tick the box to turn every type back on.`}
      </p>
      <h3>Tip chips</h3>
      <label className="sandbox-toggle">
        <input
          type="checkbox"
          data-testid="settings-tip-chips"
          checked={game.tipBook.enabled}
          onChange={(e) => game.setTipChips(e.target.checked)}
        />
        <span>Tip chips</span>
      </label>
      <p className="muted">
        {game.tipBook.enabled
          ? 'Small notes when the field is stuck. Each one shows once. Separate from hints and alerts.'
          : 'Tip chips are off. The hint panel and the alert stack are unchanged.'}
      </p>
    </div>
  )
}
