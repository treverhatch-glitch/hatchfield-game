import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ALL_SERVICES, makeOffer } from '../contracts/index.ts'
import { line } from '../contracts/testkit.ts'
import { PremiumPanel } from '../ui/PremiumPanel.tsx'
import { PREMIUM_RULES } from './data.ts'
import {
  attachOptionalServices,
  buyFacility,
  createPremiumState,
  dailyUpkeep,
  hireOfficer,
  optionalPremiumServices,
  screenPassengers,
  setFeeEnabled,
  type Cabin,
  type PremiumState,
  type ScreeningPax,
} from './index.ts'

const pools = { security_officer: 4, terminal_staff: 2 }
const openGate = { fieldLevel: 8, hasCt: true, hours: 1 }

function wave(cabin: Cabin, count: number, airlineId = 'summit'): ScreeningPax[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${cabin}-${airlineId}-${index}`,
    cabin,
    airlineId,
  }))
}

function withLane(extra: Partial<PremiumState> = {}): PremiumState {
  const bought = buyFacility(createPremiumState(), 'fast_track_1', openGate)
  if (!bought.ok) throw new Error(bought.reason)
  return { ...bought.state, securityOfficers: 1, ...extra }
}

describe('premium screening', () => {
  it('sends at least 95% of premium passengers down a staffed lane, and no economy passenger', () => {
    const screened = screenPassengers(
      withLane(),
      [...wave('premium', 100), ...wave('economy', 100)],
      { security_officer: 1, terminal_staff: 0 },
      openGate,
    )
    const premium = screened.rows.filter((row) => row.cabin === 'premium')
    const onLane = premium.filter((row) => row.path === 'fast_track')
    expect(onLane.length / premium.length).toBeGreaterThanOrEqual(0.95)
    expect(screened.rows.filter((row) => row.cabin === 'economy' && row.path !== 'general')).toEqual([])

    const cabins = screenPassengers(
      withLane(),
      [...wave('business', 10), ...wave('first', 10), ...wave('economy', 10)],
      { security_officer: 1, terminal_staff: 0 },
      openGate,
    )
    expect(cabins.rows.filter((row) => row.cabin !== 'economy').every((row) => row.path === 'fast_track')).toBe(true)
    expect(cabins.rows.filter((row) => row.cabin === 'economy').every((row) => row.path === 'general')).toBe(true)
  })

  it('applies the general-queue penalty and caps Standing at -5 per airline per day', () => {
    const first = screenPassengers(createPremiumState(), wave('premium', 200), pools, openGate)
    const standing = first.rows.reduce((sum, row) => sum + row.standingDelta, 0)
    expect(standing).toBe(PREMIUM_RULES.standingCapPerDay)
    expect(standing).toBe(-5)
    expect(first.rows.every((row) => row.happinessDelta === -25)).toBe(true)
    expect(first.rows.every((row) => row.path === 'general')).toBe(true)

    const more = screenPassengers(first.state, wave('premium', 40, 'summit'), pools, openGate)
    expect(more.rows.reduce((sum, row) => sum + row.standingDelta, 0)).toBe(0)

    const other = screenPassengers(first.state, wave('business', 20, 'crown'), pools, openGate)
    expect(other.rows.reduce((sum, row) => sum + row.standingDelta, 0)).toBe(-1)

    const fresh = screenPassengers(first.state, wave('premium', 20), pools, { ...openGate, day: 2 })
    expect(fresh.rows.reduce((sum, row) => sum + row.standingDelta, 0)).toBe(-1)
  })

  it('uses the private room when it is built, otherwise escorts VIPs, otherwise a larger Standing hit', () => {
    const room = buyFacility(createPremiumState(), 'vip_room', openGate)
    if (!room.ok) throw new Error(room.reason)
    const privateRoom = screenPassengers(
      { ...room.state, securityOfficers: 2 },
      wave('vip', 3),
      { security_officer: 2, terminal_staff: 0 },
      openGate,
    )
    expect(privateRoom.rows.every((row) => row.path === 'vip_room')).toBe(true)
    expect(privateRoom.rows.every((row) => row.standingDelta === 0 && row.happinessDelta === 0)).toBe(true)

    const escorted = screenPassengers(withLane(), wave('vip', 2), { security_officer: 1, terminal_staff: 0 }, openGate)
    expect(escorted.rows.every((row) => row.path === 'fast_track' && row.escorted)).toBe(true)
    expect(escorted.rows.every((row) => row.standingDelta === 0)).toBe(true)

    const dumped = screenPassengers(createPremiumState(), wave('vip', 3), pools, openGate)
    expect(dumped.rows.every((row) => row.path === 'general')).toBe(true)
    expect(dumped.rows.reduce((sum, row) => sum + row.standingDelta, 0)).toBe(PREMIUM_RULES.vipMissStanding)
    expect(Math.abs(PREMIUM_RULES.vipMissStanding)).toBeGreaterThan(Math.abs(PREMIUM_RULES.standingPerBatch))
  })

  it('bills daily upkeep for an idle, unstaffed lane', () => {
    const bought = buyFacility(createPremiumState(), 'fast_track_1', openGate)
    if (!bought.ok) throw new Error(bought.reason)
    const idle = { ...bought.state, securityOfficers: 0 }
    expect(dailyUpkeep(idle)).toBe(600)
    const screened = screenPassengers(idle, wave('premium', 10), { security_officer: 0, terminal_staff: 0 }, openGate)
    expect(screened.rows.every((row) => row.path === 'general')).toBe(true)
    expect(dailyUpkeep(screened.state)).toBe(600)
    const withRoom = buyFacility(idle, 'vip_room', openGate)
    if (!withRoom.ok) throw new Error(withRoom.reason)
    expect(dailyUpkeep(withRoom.state)).toBe(600 + 1_500)
  })

  it('keeps unlocks, CT, staff, and the optional fee in the data table', () => {
    expect(buyFacility(createPremiumState(), 'premium_checkin', { fieldLevel: 2, hasCt: true }).ok).toBe(false)
    const desk = buyFacility(createPremiumState(), 'premium_checkin', { fieldLevel: 3, hasCt: false })
    expect(desk.ok && desk.cost).toBe(6_000)

    expect(buyFacility(createPremiumState(), 'fast_track_2', { fieldLevel: 6, hasCt: false }).ok).toBe(false)
    const ct = buyFacility(createPremiumState(), 'fast_track_2', { fieldLevel: 6, hasCt: true })
    expect(ct.ok && ct.upkeep).toBe(900)

    const lane3 = buyFacility(createPremiumState(), 'fast_track_3', { fieldLevel: 8, hasCt: true })
    const room = buyFacility(createPremiumState(), 'vip_room', { fieldLevel: 8, hasCt: false })
    expect(lane3.ok && lane3.cost).toBe(40_000)
    expect(room.ok && room.cost).toBe(55_000)

    const half = buyFacility({ ...createPremiumState(), securityOfficers: 1 }, 'fast_track_2', openGate)
    if (!half.ok) throw new Error(half.reason)
    const thin = screenPassengers(
      half.state,
      wave('premium', 101),
      { security_officer: 1, terminal_staff: 0 },
      openGate,
    )
    expect(thin.rows.filter((row) => row.path === 'fast_track')).toHaveLength(100)
    expect(thin.rows.filter((row) => row.path === 'general')).toHaveLength(1)

    const priced = setFeeEnabled(withLane(), true)
    const paid = screenPassengers(priced, wave('premium', 2), { security_officer: 1, terminal_staff: 1 }, openGate)
    expect(paid.rows.every((row) => row.fee === PREMIUM_RULES.fastTrackFee)).toBe(true)
    const free = screenPassengers(withLane(), wave('premium', 2), { security_officer: 1, terminal_staff: 0 }, openGate)
    expect(free.rows.every((row) => row.fee === 0)).toBe(true)
  })

  it('puts higher-service passengers on the premium desk when an agent is on the roster', () => {
    const desk = buyFacility(withLane(), 'premium_checkin', openGate)
    if (!desk.ok) throw new Error(desk.reason)
    const screened = screenPassengers(
      desk.state,
      [...wave('premium', 1), ...wave('economy', 1)],
      { security_officer: 1, terminal_staff: 1 },
      openGate,
    )
    const premium = screened.rows.find((row) => row.cabin === 'premium')!
    const economy = screened.rows.find((row) => row.cabin === 'economy')!
    expect(premium.checkinId).toBeTruthy()
    expect(premium.path).toBe('fast_track')
    expect(economy.checkinId).toBeNull()
    expect(economy.path).toBe('general')
  })

  it('gives the private room first claim on the shared officer pool', () => {
    let state = createPremiumState()
    const room = buyFacility(state, 'vip_room', openGate)
    if (!room.ok) throw new Error(room.reason)
    const lane = buyFacility(room.state, 'fast_track_1', openGate)
    if (!lane.ok) throw new Error(lane.reason)
    const firstHire = hireOfficer(lane.state)
    if (!firstHire.ok) throw new Error(firstHire.reason)
    const hired = hireOfficer(firstHire.state)
    if (!hired.ok) throw new Error(hired.reason)
    const screened = screenPassengers(
      hired.state,
      [...wave('vip', 1), ...wave('premium', 1)],
      { security_officer: hired.state.securityOfficers, terminal_staff: 0 },
      openGate,
    )
    expect(screened.rows.find((row) => row.cabin === 'vip')?.path).toBe('vip_room')
    expect(screened.rows.find((row) => row.cabin === 'premium')?.path).toBe('general')
  })

  it('offers fast-track and premium check-in only to tier 4–5 and luxury passenger airlines', () => {
    expect(optionalPremiumServices({ tier: 3, persona: 'business' })).toEqual([])
    expect(optionalPremiumServices({ tier: 4, persona: 'luxury' })).toEqual(['fast_track', 'premium_checkin'])
    expect(optionalPremiumServices({ tier: 5, persona: 'luxury' })).toEqual(['fast_track', 'premium_checkin'])
    expect(optionalPremiumServices({ tier: 2, persona: 'luxury' })).toEqual(['fast_track', 'premium_checkin'])
    expect(optionalPremiumServices({ tier: 5, persona: 'cargo_night', kind: 'cargo' })).toEqual([])
    expect(ALL_SERVICES).toEqual(expect.arrayContaining(['fast_track', 'premium_checkin']))

    const offer = makeOffer({
      id: 'lux',
      airlineId: 'summit',
      lines: [line('l', 'a320', 480)],
      services: attachOptionalServices(['fuel'], { tier: 4, persona: 'luxury' }, { fastTrack: true, premiumCheckin: true }),
    })
    expect(offer.services).toEqual(['fuel', 'fast_track', 'premium_checkin'])
    expect(attachOptionalServices(['fuel', 'fast_track'], { tier: 2, persona: 'budget' }, { fastTrack: true })).toEqual(['fuel'])
    expect(offer.status).toBe('offered')
  })

  it('renders as a side panel and does not mount a blocking dialog', () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPanel, {
        game: {
          fieldLevel: () => 4,
          hasCtScanners: () => false,
          deskStaff: 1,
          premium: withLane({ feeEnabled: false }),
          buyPremium: () => false,
          hirePremiumOfficer: () => false,
          setPremiumFee: () => {},
        },
      }),
    )
    expect(html).toContain('Premium check-in')
    expect(html).toContain('Fast-track lane I')
    expect(html).toContain('VIP private screening')
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('modal')
    expect(html.startsWith('<section')).toBe(true)
  })
})
