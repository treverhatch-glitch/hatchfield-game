import { describe, expect, it } from 'vitest'
import { CONFIG, runChecks, clockLabel, formatTable } from './checks.mjs'

type Log = Record<string, unknown>
type Found = { category: string; severity: string; title: string }

const run = (log: Log): Found[] => runChecks(log)
const cats = (log: Log) => run(log).map((f) => f.category)

const clean = (): Log => ({
  endT: 1000,
  money: [
    { t: 1, kind: 'spend', amount: 5000, label: 'starter kit', before: 20000, after: 15000, action: 1 },
    { t: 40, kind: 'earn', amount: 420, label: 'BL100 landing fee', before: 15000, after: 15420 },
    { t: 41, kind: 'earn', amount: 380, label: 'BL100 outbound bags', before: 15420, after: 15800 },
  ],
  cashSamples: [
    { t: 1, cash: 15000 },
    { t: 41, cash: 15800 },
  ],
  fees: [{ t: 0, schedule: { landingPerTonne: 8, paxFee: 12, parkingFreeHours: 0, gpu: 40 } }],
  flightEvents: [
    { t: 30, id: 'f1', airline: 'bushline', phase: 'approach' },
    { t: 34, id: 'f1', airline: 'bushline', phase: 'landing' },
    { t: 38, id: 'f1', airline: 'bushline', phase: 'taxi_in' },
    { t: 45, id: 'f1', airline: 'bushline', phase: 'gone', gone: true },
  ],
  signed: [{ t: 5, airline: 'bushline' }],
  consoleErrors: [],
})

describe('scripted playthrough checks', () => {
  it('clean fixture has zero findings', () => {
    expect(run(clean())).toEqual([])
  })

  it('detects a $0 fee on the fee card', () => {
    const log = clean()
    log.fees = [{ t: 90, schedule: { landingPerTonne: 0, paxFee: 12 } }]
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ category: 'low-fee', title: 'Fee "landingPerTonne" is $0' })
  })

  it('detects a $1 fee on the fee card', () => {
    const log = clean()
    log.fees = [{ t: 90, schedule: { paxFee: 1 } }]
    expect(run(log).map((f) => f.title)).toEqual(['Fee "paxFee" is $1'])
  })

  it('ignores hour-count keys that are legitimately 0 or 1', () => {
    const log = clean()
    log.fees = [{ t: 0, schedule: { parkingFreeHours: 1 } }]
    expect(run(log)).toEqual([])
  })

  it('detects $0 and $1 postings', () => {
    const log = clean()
    ;(log.money as unknown[]).push(
      { t: 50, kind: 'earn', amount: 0, label: 'BL100 gpu', before: 15800, after: 15800 },
      { t: 51, kind: 'earn', amount: 1, label: 'BL100 cleaning', before: 15800, after: 15801 },
    )
    expect(run(log).filter((f) => f.category === 'low-fee')).toHaveLength(2)
  })

  it('groups repeated per-flight $0 lines into one finding with a count', () => {
    const log = clean()
    ;(log.money as unknown[]).push(
      { t: 50, kind: 'earn', amount: 0, label: 'N208E bag handling', before: 15800, after: 15800 },
      { t: 90, kind: 'earn', amount: 0, label: 'N322O bag handling', before: 15800, after: 15800 },
    )
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0].title).toContain('x2')
  })

  it('detects NaN cash in a money line and in a cash sample', () => {
    const log = clean()
    ;(log.money as unknown[]).push({ t: 60, kind: 'earn', amount: Number.NaN, label: 'bad fee', before: 15800, after: Number.NaN })
    ;(log.cashSamples as unknown[]).push({ t: 61, cash: Number.POSITIVE_INFINITY })
    const nan = run(log).filter((f) => f.category === 'nan')
    expect(nan).toHaveLength(2)
    expect(nan.every((f) => f.severity === 'critical')).toBe(true)
  })

  it('detects negative revenue', () => {
    const log = clean()
    ;(log.money as unknown[]).push({ t: 60, kind: 'earn', amount: -90, label: 'refund as fee', before: 15800, after: 15710 })
    expect(cats(log)).toEqual(['negative-revenue'])
  })

  it('detects a duplicate charge for one action', () => {
    const log = clean()
    ;(log.money as unknown[]).push(
      { t: 70, kind: 'spend', amount: 2200, label: 'Souvenirs', before: 15800, after: 13600, action: 7 },
      { t: 70, kind: 'spend', amount: 2200, label: 'Souvenirs', before: 13600, after: 11400, action: 7 },
    )
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ category: 'double-spend', severity: 'high' })
  })

  it('does not call two purchases in different actions a double-spend', () => {
    const log = clean()
    ;(log.money as unknown[]).push(
      { t: 70, kind: 'spend', amount: 2200, label: 'Souvenirs', before: 15800, after: 13600, action: 7 },
      { t: 90, kind: 'spend', amount: 2200, label: 'Souvenirs', before: 13600, after: 11400, action: 8 },
    )
    expect(run(log)).toEqual([])
  })

  it('detects a stuck flight (> 2 game hours in one phase)', () => {
    const log = clean()
    const limit = CONFIG.stuckHours * CONFIG.secPerHour
    log.flightEvents = [
      { t: 30, id: 'f2', airline: 'bushline', phase: 'servicing' },
      { t: 30 + limit + 5, id: 'f2', airline: 'bushline', phase: 'board' },
      { t: 30 + limit + 9, id: 'f2', airline: 'bushline', phase: 'gone', gone: true },
    ]
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ category: 'stuck-flight' })
    expect(f[0].title).toContain('servicing')
  })

  it('flags a flight still in one phase at the end of the run as high', () => {
    const log = clean()
    log.endT = 500
    log.flightEvents = [{ t: 30, id: 'f3', airline: 'bushline', phase: 'hold' }]
    expect(run(log)[0]).toMatchObject({ category: 'stuck-flight', severity: 'high' })
  })

  it('detects a flight from an airline with no contract', () => {
    const log = clean()
    ;(log.flightEvents as unknown[]).push(
      { t: 50, id: 'f9', airline: 'zoomjet', phase: 'approach' },
      { t: 52, id: 'f9', airline: 'zoomjet', phase: 'gone', gone: true },
    )
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ category: 'contract-mismatch' })
    expect(f[0].title).toContain('zoomjet')
  })

  it('detects a signed contract that never schedules a flight', () => {
    const log = clean()
    log.endT = 5000
    ;(log.signed as unknown[]).push({ t: 10, airline: 'zoomjet' })
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0].title).toContain('never scheduled')
  })

  it('does not fault a contract signed moments before the end of the log', () => {
    const log = clean()
    ;(log.signed as unknown[]).push({ t: 990, airline: 'zoomjet' })
    expect(run(log)).toEqual([])
  })

  it('reports console errors once with a count and ignores benign noise', () => {
    const log = clean()
    log.consoleErrors = [
      { t: 5, text: 'pageerror: x is undefined' },
      { t: 6, text: 'pageerror: x is undefined' },
      { t: 7, text: 'Failed to load resource: favicon.ico' },
    ]
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0].title).toBe('Console/page error x2')
  })

  it('turns script gaps into findings', () => {
    const log = clean()
    log.scriptGaps = [{ what: 'testid "starter-kit" not found', detail: 'fell back to game API' }]
    expect(cats(log)).toEqual(['script-gap'])
  })

  it('reports unledgered cash changes as one grouped low finding', () => {
    const log = clean()
    ;(log.money as unknown[]).push(
      { t: 80, kind: 'untracked', amount: -300, label: 'tick residual', before: 15800, after: 15500 },
      { t: 81, kind: 'untracked', amount: 0.2, label: 'tick residual', before: 15500, after: 15500.2 },
    )
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ category: 'unledgered-cash', severity: 'low' })
  })

  it('turns a world-audit violation into a finding', () => {
    const log = clean()
    log.worldViolations = [
      { rule: 'overlap', c: 15, r: 9, message: 'Road at 15,9 cuts through the terminal at 15,9.' },
    ]
    const f = run(log)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({
      category: 'world-violation',
      severity: 'high',
      title: 'Road at 15,9 cuts through the terminal at 15,9.',
    })
  })

  it('formats game time and tables', () => {
    expect(clockLabel(0)).toBe('day 1 00:00')
    expect(clockLabel(180 + 7.5)).toBe('day 2 01:00')
    expect(formatTable([])).toBe('No findings.')
    expect(formatTable(run({ ...clean(), fees: [{ t: 0, schedule: { paxFee: 0 } }] }))).toContain('paxFee')
  })
})
