import { describe, expect, it } from 'vitest'
import {
  buildingById,
  catalog,
  dailyPnL,
  demandModifier,
  fuelMultiplier,
  greenDemandSatisfied,
  isOpen,
  placeBuilding,
  tickBuildProgress,
} from './index.ts'
import type { BuildSite, HotelBuilding, RailBuilding, SafBuilding } from './index.ts'

function hotelSpec(): HotelBuilding {
  const spec = buildingById('airport_hotel')
  if (spec?.kind !== 'hotel') throw new Error('hotel missing')
  return spec
}

function railSpec(): RailBuilding {
  const spec = buildingById('rail_link')
  if (spec?.kind !== 'rail') throw new Error('rail missing')
  return spec
}

function safSpec(): SafBuilding {
  const spec = buildingById('saf_blending')
  if (spec?.kind !== 'saf') throw new Error('saf missing')
  return spec
}

function placed(id: BuildSite['id'], level: number): BuildSite {
  const result = placeBuilding(id, level)
  if (!result.ok) throw new Error(result.reason)
  return result.site
}

describe('late-game building catalog', () => {
  it('lists the three table buildings with their field level, price, and upkeep', () => {
    expect(catalog.map((building) => building.id)).toEqual(['airport_hotel', 'rail_link', 'saf_blending'])

    const hotel = hotelSpec()
    expect(hotel.name).toBe('Airport hotel')
    expect(hotel.fieldLevel).toBe(7)
    expect(hotel.cost).toBe(260_000)
    expect(hotel.dailyUpkeep).toBe(5_400)
    expect(hotel.purpose).toBe('Overnight transfer and crew income')
    expect(hotel.catch).toBe('Empty rooms still cost')
    expect(hotel.rooms).toBeGreaterThan(0)
    expect(hotel.transferNightRate).toBeGreaterThan(0)
    expect(hotel.crewNightRate).toBeGreaterThan(0)

    const rail = railSpec()
    expect(rail.name).toBe('Rail link station')
    expect(rail.fieldLevel).toBe(9)
    expect(rail.cost).toBe(600_000)
    expect(rail.dailyUpkeep).toBe(7_000)
    expect(rail.buildDays).toBe(10)
    expect(rail.demandBonus).toBe(0.2)

    const saf = safSpec()
    expect(saf.name).toBe('SAF blending')
    expect(saf.fieldLevel).toBe(8)
    expect(saf.cost).toBe(190_000)
    expect(saf.dailyUpkeep).toBe(4_000)
    expect(saf.fuelCostMultiplier).toBe(1.08)
    expect(saf.satisfiesGreen).toBe(true)
  })

  it('refuses an order below the field level and quotes the sticker price when it allows one', () => {
    expect(placeBuilding('airport_hotel', 6)).toEqual({
      ok: false,
      reason: 'Airport hotel unlocks at Field Level 7.',
    })
    expect(placeBuilding('saf_blending', 7)).toEqual({
      ok: false,
      reason: 'SAF blending unlocks at Field Level 8.',
    })
    expect(placeBuilding('rail_link', 8)).toEqual({
      ok: false,
      reason: 'Rail link station unlocks at Field Level 9.',
    })

    const hotel = placeBuilding('airport_hotel', 7)
    const rail = placeBuilding('rail_link', 9.8)
    const saf = placeBuilding('saf_blending', 8)
    expect(hotel).toEqual({ ok: true, site: { id: 'airport_hotel', elapsedDays: 0 }, cost: 260_000 })
    expect(rail).toEqual({ ok: true, site: { id: 'rail_link', elapsedDays: 0 }, cost: 600_000 })
    expect(saf).toEqual({ ok: true, site: { id: 'saf_blending', elapsedDays: 0 }, cost: 190_000 })
    expect(placeBuilding('rail_link', Number.NaN).ok).toBe(false)
  })
})

describe('build progress', () => {
  it('opens the rail link on day 10 and leaves the site that was passed in unchanged', () => {
    const site = placed('rail_link', 9)
    const early = tickBuildProgress([site], 9)
    expect(site.elapsedDays).toBe(0)
    expect(early[0]).toMatchObject({ elapsedDays: 9, phase: 'building', progress: 0.9, daysLeft: 1 })
    expect(isOpen(early[0]!)).toBe(false)
    expect(demandModifier(early)).toBe(1)

    const opened = tickBuildProgress(early, 1)
    expect(opened[0]).toMatchObject({ elapsedDays: 10, phase: 'open', progress: 1, daysLeft: 0 })
    expect(isOpen(opened[0]!)).toBe(true)
    expect(tickBuildProgress(opened, 4)[0]?.elapsedDays).toBe(10)
  })

  it('accepts one 10-day step, ignores a bad step, and opens the hotel and SAF plant immediately', () => {
    const rail = placed('rail_link', 9)
    expect(tickBuildProgress([rail], 10)[0]?.phase).toBe('open')
    expect(tickBuildProgress([rail], 0)[0]?.phase).toBe('building')
    expect(tickBuildProgress([rail], -3)[0]?.elapsedDays).toBe(0)
    expect(tickBuildProgress([rail], Number.NaN)[0]?.elapsedDays).toBe(0)

    expect(isOpen(placed('airport_hotel', 7))).toBe(true)
    expect(isOpen(placed('saf_blending', 8))).toBe(true)
    expect(tickBuildProgress([placed('airport_hotel', 7), placed('saf_blending', 8)], 0).map((site) => site.phase)).toEqual([
      'open',
      'open',
    ])
  })
})

describe('daily P&L', () => {
  it('charges the full hotel upkeep when every room is empty', () => {
    const hotel = hotelSpec()
    const report = dailyPnL([placed('airport_hotel', 7)])
    expect(report.lines[0]).toMatchObject({
      open: true,
      income: 0,
      upkeep: hotel.dailyUpkeep,
      net: -hotel.dailyUpkeep,
      occupiedRooms: 0,
      emptyRooms: hotel.rooms,
      note: 'Empty rooms still cost',
    })
    expect(report.net).toBe(-5_400)
  })

  it('sells transfer nights first, then crew, and does not discount upkeep for empty rooms', () => {
    const hotel = hotelSpec()
    const site = placed('airport_hotel', 7)
    const half = Math.floor(hotel.rooms / 2)
    const partial = dailyPnL([site], { transfers: half, crew: 0 })
    expect(partial.lines[0]).toMatchObject({
      income: half * hotel.transferNightRate,
      upkeep: hotel.dailyUpkeep,
      occupiedRooms: half,
      emptyRooms: hotel.rooms - half,
      transferRooms: half,
      crewRooms: 0,
    })
    expect(partial.lines[0]?.note).toContain('upkeep unchanged')

    const mixed = dailyPnL([site], { transfers: hotel.rooms, crew: 40 })
    expect(mixed.lines[0]).toMatchObject({
      income: hotel.rooms * hotel.transferNightRate,
      occupiedRooms: hotel.rooms,
      emptyRooms: 0,
      transferRooms: hotel.rooms,
      crewRooms: 0,
    })

    const crewFill = dailyPnL([site], { transfers: 10, crew: hotel.rooms })
    expect(crewFill.lines[0]).toMatchObject({
      transferRooms: 10,
      crewRooms: hotel.rooms - 10,
      income: 10 * hotel.transferNightRate + (hotel.rooms - 10) * hotel.crewNightRate,
      emptyRooms: 0,
      upkeep: hotel.dailyUpkeep,
    })
  })

  it('shares one guest list across two hotels and drops non-finite counts', () => {
    const hotel = hotelSpec()
    const sites = [placed('airport_hotel', 7), placed('airport_hotel', 7)]
    const report = dailyPnL(sites, { transfers: hotel.rooms + 10, crew: 5 })
    expect(report.lines[0]).toMatchObject({ transferRooms: hotel.rooms, crewRooms: 0, emptyRooms: 0 })
    expect(report.lines[1]).toMatchObject({ transferRooms: 10, crewRooms: 5, emptyRooms: hotel.rooms - 15 })
    expect(report.income).toBe(
      hotel.rooms * hotel.transferNightRate + 10 * hotel.transferNightRate + 5 * hotel.crewNightRate,
    )

    const junk = dailyPnL(sites, { transfers: Number.NaN, crew: -4 })
    expect(junk.income).toBe(0)
    expect(junk.upkeep).toBe(hotel.dailyUpkeep * 2)
    expect(Number.isNaN(junk.net)).toBe(false)
  })

  it('posts rail and SAF upkeep only after they open, and sums the day', () => {
    const rail = placed('rail_link', 9)
    const building = tickBuildProgress([rail], 9)
    const quiet = dailyPnL([...building, placed('saf_blending', 8), placed('airport_hotel', 7)], {
      transfers: 0,
      crew: 0,
    })
    expect(quiet.lines.map((line) => [line.id, line.upkeep, line.note])).toEqual([
      ['rail_link', 0, 'Under construction — 1 day left'],
      ['saf_blending', 4_000, 'Green airline demand met — fuel cost +8%'],
      ['airport_hotel', 5_400, 'Empty rooms still cost'],
    ])
    expect(quiet.net).toBe(-9_400)

    const openRail = tickBuildProgress(building, 1)
    const running = dailyPnL(openRail)
    expect(running.lines[0]).toMatchObject({ upkeep: 7_000, income: 0, note: '+20% demand' })
    expect(running.net).toBe(-7_000)
  })
})

describe('demand, fuel, and green airline demand', () => {
  it('adds 20% demand only while the rail link is open, once', () => {
    const rail = placed('rail_link', 9)
    expect(demandModifier([])).toBe(1)
    expect(demandModifier(tickBuildProgress([rail], 9))).toBe(1)
    const open = tickBuildProgress([rail], 10)
    expect(demandModifier(open)).toBe(1.2)
    expect(demandModifier([...open, ...open])).toBe(1.2)
  })

  it('raises fuel cost 8% and satisfies green demand only while SAF blending is open', () => {
    expect(fuelMultiplier([])).toBe(1)
    expect(greenDemandSatisfied([])).toBe(false)

    const saf = placed('saf_blending', 8)
    expect(fuelMultiplier([saf, saf])).toBe(1.08)
    expect(greenDemandSatisfied([saf])).toBe(true)

    const rail = tickBuildProgress([placed('rail_link', 9)], 10)
    expect(demandModifier([...rail, saf])).toBe(1.2)
    expect(fuelMultiplier([...rail, saf])).toBe(1.08)
  })
})
