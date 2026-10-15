import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { fittingDef, hostKey } from './catalog.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  return game
}

function mxFor(game: Game, bay: { c: number; r: number } | null): number {
  return (game as unknown as { hangarMxFor(bay: { c: number; r: number } | null): number }).hangarMxFor(bay)
}

describe('fire bell and hangar office', () => {
  it('shortens the scramble and names it on the card and in the news', () => {
    const game = field()
    expect(game.scrambleSec()).toBe(45)
    game.tool = 'pan'
    game.clickTile({ c: 19, r: 8 })
    expect(game.buildingCard()?.note).toBe('Scramble 45s. Drive time unchanged.')
    const row = game.buildingCard()?.sections?.find((section) => section.id === 'attachments')?.rows[0]
    expect(row?.label).toBe('Alarm bell needs Field level 2.')
    expect(row?.label).not.toContain('$')
    game.fieldXp = 700
    const cash = game.cash
    expect(game.buyFitting(hostKey('fire', 19, 8), 'alarm_bell')).toBe(true)
    expect(game.cash).toBe(cash - fittingDef('alarm_bell').cost)
    expect(game.scrambleSec()).toBe(36)
    expect(game.buildingCard()?.note).toBe('Scramble 36s. Drive time unchanged.')
    const before = (game as unknown as { pillarUpkeepBill(): number }).pillarUpkeepBill()
    game.removeFitting(hostKey('fire', 19, 8), 'alarm_bell')
    const after = (game as unknown as { pillarUpkeepBill(): number }).pillarUpkeepBill()
    expect(before - after).toBe(fittingDef('alarm_bell').upkeepPerDay)
    game.buyFitting(hostKey('fire', 19, 8), 'alarm_bell')

    game.tiles[2]![2] = 'fuel'
    game.fireIncidentCool = 0
    const random = Math.random
    Math.random = () => 0
    try {
      game.tickFireRisk(1)
    } finally {
      Math.random = random
    }
    expect(game.news[0]?.text).toMatch(/[Ss]cramble 36s/)
  })

  it('shortens line MX only on the hangar that has an office', () => {
    const game = field()
    game.fieldXp = 700
    game.tiles[4]![4] = 'hangar'
    game.tiles[4]![8] = 'hangar'
    const base = game.hangarMxDuration()
    expect(mxFor(game, { c: 4, r: 4 })).toBe(base)
    expect(game.buyFitting(hostKey('hangar', 4, 4), 'line_office')).toBe(true)
    expect(mxFor(game, { c: 4, r: 4 })).toBeCloseTo(base * 0.9)
    expect(mxFor(game, { c: 8, r: 4 })).toBe(base)
    game.tool = 'pan'
    game.clickTile({ c: 4, r: 4 })
    const rows = game.buildingCard()?.sections?.find((section) => section.id === 'attachments')?.rows ?? []
    expect(rows.some((item) => item.label.includes('line_office'))).toBe(true)
    expect(game.buildingCard()?.note).toContain((base * 0.9).toFixed(1))
  })
})
