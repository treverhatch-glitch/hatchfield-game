import { describe, expect, it } from 'vitest'
import { serviceSecOf } from '../paxnav/index.ts'
import { gameMinToSim } from '../pax/showup.ts'
import type { ShowUpPlan } from '../pax/showup.ts'
import { CHECKIN_ALLOC } from '../checkin/index.ts'
import { spawnHallGuest } from './guests.ts'
import { staffPoints } from './hallNav.ts'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = true
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  game.hallGuests = game.hallGuests.filter((g) => !g.preview)
  game.deskStaff = 0
  game.hallStaff = []
  game.deskStaffCool = 1e9
  return game
}

function show(id: string, airlineId: string, std: number, pax: number): ShowUpPlan {
  return {
    slotId: id,
    std,
    hallId: 'hall',
    airlineId,
    intl: false,
    tags: Array.from({ length: pax }, () => 'budget' as const),
    releases: [],
    spawned: 0,
    flightId: id,
    closed: false,
  }
}

function flight(id: string, airline: string): Flight {
  return {
    id,
    airline,
    flightNo: id.toUpperCase(),
    airframeId: 'b738',
    airframeName: 'Boeing 737-800',
    pax: 40,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'servicing',
    stand: null,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: { landing: false, bags: false, bagsLoad: false, fuel: false, catering: false, bagDrop: false, mx: false, deiced: false },
    waitingOn: { bags: false, bagsLoad: false, fuel: false, catering: false, mx: false, deice: false, paxOut: 0, paxIn: 0 },
    phaseTime: 0,
    ledger: [],
    scheduleId: id,
  } as Flight
}

describe('check-in desks on the field', () => {
  it('themes the open airline, leaves the kiosk general, and says short of desks', () => {
    const game = field()
    const std = game.clock + gameMinToSim(80)
    game.showUps.push(show('harbor-1', 'harbor', std, 40), show('north-1', 'northline', std + 1, 40))
    game.flights.push(flight('harbor-1', 'harbor'), flight('north-1', 'northline'))
    game.tickHallNav(0.05)
    expect(game.hallNav.live).toBe(true)

    const alloc = game.checkinAllocation()
    const branded = alloc.desks.filter((row) => row.mode === 'common')
    const kiosks = alloc.desks.filter((row) => row.mode === 'kiosk')
    expect(branded).toHaveLength(1)
    expect(branded[0]?.airlineId).toBe('harbor')
    expect(kiosks.length).toBeGreaterThan(0)
    expect(kiosks.every((row) => row.airlineId == null)).toBe(true)
    expect(alloc.reason).toBe('short of desks')
    expect(game.deskBrands().map((brand) => brand.id)).toContain('harbor')
    expect(game.deskBrands().some((brand) => brand.id === 'neutral')).toBe(true)

    game.view = 'hall'
    game.selectFacility('checkin')
    const card = game.buildingCard()
    expect(card?.why).toBe('short of desks')
    expect(card?.bays.some((bay) => /Desk \d+ · Harbor/.test(bay.line))).toBe(true)
    expect(card?.bays.some((bay) => bay.line.includes('Kiosk · any airline'))).toBe(true)
    const deskNo = alloc.desks.findIndex((row) => row.mode === 'common') + 1
    expect(game.checkinLine(game.flights[0]!)).toBe(`Check-in open · desks ${deskNo}`)
    expect(game.checkinLine(game.flights[1]!)).toBe('Check-in open · short of desks')

    const harbor = spawnHallGuest('harbor-1', 'depart', 'budget', { airlineId: 'harbor' })
    const north = spawnHallGuest('north-1', 'depart', 'budget', { airlineId: 'northline' })
    harbor.bags = true
    north.bags = true
    harbor.releaseAt = game.clock
    north.releaseAt = game.clock
    game.hallGuests.push(harbor, north)
    game.tickHallNav(0.05)
    const pose = (id: string) => game.hallNav.nav?.poses().find((row) => row.id === id)
    const belt = alloc.desks.find((row) => row.mode === 'common')?.deskId
    expect(pose(north.id)?.facility).not.toBe(belt)
  })

  it('charges below Preferred, waives the fee after that, and speeds a Trusted desk', () => {
    const game = field()
    game.tickHallNav(0.05)
    game.sandbox = false
    game.cash = 80_000
    const before = game.cash
    expect(game.dedicateDesk('northline')).toBe(true)
    expect(game.cash).toBe(before - CHECKIN_ALLOC.dedicatedFee)
    expect(game.dedicatedDesks).toHaveLength(1)
    expect(game.dedicateDesk('harbor')).toBe(false)

    game.releaseDesk(game.dedicatedDesks[0]!.deskId)
    while (game.wave3.relation('harbor').tier < 2) game.wave3.noteTurnaround('harbor', 'success')
    const held = game.cash
    expect(game.dedicateDesk('harbor')).toBe(true)
    expect(game.cash).toBe(held)

    while (game.wave3.relation('harbor').tier < 3) game.wave3.noteTurnaround('harbor', 'success')
    game.tickHallNav(0.05)
    const nav = game.hallNav.nav!
    const fit = game.activeHall()!
    const points = staffPoints(nav.facilities.list, fit.items ?? [])
    const belt = points.find((point) => point.kind === 'checkin_desk' && !point.automatic)
    const kiosk = points.find((point) => point.kind === 'checkin_desk' && point.automatic)
    expect(belt).toBeTruthy()
    expect(kiosk).toBeTruthy()
    const beltEq = nav.layout.equipment.find((eq) => eq.id === belt!.id)
    const kioskEq = nav.layout.equipment.find((eq) => eq.id === kiosk!.id)
    expect(nav.facilities.byId.get(belt!.id)?.serviceSec).toBeCloseTo(serviceSecOf(beltEq!) * CHECKIN_ALLOC.trustedServiceShare, 5)
    expect(nav.facilities.byId.get(kiosk!.id)?.serviceSec).toBeCloseTo(serviceSecOf(kioskEq!) * 0.45, 5)
  })
})
