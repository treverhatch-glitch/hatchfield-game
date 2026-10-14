import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { AlertStackView } from './AlertStack.tsx'

describe('AlertStackView', () => {
  it('shows critical and warning on the bottom-right dock and leaves info off it', () => {
    const game = new Game()
    game.raiseAlert({
      key: 'cond:fuel-out',
      severity: 'critical',
      title: 'Fuel farm is empty',
      detail: '0 L',
      at: { view: 'apron', cells: [{ c: 3, r: 4 }] },
    })
    game.raiseAlert({ key: 'cond:cash', severity: 'warning', title: 'Cash is low', detail: '$4k' })
    game.raiseAlert({ key: 'ops:vip', severity: 'info', title: 'VIP visit', detail: 'A stand is held' })

    const html = renderToStaticMarkup(<AlertStackView game={game} />)
    expect(html).toContain('class="alert-dock"')
    expect(html).toContain('data-testid="alert-stack"')
    expect(html).toContain('data-severity="critical"')
    expect(html).toContain('data-severity="warning"')
    expect(html).toContain('Critical')
    expect(html).toContain('Warning')
    expect(html).toContain('Fuel farm is empty')
    expect(html).toContain('Cash is low')
    expect(html).not.toContain('VIP visit')
    expect(html).not.toContain('data-severity="info"')
    expect(html).toContain('data-testid="alert-cond:fuel-out"')
    expect(html).toContain('Pan to problem')
  })

  it('renders nothing when every live alert is info', () => {
    const game = new Game()
    game.raiseAlert({ key: 'ops:vip', severity: 'info', title: 'VIP visit', detail: 'A stand is held' })
    expect(renderToStaticMarkup(<AlertStackView game={game} />)).toBe('')
  })
})
