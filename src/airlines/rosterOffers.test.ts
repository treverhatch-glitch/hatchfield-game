import { describe, expect, it } from 'vitest'
import { MEDEVAC_PRIORITY, OFFER_PROFILES } from './rosterConfig.ts'
import { ROSTER, rosterAirline, rosterByType, type AirlineType } from './roster.ts'
import {
  airportCanServe,
  buildRouteOffer,
  charterSeasonMultiplier,
  generateRouteOffers,
  isAirlineUnlocked,
  routeOfferToContractOffer,
  unlockedRoster,
  type RosterAirport,
} from './rosterOffers.ts'

const hub: RosterAirport = {
  runwayLengthMeters: 3800,
  hasSmallStands: true,
  hasMediumStands: true,
  hasHeavyStands: true,
  terminalRating: 5,
  hasFuelService: true,
  hasCateringService: true,
  hasMaintenanceService: true,
  hasHeavyVehicles: true,
  onTimePercentage: 95,
  totalFlightsHandled: 5000,
  size: 5,
  reputation: 100,
  hasHelipad: true,
  hasCargoApron: true,
}

const strip: RosterAirport = {
  runwayLengthMeters: 1600,
  hasSmallStands: true,
  hasMediumStands: false,
  hasHeavyStands: false,
  terminalRating: 1,
  hasFuelService: false,
  hasCateringService: false,
  hasMaintenanceService: false,
  hasHeavyVehicles: false,
  onTimePercentage: 80,
  totalFlightsHandled: 5,
  size: 1,
  reputation: 30,
  hasHelipad: false,
  hasCargoApron: false,
}

function first(type: AirlineType) {
  return rosterByType(type)[0]
}

describe('unlocks', () => {
  it('opens more airlines as size and reputation grow', () => {
    const small = unlockedRoster(strip).length
    const big = unlockedRoster(hub).length
    expect(small).toBeGreaterThan(0)
    expect(big).toBe(ROSTER.length)
    expect(small).toBeLessThan(big)
  })

  it('needs both size and reputation', () => {
    const flag = first('flag')
    expect(isAirlineUnlocked(flag, { size: 5, reputation: 10 })).toBe(false)
    expect(isAirlineUnlocked(flag, { size: 1, reputation: 100 })).toBe(false)
    expect(isAirlineUnlocked(flag, { size: 5, reputation: 100 })).toBe(true)
  })

  it('staggers airlines of one type by reputation', () => {
    const flags = rosterByType('flag')
    const rep = flags.map((a) => unlockedRoster({ size: 5, reputation: 66 }).includes(a))
    expect(rep.some(Boolean)).toBe(true)
    expect(rep.every(Boolean)).toBe(false)
  })
})

describe('offers by type', () => {
  const offer = (type: AirlineType, day = 200) => buildRouteOffer(first(type), 0, { dayOfYear: day })

  it('budget: high frequency, tight turnaround, low fees against flag', () => {
    const budget = offer('budget')
    const flag = offer('flag')
    expect(budget.terms.slotsPerWeek).toBeGreaterThan(flag.terms.slotsPerWeek * 4)
    expect(budget.turnaroundMinutes).toBeLessThan(flag.turnaroundMinutes)
    expect(budget.terms.feePerPassenger).toBeLessThan(flag.terms.feePerPassenger)
    expect(budget.terms.feePerLanding).toBeLessThan(flag.terms.feePerLanding)
  })

  it('flag: wide-body fleet that needs premium facilities', () => {
    const flag = offer('flag')
    expect(flag.needsPremiumFacilities).toBe(true)
    expect(flag.fleet.some((m) => ['b789', 'a359', 'b77w', 'a380'].includes(m))).toBe(true)
    const noPremium = { ...hub, hasCateringService: false }
    expect(airportCanServe(first('flag'), noPremium)).toBe(false)
    expect(airportCanServe(first('flag'), hub)).toBe(true)
  })

  it('regional: props and small jets', () => {
    expect(OFFER_PROFILES.regional.sizeClasses).toEqual(['regional'])
    expect(airportCanServe(first('regional'), strip)).toBe(true)
  })

  it('cargo: night freighters that need a cargo apron', () => {
    const cargo = offer('cargo')
    expect(cargo.nightWindow).toEqual([22, 6])
    expect(cargo.needsCargoApron).toBe(true)
    expect(airportCanServe(first('cargo'), { ...hub, hasCargoApron: false })).toBe(false)
    expect(airportCanServe(first('cargo'), hub)).toBe(true)
  })

  it('charter: slots follow the season', () => {
    expect(charterSeasonMultiplier(200)).toBeGreaterThan(1)
    expect(charterSeasonMultiplier(360)).toBeGreaterThan(1)
    expect(charterSeasonMultiplier(5)).toBeGreaterThan(1)
    expect(charterSeasonMultiplier(90)).toBeLessThan(1)
    expect(offer('charter', 200).terms.slotsPerWeek).toBeGreaterThan(offer('charter', 90).terms.slotsPerWeek)
  })

  it('heli: needs a helipad, medevac is top priority', () => {
    expect(airportCanServe(first('heli'), { ...hub, hasHelipad: false })).toBe(false)
    const medevac = buildRouteOffer(rosterAirline('medevac_one')!, 0)
    const other = buildRouteOffer(rosterAirline('harbor_heli')!, 0)
    expect(medevac.priority).toBe(MEDEVAC_PRIORITY)
    expect(other.priority).toBeGreaterThan(medevac.priority)
    for (const type of ['budget', 'flag', 'regional', 'cargo', 'charter'] as AirlineType[]) {
      expect(offer(type).priority).toBeGreaterThan(medevac.priority)
    }
  })

  it('penalty tiers worsen terms', () => {
    const a = first('budget')
    const base = buildRouteOffer(a, 0)
    const worse = buildRouteOffer(a, 0, { penaltyTier: 2 })
    expect(worse.terms.feePerLanding).toBeLessThan(base.terms.feePerLanding)
    expect(worse.terms.penaltyPerCancellation).toBeGreaterThan(base.terms.penaltyPerCancellation)
  })
})

describe('generateRouteOffers', () => {
  it('offers to every unlocked, servable airline when the dice always hit', () => {
    const offers = generateRouteOffers({ airport: hub, nowMinutes: 0, dtMinutes: 1440 * 30, dayOfYear: 200, rng: () => 0 })
    expect(new Set(offers.map((o) => o.airlineId)).size).toBe(ROSTER.length)
    for (const type of ['budget', 'flag', 'regional', 'cargo', 'charter', 'heli'] as AirlineType[]) {
      expect(offers.some((o) => o.type === type)).toBe(true)
    }
  })

  it('serves medevac first', () => {
    const offers = generateRouteOffers({ airport: hub, nowMinutes: 0, dtMinutes: 1440 * 30, dayOfYear: 200, rng: () => 0 })
    expect(offers[0].priority).toBe(MEDEVAC_PRIORITY)
    expect(offers.map((o) => o.priority)).toEqual([...offers.map((o) => o.priority)].sort((a, b) => a - b))
  })

  it('skips busy airlines, missing facilities and zero time', () => {
    const busy = new Set([first('budget').id])
    const offers = generateRouteOffers({ airport: hub, nowMinutes: 0, dtMinutes: 1440, dayOfYear: 1, busyAirlineIds: busy, rng: () => 0 })
    expect(offers.find((o) => o.airlineId === first('budget').id)).toBeUndefined()
    const small = generateRouteOffers({ airport: strip, nowMinutes: 0, dtMinutes: 1440, dayOfYear: 1, rng: () => 0 })
    expect(small.every((o) => o.type === 'regional' || o.type === 'heli' || o.type === 'budget')).toBe(true)
    expect(small.some((o) => o.needsHelipad)).toBe(false)
    expect(generateRouteOffers({ airport: hub, nowMinutes: 0, dtMinutes: 0, dayOfYear: 1, rng: () => 0 })).toEqual([])
  })

  it('bridges to the legacy ContractOffer shape', () => {
    const o = buildRouteOffer(first('cargo'), 100)
    const legacy = routeOfferToContractOffer(o)
    expect(legacy).toEqual({ id: o.id, airlineId: o.airlineId, terms: o.terms, expiresAtMinute: o.expiresAtMinute, penaltyTier: 0 })
    expect(legacy.expiresAtMinute).toBeGreaterThan(100)
  })
})
