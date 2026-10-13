import { describe, expect, it } from 'vitest'
import { SUB_SCORE_WEIGHTS } from './data.ts'
import { starRating } from './stars.ts'

describe('ratings - stars', () => {
  it('data exports sub score weights summing to 1.0', () => {
    const keys = [
      'queues',
      'cleanliness',
      'shops',
      'on-time',
      'bags',
      'transfers',
      'accessibility',
      'comfort',
    ]
    const sum = keys.reduce((acc, k) => acc + (SUB_SCORE_WEIGHTS[k] ?? 0), 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('starRating gives 5 stars for perfect scores', () => {
    const perfect = {
      queues: 1,
      cleanliness: 1,
      shops: 1,
      'on-time': 1,
      bags: 1,
      transfers: 1,
      accessibility: 1,
      comfort: 1,
    }
    const res = starRating(perfect)
    expect(res.score).toBe(1)
    expect(res.stars).toBe(5)
  })

  it('starRating gives 1 star for zero scores', () => {
    const zero = {
      queues: 0,
      cleanliness: 0,
      shops: 0,
      'on-time': 0,
      bags: 0,
      transfers: 0,
      accessibility: 0,
      comfort: 0,
    }
    const res = starRating(zero)
    expect(res.score).toBe(0)
    expect(res.stars).toBe(1)
  })

  it('starRating rounds stars to nearest 0.5', () => {
    // Score 0.5 maps to 1 + 4(0.5) = 3.0 stars
    const mid = starRating({
      queues: 0.5,
      cleanliness: 0.5,
      shops: 0.5,
      'on-time': 0.5,
      bags: 0.5,
      transfers: 0.5,
      accessibility: 0.5,
      comfort: 0.5,
    })
    expect(mid.score).toBe(0.5)
    expect(mid.stars).toBe(3.0)

    // Score 0.25 maps to 1 + 4(0.25) = 2.0 stars
    const quarter = starRating({
      queues: 0.25,
      cleanliness: 0.25,
      shops: 0.25,
      'on-time': 0.25,
      bags: 0.25,
      transfers: 0.25,
      accessibility: 0.25,
      comfort: 0.25,
    })
    expect(quarter.stars).toBe(2.0)

    // Score 0.125 maps to 1 + 4(0.125) = 1.5 stars
    const low = starRating({
      queues: 0.125,
      cleanliness: 0.125,
      shops: 0.125,
      'on-time': 0.125,
      bags: 0.125,
      transfers: 0.125,
      accessibility: 0.125,
      comfort: 0.125,
    })
    expect(low.stars).toBe(1.5)
  })

  it('starRating identifies the 2 weakest sub-scores', () => {
    const scores = {
      queues: 0.9,
      cleanliness: 0.1, // weakest #1
      shops: 0.8,
      'on-time': 0.9,
      bags: 0.8,
      transfers: 0.7,
      accessibility: 0.2, // weakest #2
      comfort: 0.8,
    }

    const res = starRating(scores)
    expect(res.weakestKeys).toEqual(['cleanliness', 'accessibility'])
    expect(res.weakest[0]).toEqual({ key: 'cleanliness', score: 0.1 })
    expect(res.weakest[1]).toEqual({ key: 'accessibility', score: 0.2 })
  })

  it('starRating supports onTime camelCase key alias', () => {
    const scores = {
      queues: 1,
      cleanliness: 1,
      shops: 1,
      onTime: 1, // camelCase variant
      bags: 1,
      transfers: 1,
      accessibility: 1,
      comfort: 1,
    }

    const res = starRating(scores)
    expect(res.score).toBe(1)
    expect(res.stars).toBe(5)
  })

  it('starRating handles null, undefined, negative, and NaN inputs safely', () => {
    const resNull = starRating(null)
    expect(resNull.score).toBe(0)
    expect(resNull.stars).toBe(1)
    expect(Number.isNaN(resNull.stars)).toBe(false)
    expect(resNull.weakest.length).toBe(2)

    const resBad = starRating({
      queues: -1,
      cleanliness: NaN,
      shops: Infinity, // clamped to 1
      'on-time': 0.5,
    })

    expect(Number.isNaN(resBad.score)).toBe(false)
    expect(Number.isNaN(resBad.stars)).toBe(false)
    expect(resBad.stars).toBeGreaterThanOrEqual(1)
    expect(resBad.stars).toBeLessThanOrEqual(5)
  })
})
