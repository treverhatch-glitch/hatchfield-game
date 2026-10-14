/**
 * JSON save/load round trips for pure module state (#125, #138).
 * Each case pushes the state through JSON the way a save slot would, then
 * checks the restored copy reads and plays on exactly like the original.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_FEE_SCHEDULE } from '../commercial/fees.ts'
import {
  restoreDeposits,
  restoreFees,
  restoreLeads,
  restoreTier,
  type AirlineLead,
  type HeldDeposit,
} from '../commercial/live.ts'
import { MID_GAME_LEVEL } from '../disruptions/data.ts'
import type { DisruptionHost, DisruptionWorld } from '../disruptions/types.ts'
import { DisruptionBridge } from '../game/disruptionBridge.ts'
import { checkGate, type GateStats } from '../levelgates/gates.ts'
import type { GateLevel } from '../levelgates/data.ts'
import { dailyNoiseReport, movementNoise, type Movement } from '../noise/noise.ts'
import { createPremiumState, restorePremium } from '../premium/engine.ts'
import type { PremiumState } from '../premium/types.ts'
import { YearPlaytestBook } from '../reports/book.ts'
import { PLAYTEST_YEAR_DAYS } from '../reports/config.ts'
import { SCENARIOS, validateScenario, validateScenarios } from '../scenarios/templates.ts'
import type { Scenario } from '../scenarios/types.ts'
import { Tier3Session, type Tier3TickContext } from '../tier3/session.ts'
import type { Tier3Posting } from '../tier3/types.ts'
import {
  GlycolStock,
  needsDeicing,
  runwayRateFactor,
  scheduleDeicing,
  type Departure,
  type Pad,
  type WeatherState,
} from '../winterops/index.ts'

/** What a save slot does to any state: stringify, then parse. */
function viaJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('noise state round trip', () => {
  const movements: Movement[] = [
    { cls: 'small', hour: 7 },
    { cls: 'narrowbody', hour: 12 },
    { cls: 'jumbo', hour: 23.5 },
    { cls: 'widebody', hour: 2 },
    { cls: 'military', hour: -1 },
    { cls: 'helicopter', hour: 30 },
    { cls: 'regional', hour: 5.99 },
  ]

  it('scores the same day from a reloaded movement log, with and without curfew', () => {
    const loaded = viaJson(movements)
    expect(loaded).toEqual(movements)
    for (const curfew of [false, true]) {
      expect(dailyNoiseReport(loaded, curfew)).toEqual(dailyNoiseReport(movements, curfew))
    }
    loaded.forEach((m, i) => expect(movementNoise(m)).toBe(movementNoise(movements[i]!)))
  })

  it('keeps a quiet-day report at +0 approval so the save does not flip its sign', () => {
    const quiet = dailyNoiseReport([{ cls: 'small', hour: 10 }], true)
    expect(Object.is(quiet.approvalDelta, 0)).toBe(true)
    const loaded = viaJson(quiet)
    expect(loaded).toEqual(quiet)
    expect(Object.is(loaded.approvalDelta, quiet.approvalDelta)).toBe(true)
  })

  it('reads a NaN hour the same after JSON turns it into null', () => {
    const odd: Movement[] = [{ cls: 'jumbo', hour: Number.NaN }]
    const loaded = viaJson(odd)
    expect(loaded[0]!.hour).toBeNull()
    expect(dailyNoiseReport(loaded, true)).toEqual(dailyNoiseReport(odd, true))
  })
})

describe('winter ops state round trip', () => {
  const weather: WeatherState = { tempC: -4, precip: 'snow', visibilityM: 450 }
  const departures: Departure[] = [
    { flightId: 'f3', cls: 'widebody', readyAt: 20 },
    { flightId: 'f1', cls: 'narrowbody', readyAt: 5 },
    { flightId: 'f2', cls: 'jumbo', readyAt: 5 },
    { flightId: 'f4', cls: 'regional', readyAt: 40 },
  ]
  const pads: Pad[] = [
    { id: 'pad-a', maxCls: 'narrowbody', busyUntil: 0 },
    { id: 'pad-b', maxCls: 'jumbo', busyUntil: 12 },
  ]

  it('reads weather, visibility and the de-icing plan the same after a reload', () => {
    const w = viaJson(weather)
    expect(needsDeicing(w)).toBe(needsDeicing(weather))
    expect(runwayRateFactor(w.visibilityM, true)).toBe(runwayRateFactor(weather.visibilityM, true))
    expect(runwayRateFactor(w.visibilityM, false)).toBe(runwayRateFactor(weather.visibilityM, false))
    const plan = scheduleDeicing(10, departures, pads, 5_000)
    const reloaded = scheduleDeicing(10, viaJson(departures), viaJson(pads), 5_000)
    expect(reloaded).toEqual(plan)
    expect(viaJson(plan)).toEqual(plan)
  })

  it('carries glycol stock, ledger and in-flight orders through a save', () => {
    const live = new GlycolStock(2_000)
    live.consume(600)
    live.order(3_000, 10)
    live.order(1_500, 25)
    live.tick(12)

    const saved = JSON.stringify(live)
    const loaded = Object.assign(new GlycolStock(), JSON.parse(saved) as object) as GlycolStock
    expect(loaded.litres).toBe(live.litres)
    expect(loaded.ledger).toEqual(live.ledger)

    // Both copies receive the same pending deliveries at the same time.
    for (const now of [30, 60, 120, 600, 10_000]) {
      live.tick(now)
      loaded.tick(now)
      expect(loaded.litres).toBe(live.litres)
    }
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(live))

    // The restored stock still plans and burns glycol exactly like the live one.
    const a = scheduleDeicing(700, departures, pads, live)
    const b = scheduleDeicing(700, departures, pads, loaded)
    expect(b).toEqual(a)
    expect(loaded.litres).toBe(live.litres)
  })
})

describe('level gate state round trip', () => {
  const stats: GateStats = {
    profitStreakDays: 6,
    morale: 0.69,
    connectingBanks: 1,
    a380ContractDays: 7,
    rating: 0.8,
    transferShare: 0.1,
    paxPerDay: 4_999,
    mishandledRate: 0.0099,
    majorDisruptionsSurvived: 2,
    specializationBadges: 1,
    marketsBeatingRival: 0,
  }

  it('checks every gate the same from reloaded stats and reloads the result intact', () => {
    const loaded = viaJson(stats)
    expect(loaded).toEqual(stats)
    for (const level of [7, 8, 9, 10] as GateLevel[]) {
      const live = checkGate(level, stats)
      expect(checkGate(level, loaded)).toEqual(live)
      expect(viaJson(live)).toEqual(live)
    }
  })

  it('keeps the borderline results that the comparisons hinge on', () => {
    const loaded = viaJson(stats)
    expect(checkGate(7, loaded).missing.map((m) => m.key)).toEqual(['morale'])
    expect(checkGate(8, loaded).ok).toBe(true)
    expect(checkGate(9, loaded).missing.map((m) => m.key)).toEqual(['paxPerDay'])
    expect(checkGate(10, loaded).missing.map((m) => m.key)).toEqual(['marketsBeatingRival'])
  })
})

describe('scenario state round trip', () => {
  it('reloads every template unchanged and still valid', () => {
    const loaded = viaJson(SCENARIOS)
    expect(loaded).toEqual(SCENARIOS)
    expect(validateScenarios(loaded)).toEqual([])
    for (const s of loaded) expect(validateScenario(s)).toEqual([])
  })

  it('drops undefined constraints on save without changing what validates', () => {
    const loose: Scenario = {
      ...SCENARIOS[0]!,
      id: 'loose',
      constraints: { noLandPlots: true, startDebt: undefined, maxRunwayM: undefined },
    }
    const loaded = viaJson(loose)
    expect(Object.keys(loaded.constraints)).toEqual(['noLandPlots'])
    expect(validateScenario(loaded)).toEqual(validateScenario(loose))
  })

  it('still flags a broken scenario after it was saved', () => {
    const broken: Scenario = {
      ...SCENARIOS[1]!,
      goal: { kind: 'transfer_share', target: Number.POSITIVE_INFINITY, byDay: Number.NaN },
    }
    const loaded = viaJson(broken)
    // JSON writes Infinity and NaN as null; both must still be rejected.
    expect(loaded.goal.target).toBeNull()
    expect(loaded.goal.byDay).toBeNull()
    expect(validateScenario(loaded).length).toBeGreaterThan(0)
  })
})

describe('tier III session round trip', () => {
  const pools: Tier3TickContext['staffPools'] = {
    maintenance_tech: { hired: 8, wagePerDay: 380 },
    ground_crew: { hired: 12, wagePerDay: 320 },
  }
  const buildings = [
    { id: '4,4', kind: 'mro' as const },
    { id: '9,2', kind: 'night_hub' as const },
  ]

  function ctx(minute: number): Tier3TickContext {
    const dayMinute = minute % 1_440
    return {
      fieldLevel: 5,
      unlockedTech: new Set<string>(),
      research: ['mro_hangar', 'cargo_night_hub'],
      staffPools: pools,
      powerTier: 1,
      otherPowerDemand: 0,
      isNight: dayMinute >= 1_320 || dayMinute < 300,
      nightIndex: Math.floor((minute + 120) / 1_440),
      curfewRelaxed: false,
      candidates: [
        { id: `a${Math.floor(minute / 600)}`, airframeId: 'b738', standKey: '12,21' },
        { id: `w${Math.floor(minute / 900)}`, airframeId: 'b763f', standKey: '14,21' },
      ],
    }
  }

  function run(session: Tier3Session, from: number, to: number, step: number): Tier3Posting[] {
    const out: Tier3Posting[] = []
    for (let m = from; m < to; m += step) out.push(...session.tick(step, ctx(m)).postings)
    return out
  }

  it('continues MRO checks, night banks and upkeep identically after a reload', () => {
    const live = new Tier3Session()
    live.sync(buildings)
    run(live, 0, 1_700, 10)
    expect(live.activeJobs().length).toBeGreaterThan(0)

    const loaded = Tier3Session.restore(viaJson(live.save()))
    loaded.sync(buildings)
    expect(loaded.save()).toEqual(live.save())

    const a = run(live, 1_700, 6_000, 10)
    const b = run(loaded, 1_700, 6_000, 10)
    expect(b).toEqual(a)
    expect(a.some((p) => p.amount > 0)).toBe(true)
    expect(a.some((p) => p.label === 'Tier III upkeep')).toBe(true)
    expect(loaded.save()).toEqual(live.save())
    expect(loaded.snapshot()).toEqual(live.snapshot())
  })

  it('restores a launched night as null or a number without re-firing the wave', () => {
    const fresh = Tier3Session.restore(viaJson(new Tier3Session().save()))
    expect(fresh.save().launchedNight).toBeNull()

    const live = new Tier3Session()
    live.sync(buildings)
    run(live, 0, 1_400, 20)
    const night = live.save().launchedNight
    expect(typeof night).toBe('number')
    const loaded = Tier3Session.restore(viaJson(live.save()))
    loaded.sync(buildings)
    const again = loaded.tick(5, ctx(1_400))
    expect(again.postings.filter((p) => p.label === 'Night hub freighter wave')).toEqual([])
  })
})

describe('premium state round trip', () => {
  it('restores a played premium state field for field', () => {
    const state: PremiumState = {
      ...createPremiumState(),
      built: [
        { id: 'pf-1', itemId: 'premium_checkin' },
        { id: 'pf-2', itemId: 'fast_track_1' },
        { id: 'pf-3', itemId: 'vip_room' },
      ],
      feeEnabled: true,
      securityOfficers: 4,
      day: 12,
      missedPremium: { northline: 3 },
      standingFromPremium: { northline: -2, harbor: 1 },
      standingFromVip: { harbor: 2 },
      hour: 7,
      servedThisHour: { 'pf-2': 18 },
      nextId: 4,
    }
    const loaded = restorePremium(viaJson(state))
    expect(loaded).toEqual(state)
    expect(restorePremium(viaJson(loaded))).toEqual(loaded)
  })

  it('round-trips an untouched state and fills an empty save with defaults', () => {
    expect(restorePremium(viaJson(createPremiumState()))).toEqual(createPremiumState())
    expect(restorePremium(viaJson({}))).toEqual(createPremiumState())
  })
})

describe('commercial fee, deposit and lead state round trip', () => {
  it('restores an edited fee schedule exactly and the default one unchanged', () => {
    const edited = { ...DEFAULT_FEE_SCHEDULE, landingPerTonne: 11, paxFee: 0, parkingFreeHours: 3 }
    expect(restoreFees(viaJson<Record<string, number>>(edited))).toEqual(edited)
    expect(restoreFees(viaJson<Record<string, number>>({ ...DEFAULT_FEE_SCHEDULE }))).toEqual(DEFAULT_FEE_SCHEDULE)
  })

  it('restores every deposit tier and status, and every lead', () => {
    for (const tier of ['big', 'standard', 'small', 'none'] as const) {
      expect(restoreTier(viaJson(tier))).toBe(tier)
    }
    const deposits: Record<string, HeldDeposit> = {
      northline: { contractId: 'northline', tier: 'big', held: 42_000, status: 'held', termEndDay: 30 },
      harbor: { contractId: 'harbor', tier: 'standard', held: 5_000, status: 'refunded', termEndDay: 12 },
      zoomjet: { contractId: 'zoomjet', tier: 'small', held: 0, status: 'forfeited', termEndDay: 9 },
      ga: { contractId: 'ga', tier: 'none', held: 0, status: 'none', termEndDay: 0 },
    }
    expect(restoreDeposits(viaJson(deposits))).toEqual(deposits)
    const leads: Record<string, AirlineLead> = {
      northline: { signDay: 3, leadDays: 2, opened: true },
      harbor: { signDay: 10, leadDays: 5, opened: false },
    }
    expect(restoreLeads(viaJson(leads))).toEqual(leads)
  })
})

describe('playtest year book round trip', () => {
  function played(): YearPlaytestBook {
    const book = new YearPlaytestBook()
    book.reset(100)
    book.noteNights(14)
    book.noteConnections(40, 3)
    book.noteDisruption('volcanic-ash', 12_000, 4)
    book.noteAward({ id: 'cleanest', name: 'Cleanest Field', year: 1, prestige: 2 })
    for (let day = 0; day < 5; day++) book.observeDay({ completedDay: day, passengers: 100 + day * 50, satisfaction: 70 + day, cleanliness: 80 })
    return book
  }

  it('closes the same year card from a reloaded book', () => {
    const live = played()
    const loaded = new YearPlaytestBook()
    loaded.restore(viaJson(live.save()), 350)
    const { rev: _liveRev, ...liveRest } = live.save()
    const { rev: _loadedRev, ...loadedRest } = loaded.save()
    expect(loadedRest).toEqual(liveRest)

    const close = { completedDay: PLAYTEST_YEAR_DAYS - 1, passengers: 900, satisfaction: 75, cleanliness: 82 }
    for (let day = 5; day < PLAYTEST_YEAR_DAYS - 1; day++) {
      const sample = { completedDay: day, passengers: 400 + day * 30, satisfaction: 72, cleanliness: 81 }
      expect(loaded.observeDay(sample)).toEqual(live.observeDay(sample))
    }
    const a = live.observeDay(close)
    const b = loaded.observeDay(close)
    expect(a).not.toBeNull()
    expect(b).toEqual(a)
  })

  it('reloads a pending year card so the player still sees it', () => {
    const live = played()
    for (let day = 5; day < PLAYTEST_YEAR_DAYS; day++) {
      live.observeDay({ completedDay: day, passengers: 900, satisfaction: 75, cleanliness: 80 })
    }
    expect(live.pending).not.toBeNull()
    const loaded = new YearPlaytestBook()
    loaded.restore(viaJson(live.save()), 900)
    expect(loaded.pending).toEqual(live.pending)
  })
})

describe('disruption bridge round trip', () => {
  function host(): DisruptionHost {
    return {
      acceptWeatherDivert: () => ({ hosted: true }),
      postCash: () => {},
      delayBank: () => {},
      rebookBank: () => {},
      news: () => {},
    }
  }

  function world(day: number): DisruptionWorld {
    return {
      fieldLevel: MID_GAME_LEVEL + 3,
      goalsComplete: true,
      endless: true,
      standsFree: 10,
      hotelRooms: 200,
      banks: [{ id: 'rw0-b1', label: 'runway 1 bank 2', flightIds: ['s1', 's2', 's3'] }],
      staffPools: ['maintenance', 'security', 'cleaning', 'fire', 'ambulance', 'desk'],
      clock: day * 180 + 10,
    }
  }

  it('rolls the same disruptions after a reload as an unbroken run', () => {
    const seed = 7
    const live = new DisruptionBridge(seed)
    const h = host()
    for (let day = 0; day < 60; day++) live.advance(world(day), h)

    const loaded = DisruptionBridge.restore(seed, viaJson(live.save()))
    expect(loaded.save()).toBe(live.save())

    for (let day = 60; day < 240; day++) {
      live.advance(world(day), h)
      loaded.advance(world(day), h)
      expect(loaded.engine.stamp()).toBe(live.engine.stamp())
    }
    expect(loaded.save()).toBe(live.save())
    expect(live.engine.feedHistory().length).toBeGreaterThan(0)
  })
})
