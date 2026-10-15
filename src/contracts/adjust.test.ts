import { describe, expect, it } from 'vitest'
import {
  bumpSlot, dragSlot, pinStand, pullSlot, setAuto, setCancelled, swapStands, unpinStand, unpinTime, weeklyOffWindowCost, windowZone,
} from './adjust.ts'
import { rerun, slotRound } from './scheduler.ts'
import { active, INFRA, line, SUMMER } from './testkit.ts'

const week = { ...SUMMER, endDay: SUMMER.startDay + 6 }
const c = active('c', 'al', [line('n', 'a320', 480, { days: [0] }), line('w', 'b777', 480, { days: [0] }), line('s', 'a380', 900, { days: [0] })])
const ctx = { contracts: [c], infra: INFRA }
const fresh = () => slotRound([c], week, INFRA)
const id = (l: string) => `c:${l}:${SUMMER.startDay}`

describe('player adjustments', () => {
  it('drag within window is free and pins the time', () => {
    const st = fresh()
    const s = st.slots.find((x) => x.id === id('n'))!
    const r = dragSlot(st, s.id, s.plannedOnBlock + 15, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.zone).toBe('window')
    expect(r.standingCostPerWeek).toBe(0)
    const ns = r.state.slots.find((x) => x.id === s.id)!
    expect(ns.pinned).toBe(true)
    expect(ns.plannedOffBlock - ns.plannedOnBlock).toBe(s.plannedOffBlock - s.plannedOnBlock)
    expect(ns.flag).toBe('ok')
    // survives rerun
    expect(rerun(r.state, [c], INFRA).slots.find((x) => x.id === s.id)!.plannedOnBlock).toBe(s.plannedOnBlock + 15)
  })
  it('drag into hard band costs standing and flags off_window; beyond is refused', () => {
    const st = fresh()
    const s = st.slots.find((x) => x.id === id('n'))!
    const r = dragSlot(st, s.id, s.plannedOnBlock - 45, ctx)
    expect(r.ok && r.zone).toBe('hard_band')
    expect(r.ok && r.standingCostPerWeek).toBe(1)
    expect(r.ok && r.state.slots.find((x) => x.id === s.id)!.flag).toBe('off_window')
    const no = dragSlot(st, s.id, s.plannedOnBlock + 61, ctx)
    expect(no.ok).toBe(false)
    expect(no.state).toBe(st)
    expect(windowZone(s, ctx, s.plannedOnBlock + 61)).toBe('outside')
    expect(dragSlot(st, 'nope', 0, ctx).ok).toBe(false)
  })
  it('drag into a clash is allowed but flagged red (never suppressed)', () => {
    const st = fresh()
    const n = st.slots.find((x) => x.id === id('n'))!
    const p = pinStand(st, n.id, 'W1', ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const flags = p.state.slots.filter((x) => x.standId === 'W1').map((x) => x.flag)
    expect(flags).toEqual(['over_capacity', 'over_capacity'])
  })
  it('pull = earlier, bump = later', () => {
    const st = fresh()
    const s = st.slots.find((x) => x.id === id('n'))!
    const p = pullSlot(st, s.id, 10, ctx)
    expect(p.ok && p.state.slots.find((x) => x.id === s.id)!.plannedOnBlock).toBe(s.plannedOnBlock - 10)
    const b = bumpSlot(st, s.id, -10, ctx)
    expect(b.ok && b.state.slots.find((x) => x.id === s.id)!.plannedOnBlock).toBe(s.plannedOnBlock + 10)
    expect(pullSlot(st, 'x', 1, ctx).ok).toBe(false)
    expect(bumpSlot(st, 'x', 1, ctx).ok).toBe(false)
  })
  it('cancel a single day and restore it; cancelled cannot be dragged', () => {
    const st = fresh()
    const r = setCancelled(st, id('n'), true, ctx)
    expect(r.ok && r.state.slots.find((x) => x.id === id('n'))!.cancelled).toBe(true)
    if (!r.ok) return
    expect(dragSlot(r.state, id('n'), 0, ctx).ok).toBe(false)
    const back = setCancelled(r.state, id('n'), false, ctx)
    expect(back.ok && back.state.slots.find((x) => x.id === id('n'))!.cancelled).toBe(false)
    expect(setCancelled(st, 'x', true, ctx).ok).toBe(false)
  })
  it('pin stand refuses too-small or unknown stands; unpin works', () => {
    const st = fresh()
    expect(pinStand(st, id('s'), 'W1', ctx).ok).toBe(false)
    expect(pinStand(st, id('s'), 'ZZ', ctx).ok).toBe(false)
    expect(pinStand(st, 'x', 'S1', ctx).ok).toBe(false)
    const ok = pinStand(st, id('n'), 'N2', ctx)
    expect(ok.ok && ok.state.slots.find((x) => x.id === id('n'))!.standPinned).toBe(true)
    if (!ok.ok) return
    const un = unpinStand(ok.state, id('n'), ctx)
    expect(un.ok && un.state.slots.find((x) => x.id === id('n'))!.standPinned).toBe(false)
    expect(unpinStand(st, 'x', ctx).ok).toBe(false)
    const ut = unpinTime(st, id('n'), ctx)
    expect(ut.ok && ut.state.slots.find((x) => x.id === id('n'))!.pinned).toBe(false)
    expect(unpinTime(st, 'x', ctx).ok).toBe(false)
  })
  it('swap stands only when both fit', () => {
    const st = fresh()
    const n = st.slots.find((x) => x.id === id('n'))!
    const w = st.slots.find((x) => x.id === id('w'))!
    expect(n.standId).toBe('N1')
    expect(w.standId).toBe('W1')
    expect(swapStands(st, n.id, w.id, ctx).ok).toBe(false) // 777 can't go on N1
    const n2 = pinStand(st, n.id, 'N2', ctx)
    if (!n2.ok) throw new Error()
    const sw = swapStands(st, n.id, id('s'), ctx) // A380 can't go on N1
    expect(sw.ok).toBe(false)
    expect(swapStands(st, n.id, 'x', ctx).ok).toBe(false)
    // two narrowbodies on different days can swap
    const c2 = active('c2', 'al', [line('a', 'a320', 480, { days: [0] }), line('b', 'a320', 480, { days: [0], arrival: { preferredMin: 480, softMin: 0, hardMin: 60 } })])
    const st2 = slotRound([c2], week, INFRA)
    const [a, b] = st2.slots
    const r = swapStands(st2, a.id, b.id, { contracts: [c2], infra: INFRA })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.slots[0].standId).toBe(b.standId)
    expect(r.state.slots[1].standId).toBe(a.standId)
    expect(r.state.slots.every((x) => x.standPinned)).toBe(true)
  })
  it('swap and pin refuse a stand leased to another airline', () => {
    const infra = {
      ...INFRA,
      stands: INFRA.stands.map((stand) => (stand.id === 'N2' ? { ...stand, leaseAirlineId: 'hub' } : stand)),
    }
    const st = fresh()
    const pinned = pinStand(st, id('n'), 'N2', { contracts: [c], infra })
    expect(pinned.ok).toBe(false)
    if (!pinned.ok) expect(pinned.reason).toMatch(/leased/)

    const parked = {
      ...st,
      slots: st.slots.map((slot) =>
        slot.id === id('n') ? { ...slot, standId: 'N1', airlineId: 'rival' } : slot.id === id('w') ? { ...slot, standId: 'N2' } : slot,
      ),
    }
    const swapped = swapStands(parked, id('n'), id('w'), { contracts: [c], infra })
    expect(swapped.ok).toBe(false)
    if (!swapped.ok) expect(swapped.reason).toMatch(/leased|too small/)
  })
  it('swap needs both flights on a stand', () => {
    const st = fresh()
    const noStand = { ...st, slots: st.slots.map((x) => x.id === id('n') ? { ...x, standId: null } : x) }
    expect(swapStands(noStand, id('n'), id('w'), ctx).ok).toBe(false)
  })
  it('auto toggle per airline; manual airline is not moved by rerun', () => {
    const st = setAuto(fresh(), 'al', false)
    expect(st.autoByAirline.al).toBe(false)
    const shifted = { ...st, slots: st.slots.map((x) => ({ ...x, plannedOnBlock: x.plannedOnBlock + 5, plannedOffBlock: x.plannedOffBlock + 5 })) }
    const re = rerun(shifted, [c], INFRA)
    expect(re.slots.map((x) => x.plannedOnBlock)).toEqual(shifted.slots.map((x) => x.plannedOnBlock))
  })
  it('weekly off-window cost is charged once per line per week', () => {
    const c3 = active('c3', 'al', [line('n', 'a320', 480, { days: [0, 1] })])
    const ctx3 = { contracts: [c3], infra: INFRA }
    let st = slotRound([c3], week, INFRA)
    for (const s of st.slots) {
      const r = dragSlot(st, s.id, s.plannedOnBlock + 40, ctx3)
      if (r.ok) st = r.state
    }
    expect(weeklyOffWindowCost(st, SUMMER.startDay, ctx3)).toEqual({ al: 1 })
    expect(weeklyOffWindowCost(st, SUMMER.startDay + 7, ctx3)).toEqual({})
  })
})
