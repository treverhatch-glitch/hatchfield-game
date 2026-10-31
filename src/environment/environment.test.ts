import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { skyState } from '../render/world/daylight.ts'
import { SEASON_WEATHER } from './config.ts'
import { forceSimRandom } from '../game/simRng.ts'
import {
  arrivalDemand,
  arrivalSpacingScale,
  bankTarget,
  clockIsNight,
  environmentCaption,
  grassColor,
  groundOpsPace,
  snowCover,
  holidayPeakHook,
  isNightHour,
  nightLighting,
  paintSky,
  rollSeasonWeather,
  seasonAtClock,
  simClockToHour,
  timeOfDayFactor,
} from './index.ts'

describe('day / night clock', () => {
  it('matches the sim night window and the field-light hours', () => {
    expect(simClockToHour(0)).toBe(8)
    expect(isNightHour(simClockToHour(0))).toBe(false)
    for (let clock = 0; clock < 360; clock += 3) {
      const hour = simClockToHour(clock)
      expect(isNightHour(hour)).toBe(clockIsNight(clock))
      expect(clockIsNight(clock)).toBe(clock % 180 >= 120)
    }
  })

  it('keeps the sun on the clock and lights the field at night', () => {
    const noon = paintSky(12, 'clear', 0, 'high')
    const night = paintSky(2, 'clear', 0, 'high')
    expect(noon.sunDir.y).toBeGreaterThan(0.7)
    expect(noon.sunIntensity).toBeGreaterThan(night.sunIntensity * 3)
    expect(noon.lights).toBe(0)
    expect(night.lights).toBe(1)
    expect(noon.sunDir).toEqual(skyState(12, 'clear').sunDir)
    const lit = nightLighting(night.hour, night.lights, true)
    expect(lit.apron).toBe(1)
    expect(lit.runwayEdge).toBe(1)
    expect(lit.taxiEdge).toBe(1)
    expect(lit.terminalWindows).toBe(1)
    expect(lit.apronPools).toBe(true)
  })

  it('turns terminal windows on before the floods, and off by the morning open', () => {
    const dusk = nightLighting(18, 0, true)
    expect(dusk.terminalWindows).toBeGreaterThan(0)
    expect(dusk.apron).toBe(0)
    expect(dusk.runwayEdge).toBe(0)
    expect(dusk.taxiEdge).toBe(0)
    const open = nightLighting(8, paintSky(8, 'clear', 0, 'low').lights, false)
    expect(open.terminalWindows).toBe(0)
    expect(open.apronPools).toBe(false)
    expect(nightLighting(23, 1, false).apronPools).toBe(false)
  })
})

describe('seasons', () => {
  it('gives each season its own palette and climate tint', () => {
    const spring = seasonAtClock(10 * 180)
    const summer = seasonAtClock(100 * 180)
    const autumn = seasonAtClock(200 * 180)
    const winter = seasonAtClock(300 * 180)
    expect(spring).toMatchObject({ id: 'spring', climate: 'rainy' })
    expect(summer).toMatchObject({ id: 'summer', climate: 'dry_hot' })
    expect(autumn).toMatchObject({ id: 'autumn', climate: 'cool' })
    expect(winter).toMatchObject({ id: 'winter', climate: 'cool' })
    const colours = [spring, summer, autumn, winter].map((s) => s.palette.skyHorizon)
    expect(new Set(colours).size).toBe(4)

    const hot = paintSky(12, 'clear', 100, 'high')
    const wet = paintSky(12, 'clear', 10, 'high')
    const cold = paintSky(12, 'clear', 300, 'high')
    expect((hot.sunColor >> 16) & 255).toBeGreaterThan((cold.sunColor >> 16) & 255)
    expect(hot.sunIntensity).toBeGreaterThan(cold.sunIntensity)
    expect(wet.skyTop).not.toBe(hot.skyTop)
    const winterNight = paintSky(23, 'clear', 300, 'high')
    const winterNoon = paintSky(12, 'clear', 300, 'high')
    const luma = (hex: number) => ((hex >> 16) & 255) + ((hex >> 8) & 255) + (hex & 255)
    expect(luma(winterNight.skyTop)).toBeLessThan(luma(winterNoon.skyTop) * 0.55)
    expect(luma(winterNight.skyHorizon)).toBeLessThan(luma(winterNoon.skyHorizon))
    expect(grassColor(100, 'high')).toBe(summer.palette.grass)
    expect(grassColor(300, 'med')).toBe(winter.palette.grass)
    expect(grassColor(300, 'low')).toBe(winter.palette.grass)
    expect(snowCover(100, 'high')).toBe(0)
    expect(snowCover(300, 'high')).toBeGreaterThan(snowCover(300, 'low'))
    expect(snowCover(300, 'low')).toBeGreaterThan(0.5)
  })

  it('drops fog reshape on the low preset and keeps the grass tint', () => {
    const day = 300
    const base = skyState(12, 'clear')
    const low = paintSky(12, 'clear', day, 'low')
    const high = paintSky(12, 'clear', day, 'high')
    expect(low.fogFar).toBe(base.fogFar)
    expect(high.fogFar).toBeLessThan(base.fogFar)
    expect(low.sunColor).toBe(high.sunColor)
    expect(low.sunColor).not.toBe(base.sunColor)
    expect(grassColor(day, 'low')).toBe(grassColor(day, 'high'))
    const storm = paintSky(12, 'storm', day, 'low')
    expect(storm.precip).toBe(1)
    expect(storm.lightning).toBe(true)
    expect(storm.lights).toBeGreaterThan(0)
  })

  it('biases weather rolls and slows a wet ramp a little', () => {
    for (const weights of Object.values(SEASON_WEATHER)) {
      const sum = weights.clear + weights.rain + weights.fog + weights.storm
      expect(sum).toBeCloseTo(1)
    }
    expect(rollSeasonWeather(100, 0.01)).toBe('clear')
    expect(rollSeasonWeather(10, 0.5)).toBe('rain')
    expect(rollSeasonWeather(300, 0.99)).toBe('storm')
    expect(SEASON_WEATHER.summer.clear).toBeGreaterThan(SEASON_WEATHER.spring.clear)
    expect(SEASON_WEATHER.spring.rain).toBeGreaterThan(SEASON_WEATHER.summer.rain)

    expect(groundOpsPace('clear', 'dry_hot')).toBe(1)
    expect(groundOpsPace('clear', 'rainy')).toBe(1)
    const rain = groundOpsPace('rain', 'dry_hot')
    expect(rain).toBeGreaterThan(1)
    expect(rain).toBeLessThan(1.25)
    expect(groundOpsPace('rain', 'rainy')).toBeGreaterThan(rain)
    expect(groundOpsPace('storm', 'cool')).toBeGreaterThan(groundOpsPace('rain', 'cool'))
  })
})

describe('demand', () => {
  it('thins overnight arrivals and keeps the morning open near full', () => {
    expect(timeOfDayFactor(8)).toBe(1)
    expect(timeOfDayFactor(2)).toBeLessThan(0.4)
    expect(timeOfDayFactor(12)).toBeGreaterThan(timeOfDayFactor(22))
    const morning = arrivalDemand(0)
    const overnight = arrivalDemand(150)
    expect(morning.hour).toBe(8)
    expect(overnight.combined).toBeLessThan(morning.combined * 0.5)
    expect(arrivalSpacingScale(0)).toBe(1)
    expect(arrivalSpacingScale(150)).toBeGreaterThan(1.25)
    expect(arrivalSpacingScale(150, { nightBank: true })).toBeLessThan(arrivalSpacingScale(150))
  })

  it('multiplies the season curve and a holiday-peak hook', () => {
    const summerDay = arrivalDemand(100 * 180)
    const peakDay = arrivalDemand(130 * 180)
    const winterDay = arrivalDemand(315 * 180)
    expect(summerDay.seasonId).toBe('summer')
    expect(peakDay.activeHolidayIds).toContain('summer_getaway')
    expect(peakDay.calendar).toBeGreaterThan(summerDay.calendar)
    expect(winterDay.calendar).toBeLessThan(summerDay.calendar)
    expect(peakDay.holidayPeak).toBe(1)

    const hooked = arrivalDemand(130 * 180, holidayPeakHook({ summer_getaway: 1.4 }))
    expect(hooked.holidayPeak).toBeCloseTo(1.4)
    expect(hooked.combined).toBeCloseTo(peakDay.combined * 1.4)
    expect(arrivalDemand(315 * 180, holidayPeakHook({ summer_getaway: 1.4 })).holidayPeak).toBe(1)

    const caption = environmentCaption(130 * 180, 'clear')
    expect(caption).toContain('Summer')
    expect(caption).toContain('dry and hot')
    expect(caption).toContain('Peak: Summer Getaway')
    expect(environmentCaption(10 * 180, 'rain')).toContain('Ramp 1.16×')
  })

  it('shrinks the open bank overnight and restores it with night bank', () => {
    expect(bankTarget(6, 12, 0, false)).toBe(5)
    expect(bankTarget(6, 12, 150, false)).toBe(2)
    expect(bankTarget(6, 12, 150, true)).toBeGreaterThan(2)
  })
})

describe('game wiring', () => {
  it('spaces an overnight bank wider than a morning bank', () => {
    const span = (clock: number, nightResearch = false) => {
      const game = new Game()
      game.clock = clock
      if (nightResearch) game.researchUnlocked.push('night_bank')
      forceSimRandom(() => 0.5)
      game.seedScheduleForAirline('northline', 4)
      forceSimRandom(null)
      const etas = game.schedule.map((slot) => slot.eta).sort((a, b) => a - b)
      return etas[1] - etas[0]
    }
    const morning = span(0)
    const night = span(150)
    expect(night).toBeGreaterThan(morning * 1.2)
    expect(span(150, true)).toBeLessThan(night)
  })

  it('draws the next weather from the season table', () => {
    const roll = (clock: number, weatherRoll: number) => {
      const game = new Game()
      game.clock = clock
      game.weather = 'storm'
      game.weatherCool = 0
      let n = 0
      forceSimRandom(() => (n++ === 0 ? 0 : weatherRoll))
      game.tickWeather(1)
      forceSimRandom(null)
      return game.weather
    }
    expect(roll(100 * 180, 0.01)).toBe('clear')
    expect(roll(10 * 180, 0.5)).toBe('rain')
  })
})
