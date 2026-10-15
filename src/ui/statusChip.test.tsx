import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../game/sim.ts'
import { StatusChip } from './StatusChip.tsx'
import {
  runStatusChipAction,
  statusChipFromGame,
  statusChipPhrases,
  statusChipTarget,
  type StatusChipInput,
} from './statusChip.ts'

const quiet: StatusChipInput = {
  threat: null,
  emergency: false,
  standingLow: false,
  holding: 0,
  apronJam: false,
  securityQueue: false,
  lostPax: false,
  power: false,
  loanShort: false,
  disruptionTitles: [],
  dock: [],
}

describe('status chip', () => {
  it('renders No alerts for the empty phrase list', () => {
    const html = renderToStaticMarkup(<StatusChip phrases={[]} dockHasRows={false} onAct={() => {}} />)
    expect(statusChipPhrases(quiet).map((phrase) => phrase.text).join('')).toBe('')
    expect(html).toContain('data-testid="status-chip"')
    expect(html).toContain('No alerts')
    expect(html).toContain('title="No alerts"')
    expect(html).not.toContain('data-opens')
  })

  it('does not repeat a fuel or power line the dock is already showing', () => {
    const phrases = statusChipPhrases({
      ...quiet,
      power: true,
      disruptionTitles: ['Fuel farm is empty'],
      dock: [
        { severity: 'critical', title: 'Fuel farm is empty', key: 'cond:fuel-out' },
        { severity: 'warning', title: 'Power brown-out', key: 'cond:power' },
      ],
    })
    expect(phrases).toEqual([])
    const html = renderToStaticMarkup(<StatusChip phrases={phrases} dockHasRows={true} onAct={() => {}} />)
    expect(html).toContain('No alerts')
    expect(html).not.toContain('Fuel')
    expect(html).not.toContain('Power')
    expect(html).toContain('data-opens="dock"')

    const game = new Game()
    expect(game.pendingThreat).toBeNull()
    game.raiseAlert({
      key: 'cond:fuel-out',
      severity: 'critical',
      title: 'Fuel farm is empty',
      detail: '0 L',
    })
    const live = statusChipFromGame(game)
    expect(live.some((phrase) => /fuel|power/i.test(phrase.text))).toBe(false)
  })

  it('keeps holding, standing, the threat, and an emergency the dock does not raise', () => {
    const phrases = statusChipPhrases({
      ...quiet,
      threat: 'hard',
      emergency: true,
      standingLow: true,
      holding: 2,
      securityQueue: true,
      dock: [{ severity: 'warning', title: 'Check-in queue', key: 'e2e-queue' }],
    })
    expect(phrases.map((phrase) => phrase.text)).toEqual(['Hard threat', 'Emergency', 'Standing low', '2 holding'])
    expect(statusChipTarget(phrases, true)).toEqual({ kind: 'letter', id: 'threat' })
  })

  it('names an emergency letter and a click reveals it without a phone card', () => {
    const phrases = statusChipPhrases({ ...quiet, emergency: true })
    expect(phrases).toEqual([{ text: 'Emergency', letter: 'emergency' }])
    expect(statusChipTarget(phrases, false)).toEqual({ kind: 'letter', id: 'emergency' })
    const html = renderToStaticMarkup(<StatusChip phrases={phrases} dockHasRows={false} onAct={() => {}} />)
    expect(html).toContain('Emergency')
    expect(html).toContain('data-opens="emergency"')
    expect(html).not.toContain('phone')

    const calls: string[] = []
    runStatusChipAction(
      { kind: 'letter', id: 'emergency' },
      {
        openLetter: (id) => calls.push(`letter:${id}`),
        scrollLetter: (id) => calls.push(`scroll:${id}`),
        expandDock: () => calls.push('dock'),
      },
    )
    expect(calls).toEqual(['letter:emergency', 'scroll:emergency'])
  })

  it('drops a disruption title the dock shows and keeps one it does not', () => {
    const shown = statusChipPhrases({
      ...quiet,
      disruptionTitles: ['Software outage'],
      dock: [{ severity: 'warning', title: 'Software outage', key: 'disruption:software-outage' }],
    })
    expect(shown).toEqual([])
    const infoOnly = statusChipPhrases({
      ...quiet,
      disruptionTitles: ['Rival price war'],
      dock: [{ severity: 'info', title: 'Rival price war', key: 'disruption:rival-price-war' }],
    })
    expect(infoOnly.map((phrase) => phrase.text)).toEqual(['Rival price war'])
    expect(statusChipTarget([{ text: '2 holding' }], true)).toEqual({ kind: 'dock' })
    expect(statusChipTarget([{ text: 'Standing low' }], false)).toBeNull()
  })
})
