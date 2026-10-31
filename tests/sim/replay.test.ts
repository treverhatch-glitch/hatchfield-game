// Replays (tools/replay/replay.ts): every recorded file in replays/ must play back to the same numbers, day by
// day. If a rule change moves them on purpose, record again (below) and say so in the PR.
//
//   npx vitest run tests/sim/replay.test.ts                                     check every replay file
//   REPLAY_RECORD=1,2,3 REPLAY_DAYS=3 npx vitest run tests/sim/replay.test.ts    record (or re-record) these seeds
//   REPLAY_PARITY=1,2,3 npx vitest run tests/sim/replay.test.ts --silent=false   one JSON line per seed, for npm run parity
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DAY_SEC, REPLAY_FORMAT, STEP_SEC, firstDifference, play, type ReplayFile } from '../../tools/replay/replay.ts'

const DIR = 'replays'
const seedsOf = (v: string | undefined) => (v ? v.split(',').map((s) => Number(s.trim()) >>> 0) : [])
const days = Number(process.env.REPLAY_DAYS || 3)
const scenario = process.env.REPLAY_SCENARIO || 'city-start'

describe('replays', () => {
  const record = seedsOf(process.env.REPLAY_RECORD)
  it.runIf(record.length > 0)('records', { timeout: 600_000 }, () => {
    mkdirSync(DIR, { recursive: true })
    let commit: string | null = null
    try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() } catch { /* not a checkout */ }
    for (const seed of record) {
      const file: ReplayFile = { format: REPLAY_FORMAT, scenario, seed, days, stepSec: STEP_SEC, rulesCommit: commit, checkpoints: play(scenario, seed, days) }
      writeFileSync(join(DIR, `${scenario}-${seed}.json`), `${JSON.stringify(file, null, 1)}\n`)
      const last = file.checkpoints.at(-1)!
      console.log(`[replay] recorded ${scenario}-${seed}: day ${last.day}, cash ${(last.cashCents / 100).toFixed(2)}, pax ${last.paxServed}, flights ${last.flightsDone}`)
    }
  })

  const parity = seedsOf(process.env.REPLAY_PARITY)
  it.runIf(parity.length > 0)('prints parity lines', { timeout: 600_000 }, () => {
    for (const seed of parity) {
      const last = play(scenario, seed, days).at(-1)!
      console.log(JSON.stringify({ seed, outcome: 'ran', tick: days * Math.round(DAY_SEC / STEP_SEC), cash: last.cashCents, pax: last.paxServed, flights: last.flightsDone, reputation: last.reputationMilli }))
    }
  })

  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : []
  it.runIf(!record.length && !parity.length && files.length > 0).each(files)('%s plays back the same, day by day', { timeout: 300_000 }, (f) => {
    const r = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as ReplayFile
    expect(r.format).toBe(REPLAY_FORMAT)
    expect(firstDifference(r.checkpoints, play(r.scenario, r.seed, r.days, r.stepSec))).toBeNull()
  })
})
