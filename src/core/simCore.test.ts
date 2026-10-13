import { describe, expect, it } from 'vitest'
import { snapshotHash } from './hash.ts'
import { SimCore } from './simCore.ts'

const DAY = 180

function field(seed?: number): SimCore {
  const core = new SimCore(seed === undefined ? {} : { seed })
  const game = core.game
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  game.offer = { airline: 'northline', age: 0, deadline: 36 }
  game.acceptOffer()
  game.speed = 1
  return core
}

/** Advance `days` of sim clock. `timeScale` 50 means 50× the caller's dt. */
function runDays(core: SimCore, days: number, timeScale: number) {
  core.timeScale = timeScale
  const clockStep = 0.5
  const steps = Math.round((days * DAY) / clockStep)
  const dt = clockStep / timeScale
  const parked = new Map<string, { at: string; since: number }>()
  let stuckTrucks = 0
  for (let i = 0; i < steps; i++) {
    core.tick(dt)
    const game = core.game
    for (const truck of game.trucks) {
      const at = `${truck.x.toFixed(2)},${truck.y.toFixed(2)}`
      const row = parked.get(truck.id)
      if (!row || row.at !== at) {
        parked.set(truck.id, { at, since: game.clock })
        continue
      }
      const dwelling = (truck.dwell ?? 0) > 0 || (truck.preDwell ?? 0) > 0
      if (!truck.patrol && !dwelling && game.clock - row.since > 240) stuckTrucks += 1
    }
  }
  return { stuckTrucks }
}

describe('SimCore', () => {
  it('round-trips a snapshot through JSON', () => {
    const core = field(11)
    runDays(core, 0.25, 1)
    const json = core.toJSON()
    const parsed = JSON.parse(json)
    expect(parsed.v).toBe(1)
    expect(parsed.rng.kind).toBe('mulberry32')

    const restored = SimCore.fromJSON(json)
    expect(JSON.parse(restored.toJSON())).toEqual(parsed)
    expect(restored.game.cash).toBe(core.game.cash)
    expect(restored.game.clock).toBe(core.game.clock)
    expect(restored.game.signed).toEqual(core.game.signed)
    expect(restored.game.flights.map((f) => f.id)).toEqual(core.game.flights.map((f) => f.id))
  })

  it('hashes the same 3-day snapshot for one seed', () => {
    const a = field(20261013)
    const b = field(20261013)
    runDays(a, 3, 1)
    runDays(b, 3, 1)
    const hashA = snapshotHash(a.snapshot())
    expect(snapshotHash(b.snapshot())).toBe(hashA)

    const other = field(20261014)
    runDays(other, 3, 1)
    expect(snapshotHash(other.snapshot())).not.toBe(hashA)
  }, 60_000)

  it('runs 5 game days at 50× with no renderer', () => {
    const core = field(5)
    const news: string[] = []
    const ticks: number[] = []
    core.events.on('news', (event) => news.push(event.text))
    core.events.on('tick', (event) => ticks.push(event.clock))
    const { stuckTrucks } = runDays(core, 5, 50)
    const game = core.game
    expect(game.clock).toBeGreaterThanOrEqual(5 * DAY - 0.01)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(Number.isFinite(game.reputation)).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
    expect(stuckTrucks).toBe(0)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(5 * DAY - 0.01)
    expect(news.length).toBeGreaterThan(0)
  }, 60_000)

  it('runs 30 game days headless with no lost passengers, bags, or stuck trucks', () => {
    const core = field(30)
    const { stuckTrucks } = runDays(core, 30, 50)
    const game = core.game
    expect(game.clock).toBeGreaterThanOrEqual(30 * DAY - 0.01)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
    expect(stuckTrucks).toBe(0)
  }, 90_000)
})
