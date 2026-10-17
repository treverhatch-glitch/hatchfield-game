/**
 * npm run bench:sim            (prints JSON)
 * SIM_BENCH_OUT=/tmp/b.json npm run bench:sim
 * SIM_BENCH_DAYS=5 npm run bench:sim   (shorter warm-up)
 *
 * Headless sim-tick benchmark: no renderer, no browser. Builds the starter kit, signs the
 * early airlines and extra stands, warms up for N in-game days (default 20), then times
 * 5 in-game minutes of 0.05 s ticks. Reports mean, p95 and p99 tick ms with the walker and
 * truck counts at the end. Rolls are seeded so runs on the same machine compare.
 *
 * Runs under Vitest so Vite can transform import.meta.glob in the sim.
 */
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { test } from 'vitest'
import { Game } from '../src/game/sim.ts'
import { withSeed } from '../src/test/withSeed.ts'

function run(): Record<string, unknown> {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()

  game.cash = 5_000_000
  game.fuelLoads = 400
  game.tankLitres = 2_000_000
  game.contractId = 'apex_local'
  game.reputation = 80
  game.speed = 5
  game.scheduleAuto = true

  game.signed = ['bushline', 'northline', 'harbor', 'swift', 'vanguard', 'summit', 'horizon']
  for (const id of game.signed) game.airlineHeat[id] = 100

  for (const c of [-6, -4, -2, 0, 2, 4, 6]) {
    for (const r of [16, 18, 20, 22, 24, 26, 28, 30]) {
      try {
        game.buildFootprint({ c, r }, { kind: 'stand', sz: 'M', variant: 'walk' })
      } catch {
        // Occupied or off-plot cells are fine; the bench only wants extra stands.
      }
    }
  }

  const days = Number(process.env.SIM_BENCH_DAYS ?? '20')
  const warmTicks = (180 * days) / 0.5
  for (let i = 0; i < warmTicks; i++) {
    game.tick(0.5)
    if (game.offer) game.acceptOffer()
  }

  const tickDt = 0.05
  const ticks = Math.ceil((60 * 5) / tickDt)
  const tickMs: number[] = []
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now()
    game.tick(tickDt)
    if (game.offer) game.acceptOffer()
    tickMs.push(performance.now() - t0)
  }

  const sorted = [...tickMs].sort((a, b) => a - b)
  return {
    warmDays: days,
    ticks,
    meanMs: tickMs.reduce((a, b) => a + b, 0) / tickMs.length,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    p99Ms: sorted[Math.floor(sorted.length * 0.99)],
    pax: game.people.length + game.hallGuests.length,
    vehicles: game.trucks.length,
  }
}

test('sim tick benchmark', () => {
  const result = withSeed(15, run)
  const out = process.env.SIM_BENCH_OUT
  if (out) writeFileSync(out, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
})
