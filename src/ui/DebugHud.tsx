import type { Game } from '../game/sim'

/**
 * Corner readout for the stuck-flight watchdog. It does not take pointer events,
 * so the field underneath stays clickable.
 */
export function DebugHud({ game }: { game: Game }) {
  if (!game.debugHud) return null
  const latest = game.recoveryLog[0]
  return (
    <div className="debug-hud" data-testid="debug-hud" aria-label="Debug">
      <span data-testid="debug-recovery-count">Recoveries {game.recoveryCount}</span>
      {latest ? <span data-testid="debug-recovery-latest">{latest.detail}</span> : null}
    </div>
  )
}
