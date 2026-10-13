import { describe, expect, it } from 'vitest'
import {
  autoSchedule, declaredCapacity, evaluateFlags, expandContracts, offsets, rankStands, rerun, slotRound,
} from './scheduler.ts'
import { MIN_PER_DAY } from './seasons.ts'
import { active, INFRA, line, SUMMER } from './testkit.ts'
import type { Infrastructure } from './types.ts'

const week = { ...SUMMER, endDay: SUMMER.startDay + 6 }

describe('expandContracts', () => {
  it('creates one instance per operating day at the preferred time', () => {
    const c = active('c', 'al', [line('l', 'a320', 480, { days: [0, 2, 4] })])
    const slots = expandContracts([c], SUMMER)
    expect(slots.length).toBe(31 * 3)
    expect(slots[0].plannedOnBlock).toBe(slots[0].day * MIN_PER_DAY + 480)
    expect(slots[0].plannedOffBlock - slots[0].plannedOnBlock).toBe(45)
  })
  it('skips offered / ended / other-season contracts', () => {
    const c = active('c', 'al', [line('l', 'a320', 480)])
    expect(expandContracts([{ ...c, status: 'offered' }], SUMMER)).toEqual([])
    expect(expandContracts([{ ...c, status: 'ended' }], SUMMER)).toEqual([])
    expect(expandContracts([{ ...c, seasons: ['W0'] }], SUMMER)).toEqual([])
  })
  it('throws on unknown airframe', () => {
    const c = active('c', 'al', [line('l', 'a320', 480)])
    expect(() => expandContracts([{ ...c, lines: [line('l', 'zzz', 0)] }], SUMMER)).toThrow()
  })
})

describe('declaredCapacity / stands', () => {
  it('counts runway moves and stands by class per hour', () => {
    const cap = declaredCapacity(INFRA)
    expect(cap.length).toBe(24)
    expect(cap[7].runwayMoves).toBe(20)
    expect(cap[7].standsByClass).toEqual({ regional: 0, narrow: 2, wide: 1, super: 1 })
  })
  it('ranks smallest fitting, contact first, hub pier first', () => {
    expect(rankStands(INFRA.stands, 'narrow').map((s) => s.id)).toEqual(['N1', 'N2', 'W1', 'S1'])
    expect(rankStands(INFRA.stands, 'wide').map((s) => s.id)).toEqual(['W1', 'S1'])
    expect(rankStands(INFRA.stands, 'super').map((s) => s.id)).toEqual(['S1'])
    expect(rankStands(INFRA.stands, 'narrow', 'B').map((s) => s.id)).toEqual(['N2', 'S1', 'N1', 'W1'])
  })
  it('offsets alternate outward', () => {
    expect(offsets(10, 5)).toEqual([0, 5, -5, 10, -10])
    expect(offsets(0, 5)).toEqual([0])
  })
})

describe('autoSchedule', () => {
  it('places at preferred time on the best stand when free', () => {
    const c = active('c', 'al', [line('l', 'a320', 480)])
    const st = slotRound([c], week, INFRA)
    expect(st.slots.length).toBe(7)
    for (const s of st.slots) {
      expect(s.flag).toBe('ok')
      expect(s.standId).toBe('N1')
      expect(s.runwayId).toBe('R09')
      expect(s.plannedOnBlock % MIN_PER_DAY).toBe(480)
    }
    expect(st.slotRule80).toBe(false)
  })
  it('A380 only goes to a super stand', () => {
    const c = active('c', 'al', [line('l', 'a380', 600)])
    const st = slotRound([c], week, INFRA)
    expect(st.slots.every((s) => s.standId === 'S1' && s.flag === 'ok')).toBe(true)
  })
  it('slides in 5-minute steps within the window when stands are full', () => {
    const infra: Infrastructure = { stands: [{ id: 'N1', sizeClass: 'narrow', contact: true }], runways: [{ id: 'R', movesPerHour: 30 }] }
    const c = active('c', 'al', [line('a', 'a320', 480, { days: [0] }), line('b', 'a320', 480, { days: [0], arrival: { preferredMin: 500, softMin: 60, hardMin: 90 } })])
    const st = slotRound([c], week, infra)
    const [a, b] = st.slots
    expect(a.flag).toBe('ok')
    expect(b.flag).toBe('ok')
    // a occupies 480..525 (+10 buffer). b must start ≥ 535 → 500+35 = 535
    expect(b.plannedOnBlock % MIN_PER_DAY).toBe(535)
    expect((b.plannedOnBlock - 500) % 5).toBe(0)
  })
  it('over capacity: still flies, placed at window edge, flagged red with a reason', () => {
    const infra: Infrastructure = { stands: [{ id: 'N1', sizeClass: 'narrow', contact: true }], runways: [{ id: 'R', movesPerHour: 30 }] }
    const c = active('c', 'al', [line('a', 'a320', 480, { days: [0] }), line('b', 'a320', 480, { days: [0] })])
    const st = slotRound([c], week, infra)
    expect(st.slots.length).toBe(2)
    const red = st.slots.find((s) => s.flag === 'over_capacity')!
    expect(red).toBeDefined()
    expect(red.standId).toBe('N1')
    expect(Math.abs((red.plannedOnBlock % MIN_PER_DAY) - 480)).toBe(20)
    expect(red.issues.join()).toMatch(/clash/)
  })
  it('runway cap slides a flight into the next hour when the window allows', () => {
    const infra: Infrastructure = { stands: Array.from({ length: 4 }, (_, i) => ({ id: `N${i}`, sizeClass: 'narrow' as const, contact: true })), runways: [{ id: 'R', movesPerHour: 2 }] }
    const lines = Array.from({ length: 3 }, (_, i) => line(`l${i}`, 'a320', 590, { days: [0], turnaroundTargetMin: 120, arrival: { preferredMin: 590, softMin: 30, hardMin: 60 } }))
    const st = slotRound([active('c', 'al', lines)], week, infra)
    expect(st.slots.every((s) => s.flag === 'ok')).toBe(true)
    expect(st.slots.map((s) => Math.floor((s.plannedOnBlock % MIN_PER_DAY) / 60)).sort((a, b) => a - b)).toEqual([9, 9, 10])
  })
  it('runway hour cap pushes flights and flags red when exhausted', () => {
    const infra: Infrastructure = { stands: Array.from({ length: 10 }, (_, i) => ({ id: `N${i}`, sizeClass: 'narrow' as const, contact: true })), runways: [{ id: 'R', movesPerHour: 2 }] }
    const lines = Array.from({ length: 6 }, (_, i) => line(`l${i}`, 'a320', 600, { days: [0], arrival: { preferredMin: 600, softMin: 0, hardMin: 60 } }))
    const st = slotRound([active('c', 'al', lines)], week, infra)
    expect(st.slots.length).toBe(6)
    // every move in an over-declared hour is red: the bottleneck is visible, not hidden on one flight
    expect(st.slots.filter((s) => s.flag === 'over_capacity').length).toBe(6)
    expect(st.slots.every((s) => s.issues.some((i) => /runway R .* over capacity/.test(i)))).toBe(true)
  })
  it('no fitting stand built → red, standId null, never dropped', () => {
    const infra: Infrastructure = { stands: [{ id: 'N1', sizeClass: 'narrow', contact: true }], runways: [{ id: 'R', movesPerHour: 30 }] }
    const st = slotRound([active('c', 'al', [line('l', 'a380', 600, { days: [0] })])], week, infra)
    expect(st.slots[0].flag).toBe('over_capacity')
    expect(st.slots[0].standId).toBeNull()
    expect(st.slots[0].issues).toContain('no super stand built')
  })
  it('no runway built → red', () => {
    const st = slotRound([active('c', 'al', [line('l', 'a320', 600, { days: [0] })])], week, { stands: INFRA.stands, runways: [] })
    expect(st.slots[0].flag).toBe('over_capacity')
    expect(st.slots[0].issues.join()).toMatch(/no runway/)
  })
  it('hub airline is placed first and at its home pier', () => {
    const infra: Infrastructure = { stands: [{ id: 'N1', sizeClass: 'narrow', contact: true, pier: 'A' }, { id: 'N2', sizeClass: 'narrow', contact: true, pier: 'H' }], runways: [{ id: 'R', movesPerHour: 30 }] }
    const other = active('o', 'other', [line('l', 'a320', 480, { days: [0] })])
    const hub = { ...active('h', 'hub', [line('l', 'a320', 480, { days: [0] })]), isHub: true, homePier: 'H' }
    const st = slotRound([other, hub], week, infra)
    const h = st.slots.find((s) => s.airlineId === 'hub')!
    expect(h.standId).toBe('N2')
    expect(h.flag).toBe('ok')
  })
  it('hub wins the only stand when contended', () => {
    const infra: Infrastructure = { stands: [{ id: 'N1', sizeClass: 'narrow', contact: true }], runways: [{ id: 'R', movesPerHour: 30 }] }
    const tight = { preferredMin: 480, softMin: 30, hardMin: 60 }
    const other = active('o', 'other', [line('l', 'a320', 480, { days: [0], arrival: tight })])
    const hub = { ...active('h', 'hub', [line('l', 'a320', 480, { days: [0], arrival: tight })]), isHub: true }
    const st = slotRound([other, hub], week, infra)
    expect(st.slots.find((s) => s.airlineId === 'hub')!.flag).toBe('ok')
    expect(st.slots.find((s) => s.airlineId === 'other')!.flag).toBe('over_capacity')
  })
  it('precedence orders series before others', () => {
    const infra: Infrastructure = { stands: [{ id: 'N1', sizeClass: 'narrow', contact: true }], runways: [{ id: 'R', movesPerHour: 30 }] }
    const tight = { preferredMin: 480, softMin: 30, hardMin: 60 }
    const c = active('c', 'al', [line('a', 'a320', 480, { days: [0], arrival: tight }), line('b', 'a320', 480, { days: [0], arrival: tight })])
    const st = slotRound([c], week, infra, { precedence: new Set(['c/b']) })
    expect(st.slots.find((s) => s.lineId === 'b')!.flag).toBe('ok')
    expect(st.slots.find((s) => s.lineId === 'a')!.flag).toBe('over_capacity')
  })
  it('pinned, cancelled and manual-airline slots keep their times on rerun', () => {
    const c = active('c', 'al', [line('l', 'a320', 480, { days: [0, 1, 2] })])
    const st = slotRound([c], week, INFRA)
    const moved = st.slots.map((s, i) => i === 0 ? { ...s, plannedOnBlock: s.plannedOnBlock + 15, plannedOffBlock: s.plannedOffBlock + 15, pinned: true } : i === 1 ? { ...s, cancelled: true } : s)
    const re = rerun({ ...st, slots: moved }, [c], INFRA)
    expect(re.slots[0].plannedOnBlock).toBe(moved[0].plannedOnBlock)
    expect(re.slots[1].cancelled).toBe(true)
    expect(re.slots[1].flag).toBe('ok')
    const manual = autoSchedule({ slots: moved.map((s) => ({ ...s, plannedOnBlock: s.plannedOnBlock + 1 })), contracts: [c], infra: INFRA, autoByAirline: { al: false } })
    expect(manual[2].plannedOnBlock).toBe(moved[2].plannedOnBlock + 1)
  })
  it('rerun after removing a stand reassigns and keeps every flight', () => {
    const c = active('c', 'al', [line('l', 'a320', 480)])
    const st = slotRound([c], week, INFRA)
    const smaller = { ...INFRA, stands: INFRA.stands.filter((s) => s.id !== 'N1') }
    const re = rerun(st, [c], smaller)
    expect(re.slots.length).toBe(st.slots.length)
    expect(re.slots.every((s) => s.standId === 'N2' && s.flag === 'ok')).toBe(true)
    expect(re.declaredCapacity[0].standsByClass.narrow).toBe(1)
  })
  it('stand-pinned slots keep their stand through rerun', () => {
    const c = active('c', 'al', [line('l', 'a320', 480, { days: [0] })])
    const st = slotRound([c], week, INFRA)
    const re = rerun({ ...st, slots: st.slots.map((s) => ({ ...s, standId: 'W1', standPinned: true })) }, [c], INFRA)
    expect(re.slots[0].standId).toBe('W1')
  })
  it('throws on a slot whose line no longer exists', () => {
    const c = active('c', 'al', [line('l', 'a320', 480, { days: [0] })])
    const slots = expandContracts([c], week)
    expect(() => autoSchedule({ slots, contracts: [{ ...c, lines: [] }], infra: INFRA })).toThrow()
  })
})

describe('evaluateFlags', () => {
  it('flags off_window / hard band and wrong stand class', () => {
    const c = active('c', 'al', [line('l', 'a380', 600, { days: [0] })])
    const [s] = slotRound([c], week, INFRA).slots
    const off = evaluateFlags([{ ...s, plannedOnBlock: s.plannedOnBlock + 30, plannedOffBlock: s.plannedOffBlock + 30 }], [c], INFRA)[0]
    expect(off.flag).toBe('off_window')
    const hard = evaluateFlags([{ ...s, plannedOnBlock: s.plannedOnBlock + 90, plannedOffBlock: s.plannedOffBlock + 90 }], [c], INFRA)[0]
    expect(hard.issues.join()).toMatch(/hard band/)
    const small = evaluateFlags([{ ...s, standId: 'N1' }], [c], INFRA)[0]
    expect(small.flag).toBe('over_capacity')
    expect(small.issues.join()).toMatch(/too small/)
    const gone = evaluateFlags([{ ...s, standId: 'X9', runwayId: 'R99' }], [c], INFRA)[0]
    expect(gone.issues.join()).toMatch(/not built/)
  })
})
