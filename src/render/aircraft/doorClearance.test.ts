import { describe, expect, it } from 'vitest'
import { DERIVED_SPECS, MODEL_SPECS } from './specs'
import { airframeKeepouts, doorBoxes, doorVolumes, renderDoorBoxes, volsOverlap } from './stands'

const ALL = [...Object.values(MODEL_SPECS), ...Object.values(DERIVED_SPECS)]

describe('door and hatch clipping', () => {
  it('no drawn leaf, closed or swung open, overlaps a wing root, fairing, nacelle or prop disc', () => {
    const hits: string[] = []
    for (const spec of ALL) {
      const keep = airframeKeepouts(spec)
      for (const b of renderDoorBoxes(spec)) {
        if (b.door.side === 0 || b.omit) continue
        for (const v of doorVolumes(spec, b)) {
          for (const k of keep) if (volsOverlap(v, k)) hits.push(`${spec.id} ${b.door.kind}@${b.door.t} ${v.what} x ${k.what}`)
        }
      }
    }
    expect(hits).toEqual([])
  })

  it('no two drawn doors on one side overlap', () => {
    const hits: string[] = []
    for (const spec of ALL) {
      const boxes = renderDoorBoxes(spec).filter((b) => b.door.side !== 0 && !b.omit)
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
        if (a.door.side === b.door.side && volsOverlap(doorVolumes(spec, a)[0], doorVolumes(spec, b)[0])) hits.push(`${spec.id} ${a.door.t}/${b.door.t}`)
      }))
    }
    expect(hits).toEqual([])
  })

  it('keeps every airframe’s main passenger door drawn', () => {
    for (const spec of ALL) {
      const drawn = renderDoorBoxes(spec)
      const pax = drawn.filter((b) => (b.door.kind === 'pax' || b.door.kind === 'crew') && b.door.side !== 0)
      if (pax.length) expect(pax.some((b) => !b.omit), spec.id).toBe(true)
    }
  })

  it('leaves the sim-facing door stations untouched (service sockets read doorBoxes)', () => {
    for (const spec of ALL) {
      const nose = spec.lengthM / 2
      doorBoxes(spec).forEach((b, i) => {
        if (b.door.side !== 0) expect(b.x).toBeCloseTo(nose - b.door.t * spec.lengthM)
        expect(renderDoorBoxes(spec)[i].door).toBe(b.door)
      })
    }
  })
})
