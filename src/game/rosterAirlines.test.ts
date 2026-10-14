import { beforeEach, describe, expect, it } from 'vitest'
import { ROSTER } from '../airlines/roster.ts'
import { unlockGate } from '../airlines/rosterOffers.ts'
import { rosterLivery } from '../render/aircraft/procLivery.ts'
import { CATALOG_AIRLINE_IDS, isRosterAirlineId, rosterGameAirline, rosterGameAirlines } from './rosterAirlines.ts'
import { Game } from './sim.ts'

function fresh(focus: 'pax' | 'cargo' = 'pax'): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.startFocus = focus
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

function letters(game: Game, n: number): string[] {
  const seen: string[] = []
  for (let i = 0; i < n; i++) {
    game.offer = null
    game.offerCool = 0
    game.considerOffers()
    if (game.offer) seen.push((game.offer as { airline: string }).airline)
  }
  return seen
}

beforeEach(() => {
  localStorage.clear()
})

describe('roster airlines in the live game', () => {
  it('turns all 45 roster carriers into game airlines with their own paint', () => {
    const all = rosterGameAirlines()
    expect(all).toHaveLength(ROSTER.length)
    expect(ROSTER.length).toBe(45)
    for (const r of ROSTER) {
      const a = rosterGameAirline(r.id)!
      expect(a.name).toBe(r.name)
      expect(a.color).toBe(r.primary)
      expect(a.minRep).toBe(unlockGate(r).reputation)
      expect(CATALOG_AIRLINE_IDS.has(a.id)).toBe(false)
    }
  })

  it('resolves roster ids through game.airline() and lists them', () => {
    const game = fresh()
    const r = ROSTER[10]
    expect(game.airline(r.id).name).toBe(r.name)
    expect(game.allAirlines().filter((a) => isRosterAirlineId(a.id))).toHaveLength(45)
  })

  it('sends contract letters from the roster, not the 8 catalog carriers', () => {
    const game = fresh()
    const ids = letters(game, 6)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(CATALOG_AIRLINE_IDS.has(id)).toBe(false)
    expect(ids.every((id) => isRosterAirlineId(id) || id === 'zoomjet' || !CATALOG_AIRLINE_IDS.has(id))).toBe(true)
  })

  it('opens more of the roster as size and reputation grow', () => {
    const game = fresh()
    const open = () => ROSTER.filter((r) => game.rosterOpen(r.id)).length
    game.reputation = 20
    const low = open()
    game.reputation = 95
    const high = open()
    expect(high).toBeGreaterThan(low)
    // Flag carriers wait for a big field no matter the reputation.
    const flag = ROSTER.find((r) => r.type === 'flag')!
    expect(game.rosterAirport().size).toBeLessThan(unlockGate(flag).size)
    expect(game.rosterOpen(flag.id)).toBe(false)
  })

  it('still gives a cargo-first field an early freight letter', () => {
    const game = fresh('cargo')
    game.reputation = 40
    const cargo = ROSTER.filter((r) => r.type === 'cargo')
    expect(cargo.some((r) => game.rosterOpen(r.id))).toBe(true)
  })

  it('keeps catalog carriers resolvable for existing contracts', () => {
    const game = fresh()
    expect(game.airline('northline').name).toBe('Northline')
    expect(game.rosterOpen('northline')).toBe(false)
  })

  it('paints a roster flight with its procedural livery', () => {
    const r = ROSTER[20]
    const paint = rosterLivery(r.id, r.fleet[0])
    expect(paint).toBeTruthy()
    expect(paint!.airline).toContain(r.id)
  })
})
