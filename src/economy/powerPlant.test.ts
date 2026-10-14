import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { MRO_POWER_DEMAND, NIGHT_HUB_POWER_DEMAND } from '../tier3/config.ts'
import { calculatePower } from './power.ts'
import { canUpgradePower, powerPlantOffer } from './powerPlant.ts'

describe('power capacity', () => {
  it('browns out a second hangar and night hub on Tier I, and Tier II clears it', () => {
    const loads = [
      { id: 'mro-a', demand: MRO_POWER_DEMAND },
      { id: 'mro-b', demand: MRO_POWER_DEMAND },
      { id: 'hub', demand: NIGHT_HUB_POWER_DEMAND },
      { id: 'site', demand: 40 },
    ]
    const tier1 = calculatePower(1, loads)
    expect(tier1.brownout).toBe(true)
    expect(tier1.demand).toBeGreaterThan(tier1.capacity)
    expect(tier1.throughputMultiplier).toBeLessThan(1)
    const tier2 = calculatePower(2, loads)
    expect(tier2.brownout).toBe(false)
    expect(tier2.capacity).toBeGreaterThan(tier1.capacity)
    expect(tier2.throughputMultiplier).toBe(1)
  })

  it('needs Tier III once demand outgrows Tier II', () => {
    const loads = [
      { id: 'mro-a', demand: MRO_POWER_DEMAND },
      { id: 'mro-b', demand: MRO_POWER_DEMAND },
      { id: 'hub', demand: NIGHT_HUB_POWER_DEMAND },
      { id: 'campus', demand: 500 },
    ]
    expect(calculatePower(2, loads).brownout).toBe(true)
    const tier3 = calculatePower(3, loads)
    expect(tier3.brownout).toBe(false)
    expect(tier3.capacity).toBe(1_400)
  })
})

function lateField(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.fieldXp = 420
  game.researchUnlocked = ['night_bank', 'deice', 'stand_class', 'heavy_pack', 'mro_hangar', 'cargo_night_hub']
  game.cash = 500_000
  game.tiles[23][11] = 'taxi'
  game.tiles[23][13] = 'taxi'
  game.tiles[23][10] = 'taxi'
  game.tool = 'mro'
  // Column 10 sits on the tower sightline, so the west hangar is one cell clear of it.
  game.placeSingle({ c: 9, r: 23 })
  game.tickConstruction(30)
  game.placeSingle({ c: 14, r: 23 })
  game.tool = 'nighthub'
  game.placeSingle({ c: 8, r: 16 })
  game.tickConstruction(30)
  return game
}

describe('power plant upgrades', () => {
  it('shows the brown-out, pans to the hangar, and Tier II removes the alert', () => {
    const game = lateField()
    expect(game.fieldLevel()).toBe(4)
    expect(game.powerPlantTier).toBe(1)
    const before = game.powerReport()
    expect(before.brownout).toBe(true)
    expect(before.demand).toBeGreaterThan(250)
    game.refreshAdvice()
    const notes = game.advice.filter((note) => note.id === 'power-brownout')
    expect(notes).toHaveLength(1)
    expect(notes[0]?.cells.length).toBe(1)
    expect(game.infoLines('power').some((line) => line.includes('Brown-out'))).toBe(true)
    game.focusAdvice('power-brownout')
    expect(game.apronFocus).toEqual(notes[0]?.cells)
    expect(game.consumeCameraCue()).toEqual(notes[0]?.cells[0])

    expect(canUpgradePower(1, 4).ok).toBe(true)
    expect(canUpgradePower(2, 4).ok).toBe(false)
    const cash = game.cash
    game.upgradePowerPlant()
    expect(game.powerPlantTier).toBe(2)
    expect(game.cash).toBe(cash - powerPlantOffer(2).cost)
    expect(game.powerReport().brownout).toBe(false)
    game.refreshAdvice()
    expect(game.advice.some((note) => note.id === 'power-brownout')).toBe(false)
    expect(game.infoLines('power').some((line) => line.includes('Supply covers demand'))).toBe(true)
  })

  it('unlocks Tier III at field level 5 and bills daily upkeep', () => {
    const game = lateField()
    game.upgradePowerPlant()
    expect(game.upgradePowerPlant).toBeTypeOf('function')
    game.upgradePowerPlant()
    expect(game.powerPlantTier).toBe(2)
    game.fieldXp = 700
    expect(game.fieldLevel()).toBe(5)
    const cash = game.cash
    game.upgradePowerPlant()
    expect(game.powerPlantTier).toBe(3)
    expect(game.cash).toBe(cash - powerPlantOffer(3).cost)
    expect(game.powerReport().capacity).toBe(1_400)
    const before = game.cash
    game.tick(180)
    expect(game.cash).toBeLessThan(before - powerPlantOffer(3).upkeepPerDay + 1)
    expect(game.cash).toBeGreaterThan(before - powerPlantOffer(3).upkeepPerDay - 80_000)
  })
})
