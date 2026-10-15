/**
 * A helicopter carrier that cannot use the field does not sign, and one that
 * can does not wait on the jet runway.
 */
import { describe, expect, it } from 'vitest'
import { buildPhoneFeed } from '../phone/feed.ts'
import { readPhoneWorld } from '../phone/readGame.ts'
import { HELIPAD_NEED, HELIPAD_WAIT, Game } from './sim.ts'
import type { Flight, Vec } from './types.ts'

const HELI = 'harbor_heli'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 500_000
  game.reputation = 80
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.heloCool = 1e9
  game.contractHeloCool = 0
  game.offerCool = 1e9
  game.clock = 1000
    game.fuelLoads = 12
    game.tankLitres = 80_000
    game.speed = 1
    return game
}

function jetOnApproach(game: Game, stand: Vec): void {
  const flight: Flight = {
    id: 'jet-busy',
    airline: 'northline',
    flightNo: 'NL1',
    airframeId: 'crj700',
    airframeName: 'CRJ-700',
    pax: 20,
    cargo: false,
    craft: 'jet',
    kind: 'regional',
    phase: 'approach',
    stand,
    x: stand.c,
    y: stand.r,
    z: 2,
    heading: 0,
    path: [stand],
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
  }
  game.flights.push(flight)
}

describe('helicopter carriers', () => {
  it('blocks the signature and names the helipad on the letter and the contract card', () => {
    const game = field()
    expect(game.rosterOpen(HELI)).toBe(true)
    expect(game.padOnlyGap(HELI)).toBe(true)
    game.offer = { airline: HELI, age: 0, deadline: 120 }
    expect(game.reqReport(HELI)).toContainEqual({ label: HELIPAD_NEED, met: false })
    expect(game.letterVerdict(HELI).missing).toContain(HELIPAD_NEED)
    expect(game.missingReq(HELI)).toContain(HELIPAD_NEED)
    expect(game.missingReq(HELI)).not.toContain('helipad')
    expect(game.missingReq(HELI)).not.toContain('Helipad')

    const cards = buildPhoneFeed(readPhoneWorld(game))
    const letter = cards.find((card) => card.id === 'contract')
    const file = cards.find((card) => card.id === 'contract-file')
    expect(letter?.lines?.some((line) => line.label.includes(HELIPAD_NEED))).toBe(true)
    expect(file?.lines?.some((line) => line.label.includes(HELIPAD_NEED))).toBe(true)

    game.acceptNegotiation()
    expect(game.signed).not.toContain(HELI)
    game.acceptOffer()
    expect(game.signed).not.toContain(HELI)
    expect(game.schedule.some((slot) => slot.airline === HELI)).toBe(false)
  })

  it('keeps a signed helicopter at the same score until a pad exists', () => {
    const game = field()
    game.signed = [HELI]
    game.wave3.noteLetter(HELI, 'accept')
    expect(game.relationWaitLine(HELI)).toBe(HELIPAD_WAIT)
    const score = game.wave3.relation(HELI).score
    const review = game as unknown as { reviewAirlineRelations(day: number): void; noteRelationFine(id: string): void }
    review.reviewAirlineRelations(1)
    review.reviewAirlineRelations(2)
    review.noteRelationFine(HELI)
    expect(game.wave3.relation(HELI).score).toBe(score)
    expect(game.schedule.some((slot) => slot.airline === HELI)).toBe(false)
  })

  it('completes a pad turn while a jet is on approach and the tower cool is up', () => {
    const game = field()
    game.tiles[30][2] = 'helipad'
    game.signed = [HELI]
    game.wave3.noteLetter(HELI, 'accept')
    jetOnApproach(game, { c: 12, r: 21 })
    game.seedScheduleForAirline(HELI, 1)
    const slot = game.schedule.find((row) => row.airline === HELI)
    expect(slot).toBeTruthy()
    slot!.eta = game.clock - 1
    slot!.status = 'scheduled'
    const before = game.flightsDone
    for (let i = 0; i < 80 && game.flightsDone === before; i++) game.tick(0.5)
    const turns = game.wave3.relation(HELI).counts.onTime + game.wave3.relation(HELI).counts.delay
    expect(game.flightsDone, game.news.slice(0, 3).map((row) => row.text).join(' | ')).toBeGreaterThan(before)
    expect(turns).toBeGreaterThan(0)
    expect(game.relationWaitLine(HELI)).toBeNull()
  })
})
