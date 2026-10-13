import { describe, expect, it } from 'vitest'
import { NEGOTIATION, NEUTRAL_CONTEXT } from './data.ts'
import { createNegotiation } from './engine.ts'
import { runNegotiationBot } from './bot.ts'
import { maxCountersFor } from './personality.ts'

describe('negotiation', () => {
  it('accepts a fair offer in round 1', () => {
    const desk = createNegotiation(11)
    desk.open('harbor', NEUTRAL_CONTEXT)
    const personality = desk.personality('harbor')
    desk.setRatio(personality.targetCost)
    const result = desk.counter()
    expect(result.reply).toBe('accept')
    expect(desk.session?.round).toBe(1)
    expect(result.outcome).toBe('signed')
  })

  it('walks when the ask is past reservation', () => {
    const desk = createNegotiation(11)
    desk.open('harbor', NEUTRAL_CONTEXT)
    desk.setRatio(1.8)
    const result = desk.counter()
    expect(result.reply).toBe('walk')
    expect(result.deltas.some((d) => d.modifier === 'walk' && d.value === NEGOTIATION.walkValue)).toBe(true)
    expect(desk.barred('harbor')).toBe(true)
  })

  it('lets a hardball carrier counter at most twice', () => {
    const desk = createNegotiation(3)
    expect(maxCountersFor(['hardball', 'frugal'])).toBe(2)
    desk.open('skypenny_max', NEUTRAL_CONTEXT)
    const personality = desk.personality('skypenny_max')
    expect(personality.maxCounters).toBeLessThanOrEqual(2)
    const mid = (personality.targetCost + personality.reservation) / 2
    let counters = 0
    for (let i = 0; i < 5 && desk.session?.status === 'open'; i++) {
      desk.setRatio(mid)
      const result = desk.counter()
      if (result.reply === 'counter') counters += 1
    }
    expect(counters).toBeLessThanOrEqual(2)
    expect(desk.session?.status).not.toBe('open')
  })

  it('is deterministic for a fixed seed', () => {
    const play = (seed: number) => {
      const desk = createNegotiation(seed)
      desk.open('zoomjet', NEUTRAL_CONTEXT)
      const personality = desk.personality('zoomjet')
      desk.setRatio((personality.targetCost + personality.reservation) / 2)
      const first = desk.counter()
      const theirs = desk.session?.theirs.feePct.landing
      desk.setRatio((personality.targetCost + personality.reservation) / 2)
      const second = desk.counter()
      return JSON.stringify({ first: first.reply, second: second.reply, theirs, mood: desk.session?.mood })
    }
    expect(play(42)).toBe(play(42))
    expect(play(42)).not.toBe(play(43))
  })

  it('decays modifiers over time', () => {
    const desk = createNegotiation(5)
    desk.open('skypenny_max', NEUTRAL_CONTEXT)
    const personality = desk.personality('skypenny_max')
    const mid = (personality.targetCost + personality.reservation) / 2
    let grudge = false
    for (let i = 0; i < 4 && desk.session?.status === 'open'; i++) {
      desk.setRatio(mid)
      const result = desk.counter()
      if (result.reply === 'accept_with_grudge') grudge = true
    }
    expect(grudge).toBe(true)
    expect(desk.modifierNow('skypenny_max', 'hard_bargain')).toBeCloseTo(NEGOTIATION.grudgeValue, 5)
    for (let i = 0; i < NEGOTIATION.grudgeDays / 2; i++) desk.advanceDay()
    expect(desk.modifierNow('skypenny_max', 'hard_bargain')).toBeCloseTo(NEGOTIATION.grudgeValue / 2, 5)
    for (let i = 0; i < NEGOTIATION.grudgeDays / 2; i++) desk.advanceDay()
    expect(desk.modifierNow('skypenny_max', 'hard_bargain')).toBe(0)
  })

  it('sends a walked airline to the rival', () => {
    const desk = createNegotiation(8)
    desk.open('harbor', NEUTRAL_CONTEXT)
    desk.setRatio(1.8)
    desk.counter()
    const card = desk.rivalCard()
    expect(card?.airlines).toContain('harbor')
    expect(card?.headline).toBe('+$18k/day')
    expect(card?.revenuePerDay).toBe(18_000)
    expect(desk.trafficFactor()).toBeCloseTo(0.95, 5)
    const crowded = createNegotiation(1)
    for (const id of ['harbor', 'summit', 'northline', 'zoomjet', 'budgie_ultra', 'skypenny_max']) {
      crowded.open(id, NEUTRAL_CONTEXT)
      crowded.setRatio(1.9)
      crowded.counter()
    }
    expect(crowded.trafficFactor()).toBeCloseTo(0.75, 5)
  })

  it('keeps ULCC actual spend inside the revealed band in 95% of seeds', () => {
    const runs = 300
    let inside = 0
    for (let seed = 1; seed <= runs; seed++) {
      const desk = createNegotiation(seed)
      const band = desk.researchBand('skypenny_max', NEGOTIATION.research.fine.cost)
      const actual = desk.hiddenSpend('skypenny_max').actual
      if (actual >= band.low && actual <= band.high) inside += 1
    }
    expect(inside / runs).toBeGreaterThanOrEqual(0.95)
  })

  it('pays a freebie bonus between +2 and +5', () => {
    const desk = createNegotiation(9)
    desk.open('harbor', NEUTRAL_CONTEXT)
    desk.setRatio(desk.personality('harbor').targetCost)
    desk.toggleFreebie('lounge')
    desk.toggleFreebie('priority')
    const result = desk.counter()
    const gift = result.deltas.find((d) => d.modifier === 'freebie')
    expect(gift).toBeTruthy()
    expect(gift!.value).toBeGreaterThanOrEqual(NEGOTIATION.freebieMin)
    expect(gift!.value).toBeLessThanOrEqual(NEGOTIATION.freebieMax)
  })

  it('holds the 30-day bot above the cash floor after one ULCC signing', () => {
    const report = runNegotiationBot(7)
    expect(report.ulccSigned).toBeTruthy()
    expect(report.counters).toBeGreaterThan(0)
    expect(report.cashFloor).toBeGreaterThan(NEGOTIATION.bot.cashFloor)
  })

  it('moves a counter 30–60% of the way toward the target', () => {
    const desk = createNegotiation(15)
    desk.open('summit', NEUTRAL_CONTEXT)
    const personality = desk.personality('summit')
    const mid = (personality.targetCost + personality.reservation) / 2
    desk.setRatio(mid)
    const before = (mid - 1) * 100
    const result = desk.counter()
    expect(result.reply).toBe('counter')
    const after = desk.session?.theirs.feePct.landing ?? before
    const targetPct = (personality.targetCost - 1) * 100
    const moved = (after - before) / (targetPct - before)
    expect(moved).toBeGreaterThanOrEqual(NEGOTIATION.counterMoveMin - 1e-6)
    expect(moved).toBeLessThanOrEqual(NEGOTIATION.counterMoveMax + 1e-6)
  })
})
