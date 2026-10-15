import { describe, expect, it } from 'vitest'
import { skinBox } from './buildingSkin'
import { NAV_CELLS, floodEdgeFade, navLightSprite } from './nightArt'

describe('night atmosphere plates', () => {
  it('fades the flood pool before the frame', () => {
    expect(floodEdgeFade(0.5, 0.5)).toBe(1)
    expect(floodEdgeFade(0, 0.5)).toBe(0)
    expect(floodEdgeFade(1, 1)).toBe(0)
    const mid = floodEdgeFade(0.5, 0.9)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it('puts each nav colour on its own cell of the sheet', () => {
    const cells = Object.values(NAV_CELLS).map((c) => `${c.col},${c.row}`)
    expect(new Set(cells).size).toBe(4)
    expect(NAV_CELLS.navRed).toEqual({ col: 0, row: 1 })
    expect(NAV_CELLS.navGreen).toEqual({ col: 1, row: 1 })
    expect(NAV_CELLS.navWhite).toEqual({ col: 0, row: 0 })
    expect(NAV_CELLS.beacon).toEqual({ col: 1, row: 0 })
    expect(navLightSprite('navRed')).toBeNull()
  })

  it('keeps the window mask once per face', () => {
    const geo = skinBox(8, 4, 6, 4, 1)
    const uv = geo.getAttribute('uv1')
    expect(uv).toBeTruthy()
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getX(i)).toBeLessThanOrEqual(1)
      expect(uv.getY(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getY(i)).toBeLessThanOrEqual(1)
    }
  })
})
