/**
 * The live-game API a host engine (Unity, through an embedded JavaScript engine) calls. Option A (2026-10-31):
 * the host runs these rules unchanged and only draws, takes input and shows UI. Everything crosses the boundary
 * as plain JSON-able data.
 *
 *   const g = newGame('city-start', seed)     a game set up by a replay scenario's opening
 *   tick(g, dtSec)                             advance the rules (the host calls it on its fixed step)
 *   view(g)                                    what to draw this frame: clock, money, flights, the tile grid
 */
import { Game } from '../../src/game/sim.ts'
import { SCENARIOS } from './replay.ts'

export { play, checkpoint, REPLAY_FORMAT, DAY_SEC, STEP_SEC } from './replay.ts'
// The rules' deterministic math, exported so another engine can check it bit for bit (detmath-fixture.ts, PU-22).
export { detSin, detCos, detTan, detAsin, detAcos, detAtan, detAtan2, detHypot, detExp, detLog, detPow, detCosh } from '../../src/game/detMath.ts'

export function newGame(scenario: string, seed: number): Game {
  const s = SCENARIOS[scenario]
  if (!s) throw new Error(`no scenario "${scenario}"`)
  const g = new Game()
  g.beginNew('easy', seed >>> 0)
  s.setup(g)
  return g
}

export function tick(g: Game, dtSec: number, scenario = 'city-start'): void {
  g.tick(dtSec)
  SCENARIOS[scenario]?.everyTick?.(g)
}

export interface ViewFlight { id: string; flightNo: string; phase: string; craft: string; x: number; y: number; z: number; heading: number }

export function view(g: Game) {
  const tiles: { c: number; r: number; kind: string }[] = []
  g.tiles.forEach((row, r) => row.forEach((kind, c) => { if (kind !== 'grass') tiles.push({ c, r, kind }) }))
  return {
    day: g.gameDay(),
    clock: g.clock,
    speed: g.speed,
    cash: g.cash,
    paxServed: g.paxServed,
    flightsDone: g.flightsDone,
    reputation: g.reputation,
    cols: g.tiles[0]?.length ?? 0,
    rows: g.tiles.length,
    tiles,
    flights: g.flights.map((f): ViewFlight => ({ id: f.id, flightNo: f.flightNo, phase: f.phase, craft: f.craft, x: f.x, y: f.y, z: f.z, heading: f.heading })),
  }
}
