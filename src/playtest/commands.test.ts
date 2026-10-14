import { describe, expect, it } from 'vitest'
import { createPlayer } from './commands.ts'
import { assembleReport, renderReport } from './report.ts'
import { PERSONAS, runHeadless } from './run.ts'
import type { BrowserReport, PersonaReport } from './types.ts'

describe('player command API', () => {
  it('starts a standard field and stamps a kit with a runway, stands, rooms, and shops', () => {
    const api = createPlayer()
    expect(api.setSandbox(false).ok).toBe(true)
    expect(api.beginNew('standard').ok).toBe(true)
    api.setFocus('pax')
    expect(api.view().cash).toBe(150_000)
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
    ]) {
      expect(markdown).toContain(heading)
    }
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
    recovered: [],
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
  }
}
