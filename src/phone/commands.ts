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
    openAirlines: (airlineId) => game.openAirlinesFromPhone(airlineId),
    openAssignScreen: (airlineId) => game.openAssignScreen(airlineId),
    laterNudge: (airlineId) => game.laterHubNudge(airlineId),
    declineNudge: (airlineId) => game.declineHubNudge(airlineId),
    acceptMxOffer: () => game.acceptMxOffer(),
    declineMxOffer: () => game.declineMxOffer(),
    acceptParking: () => game.acceptParking(),
    declineParking: () => game.declineParking(),
    buildFieldTask: () => game.buildFieldTask(),
    declineFieldTask: () => game.declineFieldTask(),
    ackLetter: (key) => game.ackLetter(key),
    dismissAdvisor: (cardId) => game.standingAdvisor.dismissCard(cardId),
    acceptFuelSpot: () => game.acceptSpot(),
    declineFuelSpot: () => game.declineSpot(),
    dropFuelTerm: () => game.dropFuelTerm(),
    orderPipelineSpot: () => game.orderPipelineSpot(),
    orderBargeSpot: () => game.orderBargeSpot(),
    acceptInbound: (requestId) => {
      game.acceptInbound(requestId)
    },
    refuseInbound: (requestId) => {
      game.refuseInbound(requestId)
    },
    scrambleThreat: () => game.resolveThreat('scramble'),
    ignoreThreat: () => game.resolveThreat('ignore'),
    hostEmergency: () => game.resolveEmergency('accept'),
    refuseEmergency: () => game.resolveEmergency('refuse'),
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
    case 'open-airlines':
      host.openAirlines(action.airlineId)
      return
    case 'open-assign':
      host.openAssignScreen(action.airlineId)
      return
    case 'later-nudge':
      host.laterNudge(action.airlineId)
      return
    case 'decline-nudge':
      host.declineNudge(action.airlineId)
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
    case 'decline-field':
      host.declineFieldTask()
      return
    case 'ack':
      host.ackLetter(action.key)
      return
    case 'dismiss-advisor':
      host.dismissAdvisor(action.cardId)
      host.emit()
      return
    case 'accept-fuel-spot':
      host.acceptFuelSpot()
      return
    case 'decline-fuel-spot':
      host.declineFuelSpot()
      return
    case 'drop-fuel-term':
      host.dropFuelTerm()
      return
    case 'order-pipeline-spot':
      host.orderPipelineSpot()
      return
    case 'order-barge-spot':
      host.orderBargeSpot()
      return
    case 'accept-inbound':
      host.acceptInbound(action.requestId)
      return
    case 'refuse-inbound':
      host.refuseInbound(action.requestId)
      return
    case 'scramble-threat':
      host.scrambleThreat()
      return
    case 'ignore-threat':
      host.ignoreThreat()
      return
    case 'host-emergency':
      host.hostEmergency()
      return
    case 'refuse-emergency':
      host.refuseEmergency()
      return
    default: {
      const never: never = action
      return never
    }
  }
}
