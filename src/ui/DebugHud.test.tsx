import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../game/sim'
import { DebugHud } from './DebugHud'

describe('debug HUD recovery counter', () => {
  it('shows the recovery count when the debug HUD is on', () => {
    const game = new Game()
    game.debugHud = true
    game.recoveryCount = 4
    game.recoveryLog = [
      {
        atMin: 12,
        id: 'bu131',
        label: 'BU131',
        kind: 'aircraft',
        state: 'landing',
        step: 'repath',
        detail: 'BU131 re-pathed while landing.',
      },
    ]
    const html = renderToStaticMarkup(<DebugHud game={game} />)
    expect(html).toContain('data-testid="debug-recovery-count"')
    expect(html).toContain('Recoveries 4')
    expect(html).toContain('BU131 re-pathed while landing.')
  })

  it('stays off the field until the debug HUD is enabled', () => {
    const game = new Game()
    game.recoveryCount = 2
    expect(renderToStaticMarkup(<DebugHud game={game} />)).toBe('')
  })
})
