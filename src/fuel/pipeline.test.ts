import { describe, expect, it } from 'vitest'
import { PIPELINE, qualityHoldMinutes, supplyCut } from './pipeline.ts'

describe('pipeline tunables', () => {
  it('holds a batch for 6 game hours, twice the pipeline lead', () => {
    expect(qualityHoldMinutes()).toBe(360)
    expect(qualityHoldMinutes()).toBe(PIPELINE.leadMinutes * PIPELINE.holdMultiple)
    expect(PIPELINE.card).toBe(
      'Pipeline batch held. Quality check. Flow resumes in 6 hours, or buy one spot truck now.',
    )
  })

  it('cuts the term only while that line is open', () => {
    expect(supplyCut('pipeline', true)).toBe(-0.008)
    expect(supplyCut('rail', true)).toBe(-0.004)
    expect(supplyCut('pipeline', false)).toBe(0)
    expect(supplyCut('rail', false)).toBe(0)
    expect(supplyCut('road', true)).toBe(0)
  })
})
