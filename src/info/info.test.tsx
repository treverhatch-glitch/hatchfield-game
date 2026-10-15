import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultConfig } from '../logistics/defaults.ts'
import { Game } from '../game/sim.ts'
import { tankDef } from '../scale/logic.ts'
import { InfoViews } from '../ui/InfoViews.tsx'
import { readMapView } from './read.ts'
import { closeMapView, mapViewSnapshot, resetMapView, toggleMapView } from './session.ts'
import { MAP_VIEWS, type MapViewId } from './types.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  game.tick(0.5)
  return game
}

function finger(game: Game) {
  return {
    cash: game.cash,
    reputation: game.reputation,
    clock: game.clock,
    tankLitres: game.tankLitres,
    fuelLoads: game.fuelLoads,
    landsideOpen: game.landsideOpen,
    fuelOpen: game.fuelOpen,
    infoOpen: game.infoOpen,
    flights: game.flights.length,
    speed: game.speed,
    fees: { ...game.fees },
  }
}

describe('info views', () => {
  beforeEach(() => resetMapView())

  it('toggles one view at a time and reads only snapshots', () => {
    const game = field()
    const before = finger(game)
    const writes: string[] = []
    const proxy = new Proxy(game, {
      set(target, prop, value, receiver) {
        writes.push(String(prop))
        return Reflect.set(target, prop, value, receiver)
      },
    })
    let groundReads = 0
    const ground = game.groundSnapshot.bind(game)
    game.groundSnapshot = () => {
      groundReads += 1
      return ground()
    }

    for (const id of MAP_VIEWS) {
      toggleMapView(id)
      expect(mapViewSnapshot().active).toBe(id)
      expect(mapViewSnapshot().detail).toBe(false)
      const model = readMapView(proxy, id)
      expect(model.id).toBe(id)
      expect(model.legend.length).toBeGreaterThan(0)
      const shown = [...model.scores, ...model.details]
      expect(shown.length).toBeGreaterThan(0)
      for (const score of shown) {
        expect(score.why, `${id} ${score.id}`).toMatch(/Inputs:/)
        expect(score.value.length, `${id} ${score.id}`).toBeGreaterThan(0)
      }
    }

    toggleMapView(mapViewSnapshot().active as MapViewId)
    expect(mapViewSnapshot().active).toBeNull()
    closeMapView()
    expect(writes, 'view reads assigned sim fields').toEqual([])
    expect(groundReads, 'fuel view must not read the logistics ledger').toBe(0)
    expect(finger(game)).toEqual(before)
  })

  it('shows the sim tank, not the logistics 500k/300k farm', () => {
    const game = field()
    const logistics = defaultConfig().fuelFarm
    expect(logistics.capacityLitres).toBe(500_000)
    expect(logistics.initialLitres).toBe(300_000)
    expect(tankDef(game.tankTier).capacityLitres).toBe(80_000)
    game.tankLitres = 20_000
    const fuel = readMapView(game, 'fuel')
    const level = fuel.scores.find((score) => score.id === 'level')
    expect(level?.value).toContain('20,000')
    expect(level?.value).toContain('80,000')
    expect(level?.why).toContain('tankLitres')
    expect(level?.value).not.toContain('500,000')
    expect(level?.value).not.toContain('300,000')
    const trucks = fuel.scores.find((score) => score.id === 'trucks')
    expect(trucks?.why).toMatch(/state is road/)
  })

  it('keeps queue lines as text and opens numbers from the bar', () => {
    const game = field()
    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      }),
    })
    const queues = readMapView(game, 'queues')
    expect(queues.scores.map((score) => score.id)).toEqual(['checkin-wait', 'security-wait'])
    const bays = readMapView(game, 'bays')
    expect(bays.details.length).toBeGreaterThan(0)
    const airfield = readMapView(game, 'airfield')
    const movements = airfield.scores.find((score) => score.id === 'movements')
    expect(movements?.value).toMatch(/\d+ \/ \d+/)
    expect(movements?.why).toMatch(/Inputs:/)
    toggleMapView('queues')
    const html = renderToStaticMarkup(<InfoViews game={game} />)
    expect(html).toContain('data-testid="info-view-queues"')
    expect(html).toContain('info-view-legend')
    expect(html).toContain('Inputs:')
    expect(html).not.toContain('landside-flow-toggle')
    expect(html).not.toContain('fuel-farm-toggle')
    vi.unstubAllGlobals()
  })
})
