import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../game/sim'
import { STARTER_KITS } from '../game/starterLayout'
import { LandScreen } from './LandScreen'
import { TitleScreen } from './TitleScreen'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function title(enableHints = true) {
  return renderToStaticMarkup(
    <TitleScreen
      sandbox={false}
      onSandboxChange={() => {}}
      enableHints={enableHints}
      onEnableHintsChange={() => {}}
      onNewGame={() => {}}
      onChooseKit={() => {}}
      onContinue={() => {}}
    />,
  )
}

describe('start menu', () => {
  it('shows the logo title, both starter kits, and start with hints off', () => {
    const html = title(true)
    expect(html).toContain('logo_hatchfield.jpg')
    expect(html).toContain('alt="Hatchfield"')
    expect(html).toContain('game-title-idle')
    expect(html).toContain(STARTER_KITS.pax.label)
    expect(html).toContain(STARTER_KITS.cargo.label)
    expect(html).toContain(STARTER_KITS.pax.includes[0])
    expect(html).toContain(STARTER_KITS.cargo.includes[0])
    expect(html).toContain('Start with hints off')
    expect(html).toContain('data-testid="hints-off-toggle"')
    expect(html).toContain('data-testid="new-game"')
    // Hints stay on until the player checks the box.
    expect(html).toContain('data-testid="enable-hints-toggle" checked=""')
    expect(html).not.toContain('data-testid="hints-off-toggle" checked=""')
  })

  it('checks start with hints off when the new game will hide them', () => {
    const html = title(false)
    expect(html).toContain('data-testid="hints-off-toggle" checked=""')
    expect(html).not.toContain('data-testid="enable-hints-toggle" checked=""')
  })

  it('offers the day and night cycle, checked until the player turns it off', () => {
    expect(title()).toContain('data-testid="day-night-cycle-toggle" checked=""')
    const off = renderToStaticMarkup(
      <TitleScreen
        sandbox={false}
        onSandboxChange={() => {}}
        enableHints
        onEnableHintsChange={() => {}}
        dayNightCycle={false}
        onNewGame={() => {}}
        onChooseKit={() => {}}
        onContinue={() => {}}
      />,
    )
    expect(off).toContain('Day and night cycle')
    expect(off).toContain('data-testid="day-night-cycle-toggle"')
    expect(off).not.toContain('data-testid="day-night-cycle-toggle" checked=""')
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
      />,
    )
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
