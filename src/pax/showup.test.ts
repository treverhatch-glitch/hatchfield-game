import { describe, expect, it } from 'vitest'
import {
  CHECKIN_CLOSE_DOM_GAME_MIN,
  CHECKIN_CLOSE_INTL_GAME_MIN,
  LEISURE_LEAD_GAME_MIN,
  MAX_SPAWNS_PER_SEC,
  PLANNED_TURN_SEC,
  SHOWUP_LEAD_GAME_MIN,
  TIMED_LEAD_GAME_MIN,
  checkInCloseAt,
  gameMinToSim,
  isIntlKind,
  planShowUp,
  type ShowTag,
} from './showup.ts'

function perSecond(times: number[]): number {
  const buckets = new Map<number, number>()
  for (const t of times) {
    const s = Math.floor(t + 1e-6)
    buckets.set(s, (buckets.get(s) ?? 0) + 1)
  }
  let max = 0
  for (const n of buckets.values()) max = Math.max(max, n)
  return max
}

describe('planShowUp', () => {
  const tags: ShowTag[] = [
    'budget',
    'family',
    'budget',
    'family',
    'business',
    'premium',
    'budget',
    'family',
  ]

  it('opens leisure before business and stays inside the outer lead', () => {
    const std = 100
    const times = planShowUp({ std, now: 0, tags, intl: false })
    expect(times).toHaveLength(tags.length)
    const leisureOpen = std - gameMinToSim(LEISURE_LEAD_GAME_MIN)
    const timedOpen = std - gameMinToSim(TIMED_LEAD_GAME_MIN)
    const outer = std - gameMinToSim(SHOWUP_LEAD_GAME_MIN)
    expect(Math.min(...times)).toBeGreaterThanOrEqual(outer - 1e-6)
    expect(Math.min(...times)).toBeGreaterThanOrEqual(leisureOpen - 1)
    expect(Math.min(...times)).toBeLessThanOrEqual(leisureOpen + 0.01)
    expect(Math.min(...times)).toBeLessThan(timedOpen)
    const close = checkInCloseAt(std, false)
    expect(Math.max(...times)).toBeLessThanOrEqual(close - 1 + 1e-6)
    expect(perSecond(times)).toBeLessThanOrEqual(MAX_SPAWNS_PER_SEC)
  })

  it('closes international check-in earlier than domestic', () => {
    expect(isIntlKind('widebody')).toBe(true)
    expect(isIntlKind('narrowbody')).toBe(false)
    const std = 80
    const dom = planShowUp({ std, now: 0, tags, intl: false })
    const intl = planShowUp({ std, now: 0, tags, intl: true })
    expect(checkInCloseAt(std, true)).toBeCloseTo(std - gameMinToSim(CHECKIN_CLOSE_INTL_GAME_MIN), 5)
    expect(checkInCloseAt(std, false)).toBeCloseTo(std - gameMinToSim(CHECKIN_CLOSE_DOM_GAME_MIN), 5)
    expect(Math.max(...intl)).toBeLessThan(Math.max(...dom))
  })

  it('shares an entrance with releases that are already promised', () => {
    const std = 100
    const first = planShowUp({ std, now: 40, tags: ['budget', 'budget', 'budget'], intl: false })
    const second = planShowUp({
      std,
      now: 40,
      tags: ['family', 'family', 'family', 'family'],
      intl: false,
      taken: first,
    })
    expect(perSecond([...first, ...second])).toBeLessThanOrEqual(MAX_SPAWNS_PER_SEC)
  })

  it('drips from now once check-in has already closed', () => {
    const std = 10
    const now = checkInCloseAt(std, false) + 1
    const times = planShowUp({ std, now, tags: ['budget', 'family', 'business', 'premium'], intl: false })
    expect(Math.min(...times)).toBeGreaterThanOrEqual(now - 1e-6)
    expect(perSecond(times)).toBeLessThanOrEqual(MAX_SPAWNS_PER_SEC)
    expect(Math.max(...times) - Math.min(...times)).toBeGreaterThan(0.3)
  })

  it('snaps stamped leads onto the entrance cap without dumping the wave', () => {
    const std = 100
    const desired = [72, 88, 88, 88, 88, 94, 61, 80]
    const times = planShowUp({ std, now: 0, tags, intl: false, desired })
    expect(times).toHaveLength(desired.length)
    const close = checkInCloseAt(std, false)
    expect(Math.max(...times)).toBeLessThanOrEqual(close - 1 + 1e-6)
    expect(Math.max(...times) - Math.min(...times)).toBeGreaterThan(10)
    expect(perSecond(times)).toBeLessThanOrEqual(MAX_SPAWNS_PER_SEC)
    const outer = std - gameMinToSim(SHOWUP_LEAD_GAME_MIN)
    expect(Math.min(...times)).toBeGreaterThanOrEqual(outer - 1e-6)
    expect(Math.min(...times)).toBeLessThan(80)
  })

  it('puts the first body before landing when STD is approach plus the planned turn', () => {
    const eta = 50
    const std = eta + PLANNED_TURN_SEC
    const times = planShowUp({
      std,
      now: 0,
      tags: ['family', 'budget', 'business'],
      intl: false,
    })
    expect(Math.min(...times)).toBeLessThan(eta)
  })
})
