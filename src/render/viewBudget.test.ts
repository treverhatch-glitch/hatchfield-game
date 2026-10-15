import { describe, expect, it } from 'vitest'
import { lodWeights, setAircraftQuality } from './aircraft/lod'
import { APRON_MAX_DIST, FULL_DETAIL_DIST, noteMaxZoomFrame } from './viewBudget'
import { VEHICLE_LOD_M } from './vehicleModels'

describe('view budget', () => {
  it('keeps the full aircraft band across the whole apron orbit', () => {
    setAircraftQuality('high')
    for (const dist of [0, 54, 140, APRON_MAX_DIST]) {
      const w = lodWeights(dist)
      expect(w.high).toBeGreaterThan(0.95)
      expect(w.mid).toBeGreaterThan(0.95)
      expect(w.low).toBeLessThan(0.05)
    }
  })

  it('still has a far band past any play distance, and the vehicle shell waits there too', () => {
    const far = lodWeights(FULL_DETAIL_DIST + 2000)
    expect(far.low).toBeGreaterThan(0.95)
    expect(VEHICLE_LOD_M).toBeGreaterThanOrEqual(FULL_DETAIL_DIST)
  })

  it('logs max-zoom fps and does not describe a quality change', () => {
    let sample: number | null = null
    for (let i = 0; i < 40 && sample == null; i++) sample = noteMaxZoomFrame(0.02, true, 10_000 + i * 20)
    expect(sample).not.toBeNull()
    expect(sample!).toBeGreaterThan(40)
    expect(sample!).toBeLessThan(60)
    expect(noteMaxZoomFrame(0.02, false, 20_000)).toBeNull()
  })
})
