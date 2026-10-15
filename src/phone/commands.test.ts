import { describe, expect, it, vi } from 'vitest'
import { dispatchPhoneAction, phoneHost } from './commands.ts'
import type { PhoneCommandHost } from './types.ts'
import { Game } from '../game/sim.ts'

function host(): PhoneCommandHost {
  return {
    acceptNegotiation: vi.fn(),
    walkNegotiation: vi.fn(),
    openNegotiationPanel: vi.fn(),
    snoozeOffer: vi.fn(),
    acceptLayover: vi.fn(),
    declineLayover: vi.fn(),
    acceptHub: vi.fn(),
    declineHub: vi.fn(),
    openAirlines: vi.fn(),
    openAssignScreen: vi.fn(),
    laterNudge: vi.fn(),
    declineNudge: vi.fn(),
    acceptMxOffer: vi.fn(),
    declineMxOffer: vi.fn(),
    acceptParking: vi.fn(),
    declineParking: vi.fn(),
    buildFieldTask: vi.fn(),
    declineFieldTask: vi.fn(),
    ackLetter: vi.fn(),
    dismissAdvisor: vi.fn(),
    acceptFuelSpot: vi.fn(),
    declineFuelSpot: vi.fn(),
    dropFuelTerm: vi.fn(),
    orderPipelineSpot: vi.fn(),
    orderBargeSpot: vi.fn(),
    acceptInbound: vi.fn(),
    refuseInbound: vi.fn(),
    scrambleThreat: vi.fn(),
    ignoreThreat: vi.fn(),
    hostEmergency: vi.fn(),
    refuseEmergency: vi.fn(),
    emit: vi.fn(),
  }
}

describe('phone commands', () => {
  it('wires Sign and Decline to the contract commands', () => {
    const desk = host()
    dispatchPhoneAction(desk, { type: 'sign-contract' })
    dispatchPhoneAction(desk, { type: 'decline-contract' })
    dispatchPhoneAction(desk, { type: 'negotiate-contract' })
    dispatchPhoneAction(desk, { type: 'later-contract' })
    expect(desk.acceptNegotiation).toHaveBeenCalledOnce()
    expect(desk.walkNegotiation).toHaveBeenCalledOnce()
    expect(desk.openNegotiationPanel).toHaveBeenCalledOnce()
    expect(desk.snoozeOffer).toHaveBeenCalledOnce()
  })

  it('declines a live contract letter through the sim', () => {
    const game = new Game()
    game.offer = { airline: 'northline', age: 0, deadline: 30 }
    dispatchPhoneAction(phoneHost(game), { type: 'decline-contract' })
    expect(game.offer).toBeNull()
  })

  it('acks a message and dismisses an advisor card', () => {
    const desk = host()
    dispatchPhoneAction(desk, { type: 'ack', key: 'field:ask-1' })
    dispatchPhoneAction(desk, { type: 'dismiss-advisor', cardId: 'advisor-standing-northline-1' })
    expect(desk.ackLetter).toHaveBeenCalledWith('field:ask-1')
    dispatchPhoneAction(desk, { type: 'decline-field' })
    expect(desk.declineFieldTask).toHaveBeenCalledOnce()
    expect(desk.dismissAdvisor).toHaveBeenCalledWith('advisor-standing-northline-1')
    expect(desk.emit).toHaveBeenCalledOnce()
  })

  it('accepts and refuses an inbound card', () => {
    const desk = host()
    dispatchPhoneAction(desk, { type: 'accept-inbound', requestId: 'in-1' })
    dispatchPhoneAction(desk, { type: 'refuse-inbound', requestId: 'in-1' })
    expect(desk.acceptInbound).toHaveBeenCalledWith('in-1')
    expect(desk.refuseInbound).toHaveBeenCalledWith('in-1')
  })
})
