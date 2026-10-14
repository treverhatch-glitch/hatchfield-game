import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { HintPanel } from './HintPanel.tsx'

describe('HintPanel', () => {
  it('renders nothing when there are no hints', () => {
    const game = new Game()
    const html = renderToStaticMarkup(<HintPanel game={game} />)
    expect(html).toBe('')
  })

  it('renders badge with count when hints exist and panel is not open', () => {
    const game = new Game()
    game.advice.push({ id: 'standing-a', title: 'Standing Note', cells: [], detail: '', fix: '' })
    const html = renderToStaticMarkup(<HintPanel game={game} />)
    expect(html).toContain('data-testid="hint-panel"')
    expect(html).toContain('data-testid="hint-badge"')
    expect(html).toContain('1 hint')
    expect(html).not.toContain('data-testid="hint-list"')
  })

  it('renders hint list and mute button when panel is open', () => {
    const game = new Game()
    game.advice.push({ id: 'standing-a', title: 'Standing Note', cells: [], detail: '', fix: '' })
    game.sidePanel = 'hints'
    const html = renderToStaticMarkup(<HintPanel game={game} />)
    expect(html).toContain('data-testid="hint-list"')
    expect(html).toContain('data-testid="hint-standing-a"')
    expect(html).toContain('Standing Note')
    expect(html).toContain('Don&#x27;t show hints of this type') // HTML encoded single quote
    expect(html).toContain('data-testid="hint-mute-standing-a"')
  })

  it('handles plural correctly when multiple hints exist', () => {
    const game = new Game()
    game.advice.push({ id: 'standing-a', title: 'Standing Note 1', cells: [], detail: '', fix: '' })
    game.advice.push({ id: 'standing-b', title: 'Standing Note 2', cells: [], detail: '', fix: '' })
    const html = renderToStaticMarkup(<HintPanel game={game} />)
    expect(html).toContain('2 hints')
  })
})
