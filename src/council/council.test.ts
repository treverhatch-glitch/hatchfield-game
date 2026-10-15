import { describe, expect, it } from 'vitest'
import { COUNCIL_REQUEST_INTERVAL_DAYS, COUNCIL_UNLOCK_FIELD_LEVEL } from './config.ts'
import { CouncilEngine } from './engine.ts'
import type { CouncilBooks, CouncilContext } from './types.ts'

function context(overrides: Partial<CouncilContext> = {}): CouncilContext {
  return {
    day: 80,
    fieldLevel: COUNCIL_UNLOCK_FIELD_LEVEL,
    prestige: 0,
    cash: 200_000,
    ...overrides,
  }
}

function books(opening = 200_000) {
  let cash = opening
  const spent: { amount: number; label: string }[] = []
  const api: CouncilBooks = {
    balance: () => cash,
    spend(amount, label) {
      if (cash < amount) return false
      cash -= amount
      spent.push({ amount, label })
      return true
    },
  }
  return { api, cash: () => cash, spent }
}

describe('Airport Council', () => {
  it('opens in reachable late play without requiring a prestige XP star', () => {
    const council = new CouncilEngine()
    expect(council.advance(context({ fieldLevel: COUNCIL_UNLOCK_FIELD_LEVEL - 1 }))).toEqual([])
    expect(council.view(context({ fieldLevel: COUNCIL_UNLOCK_FIELD_LEVEL - 1 })).unlocked).toBe(false)

    const notes = council.advance(context())
    const view = council.view(context())
    expect(notes[0]?.text).toContain('Airport Council opened')
    expect(view.unlocked).toBe(true)
    expect(view.pending?.choices).toHaveLength(3)
    expect(view.pending?.choices.some((choice) => choice.cost === 0)).toBe(true)
  })

  it('turns cash, standing, and existing prestige into deterministic vote choices', () => {
    const council = new CouncilEngine()
    const ledger = books()
    council.advance(context())
    const before = council.view(context())
    const full = before.pending!.choices.find((choice) => choice.id === 'full')!
    const notes = council.vote(before.pending!.id, 'full', context(), ledger.api)
    const after = council.view(context())

    expect(ledger.cash()).toBe(200_000 - full.cost)
    expect(ledger.spent[0]?.label).toContain(before.pending!.title)
    expect(notes[0]?.prestige).toBeGreaterThan(0)
    expect(after.standing).toBeGreaterThan(before.standing)
    expect(after.votes[0]).toMatchObject({ passed: true, choiceId: 'full', cost: full.cost })
    expect(after.pending).toBeNull()

    const low = new CouncilEngine()
    low.advance(context())
    const noPrestige = low.view(context()).pending!.choices.find((choice) => choice.id === 'compromise')!
    const withPrestige = low
      .view(context({ prestige: 20 }))
      .pending!.choices.find((choice) => choice.id === 'compromise')!
    expect(withPrestige.projectedSupport).toBe(noPrestige.projectedSupport + 10)
  })

  it('does not consume a request when funding is short and schedules the next sitting after a vote', () => {
    const council = new CouncilEngine()
    council.advance(context())
    const request = council.view(context()).pending!
    const broke = books(1)
    expect(council.vote(request.id, 'full', context({ cash: 1 }), broke.api)[0]?.tone).toBe('bad')
    expect(council.view(context({ cash: 1 })).pending?.id).toBe(request.id)

    council.vote(request.id, 'decline', context({ cash: 1 }), broke.api)
    expect(council.view(context()).nextRequestInDays).toBe(COUNCIL_REQUEST_INTERVAL_DAYS)
    council.advance(context({ day: 80 + COUNCIL_REQUEST_INTERVAL_DAYS - 1 }))
    expect(council.view(context({ day: 89 })).pending).toBeNull()
    council.advance(context({ day: 80 + COUNCIL_REQUEST_INTERVAL_DAYS }))
    expect(council.view(context({ day: 90 })).pending).not.toBeNull()
  })

  it('round-trips votes and safely initializes an old save at its current day', () => {
    const council = new CouncilEngine()
    council.advance(context())
    const request = council.view(context()).pending!
    council.vote(request.id, 'compromise', context(), books().api)

    const restored = new CouncilEngine()
    restored.restore(JSON.parse(JSON.stringify(council.snapshot())), 80)
    expect(restored.view(context())).toEqual(council.view(context()))

    const oldSave = new CouncilEngine()
    oldSave.restore(undefined, 140)
    expect(oldSave.advance(context({ day: 140 }))).not.toHaveLength(0)
    expect(oldSave.view(context({ day: 140 })).pending).not.toBeNull()
  })
})
