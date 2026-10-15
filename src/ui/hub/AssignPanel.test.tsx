import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { AssignPanel } from './AssignPanel.tsx'
import { HubSection } from './HubPanels.tsx'
import { openHubProfile, resetHubProfile } from './session.ts'

describe('assign panel', () => {
  it('shows the three sentences and a checklist link', () => {
    resetHubProfile()
    const game = new Game()
    game.signed = ['gulf_pearl']
    game.tiles[8][3] = 'stand'
    game.openAssign('gate', 'stand:3,8')
    const html = renderToStaticMarkup(<AssignPanel game={game} />)
    expect(html).toContain('Dedicate to airline…')
    expect(html).toContain('data-testid="assign-relationship"')
    expect(html).toContain('No rival hit for the lease.')
    expect(html).toContain('data-testid="assign-flexibility"')
    expect(html).toContain('Serves only Gulf Pearl')
    expect(html).toContain('data-testid="assign-bulk"')
    expect(html).toContain('Paint desks and stands')

    openHubProfile('gulf_pearl')
    const profile = renderToStaticMarkup(<HubSection game={game} id="gulf_pearl" />)
    expect(profile).toContain('data-testid="hub-missing-desk"')
    expect(profile).toContain('0 / 1')
    expect(profile).toContain('data-testid="hub-rivals"')
  })
})
