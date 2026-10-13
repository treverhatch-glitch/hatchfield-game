import { describe, expect, it } from 'vitest'
import { hallPlan, layoutHints, layoutKey, mergeHints, worstSeverity, type AdvisorHall } from './advisorBridge.ts'
import { litterAdvice } from './litter.ts'
import { schemeItems, schemeZones, type ItemId, type ZoneId } from './terminal.ts'
import type { Advice } from './advisor.ts'

const LETTER: Record<string, ZoneId | null> = {
  C: 'checkin',
  S: 'security',
  G: 'gates',
  A: 'arrivals',
  R: 'retail',
  T: 'toilets',
  '.': null,
}
const paint = (rows: string[]) => rows.map((row) => [...row].map((ch) => LETTER[ch]))
const at = (def: string, c: number, r: number) => ({ def, c, r })

/**
 * Custom kit hall, 6 x 3:
 *   C C S G G G
 *   C C S G G T
 *   A A S R G G
 * Shops / Food sits between the lane and the gates, so it is after security.
 */
function kitHall(): AdvisorHall & { items: { def: string; c: number; r: number }[] } {
  return {
    premade: false,
    redesigned: true,
    zones: paint(['CCSGGG', 'CCSGGT', 'AASRGG']),
    items: [
      at('entrance', 0, 0),
      at('checkin_belt', 1, 0),
      at('kiosk', 1, 1),
      at('security_small', 2, 1),
      at('boarding_desk', 4, 0),
      at('bench', 4, 1),
      at('claim_carousel', 0, 2),
      at('toilet', 5, 1),
      at('fast_food', 3, 2),
      at('trash_can', 3, 2),
      at('plant', 3, 1),
    ],
  }
}

const ids = (hall: AdvisorHall) => layoutHints(hall).map((h) => h.id)
const serious = (hall: AdvisorHall) => layoutHints(hall).filter((h) => h.severity !== 'tip')

describe('advisor bridge — prefab halls', () => {
  for (const tier of [1, 2, 3] as const) {
    it(`prefab tier ${tier} has no blockers or warnings`, () => {
      const hall = { premade: true, tier, zones: schemeZones(tier), items: schemeItems(tier) }
      expect(serious(hall)).toEqual([])
    })
  }

  it('a stock prefab with no zones on the fit falls back to its scheme', () => {
    const plan = hallPlan({ premade: true, tier: 1 })
    expect(plan.w).toBe(8)
    expect(plan.h).toBe(5)
    expect(plan.floors[0].doors.some((d) => d.kind === 'curb')).toBe(true)
    expect(serious({ premade: true, tier: 1 })).toEqual([])
  })

  it('walls Arrivals off from Gates but leaves Security open', () => {
    const plan = hallPlan({ premade: true, tier: 1 })
    const walls = plan.floors[0].walls
    // Scheme I: arrivals (6,2) above gates (6,3).
    expect(walls).toContainEqual({ x: 6, y: 2, dir: 'S' })
    // Security (0,2) above gates (0,3): open.
    expect(walls).not.toContainEqual({ x: 0, y: 2, dir: 'S' })
  })

  it('a check-in cell beside a gate is partitioned, not a bypass (scheme II)', () => {
    const hall = { premade: true, tier: 2 as const }
    expect(hallPlan(hall).floors[0].walls).toContainEqual({ x: 3, y: 0, dir: 'E' })
    expect(ids(hall)).not.toContain('security_bypass')
  })
})

describe('advisor bridge — custom kit hall', () => {
  it('maps zones and kit items onto the plan', () => {
    const plan = hallPlan(kitHall())
    const cells = plan.floors[0].cells
    expect(cells[0][0].room).toBe('checkin')
    expect(cells[1][2].room).toBe('security')
    expect(cells[0][3].room).toBe('gates')
    expect(cells[2][0].room).toBe('bagclaim')
    expect(cells[1][5].room).toBe('restrooms')
    // After-security shops act as concourse.
    expect(cells[2][3].room).toBe('lounge')
    const equip = plan.equipment.map((e) => e.id).sort()
    expect(equip).toEqual(['carousel', 'desk', 'gate_desk', 'kiosk', 'scanner', 'seat', 'shop_unit', 'toilet'])
    expect(plan.floors[0].doors).toEqual([{ x: 0, y: 0, dir: 'E', kind: 'curb' }])
  })

  it('a sound kit hall has no blockers or warnings', () => {
    expect(serious(kitHall())).toEqual([])
  })

  it('shops between the lane and the gates still reach the gates', () => {
    const hall = kitHall()
    hall.zones = paint(['CCSRGG', 'CCSRGT', 'AASRGG'])
    hall.items = hall.items.filter((it) => it.c !== 3)
    expect(ids(hall)).not.toContain('gates_unreachable')
    expect(ids(hall)).not.toContain('security_bypass')
  })

  it('missing seating at the gates is a warning that points at the gates', () => {
    const hall = kitHall()
    hall.items = hall.items.filter((it) => it.def !== 'bench')
    const hint = layoutHints(hall).find((h) => h.id === 'equip_gates_seat')
    expect(hint?.severity).toBe('warning')
    expect(hint?.title).toBe('Gates has no seating')
    expect(hint?.cells.length).toBeGreaterThan(0)
  })
})

describe('advisor bridge — blockers', () => {
  it('no entrance doors', () => {
    const hall = kitHall()
    hall.items = hall.items.filter((it) => it.def !== 'entrance')
    const hint = layoutHints(hall).find((h) => h.id === 'no_curb')
    expect(hint?.severity).toBe('blocker')
    expect(hint?.cells).toContainEqual({ c: 0, r: 0 })
  })

  it('a Security strip with no lane is a bypass', () => {
    const hall = kitHall()
    hall.items = hall.items.filter((it) => it.def !== 'security_small')
    const hints = layoutHints(hall)
    const bypass = hints.find((h) => h.id === 'security_bypass')
    expect(bypass?.severity).toBe('blocker')
    expect(bypass?.cells.length).toBe(1)
    // The lane-less paint is what "Show me" points at for the missing checkpoint.
    expect(hints.find((h) => h.id === 'missing_security')?.cells).toContainEqual({ c: 2, r: 1 })
    expect(hints[0].severity).toBe('blocker')
  })

  it('entrance doors opening onto the gates are a bypass', () => {
    const hall = kitHall()
    hall.items.push(at('entrance', 5, 0))
    expect(ids(hall)).toContain('security_bypass')
  })

  it('gates cut off from security', () => {
    const hall = kitHall()
    hall.zones = paint(['CSCGGG', 'CSCGGT', 'AACGGG'])
    hall.items = [at('entrance', 0, 0), at('security_small', 1, 0), at('boarding_desk', 4, 0)]
    expect(ids(hall)).toContain('gates_unreachable')
    expect(ids(hall)).not.toContain('security_bypass')
    // The sealed-gates dead end is the same problem; the merged list shows it once.
    const merged = mergeHints([layoutHints(hall)]).map((h) => h.id)
    expect(merged).toContain('gates_unreachable')
    expect(merged).not.toContain('dead_gates')
  })

  it('speaks in zones and kit items, not walls or doors', () => {
    const hall = kitHall()
    hall.zones = paint(['CSCGGG', 'CSCGGT', 'AACGGG'])
    hall.items = [at('security_small', 1, 0)]
    for (const h of layoutHints(hall)) {
      expect(`${h.title} ${h.detail} ${h.fix}`).not.toMatch(/\bdoor\b|\bwall/i)
    }
  })

  it('arrivals that only touch the gates have no way out', () => {
    const hall = kitHall()
    hall.zones = paint(['CCSGGG', 'CCSGGT', '...GAA'])
    hall.items = hall.items.filter((it) => it.r < 2).concat(at('claim_carousel', 4, 2))
    const hint = layoutHints(hall).find((h) => h.id === 'claim_unreachable')
    expect(hint?.severity).toBe('blocker')
  })

  it('no gates painted', () => {
    expect(ids({ zones: paint(['CCS', 'CCS']), items: [at('entrance', 0, 0)] })).toContain('missing_gates')
  })

  it('an empty shell has no layout hints to give', () => {
    expect(layoutHints({ premade: false, zones: [] })).toEqual([])
  })
})

describe('one source of hints', () => {
  const note = (id: string, extra: Partial<Advice> = {}): Advice => ({
    id,
    title: id,
    detail: '',
    fix: '',
    cells: [],
    ...extra,
  })

  it('folds layout, kit, and litter notes, worst first, without duplicates', () => {
    const hall = kitHall()
    hall.items = hall.items.filter((it) => it.def !== 'security_small' && it.def !== 'trash_can')
    const layout = layoutHints(hall)
    const kit = [note('missing-signs'), note('security-bypass'), note('undersized-security')]
    const litter = litterAdvice(
      {
        zones: hall.zones as (string | null)[][],
        items: hall.items.map((it, i) => ({ id: `i${i}`, wear: 0, ...it, def: it.def as ItemId })),
      },
      0,
      0,
    )
    expect(litter.map((n) => n.id)).toContain('litter-no-bins')
    const merged = mergeHints([layout, kit, litter])
    const got = merged.map((n) => n.id)
    expect(got).toContain('security_bypass')
    expect(got).not.toContain('security-bypass')
    expect(got).toContain('litter-no-bins')
    const ranks = merged.map((n) => ({ blocker: 0, warning: 1, tip: 2 })[n.severity!])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(worstSeverity(merged)).toBe('blocker')
  })

  it('ops notes default to warnings', () => {
    expect(mergeHints([[note('low-meals')]])[0].severity).toBe('warning')
    expect(worstSeverity([])).toBeNull()
  })

  it('layout key moves with builds, not with litter', () => {
    const hall = kitHall()
    const before = layoutKey(hall)
    expect(layoutKey({ ...hall, litter: [{ c: 0, r: 0 }] } as AdvisorHall)).toBe(before)
    hall.items.push(at('bench', 0, 1))
    expect(layoutKey(hall)).not.toBe(before)
  })
})
