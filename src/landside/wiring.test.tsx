import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../game/sim.ts'
import { openCurbFlow } from '../landside/index.ts'
import { LandsideOverlay } from '../ui/LandsideOverlay.tsx'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

describe('landside wiring', () => {
  it('opens the curb panel from a road click and keeps fees untouched', () => {
    const game = field()
    const upkeep = game.landsideUpkeep()
    game.tool = 'pan'
    game.clickTile({ c: 17, r: 8 })
    expect(game.landsideOpen).toBe(true)
    expect(game.landsideFocus).toBe('17,8')
    game.clickTile({ c: 17, r: 8 })
    expect(game.landsideOpen).toBe(false)

    for (let t = 0; t < 20; t++) game.tick(0.5)
    const view = game.landsideView()
    expect(view.segments.length).toBeGreaterThan(0)
    expect(view.curbStalls).toBeGreaterThan(0)
    expect(view.vehicles.length).toBeGreaterThan(0)
    expect(game.landsideUpkeep()).toBe(upkeep)
  })

  it('exports openCurbFlow so Operations can open the panel', () => {
    const game = field()
    openCurbFlow(game)
    expect(game.landsideOpen).toBe(true)
    openCurbFlow(game)
    expect(game.landsideOpen).toBe(false)
    openCurbFlow(game, { c: 17, r: 8 })
    expect(game.landsideOpen).toBe(true)
    expect(game.landsideFocus).toBe('17,8')
  })

  it('renders the click-open overlay with capacity and flow', () => {
    const game = field()
    game.tick(0.2)
    expect(renderToStaticMarkup(<LandsideOverlay game={game} />)).toContain('landside-flow-toggle')
    game.openLandside(null)
    const html = renderToStaticMarkup(<LandsideOverlay game={game} />)
    expect(html).toContain('data-testid="landside-flow"')
    expect(html).toContain('capacity')
    expect(html).toContain('flow')
    expect(html).toContain('Rail')
  })
})
