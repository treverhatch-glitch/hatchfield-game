import { ControlsPanel } from '../ControlsPanel.tsx'
import { GameSettings } from './GameSettings.tsx'
import type { Game } from '../../game/sim.ts'
import type { SettingsTab } from '../pauseState.ts'

export function SettingsPane({
  game,
  tab,
  onTab,
  onNewGame,
}: {
  game: Game
  tab: SettingsTab
  onTab: (tab: SettingsTab) => void
  onNewGame?: () => void
}) {
  return (
    <div data-testid="settings-pane">
      <h2>Settings</h2>
      <div className="settings-tabs">
        <button
          type="button"
          className={tab === 'game' ? 'on' : ''}
          data-testid="settings-tab-game"
          onClick={() => onTab('game')}
        >
          Game
        </button>
        <button
          type="button"
          className={tab === 'controls' ? 'on' : ''}
          data-testid="settings-tab-controls"
          onClick={() => onTab('controls')}
        >
          Controls
        </button>
      </div>
      {tab === 'game' ? <GameSettings game={game} onNewGame={onNewGame} /> : <ControlsPanel />}
    </div>
  )
}
