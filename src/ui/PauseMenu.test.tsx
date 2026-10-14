import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
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

  it('shows correct message when one hint type is muted', () => {
    const game = new Game()
    game.hintPrefs = { allEnabled: false, muted: ['standing'] }
    const html = renderToStaticMarkup(<GameSettings game={game} />)
    expect(html).toContain('1 hint type hidden. Tick the box to turn every type back on.')
  })
})
