import { describe, expect, it } from 'vitest'
import { SCORE_ON_CANCEL, SCORE_ON_DELAY, SCORE_ON_SUCCESS } from '../wave3/config.ts'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'

function flight(id: string, extra: Partial<Flight> = {}): Flight {
  return {
    id,
    airline: 'northline',
    flightNo: 'NL9',
    airframeId: 'a320neo',
    airframeName: 'Airbus A320neo',
    pax: 40,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'parked',
    stand: { c: 2, r: 2 },
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: false,
      bags: false,
      bagsLoad: false,
      fuel: false,
      catering: false,
      bagDrop: false,
      mx: false,
      deiced: false,
    },
    waitingOn: {
      bags: false,
      bagsLoad: false,
      fuel: false,
      catering: false,
      mx: false,
      deice: false,
      paxOut: 0,
      paxIn: 0,
    },
    phaseTime: 0,
    ledger: [],
    ...extra,
  }
}

describe('wave 3 scores real outcomes', () => {
  it('does not treat landing schedule slip as a delay', () => {
    const game = new Game()
    game.beginNew('easy')
    game.schedule.push({
      id: 'slip',
      airline: 'northline',
      flightNo: 'NL1',
      eta: 10,
      status: 'delayed',
      delaySec: 100,
      delayReason: 'Tower sequencing',
      manual: false,
      flightId: 'land-1',
    })
    game.beginServicing(flight('land-1', { scheduleId: 'slip' }))
    expect(game.wave3.relation('northline').score).toBe(0)
  })

  it('scores a late departure and a poor grade, and a clean push as a success', () => {
    const game = new Game()
    game.beginNew('easy')
    game.clock = 100
    game.scoreWave3Turn(flight('late', { turnGrade: 'A', std: 100 - 3 }))
    expect(game.wave3.relation('northline').score).toBe(SCORE_ON_DELAY)
    game.scoreWave3Turn(flight('grade', { turnGrade: 'D', std: 100 }))
    expect(game.wave3.relation('northline').score).toBeCloseTo(SCORE_ON_DELAY * 2, 5)
    game.scoreWave3Turn(flight('clean', { turnGrade: 'A', std: 100 }))
    expect(game.wave3.relation('northline').score).toBeCloseTo(SCORE_ON_DELAY * 2 + SCORE_ON_SUCCESS, 5)
    game.scoreWave3Turn(flight('clean', { turnGrade: 'F', std: 0 }))
    expect(game.wave3.relation('northline').score).toBeCloseTo(SCORE_ON_DELAY * 2 + SCORE_ON_SUCCESS, 5)
  })

  it('scores a player cancel and a divert, and excuses a weather cancel', () => {
    const game = new Game()
    game.beginNew('easy')
    game.signed = ['northline']
    game.addManualSlot('northline', 40)
    const slot = game.schedule.find((row) => row.airline === 'northline')
    expect(slot).toBeTruthy()
    game.cancelSlot(slot!.id)
    expect(game.wave3.relation('northline').score).toBe(SCORE_ON_CANCEL)

    game.addManualSlot('northline', 40)
    const weather = game.schedule.find((row) => row.airline === 'northline')!
    weather.delayReason = 'Fog / dest weather'
    game.cancelSlot(weather.id)
    expect(game.wave3.relation('northline').score).toBe(SCORE_ON_CANCEL)

    const diverted = flight('div-1')
    game.flights.push(diverted)
    game.divertFlight(diverted, 'NL9 diverted')
    expect(game.wave3.relation('northline').score).toBe(SCORE_ON_CANCEL * 2)
    expect(diverted.phase).toBe('gone')
  })
})

describe('one landing relationship fee', () => {
  it('matches the tier-1 total and moves only with the wave 3 factor', () => {
    const game = new Game()
    game.beginNew('easy')
    const first = flight('fee-1')
    game.beginServicing(first)
    const tier1 = first.ledger.find((line) => line.label.includes('landing'))?.amount ?? 0
    const repeat = flight('fee-1b')
    game.beginServicing(repeat)
    const again = repeat.ledger.find((line) => line.label.includes('landing'))?.amount ?? 0
    expect(tier1).toBeGreaterThan(0)
    expect(again).toBe(tier1)
    expect(game.wave3.feeFactor('northline')).toBe(1)
    expect(game.wave3.feeLine('northline')).toContain('×1.00')
    expect(game.wave3.slotLine('northline')).toBe('Extra slots · 0')

    while (game.wave3.relation('northline').tier < 2) game.wave3.noteTurnaround('northline', 'success')
    const second = flight('fee-2')
    game.beginServicing(second)
    const preferred = second.ledger.find((line) => line.label.includes('landing'))?.amount ?? 0
    expect(game.wave3.feeFactor('northline')).toBeCloseTo(1.05, 5)
    expect(preferred / tier1).toBeCloseTo(1.05, 2)
    expect(preferred / tier1).not.toBeCloseTo(1.05 * 0.92, 2)
    expect(game.wave3.feeLine('northline')).toContain('×1.05')
    expect(game.wave3.slotLine('northline')).toBe('Extra slots · +1 on the timetable')
  })
})

describe('extra slots reach the timetable', () => {
  it('writes the tier grant once on the day review, and tier 1 writes none', () => {
    const game = new Game()
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.signed = ['northline']
    expect(game.fleetHasOperable('northline')).toBe(true)
    game.clock = 800
    game.payrollDay = Math.floor(game.clock / 180) - 1
    const before = game.schedule.filter((slot) => slot.airline === 'northline').length
    game.tickPayroll(1)
    expect(game.wave3.routesDue('northline')).toBe(0)
    expect(game.wave3.relation('northline').routesGranted).toBe(0)
    expect(game.schedule.filter((slot) => slot.airline === 'northline').length).toBe(before)

    while (game.wave3.relation('northline').score < 25) game.wave3.noteTurnaround('northline', 'success')
    expect(game.wave3.relation('northline').tier).toBeGreaterThanOrEqual(2)
    expect(game.wave3.routesDue('northline')).toBe(1)
    game.clock += 180
    game.tickPayroll(1)
    const granted = game.schedule.filter((slot) => slot.airline === 'northline').length
    expect(granted).toBeGreaterThan(before)
    expect(game.wave3.relation('northline').routesGranted).toBe(1)
    expect(game.wave3.routesDue('northline')).toBe(0)

    game.clock += 180
    game.tickPayroll(1)
    expect(game.schedule.filter((slot) => slot.airline === 'northline').length).toBe(granted)
    expect(game.wave3.relation('northline').routesGranted).toBe(1)
  })
})
