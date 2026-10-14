import { describe, expect, it } from 'vitest'
import { removeEquipment } from '../terminalbuild/index.ts'
import { bigTerminal, build, runChecked } from './fixtures.test-util.ts'
import {
  GUEST_TUNING,
  PAXNAV_TUNING,
  PaxNav,
  WALKER_LOST,
  WALKER_REBOOK,
  buildSignField,
  cellX,
  cellZ,
  combineFx,
  feedbackReputation,
  rollMind,
  type GuestPurpose,
  type PaxEvent,
  type Signage,
} from './index.ts'

const GATES = ['g1', 'g2', 'g3', 'g4']

function guestNav(seed = 1, signage?: Signage) {
  return new PaxNav(bigTerminal(), { seed, guests: true, signage })
}

describe('guest traits', () => {
  it('rolls the same guest from the same id and seed, whatever the order', () => {
    const a = rollMind('pax-17', 5, 0)
    rollMind('someone-else', 5, 0)
    const b = rollMind('pax-17', 5, 0)
    expect(b.traits).toEqual(a.traits)
    expect([...b.needs]).toEqual([...a.needs])
    expect(b.patienceSec).toBe(a.patienceSec)
    // A different seed is a different crowd.
    const diff = Array.from({ length: 50 }, (_, i) => rollMind(`p${i}`, 5, 0).traits.join() !== rollMind(`p${i}`, 6, 0).traits.join())
    expect(diff.some(Boolean)).toBe(true)
  })

  it('rolls every purpose and flag at roughly the configured shares, never first-timer and frequent flyer together', () => {
    const count = new Map<string, number>()
    const N = 4000
    for (let i = 0; i < N; i++) {
      const m = rollMind(`g${i}`, 3, 0)
      for (const t of m.traits) count.set(t, (count.get(t) ?? 0) + 1)
      expect(m.traits.includes('first_timer') && m.traits.includes('frequent_flyer')).toBe(false)
      expect(m.traits.filter((t) => ['business', 'leisure', 'family', 'budget'].includes(t)).length).toBe(1)
    }
    for (const [p, share] of Object.entries(GUEST_TUNING.purposeShare)) {
      expect(Math.abs((count.get(p) ?? 0) / N - share)).toBeLessThan(0.03)
    }
    for (const f of ['first_timer', 'frequent_flyer', 'reduced_mobility', 'with_kids']) expect(count.get(f) ?? 0).toBeGreaterThan(0)
  })

  it('traits change pace, patience, spend and taste', () => {
    const slow = combineFx(['leisure', 'reduced_mobility'])
    const quick = combineFx(['business', 'frequent_flyer'])
    expect(slow.speed).toBeLessThan(0.7)
    expect(quick.speed).toBeGreaterThan(1.1)
    expect(quick.patience).toBeLessThan(slow.patience)
    expect(combineFx(['budget']).spend).toBeLessThan(combineFx(['business']).spend)
    expect(combineFx(['family', 'with_kids']).taste.shop!).toBeGreaterThan(combineFx(['business']).taste.shop!)
    expect(combineFx(['first_timer']).lost).toBeGreaterThan(combineFx(['frequent_flyer']).lost * 5)

    const nav = guestNav()
    nav.spawn({ id: 'old', gate: 'g1', departAt: 9000, purpose: 'leisure', flags: ['reduced_mobility'] })
    nav.spawn({ id: 'biz', gate: 'g1', departAt: 9000, purpose: 'business', flags: ['frequent_flyer'] })
    expect(nav.guest('old')!.traits).toContain('reduced_mobility')
    expect(nav.guest('old')!.speedMps).toBeLessThan(nav.guest('biz')!.speedMps * 0.7)
  })
})

describe('needs and optional stops', () => {
  it('needs rise over time and pick the stop they need, weighed against time to boarding', () => {
    const nav = guestNav(2)
    const calm = { hunger: 0, thirst: 0, bladder: 0, boredom: 0, tired: 0, comfort: 0 }
    const departAt = 3600 + PAXNAV_TUNING.boardLeadSec
    nav.spawn({ id: 'wc', gate: 'g2', departAt, bags: false, purpose: 'business', flags: [], startNeeds: { ...calm, bladder: 0.95 } })
    nav.spawn({ id: 'none', gate: 'g2', departAt, bags: false, purpose: 'business', flags: [], startNeeds: calm })
    // Bursting, but boarding opens before any stop would fit: straight to the gate.
    nav.spawn({
      id: 'late',
      gate: 'g3',
      departAt: 240 + PAXNAV_TUNING.boardLeadSec,
      bags: false,
      purpose: 'business',
      flags: [],
      startNeeds: { ...calm, bladder: 0.95 },
    })
    const { tracks, events } = runChecked(nav, 0, departAt, 0.25)
    expect(tracks.get('wc')!.kinds).toEqual(['security_lane', 'toilet', 'gate_desk'])
    expect(tracks.get('none')!.kinds).toEqual(['security_lane', 'gate_desk'])
    expect(tracks.get('late')!.kinds).toEqual(['security_lane', 'gate_desk'])
    expect(events.filter((e) => e.kind === 'boarded').map((e) => e.id).sort()).toEqual(['late', 'none', 'wc'])
  })

  it('needs decay while they wait, and sitting rests tired feet', () => {
    const nav = guestNav(3)
    nav.spawn({ id: 'a', gate: 'g1', departAt: 4 * 3600, bags: false, needs: [], purpose: 'leisure', flags: [], startNeeds: { tired: 0.6, thirst: 0.1 } })
    const t0 = nav.guest('a')!
    runChecked(nav, 0, 1200, 0.25)
    const t1 = nav.guest('a')!
    expect(t1.phase).toBe('seated')
    expect(t1.needs.thirst).toBeGreaterThan(t0.needs.thirst)
    expect(t1.needs.tired).toBeLessThan(0.6)
    expect(t1.thoughts.map((t) => t.key)).toContain('nice_seats')
  })
})

describe('wayfinding', () => {
  function lostRun(signs: boolean) {
    const nav = guestNav(
      4,
      signs
        ? {
            schemeSigns: 2,
            signs: [8, 24, 40, 56, 72, 88].flatMap((x) => [{ x, z: 30 }, { x, z: 14 }]),
            boards: [{ x: 24, z: 44 }, { x: 72, z: 44 }],
          }
        : undefined,
    )
    for (let i = 0; i < 120; i++) {
      nav.spawn({ id: `p${i}`, gate: GATES[i % 4], departAt: 2 * 3600, bags: i % 2 === 0, needs: [], flags: ['first_timer'] })
    }
    let flagged = 0
    const flags = new Uint8Array(400)
    let lostPoses = 0
    for (let t = 0; t < 1500; t += 0.5) {
      nav.tick(0.5, t)
      const n = nav.writeFlags(flags)
      for (let i = 0; i < n; i++) if (flags[i] & WALKER_LOST) flagged++
      if (t % 30 === 0) lostPoses += nav.poses().filter((p) => p.lost).length
    }
    return { fb: nav.drainFeedback(), flagged, lostPoses, nav }
  }

  it('first-timers get lost, and signs and boards make it rarer', () => {
    const bare = lostRun(false)
    const signed = lostRun(true)
    expect(bare.fb.lost).toBeGreaterThan(10)
    expect(bare.flagged).toBeGreaterThan(0)
    expect(signed.fb.lost).toBeLessThan(bare.fb.lost * 0.6)
  })

  it('lost guests wander on walkable floor only and still make their flight', () => {
    const nav = guestNav(5)
    for (let i = 0; i < 40; i++) {
      nav.spawn({ id: `p${i}`, gate: GATES[i % 4], departAt: 2400 + PAXNAV_TUNING.boardLeadSec, bags: true, needs: [], flags: ['first_timer'] })
    }
    const { events } = runChecked(nav, 0, 2400 + PAXNAV_TUNING.boardLeadSec, 0.25)
    expect(events.filter((e) => e.kind === 'boarded').length).toBe(40)
    expect(events.some((e) => e.kind === 'missed')).toBe(false)
  })

  it('sign coverage is strongest by the sign and counts scheme signs everywhere', () => {
    const nav = guestNav()
    const f = buildSignField(nav.nav, { schemeSigns: 2, signs: [{ x: 10, z: 10 }], boards: [] })
    const g = nav.nav
    let near = -1
    let far = -1
    for (let c = 0; c < g.mask.length; c++) {
      if (!g.mask[c]) continue
      const d = Math.hypot(cellX(g, c) - 10, cellZ(g, c) - 10)
      if (d < 1 && near < 0) near = c
      if (d > 60 && far < 0) far = c
    }
    expect(f.div[near]).toBeGreaterThan(f.div[far])
    expect(f.div[far]).toBeCloseTo(1 + 2 * GUEST_TUNING.schemeSignWeight, 5)
  })
})

describe('thoughts, queues and feedback', () => {
  it('a long line makes guests say so, some give up on optional stops, and it reaches the card and feedback', () => {
    const nav = guestNav(6)
    const departAt = 3 * 3600
    // Everyone bursting for the one toilet block.
    for (let i = 0; i < 40; i++) {
      nav.spawn({
        id: `p${i}`,
        gate: GATES[i % 4],
        departAt,
        bags: false,
        purpose: 'business',
        flags: [],
        startNeeds: { bladder: 0.95, hunger: 0, thirst: 0, boredom: 0 },
      })
    }
    runChecked(nav, 0, 2400, 0.25)
    const wc = nav.metricsFor('wc1')!
    expect(wc.served).toBeGreaterThan(0)
    expect(wc.leftQueue).toBeGreaterThan(0)
    const fb = nav.drainFeedback()
    expect(fb.leftQueue).toBe(wc.leftQueue)
    expect(fb.satDelta).toBeLessThan(0)
    const said = new Set<string>()
    for (let i = 0; i < 40; i++) for (const t of nav.guest(`p${i}`)?.thoughts ?? []) said.add(t.text)
    expect(said).toContain('This queue is too long')
    expect(said).toContain("I'm not waiting in this line")
    // Drained: the next read starts from zero.
    expect(nav.drainFeedback().leftQueue).toBe(0)
  })

  it('an empty shelf: "Shop is out of stock", nothing spent, satisfaction down', () => {
    const nav = guestNav(7)
    expect(nav.addStock('shop1', -1000)).toBe(0)
    expect(nav.metricsFor('shop1')!.stock).toBe(0)
    nav.spawn({
      id: 'hungry',
      gate: 'g1',
      departAt: 3 * 3600,
      bags: false,
      purpose: 'leisure',
      flags: [],
      startNeeds: { hunger: 0.95, bladder: 0, boredom: 0, thirst: 0 },
    })
    const sat0 = nav.guest('hungry')!.satisfaction
    runChecked(nav, 0, 400, 0.25)
    const card = nav.guest('hungry')!
    expect(card.thoughts.map((t) => t.text)).toContain('Shop is out of stock')
    expect(card.spent).toBe(0)
    expect(card.satisfaction).toBeLessThan(sat0)
    expect(nav.drainFeedback().outOfStock).toBe(1)
  })

  it('a restock lets the next guest buy, and their mood is above the stockout', () => {
    const nav = guestNav(11)
    nav.addStock('shop1', -1000)
    nav.spawn({
      id: 'hungry',
      gate: 'g1',
      departAt: 3 * 3600,
      bags: false,
      purpose: 'leisure',
      flags: [],
      startNeeds: { hunger: 0.95, bladder: 0, boredom: 0, thirst: 0 },
    })
    const sat0 = nav.guest('hungry')!.satisfaction
    runChecked(nav, 0, 400, 0.25)
    const hit = nav.guest('hungry')!
    expect(hit.thoughts.map((t) => t.text)).toContain('Shop is out of stock')
    expect(hit.satisfaction).toBeLessThan(sat0)
    nav.mirrorShelves(GUEST_TUNING.stockCap, GUEST_TUNING.stockCap)
    expect(nav.metricsFor('shop1')!.stock).toBe(GUEST_TUNING.stockCap)
    nav.spawn({
      id: 'next',
      gate: 'g1',
      departAt: 4 * 3600,
      bags: false,
      purpose: 'leisure',
      flags: [],
      startNeeds: { hunger: 0.95, bladder: 0, boredom: 0, thirst: 0 },
    })
    runChecked(nav, 400, 2200, 0.25)
    const next = nav.guest('next')!
    expect(next.spent).toBeGreaterThan(0)
    expect(next.thoughts.map((t) => t.text)).not.toContain('Shop is out of stock')
    expect(next.satisfaction).toBeGreaterThan(hit.satisfaction)
  })

  it('a stocked shelf sells by trait and does not refill itself', () => {
    const run = (purpose: GuestPurpose) => {
      const nav = guestNav(8)
      for (let i = 0; i < 6; i++) {
        nav.spawn({ id: `p${i}`, gate: 'g1', departAt: 3 * 3600, bags: false, purpose, flags: [], startNeeds: { hunger: 0.95, bladder: 0, boredom: 0 } })
      }
      runChecked(nav, 0, 1500, 0.25)
      return { fb: nav.drainFeedback(), stock: nav.metricsFor('shop1')!.stock! }
    }
    const biz = run('business')
    const budget = run('budget')
    expect(biz.fb.spent).toBeGreaterThan(budget.fb.spent)
    expect(biz.stock).toBeLessThan(GUEST_TUNING.stockCap)
    const nav = guestNav(8)
    nav.addStock('shop1', -4)
    const before = nav.metricsFor('shop1')!.stock!
    runChecked(nav, 0, 600, 0.5)
    expect(nav.metricsFor('shop1')!.stock).toBeLessThanOrEqual(before)
    nav.mirrorShelves(GUEST_TUNING.stockCap, GUEST_TUNING.stockCap)
    expect(nav.metricsFor('shop1')!.stock).toBe(GUEST_TUNING.stockCap)
  })

  it('feedback turns into a reputation change', () => {
    expect(feedbackReputation({ satDelta: 0, missed: 0, complaints: 0 })).toBe(0)
    expect(feedbackReputation({ satDelta: -100, missed: 2, complaints: 3 })).toBeLessThan(0)
    expect(feedbackReputation({ satDelta: 50, missed: 0, complaints: 0 })).toBeGreaterThan(0)
    expect(feedbackReputation({ satDelta: NaN, missed: 0, complaints: 0 })).toBe(0)
  })
})

describe('groups', () => {
  it('a family walks together on the leader path, never through a wall, and boards together', () => {
    const nav = guestNav(9)
    const departAt = 1800 + PAXNAV_TUNING.boardLeadSec
    nav.spawn({ id: 'mum', gate: 'g2', departAt, bags: true, purpose: 'family', flags: ['with_kids'] })
    for (const id of ['kid1', 'kid2', 'dad']) nav.spawn({ id, gate: 'g2', departAt, groupOf: 'mum' })
    // Groups have a cap.
    nav.spawn({ id: 'gran', gate: 'g2', departAt, groupOf: 'mum' })
    nav.spawn({ id: 'extra', gate: 'g2', departAt, groupOf: 'mum' })
    expect(nav.guest('mum')!.group.length).toBe(GUEST_TUNING.groupMax)
    expect(nav.guest('extra')!.leader).toBeNull()
    expect(nav.guest('kid1')!.leader).toBe('mum')
    let maxGap = 0
    const tracks = new Map()
    let events: PaxEvent[] = []
    for (let t = 0; t < departAt; t += 30) {
      const r = runChecked(nav, t, t + 30, 0.25, tracks)
      events = events.concat(r.events)
      const poses = new Map(nav.poses().map((p) => [p.id, p]))
      const mum = poses.get('mum')
      if (!mum) continue
      for (const id of ['kid1', 'kid2', 'dad', 'gran']) {
        const p = poses.get(id)!
        maxGap = Math.max(maxGap, Math.hypot(p.x - mum.x, p.z - mum.z))
      }
    }
    expect(maxGap).toBeLessThan(GUEST_TUNING.groupMax * GUEST_TUNING.groupGapM + 1.5)
    const boarded = events.filter((e) => e.kind === 'boarded')
    const fam = boarded.filter((e) => ['mum', 'kid1', 'kid2', 'dad', 'gran'].includes(e.id))
    expect(fam.length).toBe(5)
    expect(new Set(fam.map((e) => e.at)).size).toBe(1)
  })
})

describe('missed flights', () => {
  it('a guest who misses heads to a rebooking desk, then leaves; it costs satisfaction', () => {
    const nav = guestNav(10)
    nav.spawn({ id: 'late', gate: 'g1', departAt: PAXNAV_TUNING.gateCloseSec + 20, bags: true, needs: [] })
    const { events } = runChecked(nav, 0, 30, 0.25)
    expect(events.map((e) => e.kind)).toEqual(['missed'])
    const card = nav.guest('late')!
    expect(card.rebooking).toBe(true)
    expect(card.stop).toBe('rebook')
    expect(card.thoughts.map((t) => t.key)).toContain('missed')
    const flags = new Uint8Array(4)
    nav.writeFlags(flags)
    expect(flags[0] & WALKER_REBOOK).toBeTruthy()
    // Landside: the rebooking desk is a check-in desk.
    expect(card.facility?.startsWith('desk')).toBe(true)
    const rest = runChecked(nav, 30, 1200, 0.25)
    expect(rest.events.map((e) => e.kind)).toEqual(['rebooked'])
    expect(nav.count).toBe(0)
    const fb = nav.drainFeedback()
    expect(fb.missed).toBe(1)
    expect(fb.rebooked).toBe(1)
    expect(feedbackReputation(fb)).toBeLessThan(0)
  })

  it('too few lanes for the crowd: some miss and rebook airside or landside, nobody walks through a wall', () => {
    let l = bigTerminal()
    for (let i = 2; i <= 8; i++) l = build(l, [(x) => removeEquipment(x, `lane${i}`)])
    const nav = new PaxNav(l, { seed: 11, guests: true })
    const departAt = 900 + PAXNAV_TUNING.boardLeadSec
    for (let i = 0; i < 80; i++) nav.spawn({ id: `p${i}`, gate: GATES[i % 4], departAt, bags: false })
    const { events } = runChecked(nav, 0, departAt + 1500, 0.25)
    const missed = events.filter((e) => e.kind === 'missed').length
    const rebooked = events.filter((e) => e.kind === 'rebooked').length
    const boarded = events.filter((e) => e.kind === 'boarded').length
    expect(missed).toBeGreaterThan(0)
    expect(rebooked).toBe(missed)
    expect(boarded + missed).toBe(80)
  })
})

describe('pace and scale', () => {
  it('walking distance scales with the time step, so 3x and 5x are three and five times as far', () => {
    const walked = (k: number) => {
      const nav = guestNav(12)
      nav.spawn({ id: 'a', gate: 'g1', departAt: 9000, bags: true, needs: [], purpose: 'business', flags: [] })
      const p0 = nav.poses()[0]
      for (let i = 0; i < 8; i++) nav.tick(0.2 * k, i * 0.2 * k)
      const p1 = nav.poses()[0]
      return Math.hypot(p1.x - p0.x, p1.z - p0.z)
    }
    const one = walked(1)
    expect(one).toBeGreaterThan(0.5)
    expect(walked(3) / one).toBeGreaterThan(2.5)
    expect(walked(5) / one).toBeGreaterThan(4)
  })

  it('crowds slow walkers down (they give way)', () => {
    const lone = guestNav(13)
    lone.spawn({ id: 'a', gate: 'g1', departAt: 9000, bags: true, needs: [], purpose: 'business', flags: ['frequent_flyer'] })
    const crowd = guestNav(13)
    crowd.spawn({ id: 'a', gate: 'g1', departAt: 9000, bags: true, needs: [], purpose: 'business', flags: ['frequent_flyer'] })
    for (let i = 0; i < 300; i++) crowd.spawn({ id: `c${i}`, gate: 'g1', departAt: 9000, bags: true, needs: [] })
    const prog = (nav: PaxNav) => {
      const p0 = nav.poses().find((p) => p.id === 'a')!
      for (let t = 0; t < 10; t += 0.25) nav.tick(0.25, t)
      const p1 = nav.poses().find((p) => p.id === 'a')!
      return Math.hypot(p1.x - p0.x, p1.z - p0.z)
    }
    expect(prog(crowd)).toBeLessThan(prog(lone))
  })

  it('is deterministic with guests on', () => {
    const run = () => {
      const nav = guestNav(14)
      for (let i = 0; i < 60; i++) nav.spawn({ id: `p${i}`, gate: GATES[i % 4], departAt: 3600, groupOf: i % 5 ? `p${i - (i % 5)}` : undefined })
      for (let t = 0; t < 900; t += 0.5) nav.tick(0.5, t)
      return JSON.stringify([nav.poses(), nav.metrics().map((m) => [m.id, m.served, m.leftQueue]), nav.guest('p7'), nav.drainFeedback()])
    }
    expect(run()).toEqual(run())
  })

  it('500 guests flow curb to boarding on a four-gate terminal', { timeout: 20_000 }, () => {
    const nav = guestNav(15)
    const tracks = new Map()
    let events: PaxEvent[] = []
    // Ten departure waves of 50, an hour of show-ups.
    for (let w = 0; w < 10; w++) {
      const t0 = w * 360
      for (let i = 0; i < 50; i++) {
        const n = w * 50 + i
        nav.spawn({ id: `p${n}`, gate: GATES[n % 4], departAt: t0 + 5400, groupOf: n % 7 === 1 ? `p${n - 1}` : undefined })
      }
      events = events.concat(runChecked(nav, t0, t0 + 360, 0.25, tracks).events)
    }
    events = events.concat(runChecked(nav, 3600, 3600 + 5400 + 600, 0.25, tracks).events)
    const boarded = events.filter((e) => e.kind === 'boarded').length
    const missed = events.filter((e) => e.kind === 'missed').length
    expect(boarded + missed).toBe(500)
    // The terminal has the kit for this load: nearly everyone makes it.
    expect(boarded).toBeGreaterThan(475)
    expect(nav.count).toBe(0)
    const shops = nav.metricsFor('shop1')!.served + nav.metricsFor('wc1')!.served
    expect(shops).toBeGreaterThan(50)
  })

  it('moves 1300 guests inside the frame budget', () => {
    const nav = guestNav(16)
    for (let i = 0; i < 1300; i++) {
      nav.spawn({ id: `p${i}`, gate: GATES[i % 4], departAt: 4 * 3600, groupOf: i % 6 === 1 ? `p${i - 1}` : undefined })
    }
    const dt = 1 / 20
    let t = 0
    for (let i = 0; i < 40; i++, t += dt) nav.tick(dt, t)
    const buf = new Float32Array(1300 * 4)
    const flags = new Uint8Array(1300)
    const frames = 200
    const start = performance.now()
    for (let i = 0; i < frames; i++, t += dt) {
      nav.tick(dt, t)
      nav.writePoses(buf)
      nav.writeFlags(flags)
    }
    const ms = (performance.now() - start) / frames
    expect(nav.count).toBe(1300)
    expect(ms).toBeLessThan(5)
  })
})
