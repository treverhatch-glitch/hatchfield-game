import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import { PLAYTEST_TUNING as T } from './tuning.ts'
import type { BrowserReport, PersonaReport, PlaytestReport } from './types.ts'

export function assembleReport(headless: PersonaReport[], browser: BrowserReport): PlaytestReport {
  return {
    generatedAt: new Date().toISOString(),
    tuning: {
      tickDt: T.tickDt,
      actEverySec: T.actEverySec,
      maxSpeed: T.maxSpeed,
      daySeconds: REAL_SECONDS_PER_GAME_DAY,
    },
    headless,
    browser,
  }
}

export function renderReport(report: PlaytestReport): string {
  const lines: string[] = []
  lines.push('# Hatchfield bot playtest')
  lines.push('')
  lines.push(`Generated ${report.generatedAt}.`)
  lines.push('')
  lines.push(
    `Headless bots use the player command API (new game, land, starter kit, tile stamps, hall rooms, contract letters, loans, shop bids) and run at ${report.tuning.maxSpeed}×. One sim day is ${report.tuning.daySeconds}s. Tick dt is ${report.tuning.tickDt}s.`,
  )
  lines.push('')
  lines.push('## Headless personas')
  lines.push('')
  for (const persona of report.headless) lines.push(...renderPersona(persona))
  lines.push('## Browser smoke')
  lines.push('')
  lines.push(...renderBrowser(report.browser))
  lines.push('')
  return lines.join('\n')
}

function renderPersona(persona: PersonaReport): string[] {
  const lines: string[] = []
  lines.push(`### ${persona.label}`)
  lines.push('')
  lines.push(
    `${persona.difficulty} / ${persona.focus}, sandbox off. Requested ${persona.daysRequested} sim days, ran ${persona.daysRan}. ${persona.ticks} ticks in ${Math.round(persona.wallMs / 100) / 10}s wall.`,
  )
  lines.push('')
  lines.push('#### Time to first landing')
  lines.push('')
  lines.push(
    persona.timeToFirstLandingSec == null
      ? 'No aircraft reached a landing phase.'
      : `${persona.timeToFirstLandingSec}s (day ${persona.timeToFirstLandingDay}) — ${persona.firstLandingFlight} entered ${persona.firstLandingPhase}.`,
  )
  lines.push('')
  lines.push('#### Cash curve')
  lines.push('')
  lines.push(`Start $${persona.cashStart.toLocaleString('en-US')} · end $${persona.cashEnd.toLocaleString('en-US')}.`)
  lines.push('')
  lines.push(spark(persona.cashCurve.map((point) => point.cash)))
  lines.push('')
  lines.push('| Day | Cash |')
  lines.push('| --- | --- |')
  for (const point of sampleCurve(persona.cashCurve)) {
    lines.push(`| ${point.day} | $${point.cash.toLocaleString('en-US')} |`)
  }
  lines.push('')
  lines.push('#### Stuck or recovered')
  lines.push('')
  lines.push(...listOr(persona.stuck.map((row) => `${row.detail} (since ${Math.round(row.firstClock)}s)`), 'No entity was still stuck at the end.'))
  if (persona.recovered.length) {
    lines.push('')
    lines.push('Recovered:')
    lines.push('')
    const shown = persona.recovered.slice(0, 12)
    for (const row of shown) {
      lines.push(`- ${row.detail} cleared at ${Math.round(row.recoveredClock ?? 0)}s`)
    }
    if (persona.recovered.length > shown.length) {
      lines.push(`- … ${persona.recovered.length - shown.length} more`)
    }
  }
  lines.push('')
  lines.push('#### Console errors')
  lines.push('')
  lines.push(...listOr(persona.consoleErrors, 'None.'))
  lines.push('')
  lines.push('#### Softlocks')
  lines.push('')
  lines.push(...listOr(persona.softlocks, 'None detected.'))
  lines.push('')
  lines.push('#### Passenger satisfaction')
  lines.push('')
  lines.push(
    persona.satisfactionAvg == null
      ? 'No hall guests were sampled.'
      : `Mean happiness while guests were present: ${persona.satisfactionAvg}.`,
  )
  lines.push('')
  if (persona.satisfaction.length) {
    lines.push('| Day | Guests | Happiness | Field rating |')
    lines.push('| --- | --- | --- | --- |')
    for (const point of sampleCurve(persona.satisfaction)) {
      lines.push(
        `| ${point.day} | ${point.guests} | ${point.avg == null ? '—' : point.avg} | ${point.fieldRating} |`,
      )
    }
    lines.push('')
  }
  lines.push('#### Slowest sim ticks')
  lines.push('')
  if (!persona.slowestTicks.length) lines.push('No ticks recorded.')
  else {
    lines.push('| ms | Day | Clock | Flights | Guests |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const tick of persona.slowestTicks) {
      lines.push(`| ${tick.ms} | ${tick.day} | ${tick.clock}s | ${tick.flights} | ${tick.guests} |`)
    }
  }
  lines.push('')
  lines.push('#### Anything the bot could not do')
  lines.push('')
  lines.push(`${persona.couldNotTotal} failed commands.`)
  lines.push('')
  lines.push(
    ...listOr(
      persona.couldNot.map((row) => `${row.command} ×${row.count} — ${row.detail}`),
      'Every command succeeded.',
    ),
  )
  lines.push('')
  lines.push('Built:')
  lines.push('')
  lines.push(
    `- Runway strips ${persona.built.runway}, stands ${persona.built.stands}, terminal tiles ${persona.built.terminals}, snack bars ${persona.built.snacks}`,
  )
  lines.push(
    `- Shop units ${persona.built.shopUnits}, leased ${persona.built.leasedShops}, flights completed ${persona.built.flightsDone}`,
  )
  lines.push(`- Signed: ${persona.built.signed.length ? persona.built.signed.join(', ') : 'nobody'}`)
  const rooms = Object.entries(persona.built.rooms)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([id, count]) => `${id} ${count}`)
  lines.push(`- Rooms: ${rooms.length ? rooms.join(', ') : 'none'}`)
  if (persona.notes.length) {
    lines.push('')
    for (const note of persona.notes) lines.push(`- ${note}`)
  }
  lines.push('')
  return lines
}

function renderBrowser(browser: BrowserReport): string[] {
  const lines: string[] = []
  if (browser.skipped) {
    lines.push(`Skipped. ${browser.reason}`)
    return lines
  }
  lines.push(browser.ok ? 'Scripted opening finished.' : 'Scripted opening hit a problem.')
  lines.push('')
  lines.push(browser.reason)
  lines.push('')
  lines.push(`Wall ${Math.round(browser.wallMs / 100) / 10}s. Clock ended at ${Math.round(browser.clockEnd)}s.`)
  lines.push('')
  lines.push('#### Time to first landing')
  lines.push('')
  lines.push(
    browser.timeToFirstLandingSec == null
      ? 'No landing observed in the scripted window.'
      : `${browser.timeToFirstLandingSec}s.`,
  )
  lines.push('')
  lines.push('#### Cash curve')
  lines.push('')
  lines.push(browser.cashEnd == null ? 'Cash was not readable.' : `Ended at $${Math.round(browser.cashEnd).toLocaleString('en-US')}.`)
  lines.push('')
  lines.push(spark(browser.cashCurve.map((point) => point.cash)))
  lines.push('')
  lines.push('#### Stuck or recovered')
  lines.push('')
  lines.push(...listOr(browser.stuck.map((row) => row.detail), 'None still stuck.'))
  if (browser.recovered.length) {
    lines.push('')
    lines.push(...browser.recovered.map((row) => `- recovered ${row}`))
  }
  lines.push('')
  lines.push('#### Console errors')
  lines.push('')
  lines.push(...listOr(browser.consoleErrors, 'None.'))
  lines.push('')
  lines.push('#### Softlocks')
  lines.push('')
  lines.push(...listOr(browser.softlocks, 'None detected.'))
  lines.push('')
  lines.push('#### Passenger satisfaction')
  lines.push('')
  lines.push(
    browser.satisfactionAvg == null
      ? 'No hall guests sampled.'
      : `Mean happiness ${browser.satisfactionAvg}.`,
  )
  lines.push('')
  lines.push('#### Slowest sim ticks')
  lines.push('')
  if (!browser.slowestTicks.length) lines.push('Tick timings were not captured.')
  else {
    lines.push('| ms | Day | Clock | Flights | Guests |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const tick of browser.slowestTicks) {
      lines.push(`| ${tick.ms} | ${tick.day} | ${tick.clock}s | ${tick.flights} | ${tick.guests} |`)
    }
  }
  lines.push('')
  lines.push('#### Anything the bot could not do')
  lines.push('')
  lines.push(...listOr(browser.couldNot.map((row) => `${row.command} — ${row.detail}`), 'Scripted clicks landed.'))
  lines.push('')
  lines.push('Script:')
  lines.push('')
  for (const step of browser.script) lines.push(`- ${step}`)
  if (browser.screenshots.length) {
    lines.push('')
    lines.push('Screenshots:')
    lines.push('')
    for (const shot of browser.screenshots) lines.push(`- ${shot}`)
  }
  if (browser.notes.length) {
    lines.push('')
    for (const note of browser.notes) lines.push(`- ${note}`)
  }
  return lines
}

function listOr(items: string[], empty: string): string[] {
  if (!items.length) return [empty]
  return items.map((item) => `- ${item}`)
}

function sampleCurve<T extends { day: number }>(points: T[]): T[] {
  if (points.length <= 16) return points
  const picked: T[] = []
  const step = Math.ceil(points.length / 14)
  for (let i = 0; i < points.length; i += step) {
    const point = points[i]
    if (point) picked.push(point)
  }
  const last = points[points.length - 1]
  if (last && picked[picked.length - 1]?.day !== last.day) picked.push(last)
  return picked
}

function spark(values: number[]): string {
  if (!values.length) return '_no samples_'
  const min = Math.min(...values)
  const max = Math.max(...values)
  const bars = '▁▂▃▄▅▆▇█'
  if (max === min) return `${bars[3]!.repeat(Math.min(values.length, 48))}  $${Math.round(min).toLocaleString('en-US')}`
  const shown = values.length > 48 ? values.filter((_, i) => i % Math.ceil(values.length / 48) === 0) : values
  const line = shown
    .map((value) => bars[Math.max(0, Math.min(bars.length - 1, Math.round(((value - min) / (max - min)) * (bars.length - 1))))])
    .join('')
  return `\`${line}\`  $${Math.round(min).toLocaleString('en-US')} → $${Math.round(max).toLocaleString('en-US')}`
}
