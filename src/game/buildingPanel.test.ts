import { describe, expect, it } from 'vitest'
import { Game } from './sim'

describe('building panel', () => {
  it('opens on a stand click and names the missing tug', () => {
    const game = new Game()
    game.tiles[5]![5] = 'stand'
    game.scaleFleet = { fuel_truck: 1, baggage_tug: 1, belt_loader: 1, catering_truck: 1 }
    game.tool = 'pan'
    game.clickTile({ c: 5, r: 5 })
    const card = game.buildingCard()
    expect(card?.name).toBe('Medium stand')
    expect(card?.why).toBe('Bay 2 idle: no tug')
    expect(card?.baysText).toBe('0 / 5')
    expect(card?.icons.some((icon) => icon.why === 'Bay 2 idle: no tug')).toBe(true)
    expect(card?.status).toBe('limited')
  })

  it('closes when the click is pavement', () => {
    const game = new Game()
    game.tiles[5]![5] = 'stand'
    game.clickTile({ c: 5, r: 5 })
    expect(game.buildingCard()).not.toBeNull()
    game.clickTile({ c: 4, r: 4 })
    expect(game.selectedBuilding).toBeNull()
    expect(game.buildingCard()).toBeNull()
  })

  it('puts a measured check-in bay on the same card', () => {
    const game = new Game()
    game.view = 'hall'
    game.selectFacility('checkin')
    const card = game.buildingCard()
    expect(card?.name).toBe('Check-in')
    expect(card?.baysTotal).toBeGreaterThan(0)
    expect(card?.staffText).toMatch(/^\d+ \/ \d+$/)
  })
})
