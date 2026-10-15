import { describe, expect, it } from 'vitest'
import type { ChecklistLine } from './checklist.ts'
import { NUDGE_DAY_CAP, NUDGE_GAP_DAYS } from './config.ts'
import { considerNudges, emptyNudgeMemory, nudgeText, silenceNudge, unmetHardLine, type NudgeCarrier } from './nudge.ts'

function line(id: string, label: string, status: ChecklistLine['status']): ChecklistLine {
  return { id, label, detail: status, status }
}

function carrier(id: string, name: string, tier: number, lines: ChecklistLine[]): NudgeCarrier {
  return { id, name, contractTier: tier, linesFor: () => lines }
}

describe('hub nudge texts', () => {
  it('sends the dedicated-desk line once, then waits four game days', () => {
    expect(nudgeText('brisa', 'base', 'Dedicated desks')).toContain('Request dedicated desks')
    const desk = [line('desk', 'Dedicated desks', 'missing')]
    const firstSight = considerNudges(emptyNudgeMemory(), 0, [carrier('brisa', 'Brisa', 1, desk)])
    expect(firstSight.inbox).toHaveLength(0)
    expect(firstSight.notedTier.brisa).toBe(1)

    const crossed = considerNudges(firstSight, 1, [carrier('brisa', 'Brisa', 3, desk)])
    expect(crossed.inbox).toHaveLength(1)
    expect(crossed.inbox[0]?.text).toContain('Tag a desk')
    expect(crossed.pending.map((row) => row.step)).toEqual(['base'])

    const nextDay = considerNudges(crossed, 2, [carrier('brisa', 'Brisa', 3, desk)])
    expect(nextDay.inbox).toHaveLength(1)
    expect(nextDay.pending).toHaveLength(1)

    const later = considerNudges(crossed, 1 + NUDGE_GAP_DAYS, [carrier('brisa', 'Brisa', 3, desk)])
    expect(later.inbox.map((row) => row.step)).toEqual(['focus', 'base'])
    expect(later.inbox[1]?.text).toContain('Request dedicated desks')
    expect(later.pending).toHaveLength(0)
  })

  it('caps the field at three texts and lets decline silence only that step', () => {
    const desk = [line('desk', 'Dedicated desks', 'missing')]
    let memory = considerNudges(emptyNudgeMemory(), 0, [
      carrier('a', 'A', 1, desk),
      carrier('b', 'B', 1, desk),
      carrier('c', 'C', 1, desk),
      carrier('d', 'D', 1, desk),
    ])
    memory = considerNudges(memory, 1, [
      carrier('a', 'A', 2, desk),
      carrier('b', 'B', 2, desk),
      carrier('c', 'C', 2, desk),
      carrier('d', 'D', 2, desk),
    ])
    expect(memory.inbox).toHaveLength(NUDGE_DAY_CAP)
    expect(memory.pending).toHaveLength(1)
    expect(memory.sent).toBe(NUDGE_DAY_CAP)

    const quiet = silenceNudge(memory, 'a', 'focus')
    expect(quiet.inbox.some((row) => row.airlineId === 'a')).toBe(false)
    const again = considerNudges(
      { ...quiet, notedTier: { ...quiet.notedTier, a: 1 } },
      1 + NUDGE_GAP_DAYS,
      [carrier('a', 'A', 2, desk)],
    )
    expect(again.inbox.some((row) => row.airlineId === 'a' && row.step === 'focus')).toBe(false)
  })

  it('skips a warmth step whose hard line is already met', () => {
    const met = [line('desk', 'Dedicated desks', 'ok'), line('relation', 'Preferred relationship', 'missing')]
    expect(unmetHardLine(met)).toBeNull()
    const seen = considerNudges(emptyNudgeMemory(), 0, [carrier('brisa', 'Brisa', 1, met)])
    const crossed = considerNudges(seen, 1, [carrier('brisa', 'Brisa', 2, met)])
    expect(crossed.inbox).toHaveLength(0)
    expect(crossed.pending).toHaveLength(0)
  })
})
