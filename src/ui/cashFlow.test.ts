import { describe, expect, it } from 'vitest'
import {
  cashSignature,
  estimateTextFor,
  incomeSource,
  moneyInText,
  projectedLevy,
  readFlow,
  runwayTextFor,
  stepCashFlow,
  type CashSnapshot,
  type FlowTracker,
} from './cashFlow'
import { moneyFull, moneyTick } from './moneyFormat'

function snap(over: Partial<CashSnapshot> = {}): CashSnapshot {
  return {
    cash: 50_000,
    sandbox: false,
    revenue: 0,
    hourIncome: 0,
    hourExpense: 0,
    econHour: 0,
    incomePerHour: 0,
    econHist: [],
    payrollCool: 30,
    clock: 0,
    payrollPerTick: 1000,
    upkeepPerTick: 200,
    staffLines: [
      { label: 'Maintenance', perTick: 400 },
      { label: 'Security staff', perTick: 600 },
    ],
    news: [],
    ...over,
  }
}

describe('cash flow selectors', () => {
  it('formats the prominent cash figure and the float tick', () => {
    expect(moneyFull(9_999_999)).toBe('$9,999,999')
    expect(moneyFull(-1200)).toBe('-$1,200')
    expect(moneyTick(1240)).toBe('$1,240')
    expect(moneyTick(295_703)).toBe('$296k')
  })

  it('classifies flight pay from the news line', () => {
    expect(incomeSource('UA100 landing (A320)  +$1,240')).toBe('Landings')
    expect(incomeSource('UA100 bag handling  +$400')).toBe('Bags')
    expect(incomeSource('City cargo intake (12u)  +$860')).toBe('Cargo')
    expect(moneyInText('UA100 landing (A320)  +$1,240')).toBe(1240)
    expect(moneyInText('bank wired $45,000')).toBeNull()
  })

  it('estimates a daily loss and a cash runway before any flights pay', () => {
    const { view } = stepCashFlow(null, snap(), 0)
    expect(view.incomePerDay).toBe(0)
    expect(view.costPerDay).toBe(7200)
    expect(view.estimateText).toBe('Est. -$7.2k/day')
    expect(view.arrow).toBe('down')
    expect(view.runwayText).toBe(runwayTextFor(50_000 / 7200))
    expect(view.runwayText).toBe('Cash lasts ~6.9 days')
    expect(view.nextChargeSec).toBe(30)
    expect(view.week.cost).toBe(7200 * 7)
    expect(view.week.net).toBe(-7200 * 7)
    expect(view.floats).toEqual([])
    expect(view.costLines.map((line) => line.label)).toEqual(['Upkeep', 'Maintenance', 'Security staff'])
  })

  it('floats a green landing tick and files it under that source', () => {
    const first = stepCashFlow(null, snap({ revenue: 0, news: [] }), 0)
    const next = stepCashFlow(
      first.tracker,
      snap({
        clock: 4,
        revenue: 1240,
        hourIncome: 1240,
        cash: 51_240,
        news: [{ id: 'n1', text: 'UA100 landing (A320)  +$1,240' }],
      }),
      1000,
    )
    expect(next.view.floats).toEqual([
      { id: 'in-n1', dir: 'up', amount: 1240, label: 'Landings', at: 1000 },
    ])
    expect(next.tracker.sessionIncome.Landings).toBe(1240)
  })

  it('treats unlabeled revenue as passenger spend', () => {
    const first = stepCashFlow(null, snap(), 0)
    const next = stepCashFlow(first.tracker, snap({ clock: 2, revenue: 40, cash: 50_040 }), 500)
    expect(next.view.floats.map((f) => f.label)).toEqual(['Passenger spend'])
    expect(next.view.floats[0].amount).toBe(40)
    expect(next.view.floats[0].dir).toBe('up')
  })

  it('does not float capital that never hits revenue', () => {
    const first = stepCashFlow(null, snap(), 0)
    const next = stepCashFlow(
      first.tracker,
      snap({
        clock: 8,
        cash: 55_000,
        news: [{ id: 'm1', text: 'Mission cleared: Secure the line. +$5,000, stock pops.' }],
      }),
      800,
    )
    expect(next.view.floats.filter((f) => f.dir === 'up')).toEqual([])
  })

  it('splits a payroll tick into upkeep, staff, and fees', () => {
    const seeded = stepCashFlow(null, snap({ cash: 240_000, sandbox: true, upkeepPerTick: 500 }), 0)
    const waiting = stepCashFlow(
      seeded.tracker,
      snap({ cash: 240_000, sandbox: true, upkeepPerTick: 500, clock: 29, payrollCool: 1 }),
      500,
    )
    const levy = projectedLevy(240_000, 1000, 0)
    expect(levy).toBe(2970)
    const tick = stepCashFlow(
      waiting.tracker,
      snap({
        cash: 240_000 - 1000 - levy,
        sandbox: true,
        upkeepPerTick: 500,
        clock: 30,
        payrollCool: 30,
        hourExpense: 1000 + levy,
      }),
      1000,
    )
    const down = tick.view.floats.filter((f) => f.dir === 'down')
    expect(down.map((f) => [f.label, f.amount])).toEqual([
      ['Staff', 1000],
      ['Fees', levy],
    ])
    expect(down.some((f) => f.label === 'Upkeep')).toBe(false)
  })

  it('leaves a sandbox pile out of the city levy estimate', () => {
    expect(projectedLevy(9_999_999, 1_000, 0, true)).toBe(0)
    expect(projectedLevy(9_999_999, 1_000, 0)).toBeGreaterThan(200_000)
  })

  it('books upkeep on the payroll tick when the field is not a sandbox', () => {
    const seeded = stepCashFlow(null, snap({ cash: 50_000 }), 0)
    const waiting = stepCashFlow(seeded.tracker, snap({ clock: 29, payrollCool: 1 }), 400)
    const tick = stepCashFlow(
      waiting.tracker,
      snap({ clock: 30, payrollCool: 30, hourExpense: 1200, cash: 48_800 }),
      900,
    )
    expect(tick.view.floats.filter((f) => f.dir === 'down').map((f) => [f.label, f.amount])).toEqual([
      ['Upkeep', 200],
      ['Staff', 1000],
    ])
  })

  it('does not float the same hour of income twice when the book rolls', () => {
    let tracker: FlowTracker = stepCashFlow(
      null,
      snap({ revenue: 100, hourIncome: 100, news: [{ id: 'a', text: 'UA1 landing  +$100' }] }),
      0,
    ).tracker
    const rolled = stepCashFlow(
      tracker,
      snap({
        clock: 7.5,
        econHour: 0,
        hourIncome: 0,
        hourExpense: 0,
        revenue: 100,
        econHist: [{ income: 100, expense: 0 }],
        news: [{ id: 'a', text: 'UA1 landing  +$100' }],
      }),
      2000,
    )
    expect(rolled.view.floats.filter((f) => f.dir === 'up')).toEqual([])
    tracker = rolled.tracker
    const more = stepCashFlow(
      tracker,
      snap({
        clock: 9,
        econHour: 1.5,
        hourIncome: 40,
        revenue: 140,
        payrollPerTick: 0,
        upkeepPerTick: 0,
        staffLines: [],
        econHist: [{ income: 100, expense: 0 }],
        news: [
          { id: 'b', text: 'UA2 bag handling  +$40' },
          { id: 'a', text: 'UA1 landing  +$100' },
        ],
      }),
      3000,
    )
    expect(more.view.floats.filter((f) => f.dir === 'up').map((f) => f.amount)).toEqual([40])
    expect(more.view.estimateText.startsWith('Est. +')).toBe(true)
  })

  it('posts a fee float for charges between payroll ticks', () => {
    const seeded = stepCashFlow(null, snap(), 0)
    const fine = stepCashFlow(
      seeded.tracker,
      snap({ clock: 10, payrollCool: 20, hourExpense: 1800, cash: 48_200 }),
      1000,
    )
    expect(fine.view.floats).toEqual([
      expect.objectContaining({ dir: 'down', label: 'Fees', amount: 1800 }),
    ])
  })

  it('resets the tape when a new game starts', () => {
    const played = stepCashFlow(
      null,
      snap({ revenue: 5000, clock: 80, news: [{ id: 'old', text: 'UA1 landing  +$5,000' }] }),
      0,
    )
    const again = stepCashFlow(played.tracker, snap({ revenue: 0, clock: 0, cash: 220_000 }), 50)
    expect(again.view.floats).toEqual([])
    expect(again.tracker.sessionIncome).toEqual({})
  })

  it('reads the same snapshot twice without a second float', () => {
    const base = snap()
    const first = readFlow(null, base, cashSignature(base), 0)
    const paid = snap({
      clock: 3,
      revenue: 1240,
      cash: 51_240,
      news: [{ id: 'n1', text: 'UA9 landing  +$1,240' }],
    })
    const second = readFlow(first, paid, cashSignature(paid), 1000)
    const third = readFlow(second, paid, cashSignature(paid), 1000)
    expect(third).toBe(second)
    expect(third.view.floats).toHaveLength(1)
  })

  it('turns a positive pace into Est. +$/day and drops the runway', () => {
    const hist = Array.from({ length: 6 }, () => ({ income: 500, expense: 0 }))
    const { view } = stepCashFlow(
      null,
      snap({
        cash: 80_000,
        payrollPerTick: 0,
        upkeepPerTick: 0,
        staffLines: [],
        econHist: hist,
        econHour: 0,
        hourIncome: 0,
      }),
      0,
    )
    expect(view.incomePerDay).toBe(500 * 24)
    expect(view.costPerDay).toBe(0)
    expect(view.arrow).toBe('up')
    expect(view.runwayText).toBeNull()
    expect(estimateTextFor(view.netPerDay)).toBe('Est. +$12k/day')
    expect(view.week.income).toBe(500 * 24 * 7)
    expect(view.week.bookedHours).toBe(6)
    expect(view.week.bookedIncome).toBe(3000)
  })
})
