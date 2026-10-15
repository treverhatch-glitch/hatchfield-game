/**
 * The Greedy expander bot plays the real sim for 25 days and keeps the game's own autosave,
 * so the batch B proof clips open on a busy field instead of an empty plot.
 * npx vitest run --config scripts/batch-b-proof.vitest.ts
 */
import { writeFileSync } from 'node:fs'
import { test } from 'vitest'
import { PERSONAS, runHeadless } from '../src/playtest/run.ts'
import { SAVE_KEY } from '../src/game/types.ts'

const DAYS = Number(process.env.PROOF_DAYS ?? 25)
const PERSONA = process.env.PROOF_PERSONA ?? 'greedy'
const OUT = process.env.PROOF_SAVE ?? '/tmp/batch-b-busy-save.txt'

test('a bot leaves a busy save', () => {
  const bot = PERSONAS.find((persona) => persona.id === PERSONA)!
  const [report] = runHeadless({ personas: [{ ...bot, days: DAYS }] })
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) throw new Error('the bot run left no autosave')
  writeFileSync(OUT, raw)
  console.log(
    `day ${report.daysRan}, cash ${report.cashEnd}, flights ${report.built.flightsDone}, signed ${report.built.signed}, ${report.notes.find((n) => n.startsWith('guests'))}`,
  )
}, 600_000)
