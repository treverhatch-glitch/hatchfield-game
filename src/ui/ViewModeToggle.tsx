import type { Game } from '../game/sim'

/**
 * Airport is the apron. Terminal is the playable interior (the hall).
 * Another workstream may add a cutaway camera on the apron; these two
 * buttons stay the way in and out of the interior.
 */
export function ViewModeToggle({ game }: { game: Game }) {
  return (
    <>
      <button
        type="button"
        data-testid="view-airport"
        className={game.view === 'apron' ? 'on' : ''}
        onClick={() => game.setView('apron')}
      >
        Airport
      </button>
      <button
        type="button"
        data-testid="view-terminal"
        className={game.view === 'hall' ? 'on' : ''}
        title="Roof off. Build and walk the interior."
        onClick={() => game.setView('hall')}
      >
        Terminal
      </button>
    </>
  )
}
