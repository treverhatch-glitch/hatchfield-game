import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { HubProgress, HubSection } from './HubPanels.tsx'
import { closeHubProfile, openHubProfile, resetHubProfile } from './session.ts'

describe('hub profile panel', () => {
  beforeEach(() => resetHubProfile())

  it('opens the checklist, the rewards, and a disabled desk button', () => {
    const game = new Game()
    game.signed = ['brisa']
    const closed = renderToStaticMarkup(<HubSection game={game} id="brisa" />)
    expect(closed).toContain('Hub tier')
    expect(closed).not.toContain('data-testid="hub-profile"')

    openHubProfile('brisa')
    const html = renderToStaticMarkup(<HubSection game={game} id="brisa" />)
    expect(html).toContain('data-testid="hub-profile"')
    expect(html).toContain('data-testid="hub-rewards"')
    expect(html).toContain('If you accept Focus city')
    expect(html).toContain('Waiting on the desk allocator')
    expect(html).toContain('data-testid="hub-dedicate-desk"')
    expect(html).toContain('disabled')
    expect(html).toContain('data-testid="hub-dedicate-lounge"')
    expect(html).toContain('data-testid="hub-dedicate-gate"')
    expect(html).toContain('data-testid="hub-dedicate-hangar"')
    expect(html).toContain('data-testid="hub-showcase"')
  })

  it('lists signed carriers with Primary hub pinned, and leaves the apron card as the only overlay', () => {
    const game = new Game()
    game.signed = ['brisa', 'gulf_pearl']
    game.hubTiers.gulf_pearl = 'primary'
    const html = renderToStaticMarkup(<HubProgress game={game} />)
    expect(html).toContain('data-testid="hub-progress"')
    expect(html).toContain('One Primary hub.')
    expect(html.indexOf('hub-row-gulf_pearl')).toBeLessThan(html.indexOf('hub-row-brisa'))
    expect(html).toContain('holds it')
    closeHubProfile()
  })
})
