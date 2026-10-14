import { describe, expect, it } from 'vitest'
import { buildPhoneFeed, emptyPhoneWorld, type PhoneWorld } from './feed.ts'
import { PHONE_EXCLUDED_KINDS } from './types.ts'

function world(partial: Partial<PhoneWorld> = {}): PhoneWorld {
  return { ...emptyPhoneWorld(), ...partial }
}

describe('phone feed', () => {
  it('puts a contract letter on Messages with Sign and Decline', () => {
    const cards = buildPhoneFeed(
      world({
        contract: {
          airlineId: 'northline',
          airlineName: 'Northline',
          persona: 'Budget',
          blurb: 'T2 regional LCC.',
          procedural: false,
          secondsLeft: 90,
          verdict: 'Ready to sign',
          verdictMet: true,
          requirements: [{ label: 'Met · Runway', met: true }],
          terms: 'Terms · landing $5,200',
        },
        signed: [{ id: 'bushline', name: 'Bushline', standing: 70 }],
      }),
    )
    const letter = cards.find((card) => card.id === 'contract')
    expect(letter?.tab).toBe('messages')
    expect(letter?.preview).toBe('Northline wants a contract')
    expect(letter?.actions.map((action) => action.label)).toEqual(['Sign', 'Decline', 'Negotiate', 'Later'])
    expect(letter?.actions[0]).toMatchObject({ id: 'sign', action: { type: 'sign-contract' }, primary: true })
    expect(letter?.actions[1]?.action).toEqual({ type: 'decline-contract' })
    expect(letter?.holdId).toBe('contract')
    const signed = cards.find((card) => card.id === 'signed:bushline')
    expect(signed).toMatchObject({ tab: 'contracts', arrives: false, actions: [] })
  })

  it('builds message cards with their own actions and never includes excluded kinds', () => {
    const cards = buildPhoneFeed(
      world({
        layoverOffer: {
          airlineName: 'Harbor Air',
          feeText: '$12,000',
          transferPax: 40,
          duration: 180,
          secondsLeft: 40,
        },
        field: {
          id: 'ask-1',
          airlineName: 'Northline',
          title: 'Police post',
          blurb: 'Build a police post',
          bonusText: '$1,000',
          secondsLeft: 20,
          buildLabel: 'Build · $8,000 cost / $1,000 bonus',
          buildEnabled: false,
        },
      }),
    )
    expect(cards.map((card) => card.kind)).toEqual(['layover', 'field'])
    expect(cards.every((card) => card.tab === 'messages')).toBe(true)
    expect(cards.find((card) => card.id === 'field')?.actions.map((action) => action.id)).toEqual(['build', 'dismiss'])
    expect(cards.find((card) => card.id === 'field')?.actions[0]?.disabled).toBe(true)
    for (const kind of PHONE_EXCLUDED_KINDS) {
      expect(cards.some((card) => card.kind === kind)).toBe(false)
    }
  })
})
