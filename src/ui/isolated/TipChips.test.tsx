import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { TipChips } from './TipChips.tsx'

describe('TipChips', () => {
  it('draws a dismissible chip from sim state and nothing when the book is off', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('standard')
    game.buyLand('city')
    game.cash = 100
    game.refreshTips()
    const html = renderToStaticMarkup(<TipChips game={game} />)
    expect(html).toContain('data-testid="tip-chip-out-of-cash"')
    expect(html).toContain('Out of cash')
    expect(html).toContain('data-testid="tip-dismiss-out-of-cash"')
    expect(html).not.toContain('alert-stack')
    expect(html).not.toContain('hint-panel')

    game.setTipChips(false)
    expect(renderToStaticMarkup(<TipChips game={game} />)).toBe('')
  })
})
