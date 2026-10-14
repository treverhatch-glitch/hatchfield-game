import { describe, expect, it } from 'vitest'
import { WEATHER_EVENTS, pickWeatherEvent, type Season } from './events_weather'

/** Mulberry32 seeded pseudo-random number generator for deterministic test runs. */
function createSeededRng(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('WEATHER_EVENTS table', () => {
  it('contains exactly 10 weather events with unique ids', () => {
    expect(WEATHER_EVENTS.length).toBe(10)
    const ids = WEATHER_EVENTS.map((event) => event.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(10)
  })

  it('contains required 10 weather events', () => {
    const ids = WEATHER_EVENTS.map((event) => event.id)
    expect(ids).toContain('fog')
    expect(ids).toContain('freezing_fog')
    expect(ids).toContain('snowstorm')
    expect(ids).toContain('thunderstorm')
    expect(ids).toContain('heatwave')
    expect(ids).toContain('crosswind')
    expect(ids).toContain('volcanic_ash_advisory')
    expect(ids).toContain('hail')
    expect(ids).toContain('typhoon_hurricane_watch')
    expect(ids).toContain('dust_storm')
  })

  it('has multipliers in 0..1.5 for all events', () => {
    for (const event of WEATHER_EVENTS) {
      expect(event.effects.runwayRateMult).toBeGreaterThanOrEqual(0)
      expect(event.effects.runwayRateMult).toBeLessThanOrEqual(1.5)

      expect(event.effects.groundOpsMult).toBeGreaterThanOrEqual(0)
      expect(event.effects.groundOpsMult).toBeLessThanOrEqual(1.5)

      expect(event.effects.cancelChance).toBeGreaterThanOrEqual(0)
      expect(event.effects.cancelChance).toBeLessThanOrEqual(1.5)
    }
  })

  it('contains no NaN values in any event attributes', () => {
    const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']
    for (const event of WEATHER_EVENTS) {
      expect(Number.isNaN(event.minFL)).toBe(false)
      expect(Number.isNaN(event.durationHours[0])).toBe(false)
      expect(Number.isNaN(event.durationHours[1])).toBe(false)
      expect(Number.isNaN(event.effects.runwayRateMult)).toBe(false)
      expect(Number.isNaN(event.effects.groundOpsMult)).toBe(false)
      expect(Number.isNaN(event.effects.paxHappinessDelta)).toBe(false)
      expect(Number.isNaN(event.effects.cancelChance)).toBe(false)

      for (const season of seasons) {
        expect(Number.isNaN(event.weightBySeason[season])).toBe(false)
        expect(event.weightBySeason[season]).toBeGreaterThanOrEqual(0)
      }

      expect(typeof event.id).toBe('string')
      expect(typeof event.name).toBe('string')
      expect(typeof event.blurb).toBe('string')
      expect(typeof event.scalingNote).toBe('string')
      expect(event.scalingNote.length).toBeGreaterThan(0)
    }
  })
})

describe('pickWeatherEvent', () => {
  it('respects minFL filter', () => {
    const rng = createSeededRng(12345)
    // At FL1, only fog has minFL <= 1
    for (let i = 0; i < 50; i++) {
      const picked = pickWeatherEvent(1, 'autumn', rng)
      expect(picked).not.toBeNull()
      expect(picked?.minFL).toBeLessThanOrEqual(1)
      expect(picked?.id).toBe('fog')
    }

    // At FL10, higher minFL events can be picked
    const pickedFL10 = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const event = pickWeatherEvent(10, 'winter', rng)
      if (event) {
        pickedFL10.add(event.id)
      }
    }
    expect(pickedFL10.size).toBeGreaterThan(1)
  })

  it('respects season weights', () => {
    const rng = createSeededRng(54321)

    // In summer at FL10, snowstorm and freezing_fog have weight 0, so should never be picked
    for (let i = 0; i < 200; i++) {
      const event = pickWeatherEvent(10, 'summer', rng)
      expect(event).not.toBeNull()
      expect(event?.id).not.toBe('snowstorm')
      expect(event?.id).not.toBe('freezing_fog')
    }

    // In winter at FL10, heatwave has weight 0
    for (let i = 0; i < 200; i++) {
      const event = pickWeatherEvent(10, 'winter', rng)
      expect(event).not.toBeNull()
      expect(event?.id).not.toBe('heatwave')
    }
  })

  it('produces expected distribution with seeded RNG', () => {
    const rng = createSeededRng(42)
    const counts: Record<string, number> = {}

    for (let i = 0; i < 1000; i++) {
      const event = pickWeatherEvent(10, 'summer', rng)
      if (event) {
        counts[event.id] = (counts[event.id] ?? 0) + 1
      }
    }

    // Heatwave and Thunderstorm have high weight in summer (65 and 60)
    expect(counts['heatwave']).toBeGreaterThan(150)
    expect(counts['thunderstorm']).toBeGreaterThan(150)
    // Snowstorm and freezing_fog have 0 weight in summer
    expect(counts['snowstorm']).toBeUndefined()
    expect(counts['freezing_fog']).toBeUndefined()
  })

  it('returns null when no events match minFL or total weight is 0', () => {
    const rng = createSeededRng(1)
    // FL 0 has no events with minFL <= 0
    const event = pickWeatherEvent(0, 'spring', rng)
    expect(event).toBeNull()
  })

  it('returns object without any NaN values', () => {
    const rng = createSeededRng(99)
    const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']

    for (const season of seasons) {
      for (let fl = 1; fl <= 10; fl++) {
        const event = pickWeatherEvent(fl, season, rng)
        if (event) {
          expect(Number.isNaN(event.effects.runwayRateMult)).toBe(false)
          expect(Number.isNaN(event.effects.groundOpsMult)).toBe(false)
          expect(Number.isNaN(event.effects.paxHappinessDelta)).toBe(false)
          expect(Number.isNaN(event.effects.cancelChance)).toBe(false)
          expect(Number.isNaN(event.minFL)).toBe(false)
        }
      }
    }
  })
})
