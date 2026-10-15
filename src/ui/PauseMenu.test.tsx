import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { audioSettings } from '../audio/prefs.ts'
import { readDayNightCycle } from '../features/settings/settings.ts'
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

  it('shows the day/night cycle toggle and remembers Off', () => {
    audioSettings().update((s) => ({ ...s, dayNightCycle: true }))
    const game = new Game()
    const on = renderToStaticMarkup(<GameSettings game={game} />)
    expect(on).toContain('Day/night cycle: On')
    expect(on).toContain('data-testid="settings-day-night" checked=""')
    audioSettings().update((s) => ({ ...s, dayNightCycle: false }))
    const off = renderToStaticMarkup(<GameSettings game={game} />)
    expect(off).toContain('Day/night cycle: Off')
    expect(off).toContain('Fixed daytime')
    expect(off).not.toContain('data-testid="settings-day-night" checked=""')
    audioSettings().update((s) => ({ ...s, dayNightCycle: true }))
  })

  it('shows correct message when one hint type is muted', () => {
    const game = new Game()
    game.hintPrefs = { allEnabled: false, muted: ['standing'] }
    const html = renderToStaticMarkup(<GameSettings game={game} />)
    expect(html).toContain('1 hint type hidden. Tick the box to turn every type back on.')
  })

  it('shows the day and night cycle switch and keeps it in the save', () => {
    const game = new Game()
    game.setDayNightCycle(true)
    const on = renderToStaticMarkup(<GameSettings game={game} />)
    expect(on).toContain('data-testid="settings-day-night" checked=""')
    expect(on).toContain('Day/night cycle: On')

    game.sandbox = true
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.setDayNightCycle(false)
    expect(game.dayNightCycle).toBe(false)
    expect(readDayNightCycle()).toBe(false)
    const off = renderToStaticMarkup(<GameSettings game={game} />)
    expect(off).toContain('data-testid="settings-day-night"')
    expect(off).not.toContain('data-testid="settings-day-night" checked=""')
    expect(off).toContain('Fixed daytime')

    game.beginNew('easy')
    expect(game.dayNightCycle).toBe(false)
    game.buyLand('city')
    game.persist()
    const again = new Game()
    expect(again.load()).toBe(true)
    expect(again.dayNightCycle).toBe(false)
    again.setDayNightCycle(true)
    expect(readDayNightCycle()).toBe(true)
    expect(again.dayNightCycle).toBe(true)
  })
})
