import { describe, expect, it } from 'vitest'
import { operatingMargin, payrollForGameDay } from '../core/bank.ts'
import { runHeadlessBalance } from '../economy/balance.ts'
import { cityLevy } from '../game/economy.ts'
import {
  BUILDINGS,
  FIELD_LEVEL_XP,
  MAX_FIELD_LEVEL,
  PAYROLL_TICKS_PER_DAY,
  PRESTIGE_STARS,
  PRESTIGE_STAR_XP,
  UPKEEP_PER_TICK,
  dailyUpkeep,
  fieldLevelOf,
  fieldProgress,
  prestigeStarsOf,
  prestigeThreshold,
} from '../game/catalog.ts'
import { Game } from '../game/sim.ts'
import { BAG_SYSTEMS, PAX_UNITS, TANK_TIERS } from '../scale/data.ts'
import { rungUpkeep } from '../stands/index.ts'
import { ITEMS, PREFAB_TIERS } from '../game/terminal.ts'
import {
  EXTRA_PATH_CAPSTONE_PREMIUM,
  EXTRA_PATH_UPKEEP,
  SPEC_POINT_LEVELS,
  capstoneCost,
  siteUpkeepMultiplier,
  specPointsForLevel,
} from './specializations.ts'
import {
  PROGRESSION_BUILDABLES,
  UNLOCK_LEVEL,
  canBuild,
  progressionBuildable,
  unlockLevel,
} from './unlocks.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.scheduleAuto = false
  game.schedule = []
  return game
}

describe('field level and prestige', () => {
  it('keeps FL1–5 and extends the ladder through FL10', () => {
    expect(FIELD_LEVEL_XP[1]).toBe(0)
    expect(FIELD_LEVEL_XP[2]).toBe(90)
    expect(FIELD_LEVEL_XP[3]).toBe(220)
    expect(FIELD_LEVEL_XP[4]).toBe(420)
    expect(FIELD_LEVEL_XP[5]).toBe(700)
    expect([...FIELD_LEVEL_XP.slice(6)]).toEqual([1100, 1600, 2300, 3200, 4500])
    expect(fieldLevelOf(0)).toBe(1)
    expect(fieldLevelOf(89)).toBe(1)
    expect(fieldLevelOf(90)).toBe(2)
    expect(fieldLevelOf(699)).toBe(4)
    expect(fieldLevelOf(700)).toBe(5)
    expect(fieldLevelOf(1099)).toBe(5)
    expect(fieldLevelOf(1100)).toBe(6)
    expect(fieldLevelOf(4499)).toBe(9)
    expect(fieldLevelOf(4500)).toBe(10)
    expect(fieldLevelOf(99_000)).toBe(10)
  })

  it('awards prestige stars P1–P5 at +2,000 XP after FL10', () => {
    expect(PRESTIGE_STAR_XP).toBe(2_000)
    expect(prestigeStarsOf(4500)).toBe(0)
    expect(prestigeStarsOf(6499)).toBe(0)
    for (let star = 1; star <= PRESTIGE_STARS; star++) {
      const at = prestigeThreshold(star)
      expect(at).toBe(FIELD_LEVEL_XP[MAX_FIELD_LEVEL] + star * 2_000)
      expect(prestigeStarsOf(at)).toBe(star)
      expect(prestigeStarsOf(at - 1)).toBe(star - 1)
      expect(fieldLevelOf(at)).toBe(10)
    }
    expect(prestigeStarsOf(prestigeThreshold(PRESTIGE_STARS) + 10_000)).toBe(5)
    const done = fieldProgress(prestigeThreshold(5))
    expect(done.stars).toBe(5)
    expect(done.pct).toBe(1)
    expect(done.label).toBe('Lv 10 · P5')
    const climbing = fieldProgress(4500)
    expect(climbing.level).toBe(10)
    expect(climbing.stars).toBe(0)
    expect(climbing.nextLabel).toBe('P1')
    expect(climbing.need).toBe(6500)
  })
})

describe('unlock gating', () => {
  it('keeps the old FL1 and FL2 stamps and gates the new batches', () => {
    expect(unlockLevel('fuel')).toBe(1)
    expect(unlockLevel('road')).toBe(1)
    expect(unlockLevel('kitchen')).toBe(2)
    expect(unlockLevel('depot')).toBe(2)
    expect(unlockLevel('checkin_express')).toBe(2)
    expect(unlockLevel('security_medium')).toBe(2)
    expect(unlockLevel('prefab_ii')).toBe(3)
    expect(unlockLevel('checkin_hall')).toBe(3)
    expect(unlockLevel('security_hall')).toBe(3)
    expect(unlockLevel('concourse')).toBe(4)
    expect(unlockLevel('substation')).toBe(4)
    expect(unlockLevel('jet_bridge')).toBe(4)
    expect(unlockLevel('runway_heavy')).toBe(5)
    expect(unlockLevel('code_e')).toBe(5)
    expect(unlockLevel('hydrant')).toBe(5)
    expect(unlockLevel('pier_ii')).toBe(6)
    expect(unlockLevel('tilt_tray')).toBe(6)
    expect(unlockLevel('hotel_biz')).toBe(6)
    expect(unlockLevel('fuel_farm_iii')).toBe(7)
    expect(unlockLevel('atc_approach')).toBe(7)
    expect(unlockLevel('park_g')).toBe(7)
    expect(unlockLevel('code_f')).toBe(8)
    expect(unlockLevel('jet_bridge_3')).toBe(8)
    expect(unlockLevel('satellite')).toBe(8)
    expect(unlockLevel('hotel_resort')).toBe(8)
    expect(unlockLevel('remote_screening')).toBe(9)
    expect(unlockLevel('rail')).toBe(9)
    expect(unlockLevel('prestige_landmark')).toBe(10)
    expect(canBuild('hotel_biz', 5)).toBe(false)
    expect(canBuild('hotel_biz', 6)).toBe(true)
    expect(canBuild('rail', 8)).toBe(false)
    expect(canBuild('runway_heavy', 4)).toBe(false)
  })

  it('lists every apron stamp and hall item in the unlock table', () => {
    for (const building of BUILDINGS) {
      expect(UNLOCK_LEVEL[building.tool], building.tool).toBeTypeOf('number')
      expect(building.minFieldLevel).toBe(unlockLevel(building.tool))
      expect(building.upkeepPerDay).toBeTypeOf('number')
    }
    for (const item of ITEMS) {
      expect(UNLOCK_LEVEL[item.id], item.id).toBe(item.minFieldLevel)
    }
    for (const row of PROGRESSION_BUILDABLES) {
      expect(unlockLevel(row.id)).toBeGreaterThanOrEqual(3)
      expect(row.upkeepPerDay).toBeGreaterThanOrEqual(0)
    }
  })

  it('refuses a build below the unlock and allows it at the level', () => {
    const game = starter()
    expect(game.fieldLevel()).toBe(1)
    game.setTool('hotel_biz')
    game.placeSingle({ c: 4, r: 4 })
    expect(game.news[0]?.text).toMatch(/Field level 6/)
    expect(game.sites).toHaveLength(0)

    game.setTool('rail')
    game.placeSingle({ c: 4, r: 4 })
    expect(game.news[0]?.text).toMatch(/Field level 9/)

    game.placeRunway({ c: 1, r: 1 }, 'heavy')
    expect(game.news[0]?.text).toMatch(/Field level 5/)

    game.standAccessMode = 'jetway'
    game.setTool('stand')
    game.placeSingle({ c: 4, r: 4 })
    expect(game.news[0]?.text).toMatch(/Jet bridge needs Field level 4/)

    expect(game.commission('checkin_hall')).toBe(false)
    expect(game.news[0]?.text).toMatch(/Field level 3/)
    expect(game.progressionBuilt).toHaveLength(0)

    game.upgradeHall()
    expect(game.fits[0]?.tier ?? 1).toBe(1)
    expect(game.news[0]?.text).toMatch(/Field level 3/)

    game.fieldXp = 220
    expect(game.commission('checkin_hall')).toBe(true)
    expect(game.progressionBuilt).toContain('checkin_hall')
    const cash = game.cash
    expect(game.commission('checkin_hall')).toBe(false)
    expect(game.cash).toBe(cash)

    game.fieldXp = 1100
    expect(game.fieldLevel()).toBe(6)
    expect(canBuild('hotel_biz', game.fieldLevel())).toBe(true)
    expect(canBuild('park_g', game.fieldLevel())).toBe(false)
  })
})

describe('specialization mix', () => {
  it('grants points at FL6, FL8, and FL10 and lets paths mix', () => {
    expect(specPointsForLevel(5)).toBe(0)
    expect(specPointsForLevel(6)).toBe(1)
    expect(specPointsForLevel(8)).toBe(2)
    expect(specPointsForLevel(10)).toBe(3)
    expect([...SPEC_POINT_LEVELS]).toEqual([6, 8, 10])

    const game = starter()
    game.fieldXp = 1100
    expect(game.chooseSpec('hub')).toBe(true)
    expect(game.chooseSpec('cargo')).toBe(false)
    game.fieldXp = 4500
    expect(game.specPointsLeft()).toBe(2)
    expect(game.chooseSpec('low-cost')).toBe(true)
    expect(game.chooseSpec('luxury')).toBe(true)
    expect(game.chooseSpec('cargo')).toBe(false)
    expect(game.specPaths).toEqual(['hub', 'low-cost', 'luxury'])
  })

  it('charges +50% on later capstones and +10% site upkeep per extra path', () => {
    const pier = progressionBuildable('pier_ii')!
    const satellite = progressionBuildable('satellite')!
    expect(capstoneCost(pier.cost, [], 'pier_ii')).toBe(pier.cost)
    expect(capstoneCost(pier.cost, ['low-cost'], 'pier_ii')).toBe(pier.cost)
    expect(capstoneCost(satellite.cost, ['hub'], 'satellite')).toBe(satellite.cost)
    expect(capstoneCost(satellite.cost, ['low-cost', 'hub'], 'satellite')).toBe(
      Math.round(satellite.cost * (1 + EXTRA_PATH_CAPSTONE_PREMIUM)),
    )
    expect(siteUpkeepMultiplier(0)).toBe(1)
    expect(siteUpkeepMultiplier(1)).toBe(1)
    expect(siteUpkeepMultiplier(2)).toBeCloseTo(1 + EXTRA_PATH_UPKEEP)
    expect(siteUpkeepMultiplier(3)).toBeCloseTo(1 + 2 * EXTRA_PATH_UPKEEP)

    const game = starter()
    game.fieldXp = 2300
    const base = game.landsideUpkeep()
    game.chooseSpec('low-cost')
    expect(game.landsideUpkeep()).toBe(base)
    game.chooseSpec('hub')
    expect(game.landsideUpkeep()).toBe(Math.round(base * siteUpkeepMultiplier(2)))
    game.cash = 200_000
    game.upgradeHall()
    expect(game.fits[0]?.tier).toBe(2)
    expect(game.cash).toBe(200_000 - 22_000)
    game.upgradeHall()
    expect(game.fits[0]?.tier).toBe(3)
    expect(game.cash).toBe(200_000 - 22_000 - Math.round(48_000 * 1.5))
  })
})

describe('daily upkeep', () => {
  it('converts every legacy tick rate to a daily total within rounding', () => {
    const ticks = [
      ...Object.values(UPKEEP_PER_TICK.park).flatMap((pair) => [pair.short, pair.long]),
      ...Object.values(UPKEEP_PER_TICK.hotel),
      ...UPKEEP_PER_TICK.hotelMeta,
      UPKEEP_PER_TICK.carparkShort,
      UPKEEP_PER_TICK.carparkLong,
      UPKEEP_PER_TICK.bus,
      UPKEEP_PER_TICK.rail,
      ...Object.values(UPKEEP_PER_TICK.hall),
    ]
    for (const tick of ticks) {
      expect(dailyUpkeep(tick)).toBe(Math.round(tick * PAYROLL_TICKS_PER_DAY))
    }
    expect(PAYROLL_TICKS_PER_DAY).toBe(6)
  })

  it('bills the starter field once per day at the old per-tick total times six', () => {
    const game = starter()
    const oldTick =
      UPKEEP_PER_TICK.hall.lounge +
      UPKEEP_PER_TICK.hall.souvenir +
      UPKEEP_PER_TICK.hall.food +
      PREFAB_TIERS[1].upkeepDay / PAYROLL_TICKS_PER_DAY
    const daily = game.landsideUpkeep()
    expect(Math.abs(daily - oldTick * PAYROLL_TICKS_PER_DAY)).toBeLessThanOrEqual(1)

    game.cash = 400_000
    game.clock = 180
    game.payrollDay = 0
    const bill = payrollForGameDay(0, 'early', game.payrollPreview())
    const pillar =
      TANK_TIERS[0]!.upkeepPerDay +
      BAG_SYSTEMS.carts.upkeepPerDay +
      2 * PAX_UNITS.desk.upkeepPerDay +
      PAX_UNITS.scanner.upkeepPerDay +
      2 * rungUpkeep('narrow', 1)
    const holding = game.dailyHoldingQuote()
    game.tickPayroll(0)
    const afterOps = 400_000 - daily - pillar - holding - bill
    expect(game.cash).toBe(afterOps - cityLevy(afterOps))
    game.tickPayroll(0)
    expect(game.cash).toBe(afterOps - cityLevy(afterOps))
  })

  it('keeps early and mid-game margins inside the finance bands', () => {
    const report = runHeadlessBalance()
    expect(report.finances.early.margin).toBeCloseTo(0.4, 3)
    expect(report.finances.midgame.margin).toBeGreaterThan(report.finances.early.margin)
    expect(operatingMargin(20_000, payrollForGameDay(20_000, 'early') + 3_000)).toBeCloseTo(0.4)
  })
})
