import { describe, expect, it } from 'vitest'
import { STUCK_WATCH, stuckLadderMin } from './stuckWatchdogData.ts'
import { StuckWatchdog, type WatchSample } from './stuckWatchdog.ts'

function sample(nowMin: number, token = 'taxi_out|1|1|0', state = 'taxi_out'): WatchSample {
  return { id: 'bu130', kind: 'aircraft', state, token, nowMin, label: 'BU130' }
}

describe('stuck watchdog ladder', () => {
  it('keeps the BU131, ZO116, and BU130 ladders inside five sim minutes', () => {
    for (const state of ['landing', 'board', 'taxi_out']) {
      expect(stuckLadderMin(state)).toBeLessThanOrEqual(STUCK_WATCH.recoverWithinMin)
    }
  })

  it('fires re-path, release, teleport, then cancel while the token stays put', () => {
    const watch = new StuckWatchdog()
    const steps: string[] = []
    let cancelledAt = Number.POSITIVE_INFINITY
    for (let i = 1; i <= 14; i++) {
      const now = i * 0.4
      for (const action of watch.observe([sample(now)])) {
        steps.push(action.step)
        if (action.step === 'cancel') cancelledAt = now
      }
    }
    expect(steps).toEqual(['repath', 'release', 'teleport', 'cancel'])
    expect(cancelledAt).toBeLessThanOrEqual(STUCK_WATCH.recoverWithinMin)
  })

  it('restarts the wait when the entity moves, and forgets it when it leaves', () => {
    const watch = new StuckWatchdog()
    watch.observe([sample(0)])
    watch.observe([sample(2, 'taxi_out|2|1|1')])
    const afterMove = watch.observe([sample(2.5, 'taxi_out|2|1|1')])
    expect(afterMove).toEqual([])
    expect(watch.outstanding(2.5)).toEqual([])
    watch.observe([])
    expect(watch.outstanding(3)).toEqual([])
  })

  it('keeps escalating after a recovery step changes the token but the entity is still stalled', () => {
    const watch = new StuckWatchdog()
    const seen: string[] = []
    let token = 'board|4|4|0'
    for (let i = 1; i <= 16; i++) {
      const actions = watch.observe([sample(i * 0.4, token, 'board')])
      for (const action of actions) {
        seen.push(action.step)
        if (action.step === 'repath') token = 'pushback|4|4|0'
      }
    }
    expect(seen).toEqual(['repath', 'release', 'teleport', 'cancel'])
  })

  it('uses the per-state limit for a vehicle mission', () => {
    const watch = new StuckWatchdog()
    const truck: WatchSample = {
      id: 'trk-1',
      kind: 'vehicle',
      state: 'load',
      token: 'load|3|3|0',
      nowMin: 0,
      label: 'bags load',
    }
    expect(watch.observe([truck])).toEqual([])
    expect(watch.observe([{ ...truck, nowMin: STUCK_WATCH.limits.load }])).toEqual([
      { id: 'trk-1', kind: 'vehicle', state: 'load', step: 'repath', label: 'bags load' },
    ])
  })
})
