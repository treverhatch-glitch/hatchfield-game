import { describe, expect, it } from 'vitest'
import { setCancelled } from './adjust.ts'
import { slotRound } from './scheduler.ts'
import { historicPrecedence, seriesUsage, setSlotRule80 } from './slotRule.ts'
import { active, INFRA, line, SUMMER } from './testkit.ts'
import type { ScheduleState } from './types.ts'

const c = active('c', 'al', [line('a', 'a320', 480), line('b', 'a320', 700)])
const ctx = { contracts: [c], infra: INFRA }

function season(): ScheduleState {
  let st = slotRound([c], { ...SUMMER, endDay: SUMMER.startDay + 9 }, INFRA)
  // cancel 3 of 10 'a' operations → 70%
  for (const s of st.slots.filter((x) => x.lineId === 'a').slice(0, 3)) {
    const r = setCancelled(st, s.id, true, ctx)
    if (r.ok) st = r.state
  }
  return st
}

describe('80/20 slot rule', () => {
  it('is off by default and keeps every series', () => {
    const st = season()
    expect(st.slotRule80).toBe(false)
    const h = historicPrecedence(st)
    expect(h.lost).toEqual([])
    expect([...h.precedence].sort()).toEqual(['c/a', 'c/b'])
  })
  it('when on, series under 80% lose precedence', () => {
    const st = setSlotRule80(season(), true)
    const u = seriesUsage(st)
    expect(u.find((x) => x.lineId === 'a')!.usage).toBeCloseTo(0.7)
    expect(u.find((x) => x.lineId === 'b')!.usage).toBe(1)
    const h = historicPrecedence(st)
    expect(h.lost.map((x) => x.lineId)).toEqual(['a'])
    expect([...h.precedence]).toEqual(['c/b'])
  })
  it('grounded flights count as unused', () => {
    const st = setSlotRule80(season(), true)
    const g = { ...st, slots: st.slots.map((s) => s.lineId === 'b' ? { ...s, actual: { grounded: 'fuel' as const } } : s) }
    expect(historicPrecedence(g).precedence.size).toBe(0)
  })
})
