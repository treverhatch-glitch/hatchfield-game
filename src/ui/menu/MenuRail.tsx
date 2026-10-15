import type { ReactNode } from 'react'
import type { MenuSection } from './sections.ts'

export function MenuWordmark() {
  return (
    <div className="hf-brand">
      <p className="hf-kicker">Regional airport</p>
      <div className="game-title-idle" data-testid="game-title-idle">
        <div className="hf-logo-plate">
          <h1 className="game-title" data-testid="game-title">
            <img src="/assets/pack4/logo_hatchfield.jpg" alt="Hatchfield" />
          </h1>
        </div>
      </div>
    </div>
  )
}

export function MenuRail({
  current,
  hasSave,
  onContinue,
  onNew,
  onLoad,
  onSettings,
  onCredits,
  onQuit,
  quitNote,
  footer,
}: {
  current: MenuSection | 'new'
  hasSave: boolean
  onContinue?: () => void
  onNew: () => void
  onLoad: () => void
  onSettings: () => void
  onCredits: () => void
  onQuit: () => void
  quitNote?: string
  footer?: ReactNode
}) {
  return (
    <div className="hf-rail">
      <MenuWordmark />
      <nav className="hf-nav" aria-label="Menu">
        {hasSave && onContinue ? (
          <button type="button" data-testid="continue-game" onClick={onContinue}>
            Continue
          </button>
        ) : null}
        <button
          type="button"
          className={current === 'new' ? 'on' : ''}
          aria-current={current === 'new' ? 'page' : undefined}
          data-testid="new-game"
          onClick={onNew}
        >
          New Game
        </button>
        <button
          type="button"
          className={current === 'load' ? 'on' : ''}
          aria-current={current === 'load' ? 'page' : undefined}
          data-testid="menu-tab-load"
          onClick={onLoad}
        >
          Load Game
        </button>
        <button
          type="button"
          className={current === 'settings' ? 'on' : ''}
          aria-current={current === 'settings' ? 'page' : undefined}
          data-testid="menu-tab-settings"
          onClick={onSettings}
        >
          Settings
        </button>
        <button
          type="button"
          className={current === 'credits' ? 'on' : ''}
          aria-current={current === 'credits' ? 'page' : undefined}
          data-testid="menu-tab-credits"
          onClick={onCredits}
        >
          Credits
        </button>
        <button type="button" className="hf-quit" data-testid="menu-tab-quit" onClick={onQuit}>
          Quit
        </button>
        {quitNote ? (
          <p className="hf-note" data-testid="quit-note">
            {quitNote}
          </p>
        ) : null}
      </nav>
      {footer ? <div className="hf-foot">{footer}</div> : null}
    </div>
  )
}
