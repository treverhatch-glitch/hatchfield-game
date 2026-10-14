import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { formatLodAdvice, type LodTuneInput } from './lodTune'

describe('PerfOverlay', () => {

  beforeEach(() => {
    // If not using jsdom, we can mock what we need on globalThis or window
    if (typeof window !== 'undefined') {
      window.__lodTuneInput = undefined
      window.__lodScale = undefined
    }
  })

  afterEach(() => {
    // Clean up
  })

  it('ensures formatLodAdvice is non-empty for a sample input', () => {
    const input: LodTuneInput = { fps: 60, drawCalls: 1000, triangles: 50000, currentScale: 1.0 }
    const advice = formatLodAdvice(input)
    expect(advice).toContain('LOD scale')
    expect(advice.length).toBeGreaterThan(0)
  })

  it('unit-tests the advice string path via lodTune', () => {
    const input: LodTuneInput = { fps: 20, drawCalls: 5000, triangles: 50000, currentScale: 1.0 }
    const advice = formatLodAdvice(input)
    expect(advice).toContain('suggested 1.05')
  })
})
