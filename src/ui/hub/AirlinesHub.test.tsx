import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { createPhoneShell, phoneOpen } from '../../phone/logic.ts'
import { PhoneView } from '../phone/Phone.tsx'
import { AirlinesHub } from './AirlinesHub.tsx'

describe('Airlines hub', () => {
  it('lists relationship, checklist, rewards, rivals, and dedicated assets', () => {
    const game = new Game()
    const empty = renderToStaticMarkup(<AirlinesHub game={game} />)
    expect(empty).toContain('No signed carriers yet')
    expect(empty).not.toContain('data-testid="airline-hub-brisa"')

    game.signed = ['brisa']
    game.dedicatedDesks.push({ deskId: 'A2', airlineId: 'brisa', mode: 'dedicated' })
    game.hubLeases.push({ id: 'lounge:1,1,0', kind: 'lounge', airlineId: 'brisa' })
    game.hubVehicleLeases.push({
      id: 'veh:pushback_tug:1',
      role: 'tug',
      type: 'pushback_tug',
      airlineId: 'brisa',
      primary: '#123456',
      secondary: '#654321',
    })
    const html = renderToStaticMarkup(<AirlinesHub game={game} />)
    expect(html).toContain('data-testid="airline-hub-brisa"')
    expect(html).toContain('data-testid="airline-hub-rel-brisa"')
    expect(html).toContain('Relationship fee')
    expect(html).toContain('Hub tier Station → Focus city')
    expect(html).toContain('data-testid="hub-line-desk"')
    expect(html).toContain('Preferred desk')
    expect(html).toContain('If you accept Focus city')
    expect(html).toContain('No signed rival is angry about this step.')
    expect(html).toContain('Desk A2')
    expect(html).toContain('Lounge lounge:1,1,0')
    expect(html).toContain('tug')
  })

  it('keeps the phone on Contracts and Messages', () => {
    const html = renderToStaticMarkup(
      <PhoneView
        cards={[]}
        shell={phoneOpen(createPhoneShell())}
        onOpen={() => {}}
        onClose={() => {}}
        onTab={() => {}}
        onSwipe={() => {}}
        onAction={() => {}}
      />,
    )
    expect(html.match(/data-testid="phone-tab-[^"]+"/g)).toEqual([
      'data-testid="phone-tab-contracts"',
      'data-testid="phone-tab-messages"',
    ])
  })
})
