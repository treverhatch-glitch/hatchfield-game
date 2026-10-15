/**
 * In-game phone. These types are the sim-side model: no DOM, no React.
 * Hints, tip chips, alerts, and emergencies are not phone material.
 */
import type { CouncilChoiceId } from '../council/types.ts'

export type PhoneTab = 'contracts' | 'messages'

export type PhoneTone = 'ok' | 'good' | 'warn' | 'bad'

/** Kinds the phone refuses. They stay on their own panels. */
/** Hints, tips, and the alert dock stay off the handset. Crash and fuel-out are screen interrupts, not cards. */
export const PHONE_EXCLUDED_KINDS = ['hint', 'tip', 'alert'] as const

export type PhoneExcludedKind = (typeof PHONE_EXCLUDED_KINDS)[number]

export type PhoneAction =
  | { type: 'sign-contract' }
  | { type: 'decline-contract' }
  | { type: 'negotiate-contract' }
  | { type: 'later-contract' }
  | { type: 'accept-layover' }
  | { type: 'decline-layover' }
  | { type: 'accept-hub' }
  | { type: 'decline-hub' }
  | { type: 'open-airlines'; airlineId: string }
  | { type: 'open-assign'; airlineId: string }
  | { type: 'later-nudge'; airlineId: string }
  | { type: 'decline-nudge'; airlineId: string }
  | { type: 'sign-mx' }
  | { type: 'decline-mx' }
  | { type: 'accept-parking' }
  | { type: 'decline-parking' }
  | { type: 'build-field' }
  | { type: 'decline-field' }
  | { type: 'ack'; key: string }
  | { type: 'dismiss-advisor'; cardId: string }
  | { type: 'accept-fuel-spot' }
  | { type: 'decline-fuel-spot' }
  | { type: 'drop-fuel-term' }
  | { type: 'order-pipeline-spot' }
  | { type: 'order-barge-spot' }
  | { type: 'accept-inbound'; requestId: string }
  | { type: 'refuse-inbound'; requestId: string }
  | { type: 'scramble-threat' }
  | { type: 'ignore-threat' }
  | { type: 'host-emergency' }
  | { type: 'refuse-emergency' }
  | { type: 'vote-council'; requestId: string; choiceId: CouncilChoiceId }
  | { type: 'counter-negotiation' }
  | { type: 'close-negotiation' }
  | { type: 'answer-diplomacy'; letterId: string; choice: 'accept' | 'decline' | 'counter' }
  | { type: 'price-war'; choice: 'match' | 'hold' | 'promote' }
  | { type: 'dismiss-year' }

export interface PhoneButton {
  id: string
  label: string
  primary?: boolean
  disabled?: boolean
  action: PhoneAction
}

export interface PhoneLine {
  label: string
  met?: boolean
}

export interface PhoneCard {
  id: string
  /** Stable arrival identity. A new key flashes the peek. Deadlines are not part of it. */
  key: string
  tab: PhoneTab
  kind: string
  from: string
  title: string
  /** Short line for the peek flash. */
  preview: string
  body: string
  tone: PhoneTone
  /** Sim letter id whose countdown pauses while this card is on the open tab. */
  holdId?: string
  /** Incoming items flash. Signed contracts already on the books do not. */
  arrives: boolean
  secondsLeft: number | null
  /** Live read for the countdown. Optional so the pure feed can stay serializable. */
  left?: () => number
  lines?: PhoneLine[]
  actions: PhoneButton[]
}

/** What the phone is doing, independent of how it is drawn. */
export interface PhoneShell {
  open: boolean
  tab: PhoneTab
  /** The active tab's page can be closed without closing the phone. */
  tabOpen: boolean
  flashKey: string | null
  seen: string[]
}

export interface PhoneCommandHost {
  acceptNegotiation(): void
  walkNegotiation(): void
  openNegotiationPanel(): void
  snoozeOffer(): void
  acceptLayover(): void
  declineLayover(): void
  acceptHub(): void
  declineHub(): void
  openAirlines(airlineId: string): void
  openAssignScreen(airlineId: string): void
  laterNudge(airlineId: string): void
  declineNudge(airlineId: string): void
  acceptMxOffer(): void
  declineMxOffer(): void
  acceptParking(): void
  declineParking(): void
  buildFieldTask(): void
  declineFieldTask(): void
  ackLetter(key: string): void
  dismissAdvisor(cardId: string): void
  acceptFuelSpot(): void
  declineFuelSpot(): void
  dropFuelTerm(): void
  orderPipelineSpot(): void
  orderBargeSpot(): void
  acceptInbound(requestId: string): void
  refuseInbound(requestId: string): void
  scrambleThreat(): void
  ignoreThreat(): void
  hostEmergency(): void
  refuseEmergency(): void
  voteCouncil(requestId: string, choiceId: CouncilChoiceId): void
  counterNegotiation(): void
  closeNegotiationPanel(): void
  answerDiplomacy(letterId: string, choice: 'accept' | 'decline' | 'counter'): void
  respondToPriceWar(choice: 'match' | 'hold' | 'promote'): void
  dismissYearReport(): void
  emit(): void
}
