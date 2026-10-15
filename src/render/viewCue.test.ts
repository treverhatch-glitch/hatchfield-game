import { describe, expect, it } from 'vitest'
import { CUE_SKIP_MS, beginCue, clearCue, cueCanSkip, legoSnap, sectionWeights, shownWorld } from './viewCue'

describe('view transition', () => {
  it('plays the beat on the apron shell, then the live view', () => {
    expect(shownWorld('apron', null)).toBe('apron')
    expect(shownWorld('hall', null)).toBe('hall')
    expect(shownWorld('hall', 'apron')).toBe('apron')
    expect(shownWorld('apron', 'hall')).toBe('apron')
  })

  it('lifts roof sections on the way in and snaps walls on the way out', () => {
    const enter = sectionWeights('enter', 0.2)
    expect(enter.roof[0]).toBeGreaterThan(enter.roof[3]!)
    expect(enter.wall.every((h) => h === 1)).toBe(true)
    const leave = sectionWeights('leave', 0)
    expect(leave.roof.every((h) => h === 1)).toBe(true)
    expect(leave.wall[0]).toBeLessThan(0.05)
    const done = sectionWeights('leave', 1)
    expect(done.roof.every((h) => h === 0)).toBe(true)
    expect(done.wall.every((h) => Math.abs(h - 1) < 1e-6)).toBe(true)
    expect(legoSnap(0.7)).toBeGreaterThan(1)
  })

  it('stays inside about a second and a half and ignores the opening click', () => {
    beginCue('hall', 1000)
    expect(cueCanSkip(1000 + CUE_SKIP_MS - 1)).toBe(false)
    expect(cueCanSkip(1000 + CUE_SKIP_MS)).toBe(true)
    clearCue()
    expect(cueCanSkip(5000)).toBe(false)
  })
})
