import { useEffect, useState } from 'react'
import { applyAudioSettings, audioSettings } from '../../audio/prefs.ts'
import { AUDIO_BUSES, type AudioBus } from '../../features/settings/settings.ts'
import type { Game } from '../../game/sim.ts'
import {
  chooseGraphicsQuality,
  graphicsAuto,
  graphicsNote,
  graphicsQuality,
  QUALITY_LABEL,
  subscribeGraphicsQuality,
  type QualityLevel,
} from '../../render/graphicsPrefs.ts'

const AUDIO_LABEL: Record<AudioBus, string> = {
  aircraft: 'Jets',
  vehicles: 'Vehicles',
  buildings: 'Buildings',
  ambient: 'Terminal',
  ambience: 'Outdoors',
  ui: 'Interface',
  sfx: 'Effects',
}

const AUDIO_ROWS: { id: AudioBus; label: string }[] = AUDIO_BUSES.map((id) => ({ id, label: AUDIO_LABEL[id] }))

export function GameSettings({ game, onNewGame }: { game: Game; onNewGame?: () => void }) {
  const [audioMix, setAudioMix] = useState(() => audioSettings().get())
  const [gfx, setGfx] = useState<QualityLevel>(graphicsQuality)
  useEffect(() => audioSettings().subscribe(setAudioMix), [])
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
      <label className="sandbox-toggle">
        <input
          type="checkbox"
          data-testid="settings-day-night"
          checked={audioMix.dayNightCycle}
          onChange={(e) => {
            game.setDayNightCycle(e.target.checked)
            setAudioMix(audioSettings().get())
          }}
        />
        <span>Day/night cycle: {audioMix.dayNightCycle ? 'On' : 'Off'}</span>
      </label>
      <p className="muted" data-testid="settings-day-night-note">
        {audioMix.dayNightCycle
          ? 'On. The sun, moon, and field lights follow the clock.'
          : 'Off. Always day. The clock still runs, and a photo hour still wins while the camera is frozen.'}
      </p>
      <ul className="budgets">
        <li>
          <label>
            <span>
              Camera speed <span className="muted">{audioMix.cameraSpeed.toFixed(1)}×</span>
            </span>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.1}
              data-testid="settings-camera-speed"
              value={audioMix.cameraSpeed}
              onChange={(e) => {
                const cameraSpeed = Number(e.target.value)
                const next = audioSettings().update((s) => ({ ...s, cameraSpeed }))
                setAudioMix(next)
              }}
            />
          </label>
        </li>
      </ul>
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
