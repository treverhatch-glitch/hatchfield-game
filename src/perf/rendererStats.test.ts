import { describe, expect, it } from 'vitest'
import { FrameMeter, formatEntities, formatStats, textureBytes } from './rendererStats'
import { recordSimTick, simTickMs } from './simSample'

describe('rendererStats', () => {
  it('counts a mip chain as a third extra', () => {
    expect(textureBytes(1024, 1024, false)).toBe(4 * 1024 * 1024)
    expect(textureBytes(1024, 1024, true)).toBe(Math.round(4 * 1024 * 1024 * (4 / 3)))
  })

  it('measures fps and slow frames', () => {
    const m = new FrameMeter(100)
    for (let i = 0; i < 99; i++) m.push(10)
    m.push(50)
    expect(m.fps).toBeCloseTo(1000 / 10.4, 0)
    expect(m.percentileMs(0.99)).toBe(50)
    m.reset()
    expect(m.fps).toBe(0)
  })

  it('ignores bad deltas', () => {
    const m = new FrameMeter()
    m.push(NaN)
    m.push(-3)
    expect(m.fps).toBe(0)
  })

  it('formats a readout', () => {
    const s = formatStats(61.2, 18.4, {
      drawCalls: 420,
      triangles: 1_250_000,
      lines: 0,
      points: 0,
      geometries: 90,
      textures: 40,
      textureMB: 96.5,
    })
    expect(s).toContain('61 fps')
    expect(s).toContain('16.3 ms')
    expect(s).toContain('draws 420')
    expect(s).toContain('tris 1250.0k')
  })

  it('lists entity counts and the sim tick', () => {
    recordSimTick(4.25)
    expect(simTickMs()).toBe(4.25)
    const line = formatEntities({ passengers: 1500, vehicles: 150, aircraft: 12 }, simTickMs())
    expect(line).toContain('pax 1500')
    expect(line).toContain('vehicles 150')
    expect(line).toContain('aircraft 12')
    expect(line).toContain('sim 4.3 ms')
    recordSimTick(Number.NaN)
    expect(simTickMs()).toBe(0)
  })
})
