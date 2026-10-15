import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { dayNightCycleEnabled, setDayNightCycleEnabled } from '../render/graphicsPrefs.ts'
import { Game } from '../game/sim.ts'
import { GameSettings } from './PauseMenu.tsx'
import { newGameHintPrefs } from '../game/hints.ts'

describe('GameSettings', () => {
  it('shows All hints enabled checkbox properly checked when enabled', () => {
    const game = new Game()
    game.hintPrefs = newGameHintPrefs(true)
    const html = renderToStaticMarkup(<GameSettings game={game} />)
    expect(html).toContain('<span>All hints enabled</span>')
    expect(html).toContain('data-testid="settings-all-hints" checked=""')
    expect(html).toContain('Every advisor hint shows in the panel, bottom right.')
    expect(html).toContain('data-testid="settings-tip-chips" checked=""')
    expect(html).toContain('<span>Tip chips</span>')
  })

  it('shows All hints enabled checkbox unchecked when disabled and everything muted', () => {
    const game = new Game()
    game.hintPrefs = newGameHintPrefs(false)
    const html = renderToStaticMarkup(<GameSettings game={game} />)
    expect(html).toContain('<span>All hints enabled</span>')
    expect(html).not.toContain('data-testid="settings-all-hints" checked=""')
    expect(html).toContain('Hints are off. Tick the box to turn every type back on.')
  })

  it('shows correct message when some hint types are muted', () => {
    const game = new Game()
    game.hintPrefs = { allEnabled: false, muted: ['standing', 'litter-floor'] }
    const html = renderToStaticMarkup(<GameSettings game={game} />)
    expect(html).toContain('2 hint types hidden. Tick the box to turn every type back on.')
  })

  it('shows the day/night cycle under graphics and remembers Off', () => {
    setDayNightCycleEnabled(true)
    const game = new Game()
    const on = renderToStaticMarkup(<GameSettings game={game} />)
    expect(on.indexOf('data-testid="gfx-note"')).toBeLessThan(on.indexOf('data-testid="settings-day-night"'))
    expect(on.indexOf('data-testid="settings-day-night"')).toBeLessThan(on.indexOf('>Hints<'))
    expect(on).toContain('Day/night cycle: On')
    expect(on).toContain('data-testid="settings-day-night" checked=""')
    expect(dayNightCycleEnabled()).toBe(true)
    setDayNightCycleEnabled(false)
    expect(dayNightCycleEnabled()).toBe(false)
    const off = renderToStaticMarkup(<GameSettings game={game} />)
    expect(off).toContain('Day/night cycle: Off')
    expect(off).toContain('Always day')
    expect(off).not.toContain('data-testid="settings-day-night" checked=""')
    setDayNightCycleEnabled(true)
    expect(dayNightCycleEnabled()).toBe(true)
  })

  it('shows correct message when one hint type is muted', () => {
    const game = new Game()
    game.hintPrefs = { allEnabled: false, muted: ['standing'] }
    const html = renderToStaticMarkup(<GameSettings game={game} />)
    expect(html).toContain('1 hint type hidden. Tick the box to turn every type back on.')
  })
})
