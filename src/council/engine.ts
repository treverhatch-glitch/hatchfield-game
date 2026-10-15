import {
  COUNCIL_FAIL_STANDING_PENALTY,
  COUNCIL_HISTORY_LIMIT,
  COUNCIL_PASS_STANDING_BONUS,
  COUNCIL_PRESTIGE_VOTE_WEIGHT,
  COUNCIL_REQUEST_INTERVAL_DAYS,
  COUNCIL_REQUESTS,
  COUNCIL_STANDING_MAX,
  COUNCIL_STANDING_MIN,
  COUNCIL_STARTING_STANDING,
  COUNCIL_UNLOCK_FIELD_LEVEL,
} from './config.ts'
import type {
  CouncilBooks,
  CouncilChoiceId,
  CouncilContext,
  CouncilNote,
  CouncilState,
  CouncilView,
} from './types.ts'

function clampStanding(value: number): number {
  return Math.max(COUNCIL_STANDING_MIN, Math.min(COUNCIL_STANDING_MAX, Math.round(value)))
}

function fresh(processedDay = -1): CouncilState {
  return {
    processedDay,
    standing: COUNCIL_STARTING_STANDING,
    nextRequestDay: -1,
    requestIndex: 0,
    pending: null,
    votes: [],
  }
}

export class CouncilEngine {
  private state: CouncilState = fresh()

  reset() {
    this.state = fresh()
  }

  snapshot(): CouncilState {
    return structuredClone(this.state)
  }

  /** Old saves have no council state and begin from their current day without a backlog. */
  restore(raw: unknown, currentDay: number) {
    if (!raw || typeof raw !== 'object') {
      this.state = fresh(currentDay)
      return
    }
    const saved = raw as Partial<CouncilState>
    const base = fresh(currentDay)
    this.state = {
      processedDay: Number.isFinite(saved.processedDay) ? Math.floor(saved.processedDay!) : currentDay,
      standing: Number.isFinite(saved.standing) ? clampStanding(saved.standing!) : base.standing,
      nextRequestDay: Number.isFinite(saved.nextRequestDay) ? Math.floor(saved.nextRequestDay!) : -1,
      requestIndex: Number.isFinite(saved.requestIndex) ? Math.max(0, Math.floor(saved.requestIndex!)) : 0,
      pending:
        saved.pending &&
        typeof saved.pending.id === 'string' &&
        COUNCIL_REQUESTS.some((request) => request.id === saved.pending!.id)
          ? { id: saved.pending.id, openedDay: Number(saved.pending.openedDay) || currentDay }
          : null,
      votes: Array.isArray(saved.votes) ? saved.votes.slice(-COUNCIL_HISTORY_LIMIT) : [],
    }
  }

  advance(context: CouncilContext): CouncilNote[] {
    const day = Math.max(0, Math.floor(context.day))
    const firstUnlockedSitting =
      context.fieldLevel >= COUNCIL_UNLOCK_FIELD_LEVEL &&
      this.state.nextRequestDay < 0 &&
      this.state.pending == null
    if (day <= this.state.processedDay && !firstUnlockedSitting) return []
    this.state.processedDay = day
    if (context.fieldLevel < COUNCIL_UNLOCK_FIELD_LEVEL) return []
    if (this.state.pending) return []
    if (this.state.nextRequestDay < 0) {
      this.openNext(day)
      return [{ text: 'Airport Council opened. A regional request is ready for a vote.', tone: 'ok' }]
    }
    if (day < this.state.nextRequestDay) return []
    this.openNext(day)
    return [{ text: 'Airport Council: a new regional request is ready.', tone: 'ok' }]
  }

  vote(
    requestId: string,
    choiceId: CouncilChoiceId,
    context: CouncilContext,
    books: CouncilBooks,
  ): CouncilNote[] {
    if (context.fieldLevel < COUNCIL_UNLOCK_FIELD_LEVEL) {
      return [{ text: `Airport Council opens at Field Level ${COUNCIL_UNLOCK_FIELD_LEVEL}.`, tone: 'bad' }]
    }
    if (!this.state.pending || this.state.pending.id !== requestId) {
      return [{ text: 'That council request is no longer open.', tone: 'bad' }]
    }
    const request = COUNCIL_REQUESTS.find((item) => item.id === requestId)
    const choice = request?.choices.find((item) => item.id === choiceId)
    if (!request || !choice) return [{ text: 'That council option is unavailable.', tone: 'bad' }]
    if (choice.cost > 0 && !books.spend(choice.cost, `${request.title}: ${choice.label}`)) {
      return [{ text: `Need $${choice.cost.toLocaleString('en-US')} for ${choice.label.toLowerCase()}.`, tone: 'bad' }]
    }

    const support = this.support(choice.voteBoost, context.prestige)
    const passed = support >= request.threshold
    const prestigeAwarded = passed ? request.prestigeReward : 0
    this.state.standing = clampStanding(
      this.state.standing +
        choice.standingDelta +
        (passed ? COUNCIL_PASS_STANDING_BONUS : COUNCIL_FAIL_STANDING_PENALTY),
    )
    this.state.votes.push({
      requestId,
      title: request.title,
      day: Math.max(0, Math.floor(context.day)),
      choiceId,
      choiceLabel: choice.label,
      support,
      passed,
      cost: choice.cost,
      prestigeAwarded,
    })
    this.state.votes = this.state.votes.slice(-COUNCIL_HISTORY_LIMIT)
    this.state.pending = null
    this.state.nextRequestDay = Math.max(0, Math.floor(context.day)) + COUNCIL_REQUEST_INTERVAL_DAYS

    return [
      {
        text: `${request.title} ${passed ? 'passed' : 'fell'} with ${support}% support. Council standing ${this.state.standing}.`,
        tone: passed ? 'good' : 'bad',
        reputation: choice.reputationDelta,
        prestige: prestigeAwarded,
      },
    ]
  }

  view(context: CouncilContext): CouncilView {
    const unlocked = context.fieldLevel >= COUNCIL_UNLOCK_FIELD_LEVEL
    const request = this.state.pending
      ? COUNCIL_REQUESTS.find((item) => item.id === this.state.pending!.id)
      : null
    return {
      unlocked,
      unlockFieldLevel: COUNCIL_UNLOCK_FIELD_LEVEL,
      standing: this.state.standing,
      prestige: Math.max(0, Math.round(context.prestige)),
      nextRequestInDays:
        unlocked && !request && this.state.nextRequestDay >= 0
          ? Math.max(0, this.state.nextRequestDay - Math.floor(context.day))
          : null,
      pending:
        request && this.state.pending
          ? {
              id: request.id,
              title: request.title,
              sponsor: request.sponsor,
              request: request.request,
              openedDay: this.state.pending.openedDay,
              threshold: request.threshold,
              choices: request.choices.map((choice) => {
                const projectedSupport = this.support(choice.voteBoost, context.prestige)
                return {
                  ...choice,
                  projectedSupport,
                  projectedPass: projectedSupport >= request.threshold,
                  affordable: context.cash >= choice.cost,
                }
              }),
            }
          : null,
      votes: [...this.state.votes].reverse(),
    }
  }

  private support(choiceBoost: number, prestige: number): number {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(this.state.standing + choiceBoost + Math.max(0, prestige) * COUNCIL_PRESTIGE_VOTE_WEIGHT),
      ),
    )
  }

  private openNext(day: number) {
    const request = COUNCIL_REQUESTS[this.state.requestIndex % COUNCIL_REQUESTS.length]!
    this.state.requestIndex += 1
    this.state.pending = { id: request.id, openedDay: day }
  }
}
