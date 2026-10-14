import { describe, expect, it } from 'vitest'
import { postConfig } from './post'

describe('postConfig', () => {
  it('only High and Ultra run SMAA', () => {
    expect(postConfig({ level: 'low' }).smaa).toBe(false)
    expect(postConfig({ level: 'med' }).smaa).toBe(false)
    expect(postConfig({ level: 'high' }).smaa).toBe(true)
    expect(postConfig({ level: 'ultra' }).smaa).toBe(true)
  })
  it('Ultra adds MSAA on top; High does not', () => {
    expect(postConfig({ level: 'high' }).samples).toBe(0)
    expect(postConfig({ level: 'ultra' }).samples).toBe(4)
  })
})
