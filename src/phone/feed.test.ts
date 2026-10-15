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
          clockLine: '20s left · fine $1,600 if left to expire',
          buildLabel: 'Build · $8,000 cost / $1,000 bonus',
          buildEnabled: false,
        },
      }),
    )
    expect(cards.map((card) => card.kind)).toEqual(['layover', 'field'])
    expect(cards.every((card) => card.tab === 'messages')).toBe(true)
    expect(cards.find((card) => card.id === 'field')?.actions.map((action) => action.id)).toEqual([
      'build',
      'decline',
      'later',
    ])
    expect(cards.find((card) => card.id === 'field')?.actions.map((action) => action.label)).toEqual([
      'Build · $8,000 cost / $1,000 bonus',
      'Decline',
      'Later',
    ])
    expect(cards.find((card) => card.id === 'field')?.body).toContain('fine $1,600 if left to expire')
    expect(cards.find((card) => card.id === 'field')?.actions[0]?.disabled).toBe(true)
    const inbound = buildPhoneFeed(
      world({
        inbound: {
          id: 'in-1',
          title: 'Night freighter',
          blurb: 'Wants a stand tonight',
          priority: true,
          needs: 'A code-C stand',
          pay: 'Fee $4,000 · 1d',
          secondsLeft: 40,
        },
      }),
    )
    expect(inbound[0]).toMatchObject({
      id: 'inbound',
      kind: 'inbound',
      tab: 'messages',
      from: 'Priority traffic',
    })
    expect(inbound[0]?.actions.map((action) => action.action.type)).toEqual(['accept-inbound', 'refuse-inbound'])
    const council = buildPhoneFeed(
      world({
        council: {
          id: 'surface-access',
          title: 'Regional access compact',
          sponsor: 'Transit committee',
          request: 'Share the cost of late buses.',
          threshold: 64,
          choices: [
            { id: 'full', label: 'Underwrite the compact', detail: 'Full package', costText: '$45,000', support: 70, pass: true, disabled: false },
            { id: 'compromise', label: 'Fund the curb works', detail: 'Smaller package', costText: '$18,000', support: 55, pass: false, disabled: false },
            { id: 'decline', label: 'Decline funding', detail: 'Keep the cash', costText: 'no cash cost', support: 40, pass: false, disabled: false },
          ],
        },
      }),
    )
    expect(council[0]).toMatchObject({ id: 'council', kind: 'council', tab: 'messages', arrives: true, from: 'Transit committee' })
    expect(council[0]?.actions.map((action) => action.action)).toEqual([
      { type: 'vote-council', requestId: 'surface-access', choiceId: 'full' },
      { type: 'vote-council', requestId: 'surface-access', choiceId: 'compromise' },
      { type: 'vote-council', requestId: 'surface-access', choiceId: 'decline' },
    ])
    expect(council[0]?.actions[0]?.primary).toBe(true)
    const season = buildPhoneFeed(
      world({
        seasonMission: {
          key: 'season:temperate:summer:0',
          seasonName: 'Summer',
          titles: ['Summer getaway'],
          nextLine: 'Next: Autumn',
        },
      }),
    )
    expect(season[0]).toMatchObject({
      id: 'season-mission',
      kind: 'season',
      tab: 'messages',
      from: 'Airport Council',
      title: 'Summer missions',
      arrives: true,
    })
    expect(season[0]?.body).toContain('Summer getaway')
    expect(season[0]?.body).toContain('Next: Autumn')
    expect(season[0]?.actions[0]?.action).toEqual({ type: 'ack', key: 'season:temperate:summer:0' })
    const offer = buildPhoneFeed(
      world({
        negotiation: {
          airlineName: 'Coastal Hop',
          note: 'They want a lower landing fee.',
          pitch: 'A master contract for the season.',
          summary: 'Landing · ask 4.20 · theirs 5.10',
          open: true,
        },
        diplomacy: [{ id: 'p1', airline: 'Coastal Hop', text: 'Coastal Hop proposes a master contract: 14 flights a week.', kind: 'flights' }],
        priceWar: { headline: 'Bellwater cuts fees', detail: 'Walk-in is sliding.', actions: [{ id: 'hold', label: 'Hold fees' }] },
      }),
    )
    expect(offer.map((card) => card.kind)).toEqual(['negotiation', 'diplomacy', 'price-war'])
    expect(offer[0]?.actions.map((action) => action.label)).toEqual(['Sign', 'Counter', 'Walk away', 'Close'])
    expect(offer[1]?.title).toContain('master contract')
    expect(offer[1]?.actions[0]?.action).toEqual({ type: 'answer-diplomacy', letterId: 'p1', choice: 'accept' })
    for (const kind of PHONE_EXCLUDED_KINDS) {
      expect(cards.some((card) => card.kind === kind)).toBe(false)
    }
  })
})
