import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../game/sim.ts'
import { AirlinesDesk } from './AirlinesDesk.tsx'
import { resetHubProfile } from './hub/session.ts'

describe('airlines desk from the hud control', () => {
  it('opens relationship, hub level, checklist, rewards, rivals, and dedicated infra', () => {
    resetHubProfile()
    const game = new Game()
    game.signed = ['gulf_pearl', 'zephyr_go', 'tango_air']
    game.hubTiers.gulf_pearl = 'base'
    game.openAirlines('gulf_pearl')
    const html = renderToStaticMarkup(<AirlinesDesk game={game} />)
    expect(html).toContain('data-testid="airline-relations"')
    expect(html).toContain('data-testid="relationship-fee"')
    expect(html).toContain('data-testid="hub-profile"')
    expect(html).toContain('data-testid="hub-tier"')
    expect(html).toContain('data-testid="hub-rewards"')
    expect(html).toContain('data-testid="hub-rivals"')
    expect(html).toContain('data-testid="hub-dedicated"')
    expect(html).toContain('Zephyr Go')
    expect(html).toContain('Tango Air')
  })
})
