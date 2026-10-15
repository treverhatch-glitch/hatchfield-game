import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { PHONE_EXCLUDED_KINDS } from '../../phone/types.ts'
import { AlertStackView } from './AlertStack.tsx'
import { ALERT_DOCK_BOTTOM, HINT_REST_BOTTOM, dockBlockHeight, hintBadgeBottom } from './hintAnchor.ts'
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

  it('anchors the badge above a warning dock and keeps today\'s place when the dock is empty', () => {
    const game = new Game()
    game.advice.push({ id: 'standing-a', title: 'Standing Note', cells: [], detail: '', fix: '' })
    const resting = renderToStaticMarkup(<HintPanel game={game} />)
    expect(resting).toContain(`data-bottom="${HINT_REST_BOTTOM}"`)
    expect(resting).toContain('bottom:120px')

    game.raiseAlert({ key: 'cond:cash', severity: 'warning', title: 'Cash is low', detail: '$4k' })
    const anchor = { rows: 1, minimised: false }
    const bottom = hintBadgeBottom(anchor)
    const dockTop = ALERT_DOCK_BOTTOM + dockBlockHeight(anchor)
    expect(bottom).toBeGreaterThanOrEqual(dockTop)
    const hint = renderToStaticMarkup(<HintPanel game={game} />)
    const dock = renderToStaticMarkup(<AlertStackView game={game} />)
    expect(hint).toContain(`data-bottom="${bottom}"`)
    expect(hint).toContain(`bottom:${bottom}px`)
    expect(hint).toContain('data-testid="hint-badge"')
    expect(dock).toContain('class="alert-dock"')
    expect(dock).toContain('Cash is low')
    expect(PHONE_EXCLUDED_KINDS).toContain('hint')
    expect(hint).not.toContain('data-testid="phone')
  })

  it('turning hints off removes only the hint badge', () => {
    const game = new Game()
    game.advice.push({ id: 'standing-a', title: 'Standing Note', cells: [], detail: '', fix: '' })
    game.raiseAlert({ key: 'cond:cash', severity: 'warning', title: 'Cash is low', detail: '$4k' })
    game.setAllHints(false)
    expect(renderToStaticMarkup(<HintPanel game={game} />)).toBe('')
    const dock = renderToStaticMarkup(<AlertStackView game={game} />)
    expect(dock).toContain('data-testid="alert-stack"')
    expect(dock).toContain('Cash is low')
    expect(dock).not.toContain('hint-badge')
  })

  it('handles plural correctly when multiple hints exist', () => {
    const game = new Game()
    game.advice.push({ id: 'standing-a', title: 'Standing Note 1', cells: [], detail: '', fix: '' })
    game.advice.push({ id: 'standing-b', title: 'Standing Note 2', cells: [], detail: '', fix: '' })
    const html = renderToStaticMarkup(<HintPanel game={game} />)
    expect(html).toContain('2 hints')
  })
})
