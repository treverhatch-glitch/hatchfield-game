import { describe, expect, it } from 'vitest'
import { DEFAULT_DEMAND_CALENDAR, demandAtDay } from '../economy/seasons'
import { SAVE_KEY } from '../game/types'
import { Game } from '../game/sim'
import {
  accrueChallenges,
  challengeCards,
  demandCalendar,
  DESERT_HEAT,
  engineDerate,
  environmentBinding,
  feedWinterOps,
  fieldDraw,
  loadedWinterOps,
  MAP_LIST,
  mapById,
  parseMapId,
  passengerFactor,
  rollMapWeather,
  weatherTitle,
  winterForecast,
} from './index'

describe('map calendars', () => {
  it('keeps the temperate year on the shared economy calendar', () => {
    expect(demandCalendar('temperate')).toBe(DEFAULT_DEMAND_CALENDAR)
    const summer = demandAtDay(demandCalendar('temperate'), 130)
    expect(summer.seasonId).toBe('summer')
    expect(summer.activeHolidayIds).toContain('summer_getaway')
    const winter = demandAtDay(demandCalendar('temperate'), 315)
    expect(winter.modifiers['deicing.demand']).toBe(1.5)
    expect(passengerFactor('temperate', 130)).toBe(1)
    expect(engineDerate('temperate', 200)).toBe(1)
    expect(fieldDraw('temperate', 10)).toBeNull()
    expect(environmentBinding('temperate', 10).legacyHolidayPeak).toBe(1)
    expect(environmentBinding('temperate', 0).season).toMatchObject({ id: 'spring', climate: 'rainy' })
  })

  it('covers every day of the year on each map', () => {
    expect(MAP_LIST).toEqual(['temperate', 'tropical', 'desert'])
    for (const id of MAP_LIST) {
      const map = mapById(id)
      expect(map.challenges).toHaveLength(3)
      for (let day = 0; day < map.yearLengthDays; day++) {
        const seasons = map.seasons.filter((season) => day >= season.startDay && day <= season.endDay)
        expect(seasons, `${id} day ${day}`).toHaveLength(1)
      }
    }
  })

  it('puts Songkran and Lunar New Year on the tropical calendar', () => {
    const songkran = demandAtDay(demandCalendar('tropical'), 105)
    expect(songkran.seasonId).toBe('hot')
    expect(songkran.activeHolidayIds).toContain('songkran')
    expect(songkran.multiplier).toBeGreaterThan(1.5)
    const lunar = demandAtDay(demandCalendar('tropical'), 46)
    expect(lunar.activeHolidayIds).toContain('lunar_new_year')
    const typhoon = environmentBinding('tropical', 240)
    expect(typhoon.season).toMatchObject({ id: 'typhoon', climate: 'rainy' })
    expect(typhoon.legacyHolidayPeak).toBe(1)
    const peak = environmentBinding('tropical', 105)
    expect(peak.legacyHolidayPeak).toBeGreaterThan(1.5)
    expect(weatherTitle('tropical', 150, 'rain')).toBe('Monsoon')
    expect(weatherTitle('tropical', 240, 'storm')).toBe('Typhoon')
    expect(weatherTitle('tropical', 20, 'clear')).toBe('Heat')
  })

  it('de-rates desert engines in extreme heat and peaks for Hajj and Eid', () => {
    expect(engineDerate('desert', 180)).toBe(DESERT_HEAT.engineDerate)
    expect(engineDerate('desert', 10)).toBe(1)
    const hajj = demandAtDay(demandCalendar('desert'), 145)
    expect(hajj.activeHolidayIds).toContain('hajj')
    expect(hajj.multiplier).toBeGreaterThan(1.3)
    const eid = demandAtDay(demandCalendar('desert'), 80)
    expect(eid.seasonId).toBe('sandstorm')
    expect(eid.activeHolidayIds).toContain('eid_fitr')
    const heat = demandAtDay(demandCalendar('desert'), 180)
    expect(heat.seasonId).toBe('extreme_heat')
    expect(heat.modifiers['engine.output']).toBeCloseTo(1 / DESERT_HEAT.engineDerate)
    expect(weatherTitle('desert', 100, 'storm')).toBe('Sandstorm')
    expect(weatherTitle('desert', 180, 'clear')).toBe('Extreme heat')
    expect(fieldDraw('desert', 180)?.terrain?.ground).toBe(0xc4a36a)
    expect(fieldDraw('desert', 180)?.skyAmount).toBeGreaterThan(0)
  })

  it('rolls temperate weather on the same thresholds as before', () => {
    expect(rollMapWeather('temperate', 0, 0)).toBe('clear')
    expect(rollMapWeather('temperate', 200, 0.549)).toBe('clear')
    expect(rollMapWeather('temperate', 200, 0.55)).toBe('rain')
    expect(rollMapWeather('temperate', 200, 0.749)).toBe('rain')
    expect(rollMapWeather('temperate', 200, 0.75)).toBe('fog')
    expect(rollMapWeather('temperate', 200, 0.899)).toBe('fog')
    expect(rollMapWeather('temperate', 200, 0.9)).toBe('storm')
    const weights = mapById('desert').seasons.map((season) => season.weather)
    for (const weight of weights) {
      if (!weight) continue
      const sum = weight.clear + weight.rain + weight.fog + weight.storm
      expect(sum).toBeCloseTo(1)
    }
  })
})

describe('map goals and winter feed', () => {
  it('counts holiday passengers, season turns, and heat turns', () => {
    const songkran = accrueChallenges('tropical', {}, {
      pax: 200,
      seasonId: 'hot',
      holidayIds: ['songkran'],
      heat: true,
    })
    expect(songkran.songkran_bank).toBe(200)
    expect(songkran.monsoon_ops).toBeUndefined()
    const rains = accrueChallenges('tropical', songkran, {
      pax: 40,
      seasonId: 'monsoon',
      holidayIds: [],
      heat: false,
    })
    expect(rains.monsoon_ops).toBe(1)
    const capped = accrueChallenges('desert', { heat_ops: 8 }, {
      pax: 10,
      seasonId: 'extreme_heat',
      holidayIds: [],
      heat: true,
    })
    expect(challengeCards('desert', capped).find((card) => card.id === 'heat_ops')?.done).toBe(true)
    const snow = accrueChallenges('temperate', {}, {
      pax: 80,
      seasonId: 'winter',
      holidayIds: ['winter_holidays'],
      heat: false,
    })
    expect(snow.snow_ops).toBe(1)
    expect(snow.christmas_bank).toBe(80)
  })

  it('feeds winter ops only for a snowy temperate winter, and only when the module is present', () => {
    expect(winterForecast('tropical', 300, 'storm')).toBeNull()
    expect(winterForecast('temperate', 10, 'storm')).toBeNull()
    const snow = winterForecast('temperate', 300, 'storm')
    expect(snow).toEqual({ tempC: -6, precip: 'snow', visibilityM: 500 })
    expect(loadedWinterOps()?.needsDeicing).toEqual(expect.any(Function))
    expect(feedWinterOps(null)).toBeNull()
    expect(feedWinterOps(snow, null)).toBeNull()
    expect(feedWinterOps(snow)).toMatchObject({ needsDeicing: true, runwayRate: 0.7, precip: 'snow' })
    const reading = feedWinterOps(snow, {
      needsDeicing: (weather) => weather.precip !== 'none' && weather.tempC <= 3,
      runwayRateFactor: (visibility) => (visibility != null && visibility < 800 ? 0.7 : 1),
    })
    expect(reading).toMatchObject({ needsDeicing: true, runwayRate: 0.7, precip: 'snow' })
  })

  it('saves the chosen map and restores an older save as temperate', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.setMap('tropical')
    game.mapChallenges = { songkran_bank: 12 }
    expect(game.buyLand('city')).toBe(true)
    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.mapId).toBe('tropical')
    expect(loaded.mapChallenges.songkran_bank).toBe(12)
    expect(loaded.mapEngineDerate()).toBeGreaterThan(1)

    const raw = localStorage.getItem(SAVE_KEY)
    expect(raw).toBeTruthy()
    const snap = JSON.parse(raw ?? '{}') as { mapId?: string; mapChallenges?: unknown }
    delete snap.mapId
    delete snap.mapChallenges
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap))
    const older = new Game()
    expect(older.load()).toBe(true)
    expect(older.mapId).toBe('temperate')
    expect(older.mapGoalCards()).toHaveLength(3)
    expect(parseMapId('nope')).toBe('temperate')
  })
})
