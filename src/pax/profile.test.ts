import { describe, expect, it } from 'vitest'
import { createPaxShowUpAdapter, stampDeparture } from './adapter.ts'
import { PAX_SEGMENT_CONFIG } from './config.ts'
import { moodSpendHook } from './hooks.ts'
import { samplePassengers, walletTagFor } from './profile.ts'
import { createPaxRng } from './rng.ts'
import { loungeLoverShare, segmentShares } from './segments.ts'
import { SHOWUP_LEAD_GAME_MIN, GAME_MINUTES_PER_SIM_SECOND } from './showup.ts'
import { leadWindow, sampleLeadMin } from './timing.ts'
import type { PaxSegment, ShowUpFacts } from './types.ts'

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function sd(xs: number[]): number {
  const m = mean(xs)
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
  return Math.sqrt(v)
}

function drawLeads(segment: PaxSegment, seed: number, n: number, intl = false): number[] {
  const rng = createPaxRng(seed)
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(sampleLeadMin(segment, rng, intl))
  return out
}

function shareOf(segment: PaxSegment, facts: ShowUpFacts, seed = 7, n = 2000): number {
  const wave = samplePassengers(n, seed, facts)
  return wave.filter((p) => p.segment === segment).length / wave.length
}

describe('show-up distributions', () => {
  it('puts road warriors late and lounge lovers early, on both clocks', () => {
    for (const intl of [false, true]) {
      const road = leadWindow('road_warrior', intl)
      const normal = leadWindow('normal', intl)
      const lounge = leadWindow('lounge_lover', intl)
      expect(road.meanLeadMin).toBeLessThan(normal.meanLeadMin)
      expect(normal.meanLeadMin).toBeLessThan(lounge.meanLeadMin)
      expect(road.maxLeadMin).toBeLessThan(lounge.minLeadMin)
      expect(lounge.maxLeadMin).toBeLessThanOrEqual(SHOWUP_LEAD_GAME_MIN)
      expect(road.minLeadMin).toBeGreaterThan(0)
    }
  })

  it('shifts an international bank earlier without passing the outer lead', () => {
    for (const segment of ['road_warrior', 'lounge_lover', 'normal'] as const) {
      const domestic = leadWindow(segment, false)
      const intl = leadWindow(segment, true)
      expect(intl.meanLeadMin).toBeGreaterThan(domestic.meanLeadMin)
      expect(intl.maxLeadMin).toBeLessThanOrEqual(SHOWUP_LEAD_GAME_MIN)
    }
  })

  it('draws a truncated normal around each window', () => {
    const n = 800
    for (const segment of ['road_warrior', 'normal', 'lounge_lover'] as const) {
      const window = leadWindow(segment, false)
      const leads = drawLeads(segment, 42, n, false)
      expect(leads.every((t) => t >= window.minLeadMin && t <= window.maxLeadMin)).toBe(true)
      expect(Math.abs(mean(leads) - window.meanLeadMin)).toBeLessThan(4)
      const spread = sd(leads)
      expect(spread).toBeGreaterThan(window.sdMin * 0.7)
      expect(spread).toBeLessThan(window.sdMin * 1.2)
    }
  })

  it('keeps every lounge lover ahead of every road warrior', () => {
    const wave = samplePassengers(400, 11, { loungeQuality: 0.5, fastTrackAvailable: true })
    const road = wave.filter((p) => p.segment === 'road_warrior').map((p) => p.leadGameMin)
    const lounge = wave.filter((p) => p.segment === 'lounge_lover').map((p) => p.leadGameMin)
    expect(road.length).toBeGreaterThan(20)
    expect(lounge.length).toBeGreaterThan(20)
    expect(Math.max(...road)).toBeLessThan(Math.min(...lounge))
    const std = 500
    const roadRelease = wave
      .filter((p) => p.segment === 'road_warrior')
      .map((p) => stampDeparture(p, std).releaseAt ?? Number.NaN)
    const loungeRelease = wave
      .filter((p) => p.segment === 'lounge_lover')
      .map((p) => stampDeparture(p, std).releaseAt ?? Number.NaN)
    expect(Math.max(...loungeRelease)).toBeLessThan(Math.min(...roadRelease))
  })

  it('repeats a wave from the same seed and uses the hall clock', () => {
    const facts = { loungeQuality: 0.4, fastTrackAvailable: true, intl: false, businessMix: 0.2 }
    const a = samplePassengers(25, 99, facts)
    const b = samplePassengers(25, 99, facts)
    expect(a).toEqual(b)
    expect(samplePassengers(25, 100, facts)).not.toEqual(a)
    for (const p of a) {
      expect(p.leadSimSec * GAME_MINUTES_PER_SIM_SECOND).toBeCloseTo(p.leadGameMin, 8)
      expect(p.walletTag).toBe(walletTagFor(p.segment))
    }
    const adapter = createPaxShowUpAdapter(99, facts)
    expect(adapter.sample(25)).toEqual(a)
  })
})

describe('segment split', () => {
  it('raises the lounge-lover share as lounge quality improves', () => {
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const quality = i / 20
      const share = segmentShares({ loungeQuality: quality }).loungeLover
      expect(share).toBeGreaterThan(prev)
      expect(loungeLoverShare(quality)).toBe(share)
      prev = share
    }
    const bare = segmentShares({ loungeQuality: 0 })
    const flagship = segmentShares({ loungeQuality: 1 })
    expect(bare.loungeLover).toBe(PAX_SEGMENT_CONFIG.baseLoungeLover)
    expect(flagship.loungeLover).toBe(PAX_SEGMENT_CONFIG.baseLoungeLover + PAX_SEGMENT_CONFIG.loungeQualityGain)
    expect(flagship.roadWarrior).toBe(bare.roadWarrior)
    expect(flagship.normal).toBeLessThan(bare.normal)
    expect(bare.roadWarrior + bare.loungeLover + bare.normal).toBeCloseTo(1, 8)
    expect(flagship.roadWarrior + flagship.loungeLover + flagship.normal).toBeCloseTo(1, 8)
  })

  it('shows the same shift in a seeded wave', () => {
    const low = shareOf('lounge_lover', { loungeQuality: 0, fastTrackAvailable: false })
    const high = shareOf('lounge_lover', { loungeQuality: 1, fastTrackAvailable: false })
    expect(high).toBeGreaterThan(low + 0.1)
  })

  it('raises road warriors with a business-heavy bank and leaves the lounge share alone', () => {
    const leisure = segmentShares({ loungeQuality: 0.4, businessMix: 0 })
    const business = segmentShares({ loungeQuality: 0.4, businessMix: 1 })
    expect(business.roadWarrior).toBeGreaterThan(leisure.roadWarrior)
    expect(business.loungeLover).toBeCloseTo(leisure.loungeLover, 8)
    expect(business.normal).toBeLessThan(leisure.normal)
  })

  it('holds a normal residual when both levers are pegged past the floor', () => {
    const shares = segmentShares(
      { loungeQuality: 1, businessMix: 1 },
      {
        baseRoadWarrior: 0.9,
        baseLoungeLover: 0.9,
        loungeQualityGain: 5,
        businessMixGain: 5,
        minNormal: 0.2,
      },
    )
    expect(shares.normal).toBeGreaterThanOrEqual(0.2 - 1e-9)
    expect(shares.roadWarrior + shares.loungeLover + shares.normal).toBeCloseTo(1, 8)
    expect(shares.roadWarrior).toBeGreaterThan(0)
    expect(shares.loungeLover).toBeGreaterThan(0)
  })
})

describe('mood and spend hooks', () => {
  it('sends road warriors to fast-track when a lane is open', () => {
    const open = moodSpendHook('road_warrior', { fastTrackAvailable: true, loungeQuality: 0.8 })
    const shut = moodSpendHook('road_warrior', { fastTrackAvailable: false, loungeQuality: 0.8 })
    expect(open.screening).toBe('fast_track')
    expect(open.amenity).toBe('cafe')
    expect(shut.screening).toBe('standard')
    expect(open.mood.onStandardQueue).toBeLessThan(shut.mood.onStandardQueue)
    expect(open.mood.onFastTrack).toBeGreaterThan(0)
    expect(open.spend.amenity).toBeGreaterThan(0)
    expect(open.spend.lounge).toBe(0)

    const wave = samplePassengers(80, 5, { loungeQuality: 0.2, fastTrackAvailable: true, businessMix: 1 })
    const warriors = wave.filter((p) => p.segment === 'road_warrior')
    expect(warriors.length).toBeGreaterThan(0)
    for (const p of warriors) {
      expect(p.screening).toBe('fast_track')
      expect(stampDeparture(p, 80).preferFastTrack).toBe(true)
      expect(p.walletTag).toBe('business')
    }
    for (const p of wave.filter((p) => p.segment !== 'road_warrior')) {
      expect(p.screening).toBe('standard')
      expect(stampDeparture(p, 80).preferFastTrack).toBe(false)
    }
  })

  it('lets lounge lovers spend more in a better lounge', () => {
    const thin = moodSpendHook('lounge_lover', { loungeQuality: 0.1, fastTrackAvailable: true })
    const rich = moodSpendHook('lounge_lover', { loungeQuality: 0.9, fastTrackAvailable: true })
    expect(thin.amenity).toBe('lounge')
    expect(thin.screening).toBe('standard')
    expect(rich.spend.lounge).toBeGreaterThan(thin.spend.lounge)
    expect(rich.spend.amenity).toBeGreaterThan(thin.spend.amenity)
    expect(rich.willingness.lounge).toBeGreaterThan(thin.willingness.lounge)
    expect(rich.mood.onLoungeVisit).toBeGreaterThan(thin.mood.onLoungeVisit)
    expect(rich.mood.onLoungeMiss).toBeLessThan(0)
    expect(walletTagFor('lounge_lover')).toBe('premium')
    expect(moodSpendHook('normal', { loungeQuality: 1 }).amenity).toBe('none')
    expect(moodSpendHook('normal', { loungeQuality: 1 }).spend).toEqual({ lounge: 0, amenity: 0 })
  })
})

describe('NaN safety', () => {
  const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -4, 8, Number.MAX_VALUE]

  it('collapses bad facts to finite shares that still sum to 1', () => {
    for (const q of bad) {
      const shares = segmentShares({ loungeQuality: q, businessMix: q })
      expect(Number.isFinite(shares.roadWarrior)).toBe(true)
      expect(Number.isFinite(shares.loungeLover)).toBe(true)
      expect(Number.isFinite(shares.normal)).toBe(true)
      expect(shares.roadWarrior).toBeGreaterThanOrEqual(0)
      expect(shares.loungeLover).toBeGreaterThanOrEqual(0)
      expect(shares.normal).toBeGreaterThanOrEqual(0)
      expect(shares.roadWarrior + shares.loungeLover + shares.normal).toBeCloseTo(1, 8)
    }
    expect(segmentShares({ loungeQuality: Number.NaN })).toEqual(segmentShares({ loungeQuality: 0 }))
    expect(segmentShares({ loungeQuality: Number.NEGATIVE_INFINITY })).toEqual(segmentShares({ loungeQuality: 0 }))
    expect(segmentShares({ loungeQuality: Number.POSITIVE_INFINITY }).loungeLover).toBe(
      segmentShares({ loungeQuality: 1 }).loungeLover,
    )
    expect(segmentShares()).toEqual(segmentShares({}))
  })

  it('draws a finite wave from a poisoned seed and poisoned facts', () => {
    expect(samplePassengers(Number.NaN, 1, { loungeQuality: 0 })).toEqual([])
    expect(samplePassengers(-3, 1, { loungeQuality: 0 })).toEqual([])
    expect(samplePassengers(0, 1, { loungeQuality: 0 })).toEqual([])

    const wave = samplePassengers(6, Number.NaN, {
      loungeQuality: Number.NaN,
      businessMix: Number.POSITIVE_INFINITY,
      fastTrackAvailable: true,
      intl: false,
    })
    expect(wave).toHaveLength(6)
    for (const p of wave) {
      expect(Number.isFinite(p.leadGameMin)).toBe(true)
      expect(Number.isFinite(p.leadSimSec)).toBe(true)
      expect(Number.isFinite(p.spend.lounge)).toBe(true)
      expect(Number.isFinite(p.spend.amenity)).toBe(true)
      expect(Number.isFinite(p.willingness.lounge)).toBe(true)
      expect(Number.isFinite(p.willingness.amenity)).toBe(true)
      expect(p.willingness.lounge).toBeGreaterThanOrEqual(0)
      expect(p.willingness.lounge).toBeLessThanOrEqual(1)
      for (const delta of Object.values(p.mood)) expect(Number.isFinite(delta)).toBe(true)
      const stamp = stampDeparture(p, Number.NaN)
      expect(stamp.releaseAt).toBeNull()
      expect(Number.isFinite(stamp.leadGameMin)).toBe(true)
    }

    const poisoned = segmentShares(
      { loungeQuality: Number.NaN, businessMix: Number.NaN },
      {
        baseRoadWarrior: Number.NaN,
        baseLoungeLover: Number.NaN,
        loungeQualityGain: Number.NaN,
        businessMixGain: Number.NaN,
        minNormal: Number.NaN,
      },
    )
    expect(poisoned).toEqual(segmentShares({}))
  })

  it('updates the adapter mix when the lounge improves', () => {
    const adapter = createPaxShowUpAdapter(3, { loungeQuality: 0.1, fastTrackAvailable: false })
    const before = adapter.shares().loungeLover
    adapter.setFacts({ loungeQuality: 0.9, fastTrackAvailable: true })
    expect(adapter.shares().loungeLover).toBeGreaterThan(before)
    const one = adapter.sampleOne()
    expect(Number.isFinite(one.leadGameMin)).toBe(true)
    const stamped = stampDeparture(one, 120)
    expect(stamped.releaseAt).toBeCloseTo(120 - one.leadSimSec, 8)
  })
})
