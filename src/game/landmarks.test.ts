import { describe, expect, it } from 'vitest'
import { LATE_FIELD_XP, prestigeThreshold } from './catalog.ts'
import { Game } from './sim.ts'
import { buildingById } from '../tier3plus/index.ts'
import { stampCard, toolStampInput } from '../ui/nav/stampFacts.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.cash = 20_000_000
  return game
}

function closeDays(game: Game, days: number) {
  for (let i = 0; i < days; i++) {
    game.clock += 180
    game.tickPayroll(0)
  }
}

function stamp(game: Game, tool: 'aviation_museum' | 'observation_tower' | 'art_concourse', c: number, r: number) {
  game.setTool('pan')
  game.setTool(tool)
  game.clickTile({ c, r })
}

describe('prestige landmarks', () => {
  it('reaches Field level 10 on the late ladder', () => {
    const game = field()
    game.fieldXp = LATE_FIELD_XP[10]
    expect(game.lateFieldLevel()).toBe(10)
  })

  it('refuses below the level, then builds, charges, and draws door income after the build', () => {
    const game = field()
    stamp(game, 'aviation_museum', 14, 2)
    expect(game.lateSites).toHaveLength(0)

    game.fieldXp = LATE_FIELD_XP[9]
    const before = game.cash
    stamp(game, 'aviation_museum', 15, 2)
    const spec = buildingById('aviation_museum')
    if (spec?.kind !== 'landmark') throw new Error('museum missing')
    expect(game.lateSites).toHaveLength(1)
    expect(game.tiles[2]![15]).toBe('late_landmark')
    expect(game.lateIdAt(15, 2)).toBe('aviation_museum')
    expect(before - game.cash).toBe(spec.cost)

    const rating = game.fieldRating()
    closeDays(game, spec.buildDays - 1)
    expect(game.lateOpenAt(15, 2)).toBe(false)
    expect(game.fieldRating()).toBe(rating)
    closeDays(game, 1)
    expect(game.lateOpenAt(15, 2)).toBe(true)
    expect(game.fieldRating()).toBeGreaterThanOrEqual(Math.min(100, rating + 1))
    const lines = game.infoLines('late-site:15,2').join(' ')
    expect(lines).toMatch(/visitors a day/)
    expect(lines).toMatch(/short of upkeep/)
  })

  it('is one per airport', () => {
    const game = field()
    game.fieldXp = LATE_FIELD_XP[9]
    stamp(game, 'aviation_museum', 15, 2)
    stamp(game, 'aviation_museum', 16, 2)
    expect(game.lateSites).toHaveLength(1)
  })

  it('holds a star-gated landmark until the prestige star is earned', () => {
    const game = field()
    game.fieldXp = LATE_FIELD_XP[10]
    expect(game.prestigeStars()).toBe(0)
    stamp(game, 'art_concourse', 14, 2)
    expect(game.lateSites).toHaveLength(0)
    game.fieldXp = prestigeThreshold(1)
    expect(game.prestigeStars()).toBe(1)
    stamp(game, 'art_concourse', 15, 2)
    expect(game.lateSites).toHaveLength(1)
  })

  it('keeps the tower clear of a runway', () => {
    const game = field()
    game.fieldXp = LATE_FIELD_XP[10]
    const run = { c: 15, r: 3 }
    game.tiles[run.r]![run.c] = 'runway'
    stamp(game, 'observation_tower', 15, 2)
    expect(game.lateSites).toHaveLength(0)
  })

  it('shows the star lock on the tray card', () => {
    const owned = new Set<string>()
    const locked = stampCard(toolStampInput('quiet_hall', 10, 10, owned, new Set(), 0))
    expect(locked.locked).toBe(true)
    expect(locked.sentence).toMatch(/3 prestige stars/)
    const open = stampCard(toolStampInput('quiet_hall', 10, 10, owned, new Set(), 3))
    expect(open.locked).toBe(false)
  })
})
