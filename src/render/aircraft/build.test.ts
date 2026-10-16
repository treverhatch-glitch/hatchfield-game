import { describe, expect, it } from 'vitest'
import { buildAircraft } from './build'
import { MODEL_SPECS } from './specs'

const LIVERY = { body: '#ffffff', stripe: '#0b4ea2', tail: '#0b4ea2' } as never

describe('buildAircraft', () => {
  it('low tier includes cheatline and tail baked into the shell', () => {
    const spec = MODEL_SPECS['b738']
    const low = buildAircraft(spec, 'low', LIVERY)
    expect(low.group.userData.partNames).toContain('cheatline')
    expect(low.group.userData.partNames).toContain('tail')
  })
})
