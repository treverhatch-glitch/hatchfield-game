import { describe, expect, it } from 'vitest'
import { CREW_LOD } from '../../ramp/crewConfig.ts'
import { assignCrewLod } from './lod.ts'

describe('crew distance cull', () => {
  it('uses full figures up close, dots in the middle, and hides the rest', () => {
    const picks = assignCrewLod(
      [
        { id: 'near', x: 0, y: 0, z: 0 },
        { id: 'mid', x: 70, y: 0, z: 0 },
        { id: 'far', x: 400, y: 0, z: 0 },
      ],
      { x: 0, y: 0, z: 0 },
    )
    expect(picks.find((row) => row.id === 'near')?.tier).toBe('full')
    expect(picks.find((row) => row.id === 'mid')?.tier).toBe('dot')
    expect(picks.find((row) => row.id === 'far')?.tier).toBe('hide')
  })

  it('keeps the closest figures when the full cap is full, and drops to dots at 5×', () => {
    const items = Array.from({ length: CREW_LOD.fullCap + 6 }, (_, i) => ({ id: `p${i}`, x: i * 0.2, y: 0, z: 0 }))
    const picks = assignCrewLod(items, { x: 0, y: 0, z: 0 })
    const full = picks.filter((row) => row.tier === 'full')
    expect(full).toHaveLength(CREW_LOD.fullCap)
    const nearestDot = picks.filter((row) => row.tier === 'dot').sort((a, b) => a.distance - b.distance)[0]
    const farthestFull = [...full].sort((a, b) => b.distance - a.distance)[0]
    expect(farthestFull.distance).toBeLessThanOrEqual(nearestDot.distance)

    const lite = assignCrewLod(items, { x: 0, y: 0, z: 0 }, true)
    expect(lite.some((row) => row.tier === 'full')).toBe(false)
    expect(lite.filter((row) => row.tier === 'dot').length).toBeLessThanOrEqual(CREW_LOD.dotCap)
  })
})
