import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../game/sim'
import { STARTER_KITS } from '../game/starterLayout'
import { setDayNightCycleEnabled } from '../render/graphicsPrefs'
import { LandScreen } from './LandScreen'
import { TitleScreen } from './TitleScreen'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function title(enableHints = true) {
  return renderToStaticMarkup(
    <TitleScreen
      game={new Game()}
      section="home"
      onSection={() => {}}
      sandbox={false}
      onSandboxChange={() => {}}
      enableHints={enableHints}
      onEnableHintsChange={() => {}}
      onNewGame={() => {}}
      onContinue={() => {}}
    />,
  )
}

describe('start menu', () => {
  it('shows the logo title, the rail, and start with hints off', () => {
    const html = title(true)
    expect(html).toContain('logo_hatchfield.jpg')
    expect(html).toContain('alt="Hatchfield"')
    expect(html).toContain('game-title-idle')
    expect(html).toContain('New Game')
    expect(html).toContain('Load Game')
    expect(html).toContain('Settings')
    expect(html).toContain('Credits')
    expect(html).toContain('>Quit<')
    expect(html).toContain('Start with hints off')
    expect(html).toContain('data-testid="hints-off-toggle"')
    expect(html).toContain('data-testid="new-game"')
    expect(html).toContain('data-testid="menu-tab-load"')
    // Hints stay on until the player checks the box.
    expect(html).toContain('data-testid="enable-hints-toggle" checked=""')
    expect(html).not.toContain('data-testid="hints-off-toggle" checked=""')
  })

  it('checks start with hints off when the new game will hide them', () => {
    const html = title(false)
    expect(html).toContain('data-testid="hints-off-toggle" checked=""')
    expect(html).not.toContain('data-testid="enable-hints-toggle" checked=""')
  })

  it('offers the day and night cycle on the settings stage', () => {
    setDayNightCycleEnabled(true)
    const game = new Game()
    const on = renderToStaticMarkup(
      <TitleScreen
        game={game}
        section="settings"
        onSection={() => {}}
        sandbox={false}
        onSandboxChange={() => {}}
        enableHints
        onEnableHintsChange={() => {}}
        onNewGame={() => {}}
        onContinue={() => {}}
      />,
    )
    expect(on).toContain('data-testid="settings-day-night" checked=""')
    expect(on).toContain('Day/night cycle: On')
    setDayNightCycleEnabled(false)
    const off = renderToStaticMarkup(
      <TitleScreen
        game={game}
        section="settings"
        onSection={() => {}}
        sandbox={false}
        onSandboxChange={() => {}}
        enableHints
        onEnableHintsChange={() => {}}
        onNewGame={() => {}}
        onContinue={() => {}}
      />,
    )
    expect(off).toContain('Day/night cycle: Off')
    expect(off).toContain('Always day')
    expect(off).not.toContain('data-testid="settings-day-night" checked=""')
    setDayNightCycleEnabled(true)
  })
})

describe('new-game sheet', () => {
  it('names each starter kit and repeats start with hints off', () => {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    game.startFocus = 'cargo'
    const html = renderToStaticMarkup(
      <LandScreen
        game={game}
        enableHints={false}
        onEnableHintsChange={() => {}}
        onBought={() => {}}
        onBack={() => {}}
        onContinue={() => {}}
        onNavigate={() => {}}
      />,
    )
    expect(html).toContain('Free play')
    expect(html).toContain('Island Hop')
    expect(html).toContain('data-testid="new-scenario-free"')
    expect(html).toContain(STARTER_KITS.pax.label)
    expect(html).toContain(STARTER_KITS.cargo.label)
    expect(html).toContain(STARTER_KITS.pax.includes[2])
    expect(html).toContain(STARTER_KITS.cargo.includes[2])
    expect(html).toContain('Start with hints off')
    expect(html).toContain('data-testid="new-game-hints-off" checked=""')
    expect(html).toContain('data-testid="start-pax"')
    expect(html).toContain('data-testid="start-cargo"')
    expect(html).toContain('aria-pressed="true"')
  })
})
