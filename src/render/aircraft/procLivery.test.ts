import { afterEach, describe, expect, it } from 'vitest'
import { ROSTER, rosterAirline } from '../../airlines/roster'
import {
  PLATE_SCALE,
  applyRosterLivery,
  disposeProcLiveries,
  drawEnginePlate,
  drawFuselagePlate,
  drawTailPlate,
  procLiveryBuildCount,
  procLiveryKey,
  procLiverySpec,
  procLiveryTextures,
  rosterLivery,
  setProcLiveryCanvasFactory,
} from './procLivery'
import { LIVERY_ART } from './liveryUv'
import { MODEL_SPECS } from './specs'

/** A 2D context that records calls instead of drawing. */
function recorder() {
  const calls: string[] = []
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop: string) => (...args: unknown[]) => {
        calls.push(prop)
        return args
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

function fakeCanvasFactory() {
  const made: { w: number; h: number }[] = []
  setProcLiveryCanvasFactory((w, h) => {
    made.push({ w, h })
    return { getContext: () => recorder().ctx }
  })
  return made
}

afterEach(() => {
  setProcLiveryCanvasFactory(null)
  disposeProcLiveries()
})

describe('procedural livery spec', () => {
  it('covers every airline on every model in its fleet, jets and helicopters alike', () => {
    for (const a of ROSTER) {
      for (const model of a.fleet) {
        const p = procLiverySpec(a.id, model)!
        expect(p, `${a.id} on ${model}`).toBeDefined()
        for (const c of [p.fuselage, p.belly, p.cheatline, p.tail, p.nacelle]) expect(c).toMatch(/^#[0-9a-f]{6}$/)
        expect(p.motif).toBe(a.motif)
        expect(p.wordmark).toBe(a.name.toUpperCase())
        expect(p.helicopter).toBe(MODEL_SPECS[model].family === 'helo')
      }
    }
  })

  it('paints freighters and helicopters solid, passenger jets white over a belly', () => {
    expect(procLiverySpec('atlas_cargo', 'b763f')!.scheme).toBe('solid')
    expect(procLiverySpec('rotorlink', 'aw139')!.scheme).toBe('solid')
    expect(procLiverySpec('brisa', 'a320neo')!.scheme).toBe('twotone')
    expect(procLiverySpec('brisa', 'a320neo')!.belly).not.toBe(procLiverySpec('brisa', 'a320neo')!.fuselage)
  })

  it('caches one spec per airline and model', () => {
    const a = procLiverySpec('brisa', 'a320neo')
    expect(procLiverySpec('brisa', 'a320neo')).toBe(a)
    expect(procLiverySpec('brisa', 'a321')).not.toBe(a)
    expect(procLiverySpec('nobody', 'b738')).toBeUndefined()
  })

  it('leaves a type the airline does not fly unpainted', () => {
    expect(procLiverySpec('brisa', 'b738')).toBeUndefined()
    const paint = { body: '#fff', stripe: '#000', airline: 'brisa' }
    expect(applyRosterLivery(paint, 'b738')).toBe(paint)
    expect(applyRosterLivery(paint, 'a321').airline).toBe('brisa@a321')
  })

  it('builds a Livery for the shell and swaps catalog liveries for roster ones', () => {
    const l = rosterLivery('zephyr_go', 'b738')!
    expect(l.body).toBe(rosterAirline('zephyr_go')!.primary)
    expect(l.airline).toBe(procLiveryKey('zephyr_go', 'b738'))
    expect(applyRosterLivery({ body: '#fff', stripe: '#000', airline: 'zephyr_go' }, 'b738').airline).toBe('zephyr_go@b738')
    const catalog = { body: '#fff', stripe: '#000', airline: 'bushline' }
    expect(applyRosterLivery(catalog, 'b738')).toBe(catalog)
    expect(applyRosterLivery(l, 'b738')).toBe(l)
  })
})

describe('livery texture cache', () => {
  it('draws once per airline, model and quality', () => {
    const made = fakeCanvasFactory()
    const key = procLiveryKey('brisa', 'a320neo')
    const first = procLiveryTextures(key)!
    expect(first).toBeDefined()
    expect(procLiveryTextures(key)).toBe(first)
    expect(procLiveryBuildCount()).toBe(1)
    expect(made).toHaveLength(3)
    procLiveryTextures(procLiveryKey('brisa', 'a321'))
    procLiveryTextures(procLiveryKey('tango_air', 'a320neo'))
    expect(procLiveryBuildCount()).toBe(3)
    procLiveryTextures(key, 'low')
    expect(procLiveryBuildCount()).toBe(4)
  })

  it('is high-res by default and scales plates with quality', () => {
    const made = fakeCanvasFactory()
    procLiveryTextures(procLiveryKey('brisa', 'a320neo'))
    expect(made[0]).toEqual({ w: LIVERY_ART.fuselage.w * PLATE_SCALE.high, h: LIVERY_ART.fuselage.h * PLATE_SCALE.high })
    expect(PLATE_SCALE.high).toBeGreaterThan(1)
    made.length = 0
    procLiveryTextures(procLiveryKey('brisa', 'a320neo'), 'low')
    expect(made[0].w).toBeLessThan(LIVERY_ART.fuselage.w)
  })

  it('returns nothing without a canvas or for unknown airlines', () => {
    expect(procLiveryTextures(procLiveryKey('brisa', 'a320neo'))).toBeUndefined()
    fakeCanvasFactory()
    expect(procLiveryTextures('nobody@b738')).toBeUndefined()
    expect(procLiveryTextures('brisa')).toBeUndefined()
    expect(procLiveryTextures(procLiveryKey('brisa', 'b738'))).toBeUndefined()
  })

  it('dispose clears the cache', () => {
    fakeCanvasFactory()
    const key = procLiveryKey('brisa', 'a320neo')
    const first = procLiveryTextures(key)
    disposeProcLiveries()
    expect(procLiveryTextures(key)).not.toBe(first)
  })
})

describe('plate drawing', () => {
  it('draws wordmark, cheatline, tail motif and nacelle band for every motif', () => {
    const jet = procLiverySpec('brisa', 'a320neo')!
    const fus = recorder()
    drawFuselagePlate(fus.ctx, 512, 128, jet)
    expect(fus.calls).toContain('fillText')
    expect(fus.calls).toContain('fill')
    const eng = recorder()
    drawEnginePlate(eng.ctx, 256, 64, jet, '#fff')
    expect(eng.calls.filter((c) => c === 'fillRect')).toHaveLength(2)
    for (const motif of new Set(ROSTER.map((a) => a.motif))) {
      const a = ROSTER.find((r) => r.motif === motif)!
      const p = procLiverySpec(a.id, a.fleet[0])!
      const tail = recorder()
      drawTailPlate(tail.ctx, 256, 256, p, a.accent, a.secondary)
      expect(tail.calls.length, motif).toBeGreaterThan(2)
    }
  })
})
