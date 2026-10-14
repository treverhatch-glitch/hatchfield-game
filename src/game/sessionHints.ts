/**
 * First-session hints. One next action at a time, in a fixed order.
 * Completed steps are skipped, so a starter kit that already hired a clerk
 * does not repeat that step. The last step covers the second letter, then the
 * sequence ends. Muted as one kind (`session`) from the hint panel.
 */
import type { Advice } from './advisor.ts'

export interface SessionState {
  /** Strip and a stand are on the field. */
  fieldUp: boolean
  signed: number
  offerWaiting: boolean
  buildTrayOpened: boolean
  deskStaff: number
  /** Cargo starts have no check-in desk to staff. */
  needsDesk: boolean
  flightsDone: number
  /** Red rows on the waiting letter. Empty when no letter waits or it qualifies. */
  offerMissing?: readonly string[]
}

export const SESSION_ORDER = [
  'session-contract',
  'session-build',
  'session-desk',
  'session-depart',
  'session-second',
] as const

export type SessionHintId = (typeof SESSION_ORDER)[number]

function tip(id: SessionHintId, title: string, detail: string, fix: string): Advice {
  return { id, title, detail, fix, cells: [], severity: 'tip', scope: 'apron' }
}

/** The single hint the player should see, or null once the sequence is finished. */
export function nextSessionHint(state: SessionState): Advice | null {
  if (!state.fieldUp) {
    return tip(
      'session-contract',
      'Place the starter field',
      'The first contract needs a strip, a stand, and the prefab terminal.',
      'Stamp the starter kit.',
    )
  }
  if (state.signed < 1) {
    if (state.offerWaiting) {
      return tip(
        'session-contract',
        'Confirm the contract',
        'The letter is waiting. Signing puts their flights on the board.',
        'Open the letter and confirm.',
      )
    }
    return tip(
      'session-contract',
      'Confirm the first contract',
      'A carrier writes once the field is running. Nothing flies until you sign.',
      'Leave the clock on. Open the letter and confirm it.',
    )
  }
  if (!state.buildTrayOpened) {
    return tip(
      'session-build',
      'Open the build tray',
      'Pavement, stands, and hall pieces live in the tray along the bottom.',
      'Open the build tray and pick a tool.',
    )
  }
  if (state.needsDesk && state.deskStaff < 1) {
    return tip(
      'session-desk',
      'Staff a desk',
      'One clerk covers check-in, security, and the gate. An empty counter holds the bank.',
      'Hire a desk agent.',
    )
  }
  if (state.flightsDone < 1) {
    return tip(
      'session-depart',
      'Watch the first departure',
      'The jet lands, turns at the gate, and leaves. That is the whole loop.',
      'Leave the clock running until the first flight is airborne. Try 3× if the apron is quiet.',
    )
  }
  // The second carrier is the first real choice: it shares the same stands and hall.
  if (state.signed === 1) {
    const missing = state.offerMissing ?? []
    if (state.offerWaiting && missing.length) {
      return tip(
        'session-second',
        'Read the red rows first',
        `The new letter is missing ${missing.slice(0, 2).join(', ')}. Their flights hold until that is built.`,
        'Build the red row, or press Later and they write again.',
      )
    }
    if (state.offerWaiting) {
      return tip(
        'session-second',
        'A second carrier wrote',
        'Every row is green. Their flights share your stands and the hall with the first carrier.',
        'Sign it if the hall queues are short. Otherwise press Later.',
      )
    }
    return tip(
      'session-second',
      'The next carrier is on the way',
      'Carriers write once your flights are turning. Each one you sign shares the same stands.',
      'Keep the first flights on time. The next letter shows what it needs in green and red.',
    )
  }
  return null
}
