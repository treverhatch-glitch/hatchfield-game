import { describe, expect, it } from 'vitest'
import { auditWeek, cancelFeeEntry, HOSTILE_STANDING, LAWSUIT_BREACH_WEEKS, seasonBonuses } from './sla.ts'
import { slotRound } from './scheduler.ts'
import { seasonFor } from './seasons.ts'
import { active, INFRA, line, SUMMER } from './testkit.ts'
import type { SlotActual, SlotInstance } from './types.ts'

const week = { ...SUMMER, endDay: SUMMER.startDay + 6 }
const c = active('c', 'al', [line('l', 'a320', 480)], { services: ['fuel', 'catering', 'deice'], money: { landingPerTonne: 10, perPax: 5, services: { fuel: 100, catering: 50, deice: 999 } } })
const slots = () => slotRound([c], week, INFRA).slots
const fly = (ss: SlotInstance[], f: (s: SlotInstance, i: number) => SlotActual): SlotInstance[] =>
  ss.map((s, i) => ({ ...s, actual: f(s, i) }))
const clean = (s: SlotInstance): SlotActual => ({ onBlock: s.plannedOnBlock, offBlock: s.plannedOffBlock, pax: 100, bagsExpected: 100, lostBags: 0 })

describe('auditWeek', () => {
  it('clean week: revenue (no deice in summer), no penalties, small standing gain', () => {
    const a = auditWeek(c, fly(slots(), clean), { season: SUMMER, auditDay: 90, currentStanding: 0 })
    expect(a.operated).toBe(7)
    expect(a.onTimePct).toBe(1)
    expect(a.breached).toBe(false)
    expect(a.standingDelta).toBe(2)
    expect(a.ledger).toEqual([{ day: 90, kind: 'contract_revenue', amount: 7 * (78 * 10 + 100 * 5 + 150), contractId: 'c', memo: '7 flights' }])
  })
  it('late turnarounds: penalty per minute over target, on-time miss costs standing', () => {
    const a = auditWeek(c, fly(slots(), (s) => ({ ...clean(s), offBlock: s.plannedOffBlock + 30 })), { season: SUMMER, auditDay: 90, currentStanding: 10 })
    expect(a.onTimePct).toBe(0)
    expect(a.lateMinOverTarget).toBe(7 * 30)
    expect(a.ledger.find((l) => l.kind === 'sla_penalty')!.amount).toBe(-7 * 30 * c.penalties.perLateMin)
    expect(a.standingDelta).toBe(-3)
    expect(a.breached).toBe(true)
  })
  it('fuel grounding is a breach only when fuel service was bought; weather never', () => {
    const g = fly(slots(), (s, i) => i === 0 ? { grounded: 'fuel' } : i === 1 ? { grounded: 'weather' } : clean(s))
    const a = auditWeek(c, g, { season: SUMMER, auditDay: 90, currentStanding: 0 })
    expect(a.groundingBreaches).toBe(1)
    expect(a.operated).toBe(5)
    const noFuel = { ...c, services: c.services.filter((s) => s !== 'fuel') }
    expect(auditWeek(noFuel, g, { season: SUMMER, auditDay: 90, currentStanding: 0 }).groundingBreaches).toBe(0)
  })
  it('lost bags and catering shortages', () => {
    const a = auditWeek(c, fly(slots(), (s, i) => ({ ...clean(s), lostBags: i === 0 ? 5 : 0, cateringShort: i === 1 })), { season: SUMMER, auditDay: 90, currentStanding: 0 })
    expect(a.lostBags).toBe(5)
    expect(a.lostBagRatePer1000).toBeCloseTo(5000 / 700)
    expect(a.cateringBreaches).toBe(1)
    expect(a.standingDelta).toBe(-3)
  })
  it('winter annex charges de-icing; unflown and cancelled slots skipped; off-window cost applied', () => {
    const w = seasonFor('winter', 0)
    const ss = fly(slots(), clean)
    ss[0] = { ...ss[0], actual: undefined }
    ss[1] = { ...ss[1], cancelled: true }
    const a = auditWeek(c, ss, { season: w, auditDay: 400, currentStanding: 0, offWindowCost: 1 })
    expect(a.flights).toBe(5)
    expect(a.ledger[0].amount).toBe(5 * (78 * 10 + 100 * 5 + 150 + 999))
    expect(a.standingDelta).toBe(1)
  })
  it('standing clamps at ±100 and hostile repeated breaches trigger lawsuits', () => {
    const late = fly(slots(), (s) => ({ ...clean(s), offBlock: s.plannedOffBlock + 60 }))
    const a = auditWeek(c, late, { season: SUMMER, auditDay: 90, currentStanding: -99 })
    expect(a.standingDelta).toBe(-1)
    expect(a.lawsuit).toBe(false)
    expect(auditWeek(c, late, { season: SUMMER, auditDay: 90, currentStanding: -60, priorBreachWeeks: 2 }).lawsuit).toBe(true)
    expect(auditWeek(c, late, { season: SUMMER, auditDay: 90, currentStanding: 20, priorBreachWeeks: 5 }).lawsuit).toBe(false)
    expect(auditWeek(c, fly(slots(), clean), { season: SUMMER, auditDay: 90, currentStanding: 100 }).standingDelta).toBe(0)
  })
  it('empty week is neutral', () => {
    const a = auditWeek(c, [], { season: SUMMER, auditDay: 90, currentStanding: 0 })
    expect(a).toMatchObject({ operated: 0, onTimePct: 1, breached: false, standingDelta: 0, ledger: [] })
  })
})

describe('sla.edge: penalty cap, zero flights, all-late cases', () => {
  it('caps standing delta strictly at -10 even under extreme breaches', () => {
    const severeBreach = fly(slots(), (s) => ({
      ...clean(s),
      offBlock: s.plannedOffBlock + 120, // late miss
      lostBags: 50,                       // lost bags miss
      grounded: 'fuel',                   // grounding breach
      cateringShort: true,               // catering breach
    }))

    const audit = auditWeek(c, severeBreach, {
      season: SUMMER,
      auditDay: 90,
      currentStanding: 0,
      offWindowCost: 10,
    })

    expect(audit.standingDelta).toBe(-10)
    // Confirm standing clamps to lower bound -100
    const standingAudit = auditWeek(c, severeBreach, {
      season: SUMMER,
      auditDay: 90,
      currentStanding: -98,
      offWindowCost: 10,
    })
    expect(standingAudit.standingDelta).toBe(-2)
  })

  it('caps standing delta strictly at +5 even under maximum bonuses', () => {
    const perfectWeek = fly(slots(), clean)
    const audit = auditWeek(c, perfectWeek, {
      season: SUMMER,
      auditDay: 90,
      currentStanding: 0,
      offWindowCost: -10, // negative off-window cost boost
    })

    expect(audit.standingDelta).toBe(5)
  })

  it('handles zero flights case gracefully when all slots are cancelled or without actual data', () => {
    const allCancelledSlots = slots().map((s) => ({ ...s, cancelled: true }))
    const auditCancelled = auditWeek(c, allCancelledSlots, {
      season: SUMMER,
      auditDay: 90,
      currentStanding: 10,
    })

    expect(auditCancelled.operated).toBe(0)
    expect(auditCancelled.onTimePct).toBe(1) // Default 100% on-time when 0 operated
    expect(auditCancelled.breached).toBe(false)
    expect(auditCancelled.standingDelta).toBe(0)
    expect(auditCancelled.ledger).toEqual([])

    const noActualSlots = slots().map((s) => ({ ...s, actual: undefined }))
    const auditNoActual = auditWeek(c, noActualSlots, {
      season: SUMMER,
      auditDay: 90,
      currentStanding: 10,
    })

    expect(auditNoActual.operated).toBe(0)
    expect(auditNoActual.breached).toBe(false)
    expect(auditNoActual.standingDelta).toBe(0)
  })

  it('handles 100% late flights case (all-late)', () => {
    const allLate = fly(slots(), (s) => ({
      ...clean(s),
      offBlock: s.plannedOffBlock + 45,
    }))

    const audit = auditWeek(c, allLate, {
      season: SUMMER,
      auditDay: 90,
      currentStanding: 0,
    })

    expect(audit.operated).toBe(7)
    expect(audit.onTimePct).toBe(0)
    expect(audit.breached).toBe(true)
    expect(audit.standingDelta).toBe(-3)
    expect(audit.lateMinOverTarget).toBe(7 * 45)

    const penaltyEntry = audit.ledger.find((l) => l.kind === 'sla_penalty')
    expect(penaltyEntry).toBeDefined()
    expect(penaltyEntry?.amount).toBe(-7 * 45 * c.penalties.perLateMin)
  })

  it('triggers lawsuit on 100% late flights when standing is hostile (<= HOSTILE_STANDING) and breach weeks >= LAWSUIT_BREACH_WEEKS', () => {
    const allLate = fly(slots(), (s) => ({
      ...clean(s),
      offBlock: s.plannedOffBlock + 45,
    }))

    // Week 1 & 2 breach (priorBreachWeeks < 2) => lawsuit false
    const audit2 = auditWeek(c, allLate, {
      season: SUMMER,
      auditDay: 90,
      currentStanding: HOSTILE_STANDING,
      priorBreachWeeks: 1,
    })
    expect(audit2.lawsuit).toBe(false)

    // Week 3 breach (priorBreachWeeks = 2, making total breach weeks = 3) => lawsuit true
    const audit3 = auditWeek(c, allLate, {
      season: SUMMER,
      auditDay: 90,
      currentStanding: HOSTILE_STANDING - 5,
      priorBreachWeeks: LAWSUIT_BREACH_WEEKS - 1,
    })
    expect(audit3.lawsuit).toBe(true)
  })
})

describe('season bonuses & fees', () => {
  it('pays on-time bonus over threshold and zero-lost-bags bonus', () => {
    const good = auditWeek(c, fly(slots(), clean), { season: SUMMER, auditDay: 90, currentStanding: 0 })
    const b = seasonBonuses(c, [good, good], 300)
    expect(b.map((x) => x.memo).join()).toMatch(/on-time/)
    expect(b.map((x) => x.memo)).toContain('zero lost bags')
    const bad = auditWeek(c, fly(slots(), (s) => ({ ...clean(s), offBlock: s.plannedOffBlock + 60, lostBags: 1 })), { season: SUMMER, auditDay: 90, currentStanding: 0 })
    expect(seasonBonuses(c, [bad], 300)).toEqual([])
    expect(seasonBonuses(c, [], 300)).toEqual([])
  })
  it('cancel fee posts as negative cash', () => {
    expect(cancelFeeEntry(c, 5000, 10)).toEqual({ day: 10, kind: 'early_cancel_fee', amount: -5000, contractId: 'c', memo: 'early cancellation' })
  })
})
