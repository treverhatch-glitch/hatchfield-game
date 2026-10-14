import { describe, it, expect } from 'vitest'
import { suggestLodScale, formatLodAdvice, loadLodScale, saveLodScale, type LodTuneInput } from './lodTune'

describe('lodTune', () => {
  describe('suggestLodScale', () => {
    it('increases scale when fps is < 25', () => {
      const input: LodTuneInput = { fps: 24, drawCalls: 2000, triangles: 10000, currentScale: 1.0 }
      expect(suggestLodScale(input)).toBe(1.05)
    })

    it('increases scale when drawCalls > 4000', () => {
      const input: LodTuneInput = { fps: 60, drawCalls: 4001, triangles: 10000, currentScale: 1.0 }
      expect(suggestLodScale(input)).toBe(1.05)
    })

    it('decreases scale when fps > 50 and drawCalls < 1500', () => {
      const input: LodTuneInput = { fps: 60, drawCalls: 1000, triangles: 10000, currentScale: 1.0 }
      expect(suggestLodScale(input)).toBe(0.95)
    })

    it('keeps scale the same otherwise', () => {
      const input: LodTuneInput = { fps: 30, drawCalls: 2000, triangles: 10000, currentScale: 1.0 }
      expect(suggestLodScale(input)).toBe(1.0)
    })

    it('clamps to [0.6, 1.8]', () => {
      expect(suggestLodScale({ fps: 60, drawCalls: 1000, triangles: 10000, currentScale: 0.6 })).toBe(0.6)
      expect(suggestLodScale({ fps: 20, drawCalls: 5000, triangles: 10000, currentScale: 1.8 })).toBe(1.8)
    })

    it('handles NaN inputs by returning currentScale or 1.0', () => {
      expect(suggestLodScale({ fps: NaN, drawCalls: 1000, triangles: 10000, currentScale: 1.0 })).toBe(1.0)
      expect(suggestLodScale({ fps: 60, drawCalls: NaN, triangles: 10000, currentScale: 1.0 })).toBe(1.0)
      expect(suggestLodScale({ fps: 60, drawCalls: 1000, triangles: NaN, currentScale: 1.0 })).toBe(1.0)
      expect(suggestLodScale({ fps: 60, drawCalls: 1000, triangles: 10000, currentScale: NaN })).toBe(1.0)
    })
  })

  describe('formatLodAdvice', () => {
    it('returns a formatted string', () => {
      const input: LodTuneInput = { fps: 24, drawCalls: 2000, triangles: 10000, currentScale: 1.0 }
      expect(formatLodAdvice(input)).toBe('LOD scale: 1.00 (suggested 1.05)')
    })
  })

  describe('storage', () => {
    it('saves and loads the scale', () => {
      const storage = {
        data: {} as Record<string, string>,
        getItem(key: string) { return this.data[key] || null },
        setItem(key: string, val: string) { this.data[key] = val },
        clear() { this.data = {} },
        removeItem(key: string) { delete this.data[key] },
        length: 0,
        key() { return null }
      }

      expect(loadLodScale(storage)).toBe(1.0)
      saveLodScale(storage, 1.2)
      expect(loadLodScale(storage)).toBe(1.2)

      storage.setItem('hatchfield.lodScale', 'invalid')
      expect(loadLodScale(storage)).toBe(1.0)
    })
  })
})
