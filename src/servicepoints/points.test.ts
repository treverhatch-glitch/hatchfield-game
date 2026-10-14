import { describe, expect, it } from 'vitest'
import { itemDef, schemeItems } from '../game/terminal.ts'
import { STARTER_CAPACITY } from '../game/openingData.ts'
import { PLAY_TUNING } from '../terminalplay/config.ts'
import { DEPARTURE_SPREAD_SEC } from '../game/terminal.ts'
import { servePose } from './anim.ts'
import { extraOpenServers, formatWait, openPointIds, serviceInfoLines, throughputOf, type PointLoad, type StaffPoint } from './points.ts'
import { simulatePoints } from './pace.ts'

function point(partial: Partial<StaffPoint> & Pick<StaffPoint, 'id' | 'kind'>): StaffPoint {
  return { included: false, automatic: false, ...partial }
}

function load(partial: Partial<PointLoad> & Pick<PointLoad, 'id'>): PointLoad {
  return {
    kind: 'security_lane',
    staffed: true,
    queueLength: 0,
    serving: false,
    serviceSec: 3.2,
    estWaitSec: 0,
    ...partial,
  }
}

describe('service point staffing', () => {
  const prefab: StaffPoint[] = [
    point({ id: 'belt', kind: 'checkin_desk', included: true }),
    point({ id: 'kiosk', kind: 'checkin_desk', automatic: true }),
    point({ id: 'extra-desk', kind: 'checkin_desk' }),
    point({ id: 'lane-0', kind: 'security_lane', included: true }),
    point({ id: 'lane-1', kind: 'security_lane', included: true }),
    point({ id: 'lane-extra', kind: 'security_lane' }),
  ]

  it('opens the prefab points with nobody hired, and keeps an extra desk closed', () => {
    const open = openPointIds(prefab, { checkin: 0, security: 0 })
    expect(open.has('belt')).toBe(true)
    expect(open.has('kiosk')).toBe(true)
    expect(open.has('lane-0')).toBe(true)
    expect(open.has('lane-1')).toBe(true)
    expect(open.has('extra-desk')).toBe(false)
    expect(open.has('lane-extra')).toBe(false)
  })

  it('a hired clerk opens one extra desk, a screener opens one extra lane', () => {
    const open = openPointIds(prefab, { checkin: 1, security: 1 })
    expect(open.has('extra-desk')).toBe(true)
    expect(open.has('lane-extra')).toBe(true)
  })

  it('a built terminal with no included points keeps every point open', () => {
    const built: StaffPoint[] = [
      point({ id: 'd1', kind: 'checkin_desk' }),
      point({ id: 'd2', kind: 'checkin_desk' }),
      point({ id: 's1', kind: 'security_lane' }),
    ]
    const open = openPointIds(built, { checkin: 0, security: 0 })
    expect([...open].sort()).toEqual(['d1', 'd2', 's1'])
  })

  it('extra servers open one per hired screener and never past the lanes placed', () => {
    expect(extraOpenServers(3, 0)).toBe(0)
    expect(extraOpenServers(3, 2)).toBe(2)
    expect(extraOpenServers(1, 4)).toBe(1)
    expect(extraOpenServers(Number.NaN, 2)).toBe(0)
  })
})

describe('throughput', () => {
  it('counts only staffed points that are in use', () => {
    const points = [
      load({ id: 'a', serving: true, queueLength: 2, estWaitSec: 8 }),
      load({ id: 'b', queueLength: 0, serving: false }),
      load({ id: 'c', staffed: false, queueLength: 4, estWaitSec: 1200 }),
    ]
    const t = throughputOf(points, 15)
    expect(t.points).toBe(3)
    expect(t.staffed).toBe(2)
    expect(t.inUse).toBe(1)
    expect(t.perMin).toBeCloseTo(60 / 3.2)
    expect(t.queueLength).toBe(6)
    expect(t.bottleneck).toBe(true)
  })

  it('two busy lanes clear twice one busy lane', () => {
    const one = throughputOf([load({ id: 'a', serving: true })], 15)
    const two = throughputOf(
      [load({ id: 'a', serving: true }), load({ id: 'b', serving: true, queueLength: 1 })],
      15,
    )
    expect(two.perMin).toBeCloseTo(one.perMin * 2)
    expect(two.inUse).toBe(2)
  })

  it('an idle staffed hall is not a bottleneck', () => {
    const t = throughputOf([load({ id: 'a' }), load({ id: 'b' })], 15)
    expect(t.inUse).toBe(0)
    expect(t.perMin).toBe(0)
    expect(t.bottleneck).toBe(false)
  })
})

describe('info lines', () => {
  it('names the queue length and the wait for each point', () => {
    const points = [
      { id: 'a', kind: 'security_lane', staffed: true, queueLength: 4, serving: true, waitSec: 12 },
      { id: 'b', kind: 'security_lane', staffed: false, queueLength: 2, serving: false, waitSec: 1200 },
    ]
    const lines = serviceInfoLines('Security', points, throughputOf(
      points.map((p) => ({ ...p, serviceSec: 3.2, estWaitSec: p.waitSec })),
      15,
    ))
    expect(lines.some((l) => l.includes('Queue 6'))).toBe(true)
    expect(lines.some((l) => l.includes('wait 12s'))).toBe(true)
    expect(lines.some((l) => l.startsWith('Lane 1') && l.includes('queue 4') && l.includes('in use'))).toBe(true)
    expect(lines.some((l) => l.startsWith('Lane 2') && l.includes('unstaffed'))).toBe(true)
    expect(lines.some((l) => l.includes('Bottleneck'))).toBe(true)
    const built = serviceInfoLines('Check-in', points.map((p) => ({ ...p, kind: 'checkin_desk' })), throughputOf(
      points.map((p) => ({ ...p, kind: 'checkin_desk', serviceSec: 4, estWaitSec: p.waitSec })),
      15,
    ), true)
    expect(built).toContain('open: building service (no staff needed)')
    expect(formatWait(0)).toBe('0s')
    expect(formatWait(95)).toBe('2 min')
  })
})

describe('serve animation', () => {
  it('reaches toward the desk while being served and stands still in the queue', () => {
    const queued = servePose(0.4, 'queue')
    expect(queued.lean).toBe(0)
    expect(queued.reach).toBe(0)
    let peak = 0
    for (let t = 0; t < 2; t += 0.02) peak = Math.max(peak, servePose(t, 'serve').reach)
    expect(peak).toBeGreaterThan(0.2)
    expect(servePose(Number.NaN, 'serve').lean).toBe(0)
  })
})

describe('prefab pace', () => {
  it('the basic prefab places one service point per published server', () => {
    for (const tier of [1, 2, 3] as const) {
      const items = schemeItems(tier).filter((it) => itemDef(it.def)?.room === 'security')
      const servers = items.reduce((s, it) => s + (itemDef(it.def)?.servers ?? 0), 0)
      const want = tier === 1 ? STARTER_CAPACITY.servers : tier === 2 ? 3 : 4
      expect(servers).toBe(want)
    }
  })

  it('starter traffic does not fill the prefab line; a tighter bank does', () => {
    const early = simulatePoints({
      points: STARTER_CAPACITY.servers,
      serviceSec: STARTER_CAPACITY.serviceSec,
      flightGapSec: 40,
      bodiesPerFlight: 11,
      releaseSpreadSec: DEPARTURE_SPREAD_SEC,
      seconds: 180,
    })
    expect(early.maxQueue).toBeLessThan(PLAY_TUNING.bottleneckAt)
    expect(early.served).toBeGreaterThan(0)

    const later = simulatePoints({
      points: STARTER_CAPACITY.servers,
      serviceSec: STARTER_CAPACITY.serviceSec,
      flightGapSec: 16,
      bodiesPerFlight: 16,
      releaseSpreadSec: DEPARTURE_SPREAD_SEC,
      seconds: 180,
    })
    expect(later.maxQueue).toBeGreaterThanOrEqual(PLAY_TUNING.bottleneckAt)
  })
})
