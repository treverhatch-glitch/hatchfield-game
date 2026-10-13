import { describe, expect, it } from 'vitest'
import { needsResize } from './world'

describe('drawing buffer resize', () => {
  it('stays put when the buffer already matches CSS size times the pixel ratio', () => {
    expect(needsResize(800, 600, 800, 600, 1)).toBe(false)
    expect(needsResize(1000, 750, 800, 600, 1.25)).toBe(false)
    expect(needsResize(640, 480, 800, 600, 0.8)).toBe(false)
  })

  it('asks for a resize when device pixels were compared to CSS pixels', () => {
    expect(needsResize(800, 600, 800, 600, 1.25)).toBe(true)
    expect(needsResize(800, 600, 800, 600, 0.8)).toBe(true)
    expect(needsResize(1000, 750, 900, 600, 1.25)).toBe(true)
  })
})
