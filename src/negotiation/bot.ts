import { AIRLINES, NEGOTIATION, NEUTRAL_CONTEXT } from './data.ts'
import { createNegotiation, type NegotiationDesk } from './engine.ts'

export interface BotReport {
  seed: number
  days: number
  cashFloor: number
  cash: number
  ulccSigned: string | null
  walks: number
  counters: number
}

/**
 * Thirty game days. Every non-ULCC letter is answered with Counter.
 * The first ULCC letter is accepted. Cash is the negotiation ledger only.
 */
export function runNegotiationBot(seed = 1): BotReport {
  const desk = createNegotiation(seed)
  let cash = NEGOTIATION.bot.startingCash
  let floor = cash
  let ulccSigned: string | null = null
  let walks = 0
  let counters = 0
  const roster = AIRLINES.filter((a) => !a.ulcc)
  let rosterAt = 0
  const touch = (delta: number) => {
    cash += delta
    floor = Math.min(floor, cash)
  }

  for (let day = 0; day < NEGOTIATION.bot.days; day++) {
    if (!desk.session || desk.session.status !== 'open') {
      if (day === NEGOTIATION.bot.ulccDay && !ulccSigned) {
        const ulcc = AIRLINES.find((a) => a.ulcc && !desk.barred(a.id))
        if (ulcc) desk.open(ulcc.id, NEUTRAL_CONTEXT)
      } else if (day % NEGOTIATION.bot.offerEvery === 0) {
        const next = roster[rosterAt % roster.length]
        rosterAt += 1
        if (next && !desk.barred(next.id)) desk.open(next.id, NEUTRAL_CONTEXT)
      }
    }

    const session = desk.session
    if (session && session.status === 'open') {
      if (desk.isUlcc(session.airlineId) && !ulccSigned) {
        const accepted = desk.accept()
        touch(accepted.cashDelta)
        if (accepted.outcome === 'signed') ulccSigned = session.airlineId
        else if (accepted.outcome === 'walked') walks += 1
      } else {
        resolveByCounter(desk, () => {
          counters += 1
        })
        if (desk.session?.status === 'walked') walks += 1
      }
    }

    touch(desk.advanceDay('bot'))
  }

  return { seed, days: NEGOTIATION.bot.days, cashFloor: floor, cash, ulccSigned, walks, counters }
}

function resolveByCounter(desk: NegotiationDesk, onCounter: () => void): void {
  let guard = 0
  while (desk.session?.status === 'open' && guard < 6) {
    const profileId = desk.session.airlineId
    const personality = desk.personality(profileId)
    // A firm counter at the target: the airline can accept, but the player never presses Accept.
    desk.setRatio(personality.targetCost)
    const result = desk.counter()
    onCounter()
    if (result.outcome !== 'open') break
    guard += 1
  }
}
