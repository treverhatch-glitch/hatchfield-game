/**
 * Map a phone button onto the letter and contract commands that already exist.
 * This does not decide prices, deadlines, or whether a signature is allowed.
 */
import type { Game } from '../game/sim.ts'
import type { PhoneAction, PhoneCommandHost } from './types.ts'

export function phoneHost(game: Game): PhoneCommandHost {
  return {
    acceptNegotiation: () => game.acceptNegotiation(),
    walkNegotiation: () => game.walkNegotiation(),
    openNegotiationPanel: () => game.openNegotiationPanel(),
    snoozeOffer: () => game.snoozeOffer(),
    acceptLayover: () => game.acceptLayover(),
    declineLayover: () => game.declineLayover(),
    acceptHub: () => game.acceptHub(),
    declineHub: () => game.declineHub(),
    acceptMxOffer: () => game.acceptMxOffer(),
    declineMxOffer: () => game.declineMxOffer(),
    acceptParking: () => game.acceptParking(),
    declineParking: () => game.declineParking(),
    buildFieldTask: () => game.buildFieldTask(),
    ackLetter: (key) => game.ackLetter(key),
    dismissAdvisor: (cardId) => game.standingAdvisor.dismissCard(cardId),
    emit: () => game.emit(),
  }
}

export function dispatchPhoneAction(host: PhoneCommandHost, action: PhoneAction): void {
  switch (action.type) {
    case 'sign-contract':
      host.acceptNegotiation()
      return
    case 'decline-contract':
      host.walkNegotiation()
      return
    case 'negotiate-contract':
      host.openNegotiationPanel()
      return
    case 'later-contract':
      host.snoozeOffer()
      return
    case 'accept-layover':
      host.acceptLayover()
      return
    case 'decline-layover':
      host.declineLayover()
      return
    case 'accept-hub':
      host.acceptHub()
      return
    case 'decline-hub':
      host.declineHub()
      return
    case 'sign-mx':
      host.acceptMxOffer()
      return
    case 'decline-mx':
      host.declineMxOffer()
      return
    case 'accept-parking':
      host.acceptParking()
      return
    case 'decline-parking':
      host.declineParking()
      return
    case 'build-field':
      host.buildFieldTask()
      return
    case 'ack':
      host.ackLetter(action.key)
      return
    case 'dismiss-advisor':
      host.dismissAdvisor(action.cardId)
      host.emit()
      return
    default: {
      const never: never = action
      return never
    }
  }
}
