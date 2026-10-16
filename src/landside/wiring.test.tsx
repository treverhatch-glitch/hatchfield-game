import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../game/sim.ts'
import type { Flight, Vec } from '../game/types.ts'
import { BUS_EXPENSE, CURB_LANE_EXPENSE, TAXI_RANK_EXPENSE } from '../game/catalog.ts'
import { LANDSIDE, openCurbFlow } from '../landside/index.ts'
import { LandsidePanel } from '../ui/LandsideOverlay.tsx'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

function hold(game: Game) {
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.offerCool = 1e9
  game.heloCool = 1e9
  game.milCool = 1e9
  game.ambuCool = 1e9
  game.threatCool = 1e9
  game.emergencyCool = 1e9
}

function parked(id: string, stand: Vec, bill: boolean): Flight {
  return {
    id,
    airline: 'northline',
    flightNo: id,
    airframeId: 'crj700',
    airframeName: 'CRJ-700',
    pax: bill ? 40 : 20,
    cargo: false,
    craft: 'jet',
    kind: 'regional',
    phase: 'board',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0.12,
    heading: 0,
    path: [stand],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: !bill,
      bags: true,
      bagsLoad: true,
      fuel: true,
      catering: true,
      bagDrop: true,
      mx: false,
      deiced: true,
    },
    waitingOn: {
      bags: false,
      bagsLoad: false,
      fuel: false,
      catering: false,
      mx: false,
      deice: false,
      paxOut: 0,
      paxIn: 0,
    },
    phaseTime: 400,
    ledger: [],
  }
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

  it('withholds passenger fees after the curb misses check-ins', () => {
    const game = field()
    hold(game)
    const stand = { c: 12, r: 7 }
    for (let i = 0; i < 28; i++) game.flights.push(parked(`hold-${i}`, stand, false))
    game.setFee('paxFee', 24)
    for (let t = 0; t < 90 && game.missedCheckIns < 1; t++) game.tick(1)
    expect(game.missedCheckIns).toBeGreaterThan(0)
    expect(game.curbFeeMisses).toBe(game.missedCheckIns)
    const flight = parked('NL100', stand, true)
    game.flights.push(flight)
    const misses = Math.min(flight.pax, game.curbFeeMisses)
    game.beginServicing(flight)
    const paid = game.bank.ledger().entries.filter((entry) => entry.category === 'passenger_fees')
    expect(paid.at(-1)?.amount).toBeLessThan(flight.pax * game.fees.paxFee)
    expect(paid.at(-1)?.amount).toBeGreaterThan(0)
    expect(flight.ledger.some((line) => /missed check-in/.test(line.label))).toBe(true)
    expect(game.curbFeeMisses).toBe(game.missedCheckIns - misses)
    const html = renderToStaticMarkup(
      <LandsidePanel game={game} focus={null} onClose={() => undefined} onSelect={() => undefined} />,
    )
    expect(html).toContain('missed check-ins')
    expect(html).not.toContain('landside-flow-toggle')
  })

  it('stamps a bus bay, a curb lane, and a taxi rank, and the panel shows curb load', () => {
    const game = field()
    game.tick(0.25)
    const before = game.landsideUpkeep()
    const bare = game.landsideView().curbStalls
    expect(bare).toBeGreaterThan(0)
    game.tiles[8][18] = 'bus'
    game.tiles[9][18] = 'curb_lane'
    game.tiles[10][18] = 'taxi_rank'
    expect(game.landsideUpkeep()).toBe(before + BUS_EXPENSE + CURB_LANE_EXPENSE + TAXI_RANK_EXPENSE)
    game.tick(0.25)
    const view = game.landsideView()
    expect(view.busBays).toBe(1)
    expect(view.curbLanes).toBe(1)
    expect(view.taxiRanks).toBe(1)
    expect(view.curbStalls).toBe(
      bare + LANDSIDE.stallsPerBusBay + LANDSIDE.stallsPerCurbLane + LANDSIDE.stallsPerTaxiRank,
    )
    game.setHover({ c: 17, r: 8 })
    expect(game.hoverInspect?.kind).toBe('curb')
    if (game.hoverInspect?.kind === 'curb') expect(game.hoverInspect.loadLabel).toContain('/')
    game.cash = 80_000
    game.tool = 'bus'
    game.clickTile({ c: 16, r: 12 })
    expect(game.sites.some((site) => site.tool === 'bus') || game.tile({ c: 16, r: 12 }) === 'bus').toBe(true)
    game.openLandside(null)
    const html = renderToStaticMarkup(
      <LandsidePanel game={game} focus={null} onClose={() => undefined} onSelect={() => undefined} />,
    )
    expect(html).toContain('curb load')
    expect(html).toContain('bus bay')
  })

  it('renders the click-open overlay with capacity and flow', () => {
    const game = field()
    game.tick(0.2)
    const html = renderToStaticMarkup(
      <LandsidePanel game={game} focus={null} onClose={() => undefined} onSelect={() => undefined} />,
    )
    expect(html).toContain('data-testid="landside-flow"')
    expect(html).toContain('capacity')
    expect(html).toContain('flow')
    expect(html).toContain('Rail')
    expect(html).toContain('Inputs:')
    expect(html).not.toContain('landside-flow-toggle')
  })
})
