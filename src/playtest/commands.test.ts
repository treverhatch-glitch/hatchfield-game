import { describe, expect, it } from 'vitest'
import { START_CASH } from '../game/catalog.ts'
import { createPlayer } from './commands.ts'
import { carefulIntents, freshMemory } from './personas.ts'
import { assembleReport, renderReport } from './report.ts'
import { PERSONAS, runHeadless } from './run.ts'
import type { BrowserReport, PersonaReport, SystemsBooks, SystemsPeaks } from './types.ts'

describe('player command API', () => {
  it('starts a standard field and stamps a kit with a runway, stands, rooms, and shops', () => {
    const api = createPlayer()
    expect(api.setSandbox(false).ok).toBe(true)
    expect(api.beginNew('standard').ok).toBe(true)
    api.setFocus('pax')
    expect(api.view().cash).toBe(START_CASH.standard)
    expect(api.buyLand('city').ok).toBe(true)
    expect(api.buildStarterKit().ok).toBe(true)
    const view = api.view()
    expect(view.runway).toBeGreaterThan(0)
    expect(view.stands).toBeGreaterThan(0)
    expect(view.terminals).toBeGreaterThan(0)
    expect((view.rooms.food ?? 0) + (view.rooms.souvenir ?? 0)).toBeGreaterThan(0)
    expect(view.shopUnits).toBeGreaterThan(0)
    expect(api.acceptContract().ok).toBe(false)
    api.setSpeed(5)
    api.tick(0.25)
    expect(api.probe().clock).toBeGreaterThan(0)
  })

  it('furnishes a research desk once the day-1 trickle banks a point', () => {
    const api = createPlayer()
    api.setSandbox(false)
    api.beginNew('standard')
    api.setFocus('pax')
    api.buyLand('city')
    expect(api.buildStarterKit().ok).toBe(true)
    expect(api.view().wave3Points).toBe(0)
    api.setSpeed(1)
    api.tick(120)
    const view = api.view()
    expect(view.researchPoints).toBeGreaterThan(0)
    expect(view.rooms.rdesk ?? 0).toBe(0)
    const decision = carefulIntents(view, freshMemory())
    expect(decision.intents).toContainEqual({ do: 'room', id: 'rdesk' })
    expect(api.buyRoom('rdesk').ok).toBe(true)
    expect(api.view().rooms.rdesk).toBe(1)
  })

  it('buys a free tree node, hires a desk agent, and stamps a bus bay on the road', () => {
    const api = createPlayer()
    api.setSandbox(false)
    api.beginNew('standard')
    api.setFocus('pax')
    api.buyLand('city')
    expect(api.buildStarterKit().ok).toBe(true)
    const view = api.view()
    expect(view.nextTree?.cost).toBe(0)
    expect(view.nextTree?.id).toBe('airfield-1')
    expect(api.buyTree(view.nextTree!.id).ok).toBe(true)
    expect(api.view().treeUnlocked).toContain('airfield-1')
    const staffed = api.view().deskStaff
    expect(api.hireDesk().ok).toBe(true)
    expect(api.view().deskStaff).toBe(staffed + 1)
    expect(api.view().busBays).toBe(0)
    const curb = api.relieveCurb()
    expect(curb.ok).toBe(true)
    expect(curb.detail).toMatch(/bus/)
  })
})

describe('playtest report', () => {
  it('names every metric the bots are supposed to record', () => {
    const markdown = renderReport(assembleReport([samplePersona()], skippedBrowser()))
    for (const heading of [
      'Time to first landing',
      'Cash curve',
      'Stuck or recovered',
      'Console errors',
      'Softlocks',
      'Passenger satisfaction',
      'Slowest sim ticks',
      'Anything the bot could not do',
      'New systems',
    ]) {
      expect(markdown).toContain(heading)
    }
    expect(markdown).toContain('step=none')
  })
})

describe('headless bot loop', () => {
  it('plays one careful sim day on the command API', { timeout: 180_000 }, () => {
    const spec = PERSONAS.find((persona) => persona.id === 'careful')
    expect(spec).toBeTruthy()
    const [report] = runHeadless({
      personas: [{ ...spec!, days: 1 }],
    })
    expect(report.daysRan).toBeGreaterThanOrEqual(1)
    expect(report.built.runway).toBeGreaterThan(0)
    expect(report.built.stands).toBeGreaterThan(0)
    expect(report.cashCurve.length).toBeGreaterThan(0)
    expect(report.consoleErrors).toEqual([])
    expect(report.ticks).toBeGreaterThan(10)
  })
})

function skippedBrowser(): BrowserReport {
  return {
    ok: false,
    skipped: true,
    reason: 'not run',
    wallMs: 0,
    script: [],
    screenshots: [],
    timeToFirstLandingSec: null,
    cashCurve: [],
    stuck: [],
    recovered: [],
    consoleErrors: [],
    softlocks: [],
    satisfaction: [],
    satisfactionAvg: null,
    slowestTicks: [],
    couldNot: [],
    clockEnd: 0,
    cashEnd: null,
    notes: [],
  }
}

function samplePersona(): PersonaReport {
  return {
    persona: 'careful',
    label: 'Careful',
    daysRequested: 45,
    daysRan: 1,
    difficulty: 'standard',
    focus: 'pax',
    sandbox: false,
    tickDt: 0.25,
    speed: 5,
    wallMs: 10,
    ticks: 3,
    timeToFirstLandingSec: 40,
    timeToFirstLandingDay: 0,
    firstLandingPhase: 'landing',
    firstLandingFlight: 'BU101',
    cashStart: 150_000,
    cashEnd: 12_000,
    cashCurve: [
      { day: 0, cash: 7_000 },
      { day: 1, cash: 12_000 },
    ],
    stuck: [],
    recovered: [
      {
        id: 'flight:sample',
        detail: 'BU101 taxi_out for 12s',
        step: 'none',
        firstClock: 10,
        lastClock: 22,
        recoveredClock: 30,
      },
    ],
    consoleErrors: [],
    softlocks: [],
    satisfaction: [{ day: 1, guests: 2, avg: 66, fieldRating: 48 }],
    satisfactionAvg: 66,
    slowestTicks: [{ ms: 4, day: 0, clock: 10, flights: 1, guests: 2 }],
    couldNot: [],
    couldNotTotal: 0,
    built: {
      runway: 1,
      stands: 2,
      terminals: 9,
      snacks: 0,
      rooms: { food: 1, souvenir: 1 },
      shopUnits: 2,
      leasedShops: 0,
      signed: ['bush'],
      flightsDone: 1,
    },
    notes: [],
    days: [],
    peaks: emptyPeaks(),
    books: emptyBooks(),
    nanFlags: [],
    ops: {
      flightsPerDay: 1,
      flightDiverts: 0,
      connectionDiverts: 0,
      goArounds: 0,
      missedConnectionCash: 0,
      curbCrossDay: null,
      curbPeak: 0,
      fuelGroundings: 0,
      firstGroundingDay: null,
      groundingWarnings: [],
      treeCompleteDay: null,
      cashDay30: null,
      cashDay60: null,
      cashDay90: null,
      preferredDay: null,
      trustedDay: null,
      hubTier: 'none',
      hubTierDay: null,
      fuelPurchase: 0,
      spotPurchase: 0,
      termPurchase: 0,
      fuelPurchasePerDay: 0,
      spotPurchasePerDay: 0,
    },
    researchBuys: [{ pool: 'tree', day: 1, id: 'airfield-1', name: 'Apron charter', cost: 0 }],
    research: {
      deskPoints: 4,
      deskCarry: 0,
      deskEarned: 4,
      wave3Points: 2,
      wave3Carry: 0.2,
      wave3Earned: 2.2,
      treePoints: 1,
      treeCarry: 0.1,
      treeEarned: 1.1,
      researchers: 0,
      desks: 1,
      boards: 0,
      machines: 0,
      deskLabRate: 0,
      deskOpsRate: 0.05,
      wave3RoomRate: 0.06,
      wave3OpsRate: 0.02,
      treeRoomRate: 0.04,
      treeOpsRate: 0.01,
      deskUnlocked: [],
      wave3Unlocked: [],
      treeUnlocked: [{ id: 'airfield-1', name: 'Apron charter', cost: 0 }],
    },
  }
}

function emptyPeaks(): SystemsPeaks {
  return { happiness: null, guests: 0, checkinWaiting: 0, securityWaiting: 0, curbPressure: 0, curbQueue: 0 }
}

function emptyBooks(): SystemsBooks {
  return {
    sinks: [{ category: 'penalties', amount: -1600 }],
    fieldAskFines: 1,
    penaltyTotal: -1600,
    penaltyBreakdown: { missedConnections: 0, delays: 0, refunds: 0, other: -1600 },
    penaltySources: [{ category: 'penalties', label: '(unlabeled)', amount: -1600, count: 1 }],
    connections: { made: 0, belowMct: 0, paxLate: 0, bagLate: 0, divert: 0, judged: 0, delayMin: 0, availableMin: 0, bagMin: 0 },
    relations: [{ id: 'bush', name: 'Bushline', score: 2, band: 'neutral', tier: 1, label: 'Published', onTime: 0, delayed: 0, kept: 0, missed: 0, fines: 0, blocked: null }],
    treePoints: 1,
    treeUnlocked: ['airfield-1'],
    wave3Points: 1,
    deskStaff: 2,
    checkinStaffed: true,
    securityStaffed: true,
    checkinWaiting: 0,
    securityWaiting: 0,
    checkinLines: [],
    securityLines: [],
    curbPressure: 0.4,
    curbQueue: 0,
    curbDelaySec: 0,
    lanes: 1,
    busBays: 1,
    curbLanes: 0,
    taxiRanks: 0,
  }
}
