import { describe, expect, it } from 'vitest'
import {
  advanceSeason, airlineRequestsExit, cancelEarly, clampStanding, makeOffer, renewalOffer, servicesForSeason,
  signContract, termOf, validateContract, weeklyFlights,
} from './contracts.ts'
import { seasonFor } from './seasons.ts'
import { line, SUMMER } from './testkit.ts'

const base = () => makeOffer({ id: 'c1', airlineId: 'al1', lines: [line('l1', 'a320', 480), line('l2', 'a380', 1080, { days: [0, 2, 4] })], services: ['fuel', 'catering', 'deice'] })

describe('contract model', () => {
  it('makeOffer fills defaults; hub gets 4 seasons and stricter KPIs', () => {
    const c = base()
    expect(c.status).toBe('offered')
    expect(termOf(c)).toBe(2)
    const hub = makeOffer({ id: 'h', airlineId: 'hub', isHub: true, lines: [line('l', 'a320', 400)], services: [] })
    expect(termOf(hub)).toBe(4)
    expect(hub.sla.onTimePct).toBeGreaterThan(c.sla.onTimePct)
    expect(hub.earlyCancel.fee).toBeGreaterThan(c.earlyCancel.fee)
  })
  it('weeklyFlights counts days per line', () => {
    expect(weeklyFlights(base())).toEqual({ total: 10, byLine: { l1: 7, l2: 3 } })
  })
  it('validates lines', () => {
    expect(validateContract(base())).toEqual([])
    const bad = makeOffer({ id: 'b', airlineId: 'x', services: ['prm'], lines: [
      line('a', 'nope', 0),
      line('b', 'a320', 2000, { days: [7], turnaroundTargetMin: 10 }),
      line('b', 'a320', 100, { arrival: { preferredMin: 100, softMin: 30, hardMin: 10 }, days: [] }),
      line('f', 'b777', 100, { kind: 'freighter' }),
    ] })
    const errs = validateContract(bad).join('|')
    for (const frag of ['unknown airframe', 'days must be 0..6', 'within the day', 'below MTT', 'duplicate line id', 'soft ≤ hard', 'no operating days', 'PRM']) {
      expect(errs).toContain(frag)
    }
    expect(validateContract(makeOffer({ id: 'e', airlineId: 'x', lines: [], services: [] }))).toContain('contract has no flight lines')
  })
  it('signs with season ids for the term and enforces one hub', () => {
    const r = signContract(base(), SUMMER, [])
    expect(r.ok && r.contract.seasons).toEqual(['S0', 'W0'])
    expect(r.ok && r.contract.status).toBe('active')
    const one = signContract(makeOffer({ id: 's', airlineId: 'x', term: 1, lines: [line('l', 'a320', 400)], services: [] }), SUMMER, [])
    expect(one.ok && one.contract.status).toBe('expiring')
    const hubA = signContract(makeOffer({ id: 'hA', airlineId: 'A', isHub: true, lines: [line('l', 'a320', 400)], services: [] }), SUMMER, [])
    if (!hubA.ok) throw new Error()
    const hubB = signContract(makeOffer({ id: 'hB', airlineId: 'B', isHub: true, lines: [line('l', 'a320', 400)], services: [] }), SUMMER, [hubA.contract])
    expect(hubB.ok).toBe(false)
    expect(signContract(hubA.contract, SUMMER, []).ok).toBe(false) // already active
    expect(signContract(makeOffer({ id: 'z', airlineId: 'x', lines: [], services: [] }), SUMMER, []).ok).toBe(false)
  })
  it('de-icing only in winter annex', () => {
    expect(servicesForSeason(base(), SUMMER)).toEqual(['fuel', 'catering'])
    expect(servicesForSeason(base(), seasonFor('winter', 0))).toContain('deice')
  })
  it('season transitions: expiring then ended; airline exit only at season end', () => {
    const r = signContract(base(), SUMMER, [])
    if (!r.ok) throw new Error()
    const w0 = seasonFor('winter', 0)
    const [c1] = advanceSeason([r.contract], SUMMER, w0)
    expect(c1.status).toBe('expiring')
    const [c2] = advanceSeason([c1], w0, seasonFor('summer', 1))
    expect(c2.status).toBe('ended')
    const exit = airlineRequestsExit(r.contract, SUMMER)
    expect(exit.status).toBe('expiring')
    expect(exit.seasons).toEqual(['S0'])
    expect(airlineRequestsExit(exit, seasonFor('summer', 5))).toEqual(exit)
    expect(advanceSeason([exit], SUMMER, w0)[0].status).toBe('ended')
  })
  it('early cancel costs fee, standing, favour; only for live contracts', () => {
    const r = signContract(base(), SUMMER, [])
    if (!r.ok) throw new Error()
    const out = cancelEarly(r.contract)!
    expect(out.contract.status).toBe('cancelled')
    expect(out.fee).toBe(200_000)
    expect(out.standingDelta).toBeLessThan(0)
    expect(out.favourDelta).toBeLessThan(0)
    expect(cancelEarly(base())).toBeNull()
  })
  it('renewal offer and standing clamp', () => {
    const r = renewalOffer(base(), 'c2', 3)
    expect(r.status).toBe('offered')
    expect(r.money.perPax).toBe(base().money.perPax + 3)
    expect(clampStanding(150)).toBe(100)
    expect(clampStanding(-150)).toBe(-100)
  })
})
