import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { rosterAirline } from '../airlines/roster.ts'
import type { Flight } from '../game/types.ts'
import { Game } from '../game/sim.ts'
import { createBridges } from '../render/aircraft/bridges.ts'
import { addFireStation } from '../render/world/airsideMass.ts'
import { starterGame } from '../render/world/fixtures.ts'
import { apronMasts, jetBridges, stands } from '../render/world/layout.ts'
import {
  fireDrillStanding,
  fireFine,
  fireReputationHit,
  FLAG_CLOTH,
  hostKey,
  scrambleNote,
} from './catalog.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  game.fieldXp = 700
  return game
}

function forceFire(game: Game) {
  game.tiles[2]![2] = 'fuel'
  game.fireIncidentCool = 0
  const random = Math.random
  Math.random = () => 0
  try {
    game.tickFireRisk(1)
  } finally {
    Math.random = random
  }
}

function apronFires(game: Game) {
  return game.bank.entriesBetween(0, 1e12).filter((entry) => entry.meta.label === 'Apron fire')
}

function categories(game: Game): Set<string> {
  return new Set(game.bank.entriesBetween(0, 1e12).map((entry) => entry.category))
}

function flight(stand: { c: number; r: number }, airframeId: string): Flight {
  return {
    id: airframeId,
    airline: 'northline',
    flightNo: 'NL1',
    airframeId,
    airframeName: airframeId,
    pax: 140,
    cargo: false,
    craft: 'jet',
    kind: airframeId === 'a380' ? 'widebody' : 'narrowbody',
    phase: 'board',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
      bags: false,
      bagsLoad: false,
      fuel: false,
      catering: false,
      bagDrop: false,
      mx: false,
      deiced: false,
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
    phaseTime: 0,
    ledger: [],
  }
}

function cap(game: Game, f: Flight): number {
  return (game as unknown as { boardCap(flight: Flight): number }).boardCap(f)
}

function attachment(game: Game, c: number, r: number, suffix: string) {
  game.tool = 'pan'
  game.clickTile({ c, r })
  return game.buildingCard()?.sections?.find((section) => section.id === 'attachments')?.rows.find((row) =>
    row.id.endsWith(suffix),
  )
}

function doorCabs(airframeId: string, doors?: number): number {
  const group = createBridges(airframeId, 1, doors)
  return group.children.filter((child) => child.name === 'bridge' || child.name === 'bridge-upper').length
}

describe('fitting honesty', () => {
  it('scales the fire fine, the reputation hit, and the drilled share by scramble time', () => {
    const quiet = field()
    quiet.setBudget('fire', 20)
    const quietCash = quiet.cash
    const quietRep = quiet.reputation
    const quietStanding = quiet.standingOf('northline')
    const quietCats = categories(quiet)
    forceFire(quiet)
    const quietFine = fireFine(0.2, quiet.scrambleSec())
    expect(quiet.scrambleSec()).toBe(45)
    expect(quiet.cash).toBe(quietCash - quietFine)
    expect(quiet.reputation).toBe(quietRep - fireReputationHit(0.2, 45))
    expect(quietFine).toBe(14_600)
    expect(fireReputationHit(0.2, 45)).toBe(8)
    expect(apronFires(quiet)).toHaveLength(1)
    expect(apronFires(quiet)[0]?.category).toBe('penalties')
    expect(quiet.standingOf('northline')).toBe(quietStanding)
    for (const category of categories(quiet)) {
      if (!quietCats.has(category)) expect(category).toBe('penalties')
    }

    const drilled = field()
    drilled.setBudget('fire', 100)
    const drilledRep = drilled.reputation
    forceFire(drilled)
    expect(drilled.news[0]?.text).toBe('ARFF drilled a hot brake — scramble 45s, no damage.')
    expect(drilled.reputation).toBe(drilledRep)
    expect(apronFires(drilled)).toHaveLength(0)
    expect(fireDrillStanding(45)).toBe(0)

    const bell = field()
    expect(attachment(bell, 19, 8, ':alarm_bell')?.label).toContain('scramble ×0.8')
    expect(bell.buyFitting(hostKey('fire', 19, 8), 'alarm_bell')).toBe(true)
    expect(bell.scrambleSec()).toBe(36)
    expect(bell.buildingCard()?.note).toBe(scrambleNote(36))

    bell.setBudget('fire', 20)
    const fineCash = bell.cash
    const fineRep = bell.reputation
    const fineCats = categories(bell)
    forceFire(bell)
    expect(bell.cash).toBe(fineCash - fireFine(0.2, 36))
    expect(fireFine(0.2, 36)).toBe(11_680)
    expect(bell.reputation).toBe(fineRep - fireReputationHit(0.2, 36))
    expect(fireReputationHit(0.2, 36)).toBe(6)
    expect(apronFires(bell)).toHaveLength(1)
    for (const category of categories(bell)) {
      if (!fineCats.has(category)) expect(category).toBe('penalties')
    }

    const fast = field()
    fast.buyFitting(hostKey('fire', 19, 8), 'alarm_bell')
    fast.setBudget('fire', 60)
    const fastCash = fast.cash
    const fastRep = fast.reputation
    forceFire(fast)
    expect(fast.cash).toBe(fastCash)
    expect(fast.reputation).toBe(fastRep + fireDrillStanding(36))
    expect(fireDrillStanding(36)).toBe(1)
    expect(fast.news[0]?.text).toContain('scramble 36s, no damage')
    expect(fast.news[0]?.text).toContain('Standing +1')
    expect(apronFires(fast)).toHaveLength(0)

    const full = field()
    full.buyFitting(hostKey('fire', 19, 8), 'alarm_bell')
    const fullRep = full.reputation
    forceFire(full)
    expect(full.reputation).toBe(fullRep + 1)
    expect(full.news[0]?.text).toBe('ARFF drilled a hot brake — scramble 36s, no damage. Standing +1.')
    expect(apronFires(full)).toHaveLength(0)
  })

  it('paints a flag without moving standing', () => {
    const game = field()
    const stand = { c: 11, r: 6 }
    const rep = game.reputation
    const standing = game.standingOf('northline')
    expect(attachment(game, 11, 6, ':flag')?.label).toContain('paint, standing unchanged')
    expect(game.buyFitting(hostKey('stand', 11, 6), 'flag')).toBe(true)
    expect(game.reputation).toBe(rep)
    expect(game.standingOf('northline')).toBe(standing)
    expect(game.standFlagColor(stand)).toBe(FLAG_CLOTH)
    expect(game.buildingCard()?.note).toContain('Flag · paint, standing unchanged')
    game.hubLeases = [{ id: 'stand:11,6', kind: 'gate', airlineId: 'northline' }]
    const cloth = rosterAirline('northline')?.primary ?? game.airline('northline').color
    expect(game.standFlagColor(stand)).toBe(cloth)
    expect(cloth).not.toBe(FLAG_CLOTH)
    expect(game.reputation).toBe(rep)
    expect(game.standingOf('northline')).toBe(standing)
  })

  it('shortens jetway boarding by the doors the aircraft can use', () => {
    const game = field()
    const stand = { c: 11, r: 6 }
    game.standSize['11,6'] = 'heavy'
    game.standRung['11,6'] = 2
    game.standClass['11,6'] = 'L'
    game.standScale['11,6'] = 'jumbo'
    const wide = flight(stand, 'a380')
    const narrow = flight(stand, 'b738')
    expect(game.buyFitting(hostKey('stand', 11, 6), 'jet_bridge')).toBe(true)
    const wideOne = cap(game, wide)
    const narrowOne = cap(game, narrow)
    expect(game.usableBridgeDoors(stand, 'a380')).toBe(1)
    expect(game.usableBridgeDoors(stand, 'b738')).toBe(1)
    expect(attachment(game, 11, 6, ':jet_bridge')?.label).toContain('door 2, shorter boarding, up to the aircraft')

    expect(game.buyFitting(hostKey('stand', 11, 6), 'jet_bridge')).toBe(true)
    expect(game.usableBridgeDoors(stand, 'a380')).toBe(2)
    expect(game.usableBridgeDoors(stand, 'b738')).toBe(1)
    expect(cap(game, wide)).toBeCloseTo(wideOne / 2)
    expect(cap(game, narrow)).toBe(narrowOne)
    expect(game.buildingCard()?.note).toContain('2 doors · shorter boarding, up to the aircraft')

    expect(game.buyFitting(hostKey('stand', 11, 6), 'jet_bridge')).toBe(true)
    expect(game.usableBridgeDoors(stand, 'a380')).toBe(3)
    expect(game.usableBridgeDoors(stand, 'b738')).toBe(1)
    expect(cap(game, wide)).toBeCloseTo(wideOne / 3)
    expect(cap(game, narrow)).toBe(narrowOne)

    game.tiles[5]![6] = 'depot'
    game.standAccess['11,12'] = 'jetway'
    game.standClass['11,12'] = 'L'
    game.bumpMap()
    const ground = (
      game as unknown as {
        ensureGround(): { sim: { stands: Map<string, { bridges?: number }> } } | null
      }
    ).ensureGround()
    const listed = (ground!.sim as unknown as { stands: Map<string, { bridges?: number }> }).stands
    expect(listed.get('11,6')?.bridges).toBe(3)
    expect(listed.get('11,12')?.bridges).toBe(1)
  })

  it('draws a mast, a flag, extra bridges, and a bell only when they are bought', () => {
    const game = starterGame()
    game.fieldXp = 700
    const stand = { c: 11, r: 6 }
    expect(game.standLit(stand)).toBe(false)
    expect(apronMasts(stands(game))).toHaveLength(0)
    expect(attachment(game, 11, 6, ':apron_light')?.label).toContain('removes Unlit')
    expect(game.buyFitting(hostKey('stand', 11, 6), 'apron_light')).toBe(true)
    const lit = stands(game)
    expect(apronMasts(lit)).toHaveLength(1)
    expect(lit.filter((row) => row.lit)).toHaveLength(1)

    game.standAccess['11,6'] = 'jetway'
    game.fittings['stand:11,6'] = [{ id: 'jet_bridge' }, { id: 'jet_bridge' }, { id: 'jet_bridge' }]
    const bridges = jetBridges(game, stands(game)).filter((bridge) => bridge.stand.c === 11 && bridge.stand.r === 6)
    expect(bridges).toHaveLength(3)
    expect(new Set(bridges.map((bridge) => `${bridge.root.x.toFixed(2)},${bridge.root.z.toFixed(2)}`)).size).toBe(3)

    expect(doorCabs('a380')).toBe(3)
    expect(doorCabs('a380', 1)).toBe(1)
    expect(doorCabs('a380', 2)).toBe(2)
    expect(doorCabs('a380', 3)).toBe(3)
    expect(createBridges('a380', 1, 2).userData.doors).toBe(2)

    const dark = new THREE.Group()
    addFireStation(dark)
    expect(dark.getObjectByName('alarm-bell')).toBeUndefined()
    const belled = new THREE.Group()
    addFireStation(belled, { bell: true })
    expect(belled.getObjectByName('alarm-bell')).toBeTruthy()
  })
})
