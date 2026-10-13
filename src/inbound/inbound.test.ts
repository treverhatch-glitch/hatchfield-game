import { describe, expect, it } from 'vitest'
import { weeklyFlights } from '../contracts/contracts.ts'
import {
  AIR_AMBULANCE_FEE,
  DIVERT_FEE_MAX,
  DIVERT_FEE_MIN,
  EMERGENCY_FAIL_FINE,
  EMERGENCY_REFUSE_FINE,
  GA_PARK_DAY_RATE,
  GA_PARK_FEE_MAX,
  GA_PARK_FEE_MIN,
  MIL_AGREE_COST,
  MIL_LANDING,
  TANKER_FEE,
  TANKER_MX_FEE,
} from '../game/catalog.ts'
import {
  CLEARANCE_LICENCE_COST,
  DECISION_SEC,
  GENERAL_KINDS,
  HOTEL_NIGHT_FEE,
  MIL_EARLY_CANCEL_FEE,
  MIL_WEEKLY_RETAINER,
  MISSED_SORTIE_PENALTY,
  PRIORITY_KINDS,
  SIM_DAY_SEC,
  activeVisits,
  applyFeeElasticity,
  botChoice,
  buyClearance,
  cancelMilitaryContract,
  createInboundState,
  daySorties,
  generalBand,
  hostGaps,
  litres,
  nightSorties,
  offerMilitaryContract,
  priorityWeight,
  profile,
  requestsOnDay,
  respond,
  rollEmergencyCount,
  signGuardAgreement,
  signMilitaryContract,
  spawnOffer,
  tick,
  type FieldCapabilities,
  type InboundEvent,
  type InboundState,
  type InboundWorld,
  type RequestKind,
} from './index.ts'

function world(partial: Partial<InboundWorld> = {}, caps: Partial<FieldCapabilities> = {}): InboundWorld {
  return {
    fieldLevel: 5,
    feeMultiplier: 1,
    weather: 'clear',
    ...partial,
    capabilities: {
      stands: 8,
      remoteStands: 4,
      grassPads: 2,
      heliPads: 1,
      guardPads: 2,
      arff: true,
      ambulance: true,
      fuelLitres: 500_000,
      hotelRooms: 40,
      securityCorridor: true,
      hangarBays: 2,
      gpu: true,
      catering: true,
      cleaning: true,
      customs: true,
      runwayMetres: 3000,
      ...caps,
    },
  }
}

function eventOf<T extends InboundEvent['type']>(events: InboundEvent[], type: T): Extract<InboundEvent, { type: T }> {
  const found = events.find((item) => item.type === type)
  if (!found || found.type !== type) throw new Error(`missing ${type}`)
  return found as Extract<InboundEvent, { type: T }>
}

function assertPads(state: InboundState, field: InboundWorld): void {
  const day = Math.floor(state.clock / SIM_DAY_SEC)
  const parked = activeVisits(state)
  for (const visit of state.visits) {
    if (visit.departDay <= day) expect(visit.status).toBe('departed')
    if (visit.status === 'parked') expect(visit.departDay).toBeGreaterThan(day)
  }
  const count = (pad: string) => parked.filter((visit) => visit.pad === pad).length
  expect(state.held.stands).toBe(count('stand'))
  expect(state.held.remoteStands).toBe(count('remote'))
  expect(state.held.grassPads).toBe(count('grass'))
  expect(state.held.heliPads).toBe(count('heli'))
  expect(state.held.guardPads).toBe(count('guard'))
  expect(state.held.hotelRooms).toBe(parked.reduce((sum, visit) => sum + visit.needs.hotelRooms, 0))
  expect(state.held.hangarBays).toBe(parked.reduce((sum, visit) => sum + visit.needs.hangarBays, 0))
  expect(state.burnedFuel).toBe(state.visits.reduce((sum, visit) => sum + visit.needs.fuelLitres, 0))
  expect(state.corridorHeld).toBe(parked.some((visit) => visit.needs.securityCorridor))
  for (const key of ['stands', 'remoteStands', 'grassPads', 'heliPads', 'guardPads'] as const) {
    expect(state.held[key]).toBeGreaterThanOrEqual(0)
    expect(state.held[key]).toBeLessThanOrEqual(field.capabilities[key])
  }
  expect(state.ledger.every((row) => Number.isFinite(row.amount))).toBe(true)
}

describe('inbound requests', () => {
  it('uses the catalog fee and fine constants', () => {
    expect(TANKER_FEE).toBe(6800)
    expect(EMERGENCY_REFUSE_FINE).toBe(2500)
    expect(MIL_LANDING).toBe(7800)
    expect(GA_PARK_DAY_RATE).toBe(380)
    expect(HOTEL_NIGHT_FEE).toBe(95)
  })

  it('gives every kind an ETA, a service list, a reward and a 60s card', () => {
    for (const kind of [...PRIORITY_KINDS, ...GENERAL_KINDS] as RequestKind[]) {
      const state = createInboundState(4)
      const request = spawnOffer(state, kind)
      expect(request.etaSec).toBeGreaterThan(0)
      expect(request.deadline - request.opensAt).toBe(DECISION_SEC)
      expect(request.needs).toEqual(profile(kind).needs)
      const events = respond(state, world(), request.id, 'accept')
      const accepted = eventOf(events, 'accepted')
      expect(accepted.consumed).toEqual(request.needs)
      expect(state.burnedFuel).toBe(request.needs.fuelLitres)
      expect(state.visits[0]?.needs).toEqual(request.needs)
      if (kind === 'vip') expect(request.reward).toBe(DIVERT_FEE_MAX)
      if (kind === 'tanker') expect(request.reward).toBe(TANKER_FEE)
      if (kind === 'tanker_mx') expect(request.reward).toBe(TANKER_MX_FEE)
      if (kind === 'medical' || kind === 'medevac') expect(request.reward).toBe(AIR_AMBULANCE_FEE)
      if (kind === 'military') expect(request.reward).toBe(MIL_LANDING)
      if (kind === 'weather_divert' || kind === 'fuel_low' || kind === 'technical') {
        expect(request.reward).toBeGreaterThanOrEqual(DIVERT_FEE_MIN)
        expect(request.reward).toBeLessThan(DIVERT_FEE_MAX)
      }
      if (kind === 'ga' || kind === 'bizjet' || kind === 'charter' || kind === 'ferry') {
        expect(request.reward).toBeGreaterThanOrEqual(GA_PARK_FEE_MIN)
        expect(request.reward).toBeLessThan(GA_PARK_FEE_MAX)
      }
      if (kind === 'storage') {
        expect(request.reward).toBe(0)
        expect(request.dailyFee).toBe(GA_PARK_DAY_RATE)
        expect(request.stayDays).toBeGreaterThanOrEqual(3)
        expect(request.stayDays).toBeLessThanOrEqual(30)
      }
      expect(request.fineOnRefuse).toBe(request.priority ? EMERGENCY_REFUSE_FINE : 0)
      expect(request.fineOnFail).toBe(request.priority ? EMERGENCY_FAIL_FINE : 0)
    }
  })

  it('locks the service hooks on the needs profiles', () => {
    expect(profile('medical').needs.ambulance).toBe(true)
    expect(profile('vip').needs.securityCorridor).toBe(true)
    expect(profile('vip').needs.hotelRooms).toBeGreaterThan(0)
    expect(profile('tanker').needs.arff).toBe(true)
    expect(profile('tanker').needs.fuelLitres).toBe(litres(80))
    expect(profile('tanker_mx').needs.hangarBays).toBe(1)
    expect(profile('weather_divert').needs.hotelRooms).toBeGreaterThan(0)
    expect(profile('weather_divert').needs.pad).toBe('stand')
    expect(profile('medevac').needs.pad).toBe('heli')
    expect(profile('medevac').needs.runwayMetres).toBe(0)
    expect(profile('fuel_low').needs.fuelLitres).toBe(litres(70))
    expect(profile('technical').needs.hangarBays).toBe(1)
    expect(profile('charter').needs.catering).toBe(true)
    expect(profile('charter').needs.cleaning).toBe(true)
    expect(profile('charter').needs.gpu).toBe(true)
    expect(profile('charter').needs.customs).toBe(true)
    expect(profile('ferry').needs.catering).toBe(false)
    expect(profile('bizjet').needs.hotelRooms).toBe(1)
    expect(profile('storage').needs.pad).toBe('remote')
    expect(profile('storage').needs.padFallback).toBe('grass')
    expect(profile('ga').needs.padFallback).toBe('stand')
    expect(profile('military').needs.pad).toBe('guard')
  })

  it('pays hotel nights from the catalog night fee and posts the landing reward', () => {
    const state = createInboundState(1)
    const request = spawnOffer(state, 'weather_divert')
    const events = respond(state, world(), request.id, 'accept')
    const accepted = eventOf(events, 'accepted')
    expect(accepted.reward).toBe(request.reward)
    expect(accepted.hotelIncome).toBe(request.needs.hotelRooms * request.stayDays * HOTEL_NIGHT_FEE)
    expect(state.ledger.some((row) => row.amount === request.reward)).toBe(true)
    expect(state.ledger.some((row) => row.amount === accepted.hotelIncome)).toBe(true)
    expect(state.xp).toBe(request.xpOnAccept)
  })

  it('refuses priority asks with the emergency fine and general traffic with none', () => {
    const priority = createInboundState(1)
    const divert = spawnOffer(priority, 'weather_divert')
    const refused = eventOf(respond(priority, world(), divert.id, 'refuse'), 'refused')
    expect(refused.fine).toBe(EMERGENCY_REFUSE_FINE)
    expect(priority.reputation).toBe(46)
    expect(priority.visits).toHaveLength(0)

    const general = createInboundState(1)
    const ga = spawnOffer(general, 'ga')
    const quiet = eventOf(respond(general, world(), ga.id, 'refuse'), 'refused')
    expect(quiet.fine).toBe(0)
    expect(general.ledger).toHaveLength(0)
    expect(general.reputation).toBe(50)
  })

  it('treats a missed deadline as a refuse', () => {
    const state = createInboundState(1)
    const divert = spawnOffer(state, 'weather_divert')
    const events = tick(state, world(), DECISION_SEC)
    const expired = events.find((item) => item.type === 'expired' && item.requestId === divert.id)
    expect(expired).toMatchObject({ fine: EMERGENCY_REFUSE_FINE })
    expect(state.requests.find((item) => item.id === divert.id)?.status).toBe('expired')

    const gaState = createInboundState(1)
    const ga = spawnOffer(gaState, 'storage')
    const gaEvents = tick(gaState, world(), DECISION_SEC)
    const gaExpired = gaEvents.find((item) => item.type === 'expired' && item.requestId === ga.id)
    expect(gaExpired).toMatchObject({ fine: 0 })
  })

  it('fails an emergency the field cannot host and declines general traffic without a fine', () => {
    const bare = world({}, {
      arff: false,
      ambulance: false,
      stands: 0,
      remoteStands: 0,
      grassPads: 0,
      heliPads: 0,
      guardPads: 0,
      hotelRooms: 0,
      hangarBays: 0,
      securityCorridor: false,
      fuelLitres: 0,
      catering: false,
      cleaning: false,
      gpu: false,
      customs: false,
    })
    const emergency = createInboundState(1)
    const divert = spawnOffer(emergency, 'medical')
    const failed = eventOf(respond(emergency, bare, divert.id, 'accept'), 'failed_host')
    expect(failed.fine).toBe(EMERGENCY_FAIL_FINE)
    expect(failed.gaps).toContain('ambulance')
    expect(emergency.visits).toHaveLength(0)
    expect(emergency.reputation).toBe(43)

    const general = createInboundState(1)
    const charter = spawnOffer(general, 'charter')
    const declined = eventOf(respond(general, bare, charter.id, 'accept'), 'declined')
    expect(declined.gaps.length).toBeGreaterThan(0)
    expect(general.ledger).toHaveLength(0)
    expect(general.visits).toHaveLength(0)
  })

  it('names the missing hook', () => {
    const state = createInboundState(1)
    expect(hostGaps(state, world({}, { arff: false }).capabilities, profile('tanker').needs)).toContain('arff')
    expect(hostGaps(state, world({}, { fuelLitres: 0 }).capabilities, profile('fuel_low').needs)).toContain('fuel')
    expect(hostGaps(state, world({}, { hotelRooms: 0 }).capabilities, profile('vip').needs)).toContain('hotel')
    expect(hostGaps(state, world({}, { securityCorridor: false }).capabilities, profile('vip').needs)).toContain(
      'security_corridor',
    )
    expect(hostGaps(state, world({}, { hangarBays: 0 }).capabilities, profile('technical').needs)).toContain('hangar')
    expect(hostGaps(state, world({}, { stands: 0 }).capabilities, profile('charter').needs)).toContain('stand')
    expect(hostGaps(state, world({}, { runwayMetres: 400 }).capabilities, profile('weather_divert').needs)).toContain(
      'runway',
    )
  })

  it('holds one security corridor and will not burn fuel it does not have', () => {
    const state = createInboundState(1)
    const first = spawnOffer(state, 'vip')
    respond(state, world(), first.id, 'accept')
    const second = spawnOffer(state, 'vip')
    const failed = eventOf(respond(state, world(), second.id, 'accept'), 'failed_host')
    expect(failed.gaps).toContain('security_corridor')
    expect(state.visits).toHaveLength(1)

    const fuel = createInboundState(2)
    const field = world({}, { fuelLitres: litres(70) })
    respond(fuel, field, spawnOffer(fuel, 'fuel_low').id, 'accept')
    const again = eventOf(respond(fuel, field, spawnOffer(fuel, 'fuel_low').id, 'accept'), 'failed_host')
    expect(again.gaps).toContain('fuel')
  })

  it('parks GA on a remote pad, a stand if that is all there is, and storage off the contact gates', () => {
    const remote = createInboundState(1)
    const ga = spawnOffer(remote, 'ga')
    const parked = eventOf(respond(remote, world(), ga.id, 'accept'), 'accepted')
    expect(parked.pad).toBe('remote')

    const standOnly = createInboundState(1)
    const ga2 = spawnOffer(standOnly, 'ga')
    const moved = eventOf(
      respond(standOnly, world({}, { remoteStands: 0, grassPads: 0 }), ga2.id, 'accept'),
      'accepted',
    )
    expect(moved.pad).toBe('stand')

    const stored = createInboundState(1)
    const storage = spawnOffer(stored, 'storage')
    const declined = eventOf(
      respond(stored, world({}, { remoteStands: 0, grassPads: 0 }), storage.id, 'accept'),
      'declined',
    )
    expect(declined.gaps).toContain('stand')
    expect(stored.visits).toHaveLength(0)

    const grass = createInboundState(1)
    const onGrass = eventOf(
      respond(grass, world({}, { remoteStands: 0 }), spawnOffer(grass, 'storage').id, 'accept'),
      'accepted',
    )
    expect(onGrass.pad).toBe('grass')
  })

  it('the bot accepts what it can host and refuses the rest', () => {
    const rich = world()
    const bare = world({}, {
      arff: false,
      stands: 0,
      remoteStands: 0,
      grassPads: 0,
      heliPads: 0,
      guardPads: 0,
      hotelRooms: 0,
      hangarBays: 0,
      fuelLitres: 0,
      ambulance: false,
      securityCorridor: false,
      catering: false,
      cleaning: false,
      gpu: false,
      customs: false,
    })
    const hosted = createInboundState(1)
    const divert = spawnOffer(hosted, 'tanker')
    expect(botChoice(divert, hosted, rich)).toBe('accept')
    expect(eventOf(respond(hosted, rich, divert.id, botChoice(divert, hosted, rich)), 'accepted').reward).toBe(
      TANKER_FEE,
    )

    const refused = createInboundState(1)
    const ask = spawnOffer(refused, 'tanker')
    expect(botChoice(ask, refused, bare)).toBe('refuse')
    expect(eventOf(respond(refused, bare, ask.id, 'refuse'), 'refused').fine).toBe(EMERGENCY_REFUSE_FINE)

    const walkIn = createInboundState(1)
    const ga = spawnOffer(walkIn, 'ga')
    expect(botChoice(ga, walkIn, bare)).toBe('refuse')
    expect(eventOf(respond(walkIn, bare, ga.id, 'refuse'), 'refused').fine).toBe(0)
  })

  it('charges storage every day it occupies a pad and frees the pad on departure', () => {
    const state = createInboundState(8)
    const field = world()
    const request = spawnOffer(state, 'storage')
    respond(state, field, request.id, 'accept')
    const visit = state.visits[0]
    expect(visit?.status).toBe('parked')
    tick(state, field, request.stayDays * SIM_DAY_SEC)
    expect(visit?.status).toBe('departed')
    expect(visit?.paidDays).toBe(request.stayDays)
    const paid = state.ledger
      .filter((row) => row.visitId === visit?.id)
      .reduce((sum, row) => sum + row.amount, 0)
    expect(paid).toBe(request.stayDays * GA_PARK_DAY_RATE)
    expect(state.held.remoteStands).toBe(0)
    expect(state.held.grassPads).toBe(0)
    assertPads(state, field)
  })

  it('opens one decision card at a time, and a bot still clears the day', () => {
    const quiet = createInboundState(4)
    tick(quiet, world({ fieldLevel: 8 }), SIM_DAY_SEC)
    expect(quiet.requests.filter((request) => request.status === 'pending').length).toBeLessThanOrEqual(1)
    expect(quiet.requests.some((request) => request.status === 'expired' || request.status === 'pending')).toBe(true)
    expect(quiet.requests.filter((request) => request.status === 'expired').length).toBeLessThanOrEqual(3)

    const bot = createInboundState(4)
    tick(bot, world({ fieldLevel: 8 }), SIM_DAY_SEC, botChoice)
    expect(bot.requests.filter((request) => request.status === 'queued' || request.status === 'pending')).toHaveLength(0)
  })

  it('rolls offers only — an ignored day parks nothing and does not touch the field', () => {
    const field = world({ fieldLevel: 6 })
    const before = structuredClone(field)
    const state = createInboundState(3)
    tick(state, field, SIM_DAY_SEC)
    expect(field).toEqual(before)
    expect(state.visits).toHaveLength(0)
    expect(state.burnedFuel).toBe(0)
    expect(state.held).toEqual({
      stands: 0,
      remoteStands: 0,
      grassPads: 0,
      heliPads: 0,
      guardPads: 0,
      hotelRooms: 0,
      hangarBays: 0,
    })
    expect(requestsOnDay(state, 0, true).length).toBeLessThanOrEqual(2)
    expect(requestsOnDay(state, 0, false).length).toBeGreaterThan(0)
  })

  it('keeps priority asks inside 0–2 per day, scaled by field level', () => {
    expect(rollEmergencyCount(1, () => 0)).toBe(2)
    expect(rollEmergencyCount(1, () => 0.99)).toBe(0)
    expect(rollEmergencyCount(1, () => 0.1)).toBe(1)
    const days = 80
    const low = createInboundState(11)
    const high = createInboundState(11)
    const storm = createInboundState(11)
    for (let day = 0; day < days; day++) {
      tick(low, world({ fieldLevel: 1 }), SIM_DAY_SEC)
      tick(high, world({ fieldLevel: 10 }), SIM_DAY_SEC)
      tick(storm, world({ fieldLevel: 8, weather: 'storm' }), SIM_DAY_SEC)
    }
    const mean = (state: InboundState) => {
      let sum = 0
      for (let day = 0; day < days; day++) {
        const n = requestsOnDay(state, day, true).length
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(2)
        sum += n
      }
      return sum / days
    }
    expect(mean(low)).toBeLessThan(mean(high))
    expect(mean(storm)).toBeLessThanOrEqual(2)
  })

  it('scales general traffic from 1–3 early to 6–10 late, and with fees', () => {
    expect(generalBand(1)).toEqual({ min: 1, max: 3 })
    expect(generalBand(10)).toEqual({ min: 6, max: 10 })
    expect(applyFeeElasticity(8, 1)).toBe(8)
    expect(applyFeeElasticity(8, 1.2)).toBe(8)
    expect(applyFeeElasticity(8, 0.5)).toBe(9)
    expect(applyFeeElasticity(8, 2)).toBe(5)

    const days = 40
    const early = createInboundState(21)
    const late = createInboundState(21)
    const cheap = createInboundState(21)
    const dear = createInboundState(21)
    for (let day = 0; day < days; day++) {
      tick(early, world({ fieldLevel: 1 }), SIM_DAY_SEC)
      tick(late, world({ fieldLevel: 10 }), SIM_DAY_SEC)
      tick(cheap, world({ fieldLevel: 10, feeMultiplier: 0.5 }), SIM_DAY_SEC)
      tick(dear, world({ fieldLevel: 10, feeMultiplier: 2 }), SIM_DAY_SEC)
    }
    const total = (state: InboundState) => {
      let sum = 0
      for (let day = 0; day < days; day++) sum += requestsOnDay(state, day, false).length
      return sum
    }
    for (let day = 0; day < days; day++) {
      const n = requestsOnDay(early, day, false).length
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(3)
      const lateN = requestsOnDay(late, day, false).length
      expect(lateN).toBeGreaterThanOrEqual(6)
      expect(lateN).toBeLessThanOrEqual(10)
    }
    expect(total(cheap)).toBeGreaterThan(total(late))
    expect(total(dear)).toBeLessThan(total(late))
  })

  it('does not offer one-shot military arrivals until the Guard agreement is signed', () => {
    const field = world({ fieldLevel: 8 })
    expect(priorityWeight('military', field, false)).toBe(0)
    expect(priorityWeight('military', field, true)).toBeGreaterThan(0)
    expect(priorityWeight('weather_divert', world({ weather: 'storm' }), false)).toBeGreaterThan(
      priorityWeight('weather_divert', world({ weather: 'clear' }), false),
    )
  })

  it('replays a seed exactly and round-trips through JSON', () => {
    const run = () => {
      const state = createInboundState(9)
      tick(state, world({ fieldLevel: 7, weather: 'fog' }), SIM_DAY_SEC * 4, botChoice)
      return state.requests.map((request) => [request.kind, request.reward, request.stayDays, request.status])
    }
    expect(run()).toEqual(run())
    const state = createInboundState(9)
    tick(state, world(), SIM_DAY_SEC)
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })

  it('stays free of stuck aircraft across 30 days of bot decisions', () => {
    const field = world({ fieldLevel: 8 }, {
      stands: 3,
      remoteStands: 1,
      grassPads: 1,
      heliPads: 1,
      guardPads: 1,
      hangarBays: 1,
      hotelRooms: 12,
    })
    const state = createInboundState(42)
    for (let day = 0; day < 30; day++) {
      tick(state, field, SIM_DAY_SEC, botChoice)
      assertPads(state, field)
    }
    expect(state.stats.accepted + state.stats.refused + state.stats.expired + state.stats.failed).toBeGreaterThan(0)
    expect(state.visits.some((visit) => visit.status === 'departed')).toBe(true)

    const empty = world({ fieldLevel: 4 }, {
      stands: 0,
      remoteStands: 0,
      grassPads: 0,
      heliPads: 0,
      guardPads: 0,
      hotelRooms: 0,
      hangarBays: 0,
      fuelLitres: 0,
      arff: false,
      ambulance: false,
      securityCorridor: false,
      catering: false,
      cleaning: false,
      gpu: false,
      customs: false,
      runwayMetres: 0,
    })
    const idle = createInboundState(42)
    for (let day = 0; day < 30; day++) tick(idle, empty, SIM_DAY_SEC, botChoice)
    expect(idle.visits).toHaveLength(0)
    expect(idle.burnedFuel).toBe(0)
    expect(idle.stats.accepted).toBe(0)
    assertPads(idle, empty)
  })
})

describe('military contracts', () => {
  it('sells the Guard agreement and the clearance licence once each', () => {
    const state = createInboundState(1)
    expect(offerMilitaryContract(state, 'training').ok).toBe(false)
    expect(signGuardAgreement(state)).toEqual({ ok: true, cost: MIL_AGREE_COST })
    expect(signGuardAgreement(state).ok).toBe(false)
    expect(state.ledger[0]?.amount).toBe(-MIL_AGREE_COST)
    expect(buyClearance(state)).toEqual({ ok: true, cost: CLEARANCE_LICENCE_COST })
    expect(buyClearance(state).ok).toBe(false)
    expect(state.ledger).toHaveLength(2)
  })

  it('follows the contract model: weekly lines, sign without capacity, early cancel', () => {
    const state = createInboundState(1)
    signGuardAgreement(state)
    const offered = offerMilitaryContract(state, 'training')
    expect(offered.ok).toBe(true)
    if (!offered.ok) return
    expect(weeklyFlights(offered.deal.contract).total).toBe(5)
    expect(daySorties(offered.deal.contract)).toBe(3)
    expect(nightSorties(offered.deal.contract)).toBe(2)
    expect(offered.deal.contract.status).toBe('offered')
    expect(offered.deal.contract.airlineId).toBe('guard')

    const signed = signMilitaryContract(state, offered.deal.contract.id)
    expect(signed.ok).toBe(true)
    expect(offered.deal.contract.status).toBe('active')
    expect(offered.deal.contract.seasons.length).toBe(2)

    const cancel = cancelMilitaryContract(state, offered.deal.contract.id)
    expect(cancel).toMatchObject({ ok: true, fee: MIL_EARLY_CANCEL_FEE, standingDelta: -10 })
    expect(offered.deal.contract.status).toBe('cancelled')
    expect(state.guardStanding).toBe(-10)
    expect(cancelMilitaryContract(state, offered.deal.contract.id).ok).toBe(false)
  })

  it('misses sorties without an apron or clearance, and flies night circuits only with the licence', () => {
    const state = createInboundState(2)
    signGuardAgreement(state)
    const offered = offerMilitaryContract(state, 'training')
    if (!offered.ok) throw new Error(offered.reason)
    expect(signMilitaryContract(state, offered.deal.contract.id).ok).toBe(true)

    const bare = world({}, { guardPads: 0 })
    const first = tick(state, bare, 7 * SIM_DAY_SEC).filter((item) => item.type === 'week_audit')
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ flown: 0, missed: 5, pay: 0, penalty: 5 * MISSED_SORTIE_PENALTY, noise: 0 })
    expect(state.held.guardPads).toBe(0)
    expect(state.visits).toHaveLength(0)

    const apron = world({}, { guardPads: 1 })
    const second = tick(state, apron, 7 * SIM_DAY_SEC).filter((item) => item.type === 'week_audit')
    expect(second[0]).toMatchObject({
      flown: 3,
      missed: 2,
      pay: 3 * MIL_LANDING + MIL_WEEKLY_RETAINER,
      penalty: 2 * MISSED_SORTIE_PENALTY,
      noise: 0,
      breach: false,
    })

    buyClearance(state)
    state.cityApproval = 1
    const third = tick(state, apron, 7 * SIM_DAY_SEC).filter((item) => item.type === 'week_audit')
    expect(third[0]).toMatchObject({
      flown: 5,
      missed: 0,
      pay: 5 * MIL_LANDING + MIL_WEEKLY_RETAINER,
      penalty: 0,
      noise: 6,
      approvalDelta: -8,
      breach: true,
    })
    expect(state.visits.filter((visit) => visit.kind === 'military')).toHaveLength(0)
    expect(state.held.guardPads).toBe(0)
  })

  it('moves a signed contract to expiring at the season boundary', () => {
    const state = createInboundState(3)
    signGuardAgreement(state)
    const offered = offerMilitaryContract(state, 'humanitarian')
    if (!offered.ok) throw new Error(offered.reason)
    const id = offered.deal.contract.id
    signMilitaryContract(state, id)
    tick(state, world(), 84 * SIM_DAY_SEC)
    expect(state.deals.find((deal) => deal.contract.id === id)?.contract.status).toBe('expiring')
  })
})
