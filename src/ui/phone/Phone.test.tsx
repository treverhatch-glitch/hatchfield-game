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
    expect(html).toContain('>Sign<')
    expect(html).toContain('>Decline<')
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
