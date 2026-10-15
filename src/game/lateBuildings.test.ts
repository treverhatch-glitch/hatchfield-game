import { describe, expect, it } from 'vitest'
import { LATE_FIELD_XP, lateFieldLevelFromXp } from './catalog.ts'
import { lateCatalogLines, lateStampLabel, safFuelCost } from './lateBuildings.ts'
import { Game } from './sim.ts'
import { SAVE_KEY } from './types.ts'
import { buildingById } from '../tier3plus/index.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.cash = 5_000_000
  return game
}

function closeDays(game: Game, days: number) {
  for (let i = 0; i < days; i++) {
    game.clock += 180
    game.tickPayroll(0)
  }
}

function tier3(game: Game, category: string) {
  return game.bank.ledger().entries.filter((entry) => entry.meta.source === 'tier3plus' && entry.category === category)
}

describe('late field level', () => {
  it('keeps the airline ladder at tier 5 while the field and late rungs reach the building gates', () => {
    expect(lateFieldLevelFromXp(700)).toBe(5)
    expect(lateFieldLevelFromXp(LATE_FIELD_XP[7])).toBe(7)
    expect(lateFieldLevelFromXp(LATE_FIELD_XP[8])).toBe(8)
    expect(lateFieldLevelFromXp(LATE_FIELD_XP[9])).toBe(9)
    const game = new Game()
    game.fieldXp = LATE_FIELD_XP[9]
    expect(game.fieldLevel()).toBe(9)
    expect(game.lateFieldLevel()).toBe(9)
    expect(game.tierUnlocked(5)).toBe(true)
  })
})

describe('late building stamps', () => {
  it('keeps cost and upkeep off the stamp name and in the click-open lines', () => {
    expect(lateStampLabel('airport_hotel')).toBe('Airport hotel')
    expect(lateStampLabel('rail_link')).toBe('Rail link station')
    expect(lateStampLabel('saf_blending')).toBe('SAF blending')
    for (const id of ['airport_hotel', 'rail_link', 'saf_blending'] as const) {
      expect(lateStampLabel(id)).not.toMatch(/\d|\$/)
      const lines = lateCatalogLines(id, 1, 0).join(' ')
      expect(lines).toMatch(/\$/)
      expect(lines).toMatch(/Field Level/)
    }
  })

  it('refuses a stamp below the field level and does not spend', () => {
    const game = field()
    game.fieldXp = LATE_FIELD_XP[6]
    game.setTool('airport_hotel')
    game.clickTile({ c: 15, r: 5 })
    expect(game.lateSites).toHaveLength(0)
    expect(game.cash).toBe(5_000_000)
    expect(tier3(game, 'construction')).toHaveLength(0)
    expect(game.news[0]?.text).toMatch(/Field Level 7/)
    const lines = game.infoLines('late:airport_hotel')
    expect(lines.join(' ')).toMatch(/\$260,000/)
    expect(lines.join(' ')).toMatch(/you are 6/)
  })

  it('places the hotel on a road edge, posts construction, and bills empty-room upkeep', () => {
    const game = field()
    expect(game.tile({ c: 15, r: 1 })).toBe('grass')
    expect(game.tile({ c: 16, r: 1 })).toBe('road')
    game.fieldXp = LATE_FIELD_XP[7]
    game.setTool('airport_hotel')
    game.clickTile({ c: 1, r: 1 })
    expect(game.lateSites).toHaveLength(0)
    expect(game.news[0]?.text).toMatch(/road edge/)

    game.researchTree.state.unlocked.push('landside-6')
    game.clickTile({ c: 15, r: 1 })
    expect(game.lateSites).toEqual([{ id: 'airport_hotel', c: 15, r: 1, elapsedDays: 0 }])
    expect(game.tile({ c: 15, r: 1 })).toBe('late_hotel')
    expect(game.cash).toBe(5_000_000 - 260_000)
    expect(tier3(game, 'construction').map((entry) => entry.amount)).toEqual([-260_000])

    closeDays(game, 1)
    expect(tier3(game, 'building_upkeep').map((entry) => entry.amount)).toEqual([-5_400])
    expect(tier3(game, 'landside_fees')).toHaveLength(0)
    expect(game.lateOpenAt(15, 1)).toBe(true)
  })

  it('books missed-connection nights into the hotel and leaves the overflow queued', () => {
    const game = field()
    const hotel = buildingById('airport_hotel')
    if (hotel?.kind !== 'hotel') throw new Error('hotel missing')
    game.noteMissedConnectionNights(4)
    game.noteMissedConnectionNights(Number.NaN)
    closeDays(game, 1)
    expect(game.missedHotelNights).toBe(4)

    game.fieldXp = LATE_FIELD_XP[7]
    game.cash = 5_000_000
    game.researchTree.state.unlocked.push('landside-6')
    game.setTool('airport_hotel')
    game.clickTile({ c: 15, r: 1 })
    game.noteCrewHotelNights(3)
    closeDays(game, 1)
    const income = tier3(game, 'landside_fees')
    expect(income.at(-1)?.amount).toBe(4 * hotel.transferNightRate + 3 * hotel.crewNightRate)
    expect(game.missedHotelNights).toBe(0)
    expect(game.crewHotelNights).toBe(0)

    game.noteMissedConnectionNights(hotel.rooms + 10)
    closeDays(game, 1)
    expect(tier3(game, 'landside_fees').at(-1)?.amount).toBe(hotel.rooms * hotel.transferNightRate)
    expect(game.missedHotelNights).toBe(10)
    expect(game.infoLines('late-site:15,1').join(' ')).toMatch(/10 transfer/)
  })

  it('adds the rail demand bonus only after the 10-day build', () => {
    const game = field()
    game.fieldXp = LATE_FIELD_XP[9]
    game.setTool('rail_link')
    game.clickTile({ c: 15, r: 2 })
    const before = game.landsidePaxMult()
    expect(game.lateOpenAt(15, 2)).toBe(false)
    expect(game.landsidePaxMult()).toBeCloseTo(before)
    closeDays(game, 9)
    expect(game.lateSites[0]?.elapsedDays).toBe(9)
    expect(game.landsidePaxMult()).toBeCloseTo(before)
    expect(tier3(game, 'building_upkeep')).toHaveLength(0)
    closeDays(game, 1)
    expect(game.lateOpenAt(15, 2)).toBe(true)
    expect(game.landsidePaxMult()).toBeCloseTo(before * 1.2)
    expect(tier3(game, 'building_upkeep').at(-1)?.amount).toBe(-7_000)
    expect(game.infoLines('late-site:15,2').join(' ')).toMatch(/Demand ×1\.20/)
  })

  it('puts the SAF premium in the fuel bill and on the ledger', () => {
    const game = field()
    game.signFuel('apex')
    game.cash = 5_000_000
    game.buyLoads()
    expect(game.cash).toBe(5_000_000 - 3_600)
    expect(tier3(game, 'fuel_purchase')).toHaveLength(0)

    game.fieldXp = LATE_FIELD_XP[8]
    game.setTool('saf_blending')
    game.clickTile({ c: 1, r: 1 })
    expect(game.lateSites).toHaveLength(0)
    expect(game.tile({ c: 17, r: 0 })).toBe('grass')
    expect(game.tile({ c: 16, r: 0 })).toBe('road')
    game.researchTree.state.unlocked.push('spec-green-1')
    game.clickTile({ c: 17, r: 0 })
    expect(game.tile({ c: 17, r: 0 })).toBe('saf')
    expect(safFuelCost(900, 4, game.lateSites)).toBe(3_888)

    const before = game.cash
    game.buyLoads()
    expect(game.cash).toBe(before - 3_888)
    expect(tier3(game, 'fuel_purchase').at(-1)?.amount).toBe(-3_888)
    expect(game.infoLines('late:saf_blending').join(' ')).toMatch(/Fuel cost \+8%/)
    expect(game.infoLines('late-site:17,0').join(' ')).toMatch(/Green airline demand met/)
  })

  it('opens a unique Spotters deck with visible crowds, prestige, and daily gate income', () => {
    const game = field()
    const spec = buildingById('spotters_deck')
    if (spec?.kind !== 'spotters') throw new Error('spotters deck missing')
    game.fieldXp = LATE_FIELD_XP[8]
    const xp = game.fieldXp
    game.setTool('spotters_deck')
    game.clickTile({ c: 15, r: 1 })

    expect(game.lateSites).toEqual([{ id: 'spotters_deck', c: 15, r: 1, elapsedDays: 0 }])
    expect(game.tile({ c: 15, r: 1 })).toBe('spotters_deck')
    expect(game.spotterCrowdAt(15, 1)).toBe(spec.crowdSize)
    expect(game.fieldXp).toBe(xp)
    expect(game.infoLines('late:spotters_deck').join(' ')).toMatch(
      /\$3,200 visitor income per day.*\+1 prestige.*18 visible spotters.*Unique/,
    )

    closeDays(game, 1)
    expect(tier3(game, 'landside_fees').at(-1)?.amount).toBe(spec.dailyIncome)
    expect(tier3(game, 'building_upkeep').at(-1)?.amount).toBe(-spec.dailyUpkeep)
    expect(game.fieldXp).toBe(xp)

    game.setTool('spotters_deck')
    game.clickTile({ c: 15, r: 2 })
    expect(game.lateSites).toHaveLength(1)
    expect(game.news[0]?.text).toMatch(/unique/)
  })

  it('saves and reloads the site, then refunds a bulldoze through the ledger', () => {
    const game = field()
    game.fieldXp = LATE_FIELD_XP[9]
    game.setTool('rail_link')
    game.clickTile({ c: 15, r: 2 })
    closeDays(game, 4)
    game.noteMissedConnectionNights(6)
    game.persist()
    const next = new Game()
    expect(next.load()).toBe(true)
    expect(next.lateSites).toEqual([{ id: 'rail_link', c: 15, r: 2, elapsedDays: 4 }])
    expect(next.tile({ c: 15, r: 2 })).toBe('late_rail')
    expect(next.missedHotelNights).toBe(6)
    expect(localStorage.getItem(SAVE_KEY)).toBeTruthy()

    const cash = next.cash
    next.setTool('clear')
    next.clickTile({ c: 15, r: 2 })
    expect(next.lateSites).toHaveLength(0)
    expect(next.tile({ c: 15, r: 2 })).toBe('grass')
    expect(next.cash).toBe(cash + Math.round(600_000 * 0.4))
    expect(tier3(next, 'refunds').at(-1)?.amount).toBe(Math.round(600_000 * 0.4))
  })
})
