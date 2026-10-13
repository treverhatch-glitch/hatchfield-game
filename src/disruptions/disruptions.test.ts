import { describe, expect, it } from 'vitest'
import { ASH_HOTEL_ROOMS, FEE_FLOOR, FIX, MID_GAME_LEVEL } from './index.ts'
import { DisruptionEngine, finiteAmount } from './engine.ts'
import { bindRivalAirport } from './rival.ts'
import { dailyChance } from './scale.ts'
import type { DisruptionHost, DisruptionId, DisruptionWorld, WeatherDivertAsk } from './types.ts'

function world(over: Partial<DisruptionWorld> = {}): DisruptionWorld {
  return {
    fieldLevel: 5,
    goalsComplete: false,
    endless: false,
    standsFree: 12,
    hotelRooms: 200,
    banks: [{ id: 'rw0-b1', label: 'runway 1 bank 2', flightIds: ['s1', 's2', 's3'] }],
    staffPools: ['maintenance', 'security', 'cleaning', 'fire', 'ambulance', 'desk'],
    clock: 20,
    ...over,
  }
}

function recorder(stands = 12) {
  let left = stands
  const calls = {
    asks: [] as WeatherDivertAsk[],
    delay: [] as string[],
    rebook: [] as string[],
    cash: [] as number[],
    news: [] as string[],
  }
  const host: DisruptionHost = {
    acceptWeatherDivert(ask) {
      calls.asks.push(ask)
      if (left <= 0) return { hosted: false }
      left -= 1
      return { hosted: true }
    },
    postCash(amount) {
      calls.cash.push(amount)
    },
    delayBank(ids) {
      calls.delay.push(...ids)
    },
    rebookBank(ids) {
      calls.rebook.push(...ids)
    },
    news(text) {
      calls.news.push(text)
    },
  }
  return { host, calls }
}

function fresh(seed = 1, stands = 12) {
  return { engine: new DisruptionEngine(seed), ...recorder(stands) }
}

describe('disruption gates', () => {
  it('fires nothing before mid-game, even in endless mode', () => {
    for (const seed of [1, 2, 7, 99]) {
      const { engine, host } = fresh(seed)
      for (let day = 0; day < 400; day++) {
        const level = day % 2 === 0 ? 1 : 2
        engine.advance(
          world({
            fieldLevel: level,
            clock: day * 180 + 10,
            goalsComplete: true,
            endless: true,
          }),
          host,
        )
      }
      expect(engine.feedHistory()).toEqual([])
      expect(engine.activeDisruption()).toBeNull()
    }
    expect(dailyChance(world({ fieldLevel: MID_GAME_LEVEL - 1 }))).toBe(0)
    expect(dailyChance(world({ fieldLevel: 1, endless: true, goalsComplete: true }))).toBe(0)
  })

  it('refuses a forced trigger before mid-game', () => {
    const { engine, host } = fresh()
    expect(engine.trigger('volcanic-ash', world({ fieldLevel: 2 }), host)).toBeNull()
    expect(engine.activeDisruption()).toBeNull()
  })

  it('gets more likely as Field Level rises, and endless keeps rolling after the goals', () => {
    const mid = dailyChance(world({ fieldLevel: 3 }))
    const late = dailyChance(world({ fieldLevel: 5, goalsComplete: false, endless: false }))
    const endless = dailyChance(world({ fieldLevel: 5, goalsComplete: true, endless: true }))
    const stopped = dailyChance(world({ fieldLevel: 5, goalsComplete: true, endless: false }))
    expect(mid).toBeGreaterThan(0)
    expect(late).toBeGreaterThan(mid)
    expect(endless).toBeGreaterThan(0)
    expect(stopped).toBe(0)
  })

  it('is deterministic for a seed and stays quiet once the goals end without endless', () => {
    const run = (seed: number, endless: boolean) => {
      const { engine, host } = fresh(seed)
      const seen: string[] = []
      for (let day = 0; day < 240; day++) {
        const started = engine.advance(
          world({
            fieldLevel: 5,
            clock: day * 180 + 5,
            goalsComplete: true,
            endless,
          }),
          host,
        )
        if (started) seen.push(`${day}:${started.kind}`)
      }
      return seen
    }
    expect(run(4, true)).toEqual(run(4, true))
    expect(run(4, true).length).toBeGreaterThan(0)
    expect(run(4, true)).not.toEqual(run(11, true))
    expect(run(4, false)).toEqual([])
  })

  it('scales severity with Field Level and never posts a non-finite amount', () => {
    const low = new DisruptionEngine(1).trigger('software-outage', world({ fieldLevel: 3 }), recorder().host)
    const high = new DisruptionEngine(1).trigger('software-outage', world({ fieldLevel: 5 }), recorder().host)
    expect(low).not.toBeNull()
    expect(high).not.toBeNull()
    expect(high!.effect.checkInMultiplier).toBeGreaterThan(low!.effect.checkInMultiplier)
    expect(finiteAmount(Number.NaN)).toBe(0)
    expect(finiteAmount(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('disruption events', () => {
  it('volcanic ash: trigger, effect, recovery, explanation, suggested fix', () => {
    const { engine, host, calls } = fresh(3, 4)
    const ev = engine.trigger('volcanic-ash', world({ hotelRooms: 10, standsFree: 4 }), host)
    expect(ev).not.toBeNull()
    expect(ev!.effect.diversions).toBeGreaterThanOrEqual(8)
    expect(ev!.effect.diversions).toBeLessThanOrEqual(12)
    expect(calls.asks).toHaveLength(ev!.effect.diversions)
    for (const ask of calls.asks) {
      expect(ask.kind).toBe('weather_divert')
      expect(ask.needsStand).toBe(true)
      expect(ask.arff).toBe(true)
      expect(ask.hotelRooms).toBe(ASH_HOTEL_ROOMS)
    }
    expect(ev!.effect.hosted).toBe(4)
    expect(ev!.effect.onward).toBe(ev!.effect.diversions - 4)
    expect(ev!.effect.hotelShortRooms).toBe(4 * ASH_HOTEL_ROOMS - 10)
    expect(engine.modifiers.hotelShortRooms).toBe(ev!.effect.hotelShortRooms)
    expect(ev!.explanation).toContain('Volcanic ash')
    expect(ev!.explanation).toContain(String(ev!.effect.diversions))
    expect(ev!.suggestedFix).toBe(FIX['volcanic-ash'])
    expect(calls.news[0]).toContain(ev!.explanation)
    expect(calls.news[0]).toContain(ev!.suggestedFix)
    const again = new DisruptionEngine(3).trigger('volcanic-ash', world({ hotelRooms: 10 }), recorder().host)
    expect(again!.effect.diversions).toBe(ev!.effect.diversions)
    const rec = engine.recover(ev!.id, host)
    expect(rec.ok).toBe(true)
    expect(rec.cost).toBeGreaterThan(0)
    expect(Number.isFinite(rec.cost)).toBe(true)
    expect(engine.activeDisruption()).toBeNull()
    expect(engine.modifiers.hotelShortRooms).toBe(0)
    expect(engine.postings().every((row) => Number.isFinite(row.amount))).toBe(true)
  })

  it('state visit: secure zone, runway windows, recovery', () => {
    const { engine, host, calls } = fresh(2)
    const ev = engine.trigger('state-visit', world({ fieldLevel: 5, clock: 50 }), host)
    expect(ev!.effect.runwayWindows.length).toBeGreaterThanOrEqual(1)
    expect(engine.secureZone()).toBe(true)
    expect(engine.runwayClosed(50)).toBe(true)
    const last = ev!.effect.runwayWindows[ev!.effect.runwayWindows.length - 1]
    expect(engine.runwayClosed(last.end)).toBe(false)
    expect(ev!.explanation).toContain('secure zone')
    expect(ev!.explanation).toContain('runway')
    expect(ev!.suggestedFix).toBe(FIX['state-visit'])
    expect(calls.news[0]).toContain('Fix:')
    const mild = new DisruptionEngine(2).trigger('state-visit', world({ fieldLevel: 3, clock: 50 }), recorder().host)
    expect(mild!.effect.runwayWindows.length).toBeLessThan(ev!.effect.runwayWindows.length)
    const rec = engine.recover(ev!.id, host)
    expect(rec.ok).toBe(true)
    expect(engine.secureZone()).toBe(false)
    expect(engine.runwayClosed(50)).toBe(false)
    expect(Number.isFinite(rec.cost)).toBe(true)
  })

  it('software outage: manual check-in, recovery, ignore, dismiss, minimise', () => {
    const { engine, host, calls } = fresh()
    const ev = engine.trigger('software-outage', world({ fieldLevel: 4 }), host)
    expect(ev!.effect.checkInMultiplier).toBeGreaterThan(1)
    expect(engine.checkInMultiplier()).toBe(ev!.effect.checkInMultiplier)
    expect(ev!.explanation).toContain('manual')
    expect(ev!.suggestedFix).toBe(FIX['software-outage'])
    engine.minimise(ev!.id)
    expect(engine.visible()[0]?.status).toBe('minimised')
    engine.expand(ev!.id)
    expect(engine.visible()[0]?.status).toBe('live')
    engine.ignore(ev!.id)
    expect(engine.visible()[0]?.status).toBe('ignored')
    expect(engine.checkInMultiplier()).toBeGreaterThan(1)
    expect(calls.cash).toEqual([])
    engine.expand(ev!.id)
    engine.dismiss(ev!.id)
    expect(engine.visible()).toEqual([])
    expect(engine.checkInMultiplier()).toBeGreaterThan(1)
    const rec = engine.recover(ev!.id, host)
    expect(rec.ok).toBe(true)
    expect(engine.checkInMultiplier()).toBe(1)
    expect(calls.cash[0]).toBeLessThan(0)
    expect(Number.isFinite(calls.cash[0])).toBe(true)
  })

  it('strike day: one pool drops, the others stay, overtime restores it', () => {
    const { engine, host } = fresh(8)
    const ev = engine.trigger('strike-day', world({ fieldLevel: 5 }), host)
    const pool = ev!.effect.staffPool
    expect(pool).not.toBeNull()
    expect(ev!.effect.staffScale).toBeGreaterThanOrEqual(0.4)
    expect(ev!.effect.staffScale).toBeLessThan(1)
    expect(engine.staffScale(pool!)).toBeCloseTo(ev!.effect.staffScale)
    for (const other of ['maintenance', 'security', 'cleaning', 'fire', 'ambulance', 'desk'] as const) {
      if (other !== pool) expect(engine.staffScale(other)).toBe(1)
    }
    expect(ev!.explanation).toContain('walked out')
    expect(ev!.suggestedFix).toBe(FIX['strike-day'])
    const early = new DisruptionEngine(8).trigger('strike-day', world({ fieldLevel: 3 }), recorder().host)
    expect(early!.effect.staffScale).toBeGreaterThan(ev!.effect.staffScale)
    const rec = engine.recover(ev!.id, host)
    expect(rec.ok).toBe(true)
    expect(engine.staffScale(pool!)).toBe(1)
    expect(Number.isFinite(rec.cost)).toBe(true)
  })

  it('hub meltdown: one bank is held and can be rebanked', () => {
    const { engine, host, calls } = fresh(5)
    const ev = engine.trigger('hub-meltdown', world(), host)
    expect(ev!.effect.bankId).toBe('rw0-b1')
    expect(ev!.effect.flightIds).toEqual(['s1', 's2', 's3'])
    expect(ev!.effect.delaySec).toBeGreaterThan(0)
    expect(calls.delay).toEqual(['s1', 's2', 's3'])
    expect(ev!.explanation).toContain('runway 1 bank 2')
    expect(ev!.explanation).toContain('not cancelled')
    expect(ev!.suggestedFix).toBe(FIX['hub-meltdown'])
    const empty = new DisruptionEngine(5).trigger('hub-meltdown', world({ banks: [] }), recorder().host)
    expect(empty!.effect.flightIds).toEqual([])
    expect(empty!.explanation).toContain('the next bank')
    const rec = engine.recover(ev!.id, host)
    expect(rec.ok).toBe(true)
    expect(calls.rebook).toEqual(['s1', 's2', 's3'])
    expect(engine.activeDisruption()).toBeNull()
  })

  it('health screening: extra step, relief lane clears it', () => {
    const { engine, host } = fresh()
    const ev = engine.trigger('health-screening', world({ fieldLevel: 4 }), host)
    expect(ev!.effect.screeningMultiplier).toBeGreaterThan(1)
    expect(engine.screeningMultiplier()).toBe(ev!.effect.screeningMultiplier)
    expect(ev!.explanation).toContain('extra step')
    expect(ev!.explanation).toContain('Nobody is turned away')
    expect(ev!.suggestedFix).toBe(FIX['health-screening'])
    const rec = engine.recover(ev!.id, host)
    expect(rec.ok).toBe(true)
    expect(engine.screeningMultiplier()).toBe(1)
    expect(Number.isFinite(rec.cost)).toBe(true)
  })

  it('rival price war: fee pressure floors, and a rival only deepens it through the interface', () => {
    const { engine, host, calls } = fresh(6)
    const ev = engine.trigger('rival-price-war', world({ fieldLevel: 5 }), host)
    expect(ev!.effect.feeMultiplier).toBeLessThan(1)
    expect(ev!.effect.feeMultiplier).toBeGreaterThanOrEqual(FEE_FLOOR)
    expect(engine.feeMultiplier()).toBe(ev!.effect.feeMultiplier)
    expect(ev!.explanation).toContain('fees')
    expect(ev!.suggestedFix).toBe(FIX['rival-price-war'])
    const rec = engine.recover(ev!.id, host)
    expect(rec.ok).toBe(true)
    expect(engine.feeMultiplier()).toBe(1)
    expect(calls.cash.every((n) => Number.isFinite(n))).toBe(true)

    bindRivalAirport({ id: 'east', name: 'Eastfield', feeIndex: () => 0.1 })
    try {
      const pressed = new DisruptionEngine(6).trigger('rival-price-war', world({ fieldLevel: 5 }), recorder().host)
      expect(pressed!.effect.feeMultiplier).toBe(FEE_FLOOR)
      expect(pressed!.effect.rivalName).toBe('Eastfield')
      expect(pressed!.explanation).toContain('Eastfield')
      const nonsense = new DisruptionEngine(6).trigger('rival-price-war', world({ fieldLevel: 3 }), recorder().host)
      expect(Number.isFinite(nonsense!.effect.feeMultiplier)).toBe(true)
    } finally {
      bindRivalAirport(null)
    }

    bindRivalAirport({ id: 'bad', name: 'Nowhere', feeIndex: () => Number.NaN })
    try {
      const safe = new DisruptionEngine(6).trigger('rival-price-war', world({ fieldLevel: 5 }), recorder().host)
      expect(safe!.effect.feeMultiplier).toBeGreaterThanOrEqual(FEE_FLOOR)
      expect(safe!.effect.feeMultiplier).toBeLessThanOrEqual(1)
      expect(Number.isFinite(safe!.effect.feeMultiplier)).toBe(true)
    } finally {
      bindRivalAirport(null)
    }
  })

  it('ends on its own and leaves cash finite', () => {
    const kinds: DisruptionId[] = [
      'volcanic-ash',
      'state-visit',
      'software-outage',
      'strike-day',
      'hub-meltdown',
      'health-screening',
      'rival-price-war',
    ]
    for (const kind of kinds) {
      const { engine, host, calls } = fresh(kind.length)
      const ev = engine.trigger(kind, world({ fieldLevel: 4, clock: 30, hotelRooms: 0, standsFree: 0 }), host)
      expect(ev).not.toBeNull()
      expect(ev!.explanation.length).toBeGreaterThan(20)
      expect(ev!.suggestedFix.length).toBeGreaterThan(20)
      engine.advance(world({ fieldLevel: 1, clock: ev!.endsAt }), host)
      expect(engine.activeDisruption()).toBeNull()
      expect(engine.checkInMultiplier()).toBe(1)
      expect(engine.screeningMultiplier()).toBe(1)
      expect(engine.feeMultiplier()).toBe(1)
      expect(engine.secureZone()).toBe(false)
      expect(calls.cash.every((n) => Number.isFinite(n))).toBe(true)
    }
  })
})
