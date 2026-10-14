import { describe, expect, it } from 'vitest'
import {
  dismissTip,
  evaluateTips,
  newTipBook,
  runwayExitCells,
  sanitizeTipBook,
  setTipsEnabled,
  stepTips,
  type TipWorld,
} from './tips.ts'
import { TIP_CASH, TIP_HALL_QUEUE, TIP_QUEUE_SEC } from './tipsData.ts'
import type { Tile } from './types.ts'

function world(over: Partial<TipWorld> = {}): TipWorld {
  return {
    site: true,
    sandbox: false,
    cash: 40_000,
    hasRunway: true,
    stands: 2,
    exits: 2,
    orphans: 0,
    queueWait: 0,
    queueCount: 0,
    hallQueue: 0,
    fuelEmpty: false,
    stuck: false,
    runwayCell: { c: 10, r: 26 },
    queueCell: { c: 8, r: 20 },
    hallCell: { c: 14, r: 8 },
    fuelCell: { c: 7, r: 5 },
    stuckCell: { c: 9, r: 18 },
    ...over,
  }
}

describe('tip triggers', () => {
  it('stays quiet on a healthy starter field', () => {
    expect(evaluateTips(world())).toEqual([])
    expect(evaluateTips(world({ site: false, cash: 0, stands: 0, hasRunway: false }))).toEqual([])
  })

  it('names no stand, no runway, and no exit on the cell that is stuck', () => {
    expect(evaluateTips(world({ stands: 0 })).map((t) => t.id)).toEqual(['no-stand'])
    expect(evaluateTips(world({ stands: 0 }))[0]?.anchor).toEqual({ kind: 'hud', slot: 'build' })

    expect(evaluateTips(world({ hasRunway: false })).map((t) => t.id)).toEqual(['no-runway'])

    const blocked = evaluateTips(world({ exits: 0, orphans: 2 }))
    expect(blocked.map((t) => t.id)).toEqual(['no-runway-exit'])
    expect(blocked[0]?.anchor).toEqual({ kind: 'world', cell: { c: 10, r: 26 } })
    expect(evaluateTips(world({ orphans: 2 })).map((t) => t.id)).toEqual(['no-runway-exit'])
  })

  it('fires queue, hall, cash, taxi, and fuel from the snapshot', () => {
    const ids = evaluateTips(
      world({
        queueWait: TIP_QUEUE_SEC,
        queueCount: 2,
        hallQueue: TIP_HALL_QUEUE,
        cash: TIP_CASH - 1,
        stuck: true,
        fuelEmpty: true,
      }),
    ).map((t) => t.id)
    expect(ids).toEqual(['queue-backing-up', 'hall-queue', 'out-of-cash', 'taxi-stuck', 'fuel-dry'])
    expect(evaluateTips(world({ cash: 0, sandbox: true })).map((t) => t.id)).not.toContain('out-of-cash')
    expect(evaluateTips(world({ queueWait: TIP_QUEUE_SEC - 1, queueCount: 4 }))).toEqual([])
  })
})

describe('once each', () => {
  it('shows a chip once, and a return of the same problem stays dark', () => {
    const live = evaluateTips(world({ cash: 100 }))
    const first = stepTips(newTipBook(), live)
    expect(first.visible.map((t) => t.id)).toEqual(['out-of-cash'])
    expect(first.book.open).toEqual(['out-of-cash'])

    const still = stepTips(first.book, live)
    expect(still.visible).toHaveLength(1)

    const cleared = stepTips(still.book, [])
    expect(cleared.visible).toEqual([])
    expect(cleared.book.spent).toEqual(['out-of-cash'])

    const again = stepTips(cleared.book, live)
    expect(again.visible).toEqual([])
    expect(again.book.open).toEqual([])
  })

  it('a dismiss spends the id even while the problem is still true', () => {
    const live = evaluateTips(world({ stands: 0 }))
    const opened = stepTips(newTipBook(), live)
    const spent = stepTips(dismissTip(opened.book, 'no-stand'), live)
    expect(spent.visible).toEqual([])
    expect(spent.book.spent).toContain('no-stand')
  })

  it('the settings toggle hides chips without spending one the player has not finished', () => {
    const live = evaluateTips(world({ fuelEmpty: true }))
    const opened = stepTips(newTipBook(), live)
    const hidden = stepTips(setTipsEnabled(opened.book, false), live)
    expect(hidden.visible).toEqual([])
    expect(hidden.book.spent).toEqual([])
    expect(hidden.book.open).toEqual(['fuel-dry'])

    const back = stepTips(setTipsEnabled(hidden.book, true), live)
    expect(back.visible.map((t) => t.id)).toEqual(['fuel-dry'])
  })

  it('keeps at most three open and does not spend the ones still waiting', () => {
    const live = evaluateTips(
      world({
        stands: 0,
        queueWait: TIP_QUEUE_SEC,
        queueCount: 1,
        hallQueue: TIP_HALL_QUEUE,
        cash: 0,
        stuck: true,
      }),
    )
    expect(live.length).toBeGreaterThan(3)
    const shown = stepTips(newTipBook(), live)
    expect(shown.visible).toHaveLength(3)
    expect(shown.book.spent).toEqual([])
    const rest = live.map((t) => t.id).filter((id) => !shown.book.open.includes(id))
    expect(rest.length).toBeGreaterThan(0)
  })

  it('reads an older save that has no tip book', () => {
    expect(sanitizeTipBook(undefined)).toEqual(newTipBook())
    expect(sanitizeTipBook({ enabled: false, spent: ['out-of-cash', 3], open: [] }).enabled).toBe(false)
    expect(sanitizeTipBook({ enabled: false, spent: ['out-of-cash', 3], open: [] }).spent).toEqual(['out-of-cash'])
  })
})

describe('runway exits', () => {
  it('counts a taxi cell that touches the strip and ignores a taxi that does not', () => {
    const tiles: Tile[][] = [
      ['grass', 'grass', 'grass'],
      ['taxi', 'runway', 'grass'],
      ['taxi', 'grass', 'grass'],
    ]
    expect(runwayExitCells(tiles)).toEqual([{ c: 0, r: 1 }])
  })
})
