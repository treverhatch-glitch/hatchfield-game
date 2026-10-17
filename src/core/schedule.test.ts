import { describe, it, expect, beforeEach } from 'vitest'
import { scheduler } from './schedule.ts'

describe('scheduler', () => {
  beforeEach(() => {
    scheduler.clear()
  })

  it('drains jobs that return done', () => {
    let a = 0
    let b = 0
    scheduler.enqueue('job-a', () => {
      a++
      return 'done'
    })
    scheduler.enqueue('job-b', () => {
      b++
      return 'done'
    })

    expect(scheduler.size).toBe(2)
    scheduler.drain(Infinity)
    expect(a).toBe(1)
    expect(b).toBe(1)
    expect(scheduler.size).toBe(0)
  })

  it('stops processing when a job returns more', () => {
    let a = 0
    let b = 0
    scheduler.enqueue('job-a', () => {
      a++
      return a < 3 ? 'more' : 'done'
    })
    scheduler.enqueue('job-b', () => {
      b++
      return 'done'
    })

    scheduler.drain(Infinity)
    expect(a).toBe(1)
    expect(b).toBe(0)
    expect(scheduler.size).toBe(2)

    scheduler.drain(Infinity)
    expect(a).toBe(2)
    expect(b).toBe(0)
    expect(scheduler.size).toBe(2)

    scheduler.drain(Infinity)
    expect(a).toBe(3)
    expect(b).toBe(1)
    expect(scheduler.size).toBe(0)
  })

  it('stops draining when budget is exhausted before job runs', () => {
    let a = 0
    scheduler.enqueue('job-a', () => {
      a++
      return 'done'
    })

    // Sleep before draining to exhaust budget
    // A trick: we can mock performance.now or just simulate budget check in the loop
    // But since `performance.now()` is global, we can't easily mock it without affecting vitest.
    // We can just rely on the fact that if we pass budget = -1, it stops immediately.
    scheduler.drain(-1)
    expect(a).toBe(0)
    expect(scheduler.size).toBe(1)

    scheduler.drain(Infinity)
    expect(a).toBe(1)
    expect(scheduler.size).toBe(0)
  })

  it('cancels and replaces a job by id', () => {
    let calls = 0
    scheduler.enqueue('job', () => {
      calls++
      return 'done'
    })
    // Replace it
    scheduler.enqueue('job', () => {
      calls += 10
      return 'done'
    })

    expect(scheduler.size).toBe(1)
    scheduler.drain(Infinity)
    expect(calls).toBe(10)
  })
})
