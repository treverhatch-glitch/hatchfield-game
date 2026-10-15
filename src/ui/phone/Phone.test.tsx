import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { createPhoneShell, phoneOpen, phoneSetTab } from '../../phone/logic.ts'
import type { PhoneCard } from '../../phone/types.ts'
import { Phone, PhoneView } from './Phone.tsx'

function letter(): PhoneCard {
  return {
    id: 'contract',
    key: 'contract:northline',
    tab: 'messages',
    kind: 'contract',
    from: 'Northline',
    title: 'Northline wants a contract',
    preview: 'Northline wants a contract',
    body: 'Budget · regional LCC',
    tone: 'good',
    arrives: true,
    secondsLeft: 90,
    holdId: 'contract',
    lines: [{ label: 'Not ready — missing Runway', met: false }],
    actions: [
      { id: 'sign', label: 'Sign', primary: true, action: { type: 'sign-contract' } },
      { id: 'decline', label: 'Decline', action: { type: 'decline-contract' } },
    ],
  }
}

describe('PhoneView', () => {
  it('peeks from the edge until a letter flashes a short preview', () => {
    const quiet = renderToStaticMarkup(
      <PhoneView cards={[]} shell={createPhoneShell()} onOpen={() => {}} onClose={() => {}} onTab={() => {}} onSwipe={() => {}} onAction={() => {}} />,
    )
    expect(quiet).toContain('data-testid="phone"')
    expect(quiet).toContain('data-state="peek"')
    expect(quiet).toContain('data-testid="phone-peek"')
    expect(quiet).not.toContain('data-testid="phone-preview"')

    const flashing = renderToStaticMarkup(
      <PhoneView
        cards={[letter()]}
        shell={{ ...createPhoneShell(), flashKey: 'contract:northline' }}
        onOpen={() => {}}
        onClose={() => {}}
        onTab={() => {}}
        onSwipe={() => {}}
        onAction={() => {}}
      />,
    )
    expect(flashing).toContain('data-state="flash"')
    expect(flashing).toContain('data-testid="phone-preview"')
    expect(flashing).toContain('Northline wants a contract')
    expect(flashing).not.toContain('Sign a carrier')
    expect(flashing).not.toContain('Fuel farm')
  })

  it('slides open to tabs, and a message card signs or declines the contract letter', () => {
    const open = phoneSetTab(phoneOpen(createPhoneShell()), 'messages')
    const html = renderToStaticMarkup(
      <PhoneView
        cards={[letter()]}
        shell={open}
        onOpen={() => {}}
        onClose={() => {}}
        onTab={() => {}}
        onSwipe={() => {}}
        onAction={() => {}}
      />,
    )
    expect(html).toContain('data-state="open"')
    expect(html).toContain('data-testid="phone-tab-contracts"')
    expect(html).toContain('data-testid="phone-tab-messages"')
    expect(html).toContain('data-testid="phone-swipe"')
    expect(html).toContain('data-testid="phone-close"')
    expect(html).toContain('data-testid="phone-card-contract"')
    expect(html).toContain('data-testid="phone-action-contract-sign"')
    expect(html).toContain('data-testid="phone-action-contract-decline"')
    expect(html).toContain('data-phone-action="sign-contract"')
    expect(html).toContain('data-phone-action="decline-contract"')
    expect(html).toContain('>Sign<')
    expect(html).toContain('>Decline<')
  })

  it('uses the same Sign, Decline, and Later ids on the filed copy', () => {
    const filed = letter()
    filed.id = 'contract-file'
    filed.tab = 'contracts'
    filed.kind = 'offer'
    filed.arrives = false
    filed.actions = [
      ...filed.actions,
      { id: 'later', label: 'Later', action: { type: 'later-contract' } },
    ]
    const open = renderToStaticMarkup(
      <PhoneView
        cards={[filed]}
        shell={{ ...phoneOpen(createPhoneShell()), tab: 'contracts', tabOpen: true }}
        onOpen={() => {}}
        onClose={() => {}}
        onTab={() => {}}
        onSwipe={() => {}}
        onAction={() => {}}
      />,
    )
    expect(open).toContain('data-testid="phone-card-contract-file"')
    expect(open).toContain('data-testid="phone-action-contract-sign"')
    expect(open).toContain('data-testid="phone-action-contract-decline"')
    expect(open).toContain('data-testid="phone-action-contract-later"')
    expect(open).toContain('data-phone-action="later-contract"')
    expect(open).not.toContain('phone-action-contract-file-sign')
  })

  it('stamps inbound and council actions with stable ids', () => {
    const cards: PhoneCard[] = [
      {
        id: 'inbound',
        key: 'inbound:in-1',
        tab: 'messages',
        kind: 'inbound',
        from: 'Traffic',
        title: 'Night freighter',
        preview: 'Night freighter',
        body: 'One turn.',
        tone: 'ok',
        arrives: true,
        secondsLeft: 40,
        actions: [
          { id: 'accept', label: 'Accept', primary: true, action: { type: 'accept-inbound', requestId: 'in-1' } },
          { id: 'refuse', label: 'Refuse', action: { type: 'refuse-inbound', requestId: 'in-1' } },
        ],
      },
      {
        id: 'council',
        key: 'council:c-1',
        tab: 'messages',
        kind: 'council',
        from: 'Transit committee',
        title: 'Curb works',
        preview: 'Curb works',
        body: 'Vote.',
        tone: 'warn',
        arrives: true,
        secondsLeft: null,
        actions: [
          { id: 'full', label: 'Underwrite the compact', primary: true, action: { type: 'vote-council', requestId: 'c-1', choiceId: 'full' } },
          { id: 'compromise', label: 'Fund the curb works', action: { type: 'vote-council', requestId: 'c-1', choiceId: 'compromise' } },
          { id: 'decline', label: 'Decline funding', action: { type: 'vote-council', requestId: 'c-1', choiceId: 'decline' } },
        ],
      },
    ]
    const html = renderToStaticMarkup(
      <PhoneView
        cards={cards}
        shell={{ ...phoneOpen(createPhoneShell()), tab: 'messages', tabOpen: true }}
        onOpen={() => {}}
        onClose={() => {}}
        onTab={() => {}}
        onSwipe={() => {}}
        onAction={() => {}}
      />,
    )
    expect(html).toContain('data-testid="phone-action-inbound-accept"')
    expect(html).toContain('data-testid="phone-action-inbound-refuse"')
    expect(html).toContain('data-phone-action="accept-inbound"')
    expect(html).toContain('data-testid="phone-action-council-full"')
    expect(html).toContain('data-testid="phone-action-council-compromise"')
    expect(html).toContain('data-testid="phone-action-council-decline"')
    expect(html).toContain('data-phone-action="vote-council"')
  })

  it('closes the open tab without closing the phone', () => {
    const shut = phoneSetTab(phoneOpen(createPhoneShell()), 'contracts')
    expect(shut.tabOpen).toBe(false)
    const html = renderToStaticMarkup(
      <PhoneView cards={[]} shell={shut} onOpen={() => {}} onClose={() => {}} onTab={() => {}} onSwipe={() => {}} onAction={() => {}} />,
    )
    expect(html).toContain('data-testid="phone-tab-shut"')
    expect(html).toContain('Contracts closed')
    expect(html).not.toContain('data-testid="phone-swipe"')
  })
})

describe('Phone desktop gate', () => {
  it('stays off the narrow layout', () => {
    const game = new Game()
    const html = renderToStaticMarkup(<Phone game={game} desktop={false} />)
    expect(html).toBe('')
  })
})
