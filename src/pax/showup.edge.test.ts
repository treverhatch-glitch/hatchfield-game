import { describe, expect, it } from 'vitest'
import { createRng } from '../features/shared/rng'
import {
  checkInCloseAt,
  gameMinToSim,
  leadSecForTag,
  MAX_SPAWNS_PER_SEC,
  planShowUp,
  SHOWUP_LEAD_GAME_MIN,
  type ShowTag,
} from './showup'

const ALL_TAGS: readonly ShowTag[] = ['budget', 'family', 'business', 'premium']

describe('pax show-up edge & distribution tests', () => {
  it('generates valid release distributions without NaN, bounded within windows across multiple seeds', () => {
    const seeds = [42, 1337, 2025, 9999, 123456]

    for (const seed of seeds) {
      const rng = createRng(seed)

      for (let run = 0; run < 25; run++) {
        const std = rng.int(200, 1000)
        const intl = rng.next() > 0.5
        const outer = std - gameMinToSim(SHOWUP_LEAD_GAME_MIN)

        const offsetSec = rng.int(-50, 40)
        const now = outer + offsetSec

        const tagCount = rng.int(5, 40)
        const tags: ShowTag[] = []
        for (let i = 0; i < tagCount; i++) {
          tags.push(rng.pick(ALL_TAGS))
        }

        const releases = planShowUp({ std, now, tags, intl })

        expect(releases).toHaveLength(tagCount)

        let sum = 0
        const minAllowed = Math.max(now, outer)

        for (let i = 0; i < releases.length; i++) {
          const t = releases[i]

          // 1. No NaN or Infinity
          expect(Number.isNaN(t)).toBe(false)
          expect(Number.isFinite(t)).toBe(true)

          // 2. No early releases before lower bound (considering second bucket flooring)
          expect(t).toBeGreaterThanOrEqual(minAllowed - 1.0)

          sum += t
        }

        const mean = sum / releases.length

        // 3. Mean lies inside the configured window
        const windowStart = minAllowed - 1.0
        const windowEnd = Math.max(now + (tagCount / 3) + 2, std)
        expect(mean).toBeGreaterThanOrEqual(windowStart)
        expect(mean).toBeLessThanOrEqual(windowEnd + 1e-6)
      }
    }
  })

  it('ensures show-up distributions strictly respect tag lead bounds (leisure before business)', () => {
    const std = 500
    const now = 0
    const tags: ShowTag[] = ['budget', 'family', 'business', 'premium']

    const releases = planShowUp({ std, now, tags, intl: false })
    expect(releases).toHaveLength(4)

    for (const t of releases) {
      expect(Number.isNaN(t)).toBe(false)
    }

    const leisureOpen = std - gameMinToSim(180)
    const timedOpen = std - gameMinToSim(120)

    // Rate-limiting places on integer second boundaries (leisureOpen - 1 <= releases[0])
    expect(releases[0]).toBeGreaterThanOrEqual(leisureOpen - 1.0)
    expect(releases[0]).toBeLessThan(timedOpen)
  })

  it('handles empty tag lists gracefully without NaN', () => {
    const releases = planShowUp({ std: 100, now: 0, tags: [], intl: false })
    expect(releases).toEqual([])
  })

  it('handles single-passenger flights without NaN and places inside bounds', () => {
    for (const tag of ALL_TAGS) {
      const std = 200
      const now = 10
      const releases = planShowUp({ std, now, tags: [tag], intl: false })
      expect(releases).toHaveLength(1)
      const t = releases[0]
      expect(Number.isNaN(t)).toBe(false)
      const open = std - leadSecForTag(tag)
      expect(t).toBeGreaterThanOrEqual(open - 1.0)
      expect(t).toBeLessThanOrEqual(checkInCloseAt(std, false) + 1e-6)
    }
  })

  it('respects pre-existing taken slots when rate-limiting seeded batches', () => {
    const rng = createRng(888)
    const std = 500
    const now = 100

    const batch1: ShowTag[] = Array.from({ length: 15 }, () => rng.pick(ALL_TAGS))
    const firstReleases = planShowUp({ std, now, tags: batch1, intl: true })

    const batch2: ShowTag[] = Array.from({ length: 15 }, () => rng.pick(ALL_TAGS))
    const secondReleases = planShowUp({
      std,
      now,
      tags: batch2,
      intl: true,
      taken: firstReleases,
    })

    const allReleases = [...firstReleases, ...secondReleases]
    for (const t of allReleases) {
      expect(Number.isNaN(t)).toBe(false)
    }

    // Per-second density check: the entrance cap, shared with the first batch.
    const secondCounts = new Map<number, number>()
    for (const t of allReleases) {
      const sec = Math.floor(t + 1e-6)
      secondCounts.set(sec, (secondCounts.get(sec) ?? 0) + 1)
    }

    for (const count of secondCounts.values()) {
      expect(count).toBeLessThanOrEqual(MAX_SPAWNS_PER_SEC)
    }
  })
})
