import { describe, expect, it } from 'vitest'
import {
  CREW_RATE_SHARE,
  HOTEL_TIERS,
  OUTSIDE_VOUCHER_RATE,
  VOUCHER_RATE_SHARE,
  WALKWAY_MAX_METRES,
  clampRate,
  crewRooms,
  hotelLink,
  hotelSite,
  priceDemand,
  settleHotelNight,
  type HotelDemand,
} from './index.ts'

const NONE: HotelDemand = {
  layoverAirside: 0,
  layoverLandside: 0,
  voucherAirline: 0,
  voucherAirport: 0,
  crew: 0,
  local: 0,
}

const inn = hotelSite({ id: 'inn', grade: 'inn', link: 'walkway', upkeep: 1680 })
const resort = hotelSite({ id: 'resort', grade: 'resort', link: 'shuttle', upkeep: 4680 })
const transit = hotelSite({ id: 'transit', grade: 'transit', link: 'inside', upkeep: 1440 })

describe('hotel sites', () => {
  it('tiers carry stars, rooms and side', () => {
    expect(inn.stars).toBeLessThan(resort.stars)
    expect(inn.side).toBe('landside')
    expect(transit.side).toBe('airside')
    expect(transit.link).toBe('inside')
    expect(hotelSite({ id: 't', grade: 'transit', link: 'none', upkeep: 0, units: 3 }).rooms).toBe(
      HOTEL_TIERS.transit.rooms * 3,
    )
  })

  it('links by walkway when close, shuttle with a bus curb, else none', () => {
    expect(hotelLink(WALKWAY_MAX_METRES, false)).toBe('walkway')
    expect(hotelLink(WALKWAY_MAX_METRES + 1, true)).toBe('shuttle')
    expect(hotelLink(WALKWAY_MAX_METRES + 1, false)).toBe('none')
    expect(hotelLink(Number.NaN, false)).toBe('none')
  })

  it('rate setting is clamped and moves the rack rate', () => {
    expect(clampRate(9)).toBe(1.6)
    expect(clampRate(0)).toBe(0.6)
    expect(hotelSite({ id: 'x', grade: 'inn', link: 'walkway', upkeep: 0, rateMult: 1.2 }).rate).toBe(
      Math.round(HOTEL_TIERS.inn.rate * 1.2),
    )
  })

  it('self-paying guests react to price', () => {
    expect(priceDemand(100, 1)).toBe(100)
    expect(priceDemand(100, 1.5)).toBeLessThan(priceDemand(100, 1.2))
    expect(priceDemand(100, 0.8)).toBeGreaterThan(100)
  })

  it('crews night-stop on late arrivals, hub crews also by day', () => {
    expect(crewRooms(180, 20, false)).toBeGreaterThan(0)
    expect(crewRooms(180, 2, false)).toBeGreaterThan(0)
    expect(crewRooms(180, 10, false)).toBe(0)
    expect(crewRooms(180, 10, true)).toBeGreaterThan(0)
    expect(crewRooms(0, 22, true)).toBe(0)
  })
})

describe('nightly occupancy and revenue', () => {
  it('fills rooms, never overbooks, and reports overflow', () => {
    const night = settleHotelNight([inn], { ...NONE, local: inn.rooms + 7 })
    expect(night.occupied).toBe(inn.rooms)
    expect(night.occupancy).toBe(1)
    expect(night.overflow.local).toBe(7)
    expect(night.revenue).toBe(inn.rooms * inn.rate)
  })

  it('an empty hotel earns nothing but still shows its upkeep', () => {
    const night = settleHotelNight([inn], NONE)
    expect(night.revenue).toBe(0)
    expect(night.occupancy).toBe(0)
    expect(night.upkeep).toBe(1680)
  })

  it('airside layovers take the transit hotel first, local guests only landside', () => {
    const night = settleHotelNight([inn, transit], { ...NONE, layoverAirside: 5, local: 3 })
    const t = night.lines.find((l) => l.id === 'transit')!
    const i = night.lines.find((l) => l.id === 'inn')!
    expect(t.bySegment.layoverAirside).toBe(5)
    expect(t.bySegment.local).toBe(0)
    expect(i.bySegment.local).toBe(3)
  })

  it('crew and airline vouchers pay contract rates; airport vouchers are comped', () => {
    const night = settleHotelNight([inn], { ...NONE, crew: 4, voucherAirline: 2, voucherAirport: 3 })
    const expected = Math.round(4 * inn.rate * CREW_RATE_SHARE + 2 * inn.rate * VOUCHER_RATE_SHARE)
    expect(night.revenue).toBe(expected)
    expect(night.occupied).toBe(9)
  })

  it('contracted rooms book before walk-ins when space is short', () => {
    const small = { ...inn, rooms: 5 }
    const night = settleHotelNight([small], { ...NONE, voucherAirline: 4, local: 10 })
    expect(night.lines[0].bySegment.voucherAirline).toBe(4)
    expect(night.lines[0].bySegment.local).toBe(1)
  })

  it('airport vouchers with no room go to an outside hotel at cost', () => {
    const night = settleHotelNight([], { ...NONE, voucherAirport: 6 })
    expect(night.outsideVoucherCost).toBe(6 * OUTSIDE_VOUCHER_RATE)
    expect(night.rooms).toBe(0)
    expect(night.occupancy).toBe(0)
  })

  it('an unlinked landside hotel gets no airside layovers', () => {
    const cut = hotelSite({ id: 'cut', grade: 'business', link: 'none', upkeep: 0 })
    const night = settleHotelNight([cut], { ...NONE, layoverAirside: 4, layoverLandside: 4, local: 2 })
    expect(night.lines[0].bySegment.layoverAirside).toBe(0)
    expect(night.lines[0].bySegment.layoverLandside).toBe(0)
    expect(night.lines[0].bySegment.local).toBe(2)
  })
})
