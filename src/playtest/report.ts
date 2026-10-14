import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import { PLAYTEST_TUNING as T } from './tuning.ts'
import type { BrowserReport, PersonaReport, PlaytestReport, ResearchBuy } from './types.ts'

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
    `Headless bots use the player command API (new game, land, starter kit, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at ${report.tuning.maxSpeed}×. One sim day is ${report.tuning.daySeconds}s. Tick dt is ${report.tuning.tickDt}s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful, when the curb pressure is over 1 and cash can cover it, adds a bus bay, then a taxi rank, then a curb lane instead of that day's expansion.`,
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
  const taxiOut = persona.recovered.filter((row) => row.detail.includes('taxi_out')).length
  lines.push('')
  lines.push(`Taxi-out watchdog recoveries: ${taxiOut}.`)
  if (persona.recovered.length) {
    lines.push('')
    lines.push('Recovered:')
    lines.push('')
    const shown = persona.recovered.slice(0, 12)
    for (const row of shown) {
      lines.push(`- ${row.detail} step=${row.step} cleared at ${Math.round(row.recoveredClock ?? 0)}s`)
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
  lines.push('')
  lines.push(...renderSystems(persona))
  if (persona.notes.length) {
    lines.push('')
    for (const note of persona.notes) lines.push(`- ${note}`)
  }
  lines.push('')
  return lines
}

function renderResearch(persona: PersonaReport): string[] {
  const lines: string[] = []
  const pools = persona.research
  lines.push('#### Research pools')
  lines.push('')
  if (!pools) {
    lines.push('Research pools were not sampled.')
    lines.push('')
    return lines
  }
  const gear = `${pools.desks} research desk${pools.desks === 1 ? '' : 's'}, ${pools.boards} chalkboard${pools.boards === 1 ? '' : 's'}, ${pools.machines} lab bench${pools.machines === 1 ? '' : 'es'}`
  lines.push(`Lab furniture at the end: ${gear}. Researchers on payroll: ${pools.researchers}.`)
  lines.push('')
  const raised: string[] = []
  if (pools.deskLabRate > 0) raised.push(`the old research desk at ${pools.deskLabRate} RP/s`)
  if (pools.wave3RoomRate > 0) raised.push(`the Wave 3 R&D pool at ${pools.wave3RoomRate} RP/s`)
  if (pools.treeRoomRate > 0) raised.push(`the Growth tree at ${pools.treeRoomRate} RP/s`)
  if (raised.length) {
    lines.push(`Measured room rates from that furniture: ${raised.join('; ')}.`)
  } else {
    lines.push('Measured room rates from that furniture were 0 RP/s on every pool.')
  }
  lines.push(
    `Old research desk lab rate ${pools.deskLabRate} RP/s (operations trickle ${pools.deskOpsRate} RP/s, which does not read the rooms). Wave 3 room rate ${pools.wave3RoomRate} RP/s on top of its ${pools.wave3OpsRate} RP/s operations trickle. Growth tree room rate ${pools.treeRoomRate} RP/s on top of its ${pools.treeOpsRate} RP/s operations trickle.`,
  )
  const furnished = persona.days.find((day) => day.labDesks + day.labBoards + day.labMachines > 0)
  const before = furnished ? persona.days.filter((day) => day.day < furnished.day).at(-1) : undefined
  if (furnished) {
    const prior = before
      ? `the day before, Wave 3 room rate was ${before.wave3RoomRate} and the Growth room rate was ${before.treeRoomRate}`
      : 'no earlier day was sampled'
    lines.push(
      `First day with lab furniture was day ${furnished.day} (${furnished.labDesks} desk, ${furnished.labBoards} board, ${furnished.labMachines} bench). That day's Wave 3 room rate was ${furnished.wave3RoomRate} RP/s and the Growth room rate was ${furnished.treeRoomRate} RP/s; ${prior}. The old desk lab rate that day was ${furnished.deskLabRate} RP/s with ${furnished.researchers} researchers.`,
    )
  } else {
    lines.push('No lab furniture was on the field in the daily samples.')
  }
  lines.push('')
  lines.push(
    'Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.',
  )
  lines.push('')
  lines.push('| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  const marks = persona.days.filter((day) => day.day === 30 || day.day === 45 || day.day === 60)
  const shown = marks.length ? marks : persona.days.filter((day) => day.day === persona.daysRan)
  if (!shown.length) lines.push('| — | — | — | — | — | — | — |')
  for (const day of shown) {
    lines.push(
      `| ${day.day} | ${day.deskPoints} | ${day.deskEarned} | ${day.wave3Points} | ${day.wave3Earned} | ${day.treePoints} | ${day.treeEarned} |`,
    )
  }
  lines.push('')
  lines.push(`End of run: desk ${pools.deskPoints} balance / ${pools.deskEarned} earned, Wave 3 ${pools.wave3Points} balance / ${pools.wave3Earned} earned, Growth ${pools.treePoints} balance / ${pools.treeEarned} earned.`)
  lines.push('')
  lines.push(...buyLines(persona.researchBuys, 'desk', 'Old research desk'))
  lines.push(...buyLines(persona.researchBuys, 'wave3', 'Wave 3 R&D'))
  lines.push(...buyLines(persona.researchBuys, 'tree', 'Growth tree'))
  return lines
}

function buyLines(buys: ResearchBuy[], pool: ResearchBuy['pool'], label: string): string[] {
  const rows = buys.filter((buy) => buy.pool === pool)
  if (!rows.length) return [`${label}: no nodes bought.`, '']
  const lines = [`${label} nodes bought:`, '']
  for (const buy of rows) lines.push(`- day ${buy.day}: ${buy.name} (${buy.id}) for ${buy.cost} points`)
  lines.push('')
  return lines
}

function renderSystems(persona: PersonaReport): string[] {
  const books = persona.books
  const lines: string[] = []
  lines.push('#### New systems')
  lines.push('')
  if (!books) {
    lines.push('No system snapshot.')
    lines.push('')
    return lines
  }
  const owned = books.treeUnlocked.length ? books.treeUnlocked.join(', ') : 'none'
  lines.push(
    `Research tree: ${books.treePoints} points, ${books.treeUnlocked.length} nodes (${owned}). Operations trickle: ${books.wave3Points} points.`,
  )
  lines.push(
    `Desks: ${books.deskStaff} agents, check-in ${books.checkinStaffed ? 'staffed' : 'empty'}, security ${books.securityStaffed ? 'staffed' : 'empty'}.`,
  )
  lines.push(
    `Queues at the end: check-in ${books.checkinWaiting}, security ${books.securityWaiting}. Peaks: check-in ${persona.peaks.checkinWaiting}, security ${persona.peaks.securityWaiting}.`,
  )
  if (books.checkinLines.length) lines.push(`Check-in: ${books.checkinLines.join(' · ')}`)
  if (books.securityLines.length) lines.push(`Security: ${books.securityLines.join(' · ')}`)
  lines.push(
    `Curb: pressure ${round1(books.curbPressure)} (peak ${round1(persona.peaks.curbPressure)}), queue ${round1(books.curbQueue)} (peak ${round1(persona.peaks.curbQueue)}), delay ${Math.round(books.curbDelaySec)}s, lanes ${books.lanes}, bus bays ${books.busBays}, curb lanes ${books.curbLanes}, taxi ranks ${books.taxiRanks}.`,
  )
  lines.push(
    `Happiness peak ${persona.peaks.happiness == null ? '—' : persona.peaks.happiness}. Guest peak ${persona.peaks.guests}. Field-ask fines booked at the full rate: ${books.fieldAskFines}. Penalties total $${books.penaltyTotal.toLocaleString('en-US')}.`,
  )
  if (persona.nanFlags.length) {
    lines.push('')
    lines.push('Non-finite values:')
    lines.push('')
    for (const flag of persona.nanFlags) lines.push(`- ${flag}`)
  }
  lines.push('')
  lines.push(...renderResearch(persona))
  lines.push('Sinks and income by category:')
  lines.push('')
  if (!books.sinks.length) lines.push('Ledger was empty.')
  else {
    lines.push('| Category | Amount |')
    lines.push('| --- | --- |')
    for (const row of books.sinks) {
      lines.push(`| ${row.category} | $${row.amount.toLocaleString('en-US')} |`)
    }
  }
  lines.push('')
  lines.push('Relation tiers:')
  lines.push('')
  if (!books.relations.length) lines.push('No airline relations.')
  else {
    lines.push('| Airline | Score | Band | Tier |')
    lines.push('| --- | --- | --- | --- |')
    for (const row of books.relations) {
      lines.push(`| ${row.name} | ${row.score} | ${row.band} | ${row.tier} ${row.label} |`)
    }
  }
  lines.push('')
  return lines
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
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
