import { describe, expect, it } from 'vitest'
import * as api from './index.ts'
import { line } from './testkit.ts'

describe('end-to-end season', () => {
  it('offer → preview → sign → slot round → drag → audit → season end', () => {
    const S = api.seasonFor('summer', 0)
    const infra: api.Infrastructure = {
      stands: [
        { id: 'A1', sizeClass: 'narrow', contact: true, pier: 'A' },
        { id: 'A2', sizeClass: 'narrow', contact: true, pier: 'A' },
        { id: 'B1', sizeClass: 'wide', contact: true, pier: 'B' },
        { id: 'B2', sizeClass: 'super', contact: true, pier: 'B' },
      ],
      runways: [{ id: '09L', movesPerHour: 24 }],
    }
    const hubOffer = api.makeOffer({ id: 'hub', airlineId: 'HF', isHub: true, homePier: 'A', services: ['fuel', 'baggage', 'catering'],
      lines: [line('m1', 'a320', 420), line('m2', 'a321', 450)] })
    const a380 = api.makeOffer({ id: 'big', airlineId: 'EK', services: ['fuel', 'catering', 'baggage', 'lav_water', 'gpu_pca'],
      lines: [line('x', 'a380', 1080, { days: [0, 2, 4] })] })
    const prev = api.previewOffer(a380, [], S, infra)
    expect(prev.warnings).toEqual([])
    const h = api.signContract(hubOffer, S, [])
    const b = api.signContract(a380, S, [])
    if (!h.ok || !b.ok) throw new Error('sign failed')
    const contracts = [h.contract, b.contract]
    const state = api.slotRound(contracts, S, infra)
    expect(state.slots.length).toBe(31 * 7 * 2 + 31 * 3)
    expect(state.slots.filter((s) => s.flag !== 'ok')).toEqual([])
    expect(state.slots.filter((s) => s.airlineId === 'HF').every((s) => s.standId!.startsWith('A'))).toBe(true)
    expect(state.slots.filter((s) => s.airframeId === 'a380').every((s) => s.standId === 'B2')).toBe(true)
    const first = state.slots[0]
    const d = api.dragSlot(state, first.id, first.plannedOnBlock + 10, { contracts, infra })
    expect(d.ok).toBe(true)
    if (!d.ok) return
    const flown = d.state.slots.map((s) => s.day < S.startDay + 7 ? { ...s, actual: { onBlock: s.plannedOnBlock, offBlock: s.plannedOffBlock, pax: 150, bagsExpected: 120 } } : s)
    const audit = api.auditWeek(h.contract, flown, { season: S, auditDay: S.startDay + 7, currentStanding: 40 })
    expect(audit.operated).toBe(14)
    expect(audit.standingDelta).toBe(2)
    expect(audit.ledger[0].amount).toBeGreaterThan(0)
    const next = api.nextSeason(S)
    const after = api.advanceSeason(contracts, S, next)
    expect(after.find((c) => c.id === 'big')!.status).toBe('expiring')
    expect(after.find((c) => c.id === 'hub')!.status).toBe('active')
  })
})
