import { describe, expect, it } from 'vitest'
import { planFor } from '../buildinginfo/config.ts'
import { OPENING_SEC } from './openingData.ts'
import { Game } from './sim.ts'
import { stampStarterKit } from './starterLayout.ts'
import { PREFAB_I_OPEN, schemeItems, schemeZones } from './terminal.ts'
import type { StartFocus, Tile } from './types.ts'
import { SIZE } from './types.ts'

function kit(focus: StartFocus) {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = focus
  game.buyLand(focus === 'cargo' ? 'factory' : 'city')
  game.buildStarterKit()
  return game
}

describe('prefab interior on main', () => {
  it('tier I places the shipped hall pieces and leaves the follow-up cells empty', () => {
    const items = schemeItems(1)
    const defs = items.map((it) => it.def)
    for (const id of [
      'checkin_belt',
      'kiosk',
      'security_small',
      'seat_row',
      'cafe',
      'newsagent',
      'toilet',
      'claim_carousel',
      'bag_system',
      'wayfinding',
      'boarding_desk',
    ]) {
      expect(defs, id).toContain(id)
    }
    expect(items.filter((it) => it.def === 'checkin_belt' || it.def === 'kiosk')).toHaveLength(2)
    expect(items.filter((it) => it.def === 'security_small')).toHaveLength(2)
    expect(items.filter((it) => it.def === 'toilet').length).toBeGreaterThanOrEqual(2)
    const taken = new Set(items.map((it) => `${it.c},${it.r}`))
    for (const cell of PREFAB_I_OPEN) expect(taken.has(`${cell.c},${cell.r}`), cell.slot).toBe(false)
    const zones = schemeZones(1)
    for (const it of items) {
      const zone = zones[it.r]?.[it.c]
      expect(zone, it.def).toBeTruthy()
    }
  })

  it('does not raise the prefab ceilings by furnishing the hall', () => {
    const game = kit('pax')
    const fit = game.fits[0]
    expect(fit.capGuests).toBe(46)
    expect(fit.secPerMin).toBeCloseTo(37.5, 1)
    expect(fit.bagAllowance).toBe(88)
    expect(fit.rooms.checkin).toBe(2)
    expect(fit.rooms.security).toBe(2)
    expect(fit.rooms.lounge).toBe(1)
    expect(fit.rooms.bathroom).toBe(2)
    const choices = game.hubFacilityChoices('harbor')
    expect(choices.find((row) => row.kind === 'lounge')?.blocked).toBeNull()
    expect(choices.find((row) => row.kind === 'gate')?.blocked).toBeNull()
    expect(choices.find((row) => row.kind === 'hangar')?.blocked).toBe('No hangar bay is built')
  })

  it('gives the passenger and hybrid kits service bays, and the cargo kit a loader bay', () => {
    for (const focus of ['pax', 'hybrid'] as const) {
      const game = kit(focus)
      const tiles = game.tiles.flat()
      expect(tiles.filter((t) => t === 'stand')).toHaveLength(2)
      expect(tiles.filter((t) => t === 'fuel')).toHaveLength(1)
      expect(tiles.filter((t) => t === 'bags')).toHaveLength(1)
      expect(tiles.filter((t) => t === 'cargo')).toHaveLength(1)
      expect(planFor('stand').bays.length).toBe(5)
      expect(planFor('fuel').bays.length).toBe(2)
      expect(planFor('bags').bays.length).toBe(2)
      expect(planFor('cargo').bays.length).toBe(1)
      expect(game.standAccess['12,7']).toBe('remote')
      expect(game.standAccess['12,10']).toBe('remote')
      expect(game.standSize['12,7']).toBe('narrow')
      expect(game.standRung['12,7']).toBe(1)
    }
    const cargo = kit('cargo')
    expect(cargo.fits).toHaveLength(0)
    expect(cargo.tiles.flat().filter((t) => t === 'cargo')).toHaveLength(1)
    expect(cargo.standAccess['12,10']).toBe('remote')
    expect(cargo.standSize['12,10']).toBe('heavy')
    expect(cargo.standRung['12,10']).toBe(2)
    const blank = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
    const stamp = stampStarterKit(blank, 'cargo')
    expect(stamp.terminal).toBeNull()
    expect(stamp.stands[0]).toMatchObject({ access: 'remote', size: 'heavy', rung: 2 })
  })
})

const SOAK_30 = process.env.SOAK_STARTER === '1'

/** Accept letters the desks can clear. Returns the first clock a nav bottleneck appears. */
function soak(days: number, dt = 0.25): {
  firstBottleneck: number | null
  flights: number
  signed: number
  carriers: string[]
} {
  const game = kit('pax')
  game.autosave = false
  const target = days * 180
  let firstBottleneck: number | null = null
  while (game.clock < target) {
    if (game.offer) {
      const gate = game.checkinSignReport(game.offer.airline)
      if (gate.ok) game.acceptOffer()
      else game.declineOffer()
    }
    game.tick(dt)
    if (firstBottleneck == null && game.hallNav.bottlenecks > 0) firstBottleneck = game.clock
  }
  return { firstBottleneck, flights: game.flightsDone, signed: game.signed.length, carriers: game.signed.slice() }
}

describe('starter opening', () => {
  it('does not bottleneck during the opening window', () => {
    const result = soak(OPENING_SEC / 180 + 0.05)
    expect(result.signed).toBeGreaterThan(0)
    expect(result.firstBottleneck == null || result.firstBottleneck >= OPENING_SEC).toBe(true)
  }, 30_000)
})

describe.skipIf(!SOAK_30)('starter 30-day soak', () => {
  it('stays clear at the start and keeps flying', () => {
    const result = soak(30)
    console.log(JSON.stringify(result))
    expect(result.firstBottleneck == null || result.firstBottleneck >= OPENING_SEC).toBe(true)
    expect(result.flights).toBeGreaterThan(0)
    expect(result.signed).toBeGreaterThan(0)
  }, 180_000)
})
