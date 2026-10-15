import { describe, expect, it } from 'vitest'
import {
  arrivalKeys,
  classifyPhoneKind,
  createPhoneShell,
  flashPreview,
  flashTab,
  lettersToHold,
  phoneClose,
  phoneDismissFlash,
  phoneOpen,
  letterOnStack,
  phoneOwnsLetter,
  phonePreview,
  phoneSetTab,
  phoneSwipe,
  phoneSync,
  PHONE_PREVIEW_MAX,
} from './logic.ts'
import type { PhoneCard } from './types.ts'

function card(partial: Pick<PhoneCard, 'key' | 'tab' | 'arrives'> & { holdId?: string; preview?: string }): PhoneCard {
  return {
    id: partial.key,
    key: partial.key,
    tab: partial.tab,
    kind: partial.tab === 'contracts' ? 'signed' : 'message',
    from: 'Desk',
    title: partial.preview ?? partial.key,
    preview: partial.preview ?? partial.key,
    body: '',
    tone: 'ok',
    arrives: partial.arrives,
    secondsLeft: null,
    holdId: partial.holdId,
    actions: [],
  }
}

describe('phone shell', () => {
  it('peeks closed on the contracts tab', () => {
    expect(createPhoneShell()).toMatchObject({ open: false, tab: 'contracts', tabOpen: true, flashKey: null })
  })

  it('opens, closes, and clears the flash', () => {
    const flashed = { ...createPhoneShell(), flashKey: 'contract:northline' }
    const open = phoneOpen(flashed, 'messages')
    expect(open).toMatchObject({ open: true, tab: 'messages', tabOpen: true, flashKey: null })
    expect(phoneClose(open).open).toBe(false)
  })

  it('opens and closes a tab, and a swipe lands on the other one open', () => {
    const shell = phoneOpen(createPhoneShell())
    const shut = phoneSetTab(shell, 'contracts')
    expect(shut.tabOpen).toBe(false)
    expect(phoneSetTab(shut, 'contracts').tabOpen).toBe(true)
    const messages = phoneSwipe(shell, 'next')
    expect(messages).toMatchObject({ tab: 'messages', tabOpen: true })
    expect(phoneSwipe(messages, 'next').tab).toBe('messages')
    expect(phoneSwipe(messages, 'prev').tab).toBe('contracts')
  })

  it('flashes a new contract or message once, and again only if it leaves and returns', () => {
    const first = phoneSync(createPhoneShell(), ['contract:northline'])
    expect(first.flashKey).toBe('contract:northline')
    const quiet = phoneSync(first, ['contract:northline'])
    expect(quiet.flashKey).toBe('contract:northline')
    const dismissed = phoneDismissFlash(quiet)
    expect(dismissed.flashKey).toBeNull()
    const still = phoneSync(dismissed, ['contract:northline'])
    expect(still.flashKey).toBeNull()
    const gone = phoneSync(still, [])
    const back = phoneSync(gone, ['contract:northline'])
    expect(back.flashKey).toBe('contract:northline')
  })

  it('does not flash a signed contract that is already on the books', () => {
    const cards = [
      card({ key: 'signed:northline', tab: 'contracts', arrives: false }),
      card({ key: 'contract:harbor', tab: 'messages', arrives: true, preview: 'Harbor Air wants a contract' }),
    ]
    expect(arrivalKeys(cards)).toEqual(['contract:harbor'])
    const shell = phoneSync(createPhoneShell(), arrivalKeys(cards))
    expect(flashPreview(cards, shell.flashKey)).toBe('Harbor Air wants a contract')
    expect(flashTab(cards, shell.flashKey)).toBe('messages')
  })

  it('keeps the preview short', () => {
    const long = 'Northline wants a contract and then keeps talking about stands, fuel, and the hall'
    expect(phonePreview(long).length).toBeLessThanOrEqual(PHONE_PREVIEW_MAX)
    expect(phonePreview(long).endsWith('…')).toBe(true)
    expect(phonePreview('  Northline   wants a contract ')).toBe('Northline wants a contract')
  })

  it('holds only the letters on the page being read', () => {
    const cards = [
      card({ key: 'contract:n', tab: 'messages', arrives: true, holdId: 'contract' }),
      card({ key: 'field:1', tab: 'messages', arrives: true, holdId: 'field' }),
      card({ key: 'signed:n', tab: 'contracts', arrives: false }),
    ]
    const closed = createPhoneShell()
    expect(lettersToHold(closed, cards)).toEqual([])
    const reading = phoneSetTab(phoneOpen(closed), 'messages')
    expect(lettersToHold(reading, cards)).toEqual(['contract', 'field'])
    const shut = phoneSetTab(reading, 'messages')
    expect(lettersToHold(shut, cards)).toEqual([])
  })
})

describe('what stays off the phone', () => {
  it('drops hints, tip chips, alerts, and emergencies', () => {
    for (const kind of ['hint', 'tip', 'alert']) {
      expect(classifyPhoneKind(kind)).toBeNull()
    }
    expect(classifyPhoneKind('inbound')).toBe('messages')
    expect(classifyPhoneKind('threat')).toBe('messages')
    expect(classifyPhoneKind('emergency')).toBe('messages')
    expect(classifyPhoneKind('contract')).toBe('messages')
    expect(classifyPhoneKind('signed')).toBe('contracts')
    expect(classifyPhoneKind('layover')).toBe('messages')
  })

  it('claims contract letters and desk notes, and keeps crash and fuel-out off the handset', () => {
    expect(phoneOwnsLetter('contract')).toBe(true)
    expect(phoneOwnsLetter('field')).toBe(true)
    expect(phoneOwnsLetter('cargo-vol')).toBe(true)
    expect(phoneOwnsLetter('warn')).toBe(true)
    expect(phoneOwnsLetter('advisor-standing-northline-10')).toBe(true)
    expect(phoneOwnsLetter('threat')).toBe(true)
    expect(phoneOwnsLetter('emergency')).toBe(true)
    expect(phoneOwnsLetter('crash')).toBe(false)
    expect(phoneOwnsLetter('fuel-out')).toBe(false)
  })

  it('keeps only a crash or a fuel outage on the desktop stack', () => {
    expect(phoneOwnsLetter('contract')).toBe(true)
    expect(phoneOwnsLetter('field')).toBe(true)
    expect(phoneOwnsLetter('cargo-vol')).toBe(true)
    expect(phoneOwnsLetter('warn')).toBe(true)
    expect(letterOnStack('contract', true)).toBe(false)
    expect(letterOnStack('field', true)).toBe(false)
    expect(letterOnStack('cargo-vol', true)).toBe(false)
    expect(letterOnStack('warn', true)).toBe(false)
    expect(letterOnStack('threat', true)).toBe(false)
    expect(letterOnStack('inbound', true)).toBe(false)
    expect(letterOnStack('crash', true)).toBe(true)
    expect(letterOnStack('fuel-out', true)).toBe(true)
    expect(letterOnStack('fire', true)).toBe(true)
    expect(letterOnStack('diplomacy', true)).toBe(false)
    expect(letterOnStack('contract', false)).toBe(true)
  })
})
