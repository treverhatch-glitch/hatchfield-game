import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RESEARCH_NODES } from '../src/research/nodes.ts'
import { TIP_PERSONAS, runHeadless } from '../src/playtest/run.ts'
import { summarizeRun } from '../src/playtest/summary.ts'
import type { PersonaReport } from '../src/playtest/types.ts'

const MARKS = [15, 30, 60, 90] as const

describe('research pace', () => {
  it('runs each persona for 90 days and writes the table', () => {
    const reports = runHeadless({
      personas: TIP_PERSONAS.map((persona) => ({ ...persona, days: 90 })),
      onProgress: (line) => console.log(line),
    })
    const body = render(reports)
    writeFileSync(new URL('../docs/playtest/research_pace.md', import.meta.url), body)
    writeFileSync(
      new URL('../docs/playtest/bots/tip90.json', import.meta.url),
      JSON.stringify(reports.map(summarizeRun), null, 2),
    )
    expect(reports).toHaveLength(3)
    for (const report of reports) expect(report.nanFlags).toEqual([])
    const careful = reports.find((report) => report.persona === 'careful')
    const finished = careful?.days.find((entry) => entry.treeNodes >= RESEARCH_NODES.length)
    expect(finished?.day).toBeGreaterThanOrEqual(70)
    expect(finished?.day).toBeLessThanOrEqual(90)
    const chaotic = reports.find((report) => report.persona === 'chaotic')
    const chaoticEnd = chaotic?.days.at(-1)
    expect(chaoticEnd?.treePoints ?? Infinity).toBeLessThanOrEqual(324)
  })
})

function nearest(report: PersonaReport, day: number) {
  const row = report.days.filter((entry) => entry.day <= day).at(-1)
  return row ?? report.days[0]
}

function render(reports: PersonaReport[]): string {
  const lines: string[] = []
  lines.push('# Research pace — 90-day headless')
  lines.push('')
  lines.push(
    'Measured on `17ac92b` (15 Oct 2026). Headway is 48s. These three runs sign the Apex term and do not hire.',
  )
  lines.push('')
  lines.push(
    'Careful, Greedy, and Chaotic each ran 90 sim days on the tip policy (standard difficulty, passenger focus, sandbox off). They sign Apex Local, they do not build a second strip, and they hire no researchers. The live bot policy that adds a strip and one researcher is measured separately. One day is 180 sim seconds. The driver uses the player command API at 5×, tick dt 0.25s, and looks at the board every 12 sim seconds. Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`.',
  )
  lines.push('')
  lines.push(
    'The Growth tree is the only research wallet. Operations trickle, finished flights, and lab rooms pay into it. Unspent points stop at twice the next node\'s cost (twice the dearest node once the tree is owned). The catalog has ' +
      `${RESEARCH_NODES.length} nodes.`,
  )
  lines.push('')
  lines.push('| Persona | Day 15 nodes | Day 15 unspent | Day 30 nodes | Day 30 unspent | Day 60 nodes | Day 60 unspent | Day 90 nodes | Day 90 unspent | Tree complete | Lab at day 90 |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |')
  for (const report of reports) {
    const cells = MARKS.map((day) => {
      const row = nearest(report, day)
      return `${row?.treeNodes ?? 0} | ${row?.treePoints ?? 0}`
    }).join(' | ')
    const end = report.days.at(-1)
    const done = report.days.find((entry) => entry.treeNodes >= RESEARCH_NODES.length)
    const gear = end
      ? `${end.labDesks} desk, ${end.labBoards} board, ${end.labMachines} bench, ${end.researchers} researchers`
      : '—'
    lines.push(`| ${report.label} | ${cells} | ${done ? `day ${done.day}` : '—'} | ${gear} |`)
  }
  lines.push('')
  lines.push('Unspent is whole Growth-tree points still in the wallet. Nodes are Growth-tree nodes owned that day.')
  lines.push('')
  for (const report of reports) {
    const end = report.research
    lines.push(
      `**${report.label}** ended day ${report.daysRan} with ${end.treeUnlocked.length} tree nodes and ${end.treePoints} unspent points (${end.desks} desks, ${end.boards} boards, ${end.machines} benches).`,
    )
  }
  lines.push('')
  return lines.join('\n')
}
