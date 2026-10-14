import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { STUCK_WATCH } from './stuckWatchdogData.ts'

function roughBytes(value: unknown, seen = new Set<object>()): number {
  if (typeof value === 'string') return value.length * 2
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return 8
  if (typeof value === 'function' || typeof value !== 'object') return 0
  if (seen.has(value)) return 0
  seen.add(value)
  if (ArrayBuffer.isView(value)) return value.byteLength
  if (value instanceof Map) {
    let size = 32
    for (const [key, item] of value) size += roughBytes(key, seen) + roughBytes(item, seen)
    return size
  }
  if (value instanceof Set) {
    let size = 32
    for (const item of value) size += roughBytes(item, seen)
    return size
  }
  if (Array.isArray(value)) {
    let size = 16
    for (const item of value) size += roughBytes(item, seen)
    return size
  }
  let size = 16
  for (const key of Object.keys(value)) {
    size += key.length * 2 + roughBytes((value as Record<string, unknown>)[key], seen)
  }
  return size
}

function biggestFields(game: Game): Record<string, number> {
  const rows: [string, number][] = []
  for (const key of Object.keys(game)) {
    rows.push([key, roughBytes((game as unknown as Record<string, unknown>)[key])])
  }
  rows.sort((a, b) => b[1] - a[1])
  return Object.fromEntries(rows.slice(0, 12))
}

const RUN = process.env.SOAK_150 === '1'
const DAYS = Math.max(1, Number(process.env.SOAK_DAYS || 150))
const FIELD_SECONDS_PER_DAY = 180
const TICK_DT = 0.1

describe.skipIf(!RUN)('150-day headless soak', () => {
  it('runs at top speed with no rendering, and fails on an unrecovered stall or >15% heap growth', () => {
    const collect = (globalThis as { gc?: () => void }).gc
    expect(collect, 'run with node --expose-gc').toBeTypeOf('function')

    const game = new Game()
    game.autosave = false
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.cash = 5_000_000
    game.fuelLoads = 40
    game.tankLitres = 200_000
    game.reputation = 80
    game.speed = 5
    game.scheduleAuto = true
    for (const id of ['bushline', 'northline', 'harbor']) {
      if (game.meetsReq(id) && !game.signed.includes(id)) {
        game.signed.push(id)
        game.airlineHeat[id] = 75
      }
    }

    const tickMs: number[] = []
    const target = game.clock + DAYS * FIELD_SECONDS_PER_DAY
    const warmupClock = game.clock + FIELD_SECONDS_PER_DAY
    let errors = 0
    let seenRecoveries = 0
    const byStep: Record<string, number> = {}
    const byState: Record<string, number> = {}

    const step = () => {
      const t0 = performance.now()
      try {
        game.tick(TICK_DT)
        if (game.offer) game.acceptOffer()
      } catch (err) {
        errors += 1
        console.error(err)
      }
      tickMs.push(performance.now() - t0)
      if (game.recoveryCount > seenRecoveries) {
        const fresh = game.recoveryCount - seenRecoveries
        for (const entry of game.recoveryLog.slice(0, fresh)) {
          byStep[entry.step] = (byStep[entry.step] ?? 0) + 1
          byState[`${entry.kind}:${entry.state}`] = (byState[`${entry.kind}:${entry.state}`] ?? 0) + 1
        }
        seenRecoveries = game.recoveryCount
      }
    }

    while (game.clock < warmupClock && errors === 0) step()
    collect!()
    const heapWarm = process.memoryUsage().heapUsed
    const stateWarm = roughBytes(game)
    const fieldsWarm = biggestFields(game)
    const warmupTicks = tickMs.length

    while (game.clock < target && errors === 0) step()
    collect!()
    const heapEnd = process.memoryUsage().heapUsed
    const stateEnd = roughBytes(game)
    const growth = heapWarm > 0 ? (heapEnd - heapWarm) / heapWarm : 0
    const outstanding = game.stuckOutstanding()
    const bankEntries = game.bank.ledger().entries.length
    const sorted = [...tickMs].sort((a, b) => a - b)
    const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))] ?? 0

    const report = {
      days: DAYS,
      reachedDay: Math.floor(game.clock / FIELD_SECONDS_PER_DAY),
      ticks: tickMs.length,
      warmupTicks,
      tickP95Ms: Number(pick(0.95).toFixed(3)),
      tickP50Ms: Number(pick(0.5).toFixed(3)),
      heapWarmBytes: heapWarm,
      heapEndBytes: heapEnd,
      heapGrowth: Number(growth.toFixed(4)),
      stateWarmBytes: stateWarm,
      stateEndBytes: stateEnd,
      stateGrowth: stateWarm > 0 ? Number(((stateEnd - stateWarm) / stateWarm).toFixed(4)) : 0,
      biggestFieldsWarm: fieldsWarm,
      biggestFields: biggestFields(game),
      recoveries: game.recoveryCount,
      recoveriesByStep: byStep,
      recoveriesByState: byState,
      bankEntries,
      schedule: game.schedule.length,
      people: game.people.length,
      hallGuests: game.hallGuests.length,
      outstanding,
      flights: game.flights.length,
      trucks: game.trucks.length,
      flightsDone: game.flightsDone,
      errors,
      recoverWithinMin: STUCK_WATCH.recoverWithinMin,
    }
    const text = JSON.stringify(report, null, 2)
    process.stdout.write(`\nSOAK_REPORT ${text}\n`)
    writeFileSync('/tmp/soak-report.json', `${text}\n`)

    expect(errors).toBe(0)
    expect(report.reachedDay).toBeGreaterThanOrEqual(DAYS)
    expect(outstanding).toEqual([])
    expect(growth).toBeLessThanOrEqual(0.15)
  }, 1_140_000)
})
