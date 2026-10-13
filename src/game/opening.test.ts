import { beforeEach, describe, expect, it } from 'vitest'
import { severityOf } from './hints.ts'
import {
  claimHoldUnits,
  OPENING_SEC,
  openingSlotCap,
  openingSpacingBonus,
  STARTER_CAPACITY,
} from './openingData.ts'
import { nextSessionHint, SESSION_ORDER, type SessionState } from './sessionHints.ts'
import { Game } from './sim.ts'
import { schemeItems } from './terminal.ts'

function withSeed(seed: number, run: () => void) {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    run()
  } finally {
    Math.random = orig
  }
}

function started(enableHints = true): Game {
  const game = new Game()
  game.sandbox = false
  game.enableHintsAtStart = enableHints
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

const blank: SessionState = {
  fieldUp: false,
  signed: 0,
  offerWaiting: false,
  buildTrayOpened: false,
  deskStaff: 0,
  needsDesk: true,
  flightsDone: 0,
}

describe('starter capacity', () => {
  it('publishes prefab I numbers that stay under the next tier', () => {
    expect(STARTER_CAPACITY).toMatchObject({
      paxCap: 46,
      servers: 2,
      serviceSec: 3.2,
      queueCap: 16,
      bagAllowance: 88,
      desks: 2,
      gates: 2,
      bagClaim: 1,
      curbStalls: 8,
    })
    expect(openingSlotCap(0)).toBe(2)
    expect(openingSlotCap(200)).toBe(3)
    expect(openingSlotCap(500)).toBe(4)
    expect(openingSlotCap(OPENING_SEC)).toBeNull()
    expect(openingSpacingBonus(0)).toBeGreaterThan(0)
    expect(openingSpacingBonus(OPENING_SEC)).toBe(0)
    expect(claimHoldUnits(true, STARTER_CAPACITY.bagAllowance, 1)).toBe(88)
    expect(claimHoldUnits(true, 140, 1)).toBe(140)
    expect(claimHoldUnits(false, 0, 1)).toBe(80)
  })

  it('the starter kit matches those desks, gates, claim, and curb stalls', () => {
    const items = schemeItems(1)
    const desks = items.filter((i) => i.def === 'checkin_belt' || i.def === 'kiosk')
    const claims = items.filter((i) => i.def === 'claim_carousel')
    expect(desks).toHaveLength(STARTER_CAPACITY.desks)
    expect(claims).toHaveLength(STARTER_CAPACITY.bagClaim)

    const game = started()
    const fit = game.fits[0]
    expect(fit.rooms.gate).toBe(STARTER_CAPACITY.gates)
    expect(fit.rooms.checkin).toBeGreaterThanOrEqual(STARTER_CAPACITY.desks)
    expect(fit.rooms.security).toBeGreaterThanOrEqual(STARTER_CAPACITY.servers)
    expect(fit.rooms.bagclaim).toBe(STARTER_CAPACITY.bagClaim)
    expect(fit.capGuests).toBe(STARTER_CAPACITY.paxCap)
    expect(fit.bagAllowance).toBe(STARTER_CAPACITY.bagAllowance)
    // Two jetway stands on the kit.
    const stands = game.tiles.flat().filter((t) => t === 'stand')
    expect(stands).toHaveLength(STARTER_CAPACITY.gates)
    expect(game.landsideCapacity()).toBe(STARTER_CAPACITY.curbStalls)
    expect(game.deskStaff).toBe(1)
  })
})

describe('first-session hint order', () => {
  it('walks place field, confirm contract, build tray, staff a desk, then the first departure', () => {
    expect(SESSION_ORDER).toEqual([
      'session-contract',
      'session-build',
      'session-desk',
      'session-depart',
    ])
    expect(nextSessionHint(blank)?.id).toBe('session-contract')
    expect(nextSessionHint(blank)?.title).toMatch(/starter field/i)

    const field = { ...blank, fieldUp: true }
    expect(nextSessionHint(field)?.id).toBe('session-contract')
    expect(nextSessionHint({ ...field, offerWaiting: true })?.fix).toMatch(/confirm/i)

    const signed = { ...field, signed: 1 }
    expect(nextSessionHint(signed)?.id).toBe('session-build')

    const tray = { ...signed, buildTrayOpened: true }
    expect(nextSessionHint(tray)?.id).toBe('session-desk')

    const staffed = { ...tray, deskStaff: 1 }
    expect(nextSessionHint(staffed)?.id).toBe('session-depart')
    expect(nextSessionHint({ ...staffed, flightsDone: 1 })).toBeNull()
  })

  it('skips steps the starter kit or a cargo start already finished', () => {
    const kit = { ...blank, fieldUp: true, signed: 1, deskStaff: 1, needsDesk: true }
    expect(nextSessionHint(kit)?.id).toBe('session-build')
    expect(nextSessionHint({ ...kit, buildTrayOpened: true })?.id).toBe('session-depart')

    const cargo = { ...blank, fieldUp: true, signed: 1, buildTrayOpened: true, needsDesk: false }
    expect(nextSessionHint(cargo)?.id).toBe('session-depart')
  })
})

describe('hint mute still works with the session sequence', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('shows one session hint, and muting it only comes back from All hints enabled', () => {
    const game = started()
    game.tick(0.2)
    expect(game.visibleHints().map((a) => a.id)).toEqual(['session-contract'])

    game.setTool('taxi')
    expect(game.buildTrayOpened).toBe(true)
    expect(game.visibleHints().map((a) => a.id)).toEqual(['session-contract'])

    game.muteHint('session-contract')
    expect(game.hintPrefs.allEnabled).toBe(false)
    expect(game.visibleHints().some((a) => a.id.startsWith('session-'))).toBe(false)

    game.setAllHints(true)
    expect(game.hintPrefs).toEqual({ allEnabled: true, muted: [] })
    expect(game.visibleHints().map((a) => a.id)).toEqual(['session-contract'])
  })

  it('a hard fail is not hidden behind the session hint, and the two kinds mute apart', () => {
    const game = started()
    game.tick(0.2)
    game.markHallOverloaded()
    const ids = game.visibleHints().map((a) => a.id)
    expect(ids).toContain('over-capacity')
    expect(ids).toContain('session-contract')
    expect(game.visibleHints().filter((a) => !a.id.startsWith('session-') && severityOf(a) !== 'blocker')).toEqual([])

    game.muteHint('over-capacity')
    expect(game.visibleHints().map((a) => a.id)).toEqual(['session-contract'])
    game.setAllHints(true)
    game.muteHint('session-contract')
    expect(game.visibleHints().some((a) => a.id === 'over-capacity')).toBe(true)
    expect(game.visibleHints().some((a) => a.id.startsWith('session-'))).toBe(false)
  })

  it('pregame hints off starts with the sequence hidden', () => {
    const game = started(false)
    game.tick(0.2)
    expect(game.advice.some((a) => a.id === 'session-contract')).toBe(true)
    expect(game.visibleHints()).toEqual([])
  })
})

describe('opening minutes on a default new game', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('the first carrier stays regional, and a second signature can bring a narrowbody', () => {
    const game = started()
    game.clock = 20
    game.signed = ['northline']
    const orig = Math.random
    Math.random = () => 0.95
    expect(game.pickAircraftKind('northline')).toBe('regional')
    game.signed = ['bushline', 'northline']
    expect(game.pickAircraftKind('northline')).toBe('narrowbody')
    game.signed = ['northline']
    game.clock = OPENING_SEC
    expect(game.pickAircraftKind('northline')).toBe('narrowbody')
    Math.random = orig
  })

  it('holds the opening bank, then lets it grow', () => {
    const game = started()
    game.clock = 30
    game.seedScheduleForAirline('northline', 6)
    expect(game.openSchedule().length).toBeLessThanOrEqual(2)
    game.clock = OPENING_SEC
    game.seedScheduleForAirline('northline', 6)
    expect(game.openSchedule().length).toBeGreaterThan(2)
  })

  it('does not claim a hard fail during the opening on a default new game', () => {
    withSeed(11, () => {
      const game = started()
      let signed = false
      for (let t = 0; t < OPENING_SEC; t++) {
        if (!signed && game.offer) {
          game.acceptOffer()
          signed = true
        }
        game.tick(1)
        expect(game.hallOverloaded).toBe(false)
        expect(game.missedFlights).toBe(0)
        const blockers = game.advice.filter((a) => severityOf(a) === 'blocker')
        expect(blockers).toEqual([])
        expect(game.news.some((n) => /over capacity|claim jammed/i.test(n.text))).toBe(false)
        const shown = game.visibleHints()
        const session = shown.find((a) => a.id.startsWith('session-'))
        if (session) {
          const extra = shown.filter((a) => a !== session && severityOf(a) !== 'blocker')
          expect(extra).toEqual([])
        }
      }
      expect(signed).toBe(true)
      expect(game.flightsDone).toBeGreaterThan(0)
    })
  })
})
