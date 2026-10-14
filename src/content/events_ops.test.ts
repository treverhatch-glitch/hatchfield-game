import { beforeEach, describe, expect, it } from 'vitest'
import {
  OPS_ALERT_PREFIX,
  OPS_EVENTS,
  OPS_TUNING,
  OpsEventRunner,
  opsAlertText,
  opsDailyOdds,
  rollOpsEvent,
  type OpsWorld,
} from './events_ops'
import { Game } from '../game/sim.ts'

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = OPS_TUNING.daySec
const world = (clock: number, level = 5, stands = ['3,4', '5,4']): OpsWorld => ({
  clock,
  level,
  freeStands: () => stands,
})

describe('OPS_EVENTS table', () => {
  it('has 10 events with unique ids, durations, and a concrete effect', () => {
    expect(OPS_EVENTS).toHaveLength(10)
    expect(new Set(OPS_EVENTS.map((e) => e.id)).size).toBe(10)
    for (const e of OPS_EVENTS) {
      expect(e.durationHours[0]).toBeGreaterThan(0)
      expect(e.durationHours[1]).toBeGreaterThanOrEqual(e.durationHours[0])
      const fx = e.effect
      if (fx.kind === 'checkin' || fx.kind === 'security') expect(fx.mult).toBeGreaterThan(1)
      if (fx.kind === 'gate') expect(fx.gates).toBeGreaterThanOrEqual(1)
      if (fx.kind === 'delay') expect(fx.delaySec).toBeGreaterThan(0)
      expect(e.fix.length).toBeGreaterThan(0)
    }
    const ids = OPS_EVENTS.map((e) => e.id)
    for (const id of ['baggage_strike', 'checkin_it_outage', 'bird_strike', 'vip_visit']) expect(ids).toContain(id)
  })

  it('covers slower processing, gate closures, and flight delays', () => {
    const kinds = new Set(OPS_EVENTS.map((e) => e.effect.kind))
    expect(kinds).toEqual(new Set(['checkin', 'security', 'gate', 'delay']))
  })
})

describe('opsDailyOdds', () => {
  it('is zero below minLevel and grows with airport level up to the cap', () => {
    for (const e of OPS_EVENTS) {
      expect(opsDailyOdds(e, e.minLevel - 1)).toBe(0)
      expect(opsDailyOdds(e, e.minLevel + 3)).toBeGreaterThan(opsDailyOdds(e, e.minLevel))
      expect(opsDailyOdds(e, 99)).toBeLessThanOrEqual(OPS_TUNING.maxDailyOdds)
      expect(opsDailyOdds(e, Number.NaN)).toBe(0)
    }
  })

  it('rolls more often at a bigger airport', () => {
    const count = (level: number) => {
      const rng = seeded(7)
      let n = 0
      for (let i = 0; i < 2000; i++) if (rollOpsEvent(level, rng)) n++
      return n
    }
    expect(count(8)).toBeGreaterThan(count(1))
    expect(count(1)).toBeGreaterThan(0)
  })

  it('never picks an event above the airport level', () => {
    const rng = seeded(3)
    for (let i = 0; i < 500; i++) {
      const e = rollOpsEvent(1, rng)
      if (e) expect(e.minLevel).toBe(1)
    }
  })
})

describe('OpsEventRunner', () => {
  it('stays off for the first 3 in-game days', () => {
    const runner = new OpsEventRunner(() => 0)
    for (let day = 0; day < OPS_TUNING.quietDays; day++) {
      expect(runner.tick(world(day * DAY + 10))).toBeNull()
      expect(runner.start('bird_strike', world(day * DAY + 20))).toBeNull()
    }
    expect(runner.tick(world(OPS_TUNING.quietDays * DAY + 1))).not.toBeNull()
  })

  it('rolls at most once per day', () => {
    const runner = new OpsEventRunner(() => 0)
    const t = 5 * DAY
    expect(runner.tick(world(t))).not.toBeNull()
    expect(runner.tick(world(t + 1))).toBeNull()
  })

  it('applies processing slowdowns and clears them when the event ends', () => {
    const runner = new OpsEventRunner(() => 0.5)
    const t = 4 * DAY
    const it1 = runner.start('checkin_it_outage', world(t))!
    const scan = runner.start('scanner_fault', world(t))!
    expect(runner.checkInMultiplier()).toBeCloseTo(2.2)
    expect(runner.screeningMultiplier()).toBeCloseTo(1.5)
    expect(it1.endsAt - t).toBeCloseTo(3.5 * OPS_TUNING.hourSec)
    expect(runner.start('checkin_it_outage', world(t))).toBeNull()
    runner.tick(world(Math.max(it1.endsAt, scan.endsAt)))
    expect(runner.active).toHaveLength(0)
    expect(runner.checkInMultiplier()).toBe(1)
    expect(runner.screeningMultiplier()).toBe(1)
  })

  it('closes a free gate and does not double-book it', () => {
    const runner = new OpsEventRunner(() => 0)
    const t = 4 * DAY
    const a = runner.start('vip_visit', world(t))!
    const b = runner.start('jet_bridge_fault', world(t))!
    expect(a.gateKeys).toEqual(['3,4'])
    expect(b.gateKeys).toEqual(['5,4'])
    expect(runner.closedGates()).toEqual(new Set(['3,4', '5,4']))
    expect(runner.start('fuel_spill', world(t))).toBeNull()
  })

  it('builds a keyed alert row', () => {
    const runner = new OpsEventRunner(() => 0)
    const run = runner.start('bird_strike', world(4 * DAY))!
    const row = opsAlertText(run)
    expect(row.key.startsWith(OPS_ALERT_PREFIX)).toBe(true)
    expect(row.title).toBe('Bird strike')
    expect(row.detail).toContain('Fix:')
  })
})

describe('ops events in the sim', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  function starter(): Game {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.speed = 1
    return game
  }

  const rows = (game: Game) => game.alerts.active.filter((a) => a.key.startsWith(OPS_ALERT_PREFIX))

  it('refuses events in the opening days', () => {
    const game = starter()
    expect(game.triggerOpsEvent('checkin_it_outage')).toBeNull()
    expect(rows(game)).toEqual([])
  })

  it('slows check-in and raises one alert with a pan target', () => {
    const game = starter()
    game.clock = 4 * DAY
    const run = game.triggerOpsEvent('checkin_it_outage')
    expect(run).not.toBeNull()
    expect(game.opsEvents.checkInMultiplier()).toBeGreaterThan(1)
    const mine = rows(game).filter((a) => a.title === 'Check-in IT outage')
    expect(mine).toHaveLength(1)
    expect(mine[0].at).toBeDefined()
    game.panToAlert(mine[0].id)
    game.clock = run!.endsAt + 1
    game.tick(0.1)
    expect(rows(game).some((a) => a.key.endsWith(run!.id))).toBe(false)
  })

  it('takes a stand out of freeStands while a gate event runs', () => {
    const game = starter()
    game.clock = 4 * DAY
    const before = game.freeStands().length
    expect(before).toBeGreaterThan(0)
    const run = game.triggerOpsEvent('jet_bridge_fault')!
    const [c, r] = run.gateKeys[0].split(',').map(Number)
    expect(game.freeStands().some((s) => s.c === c && s.r === r)).toBe(false)
    expect(game.freeStands().length).toBe(before - 1)
    const row = rows(game).find((a) => a.key.endsWith(run.id))!
    expect(row.at).toEqual({ view: 'apron', cells: [{ c, r }] })
  })
})
