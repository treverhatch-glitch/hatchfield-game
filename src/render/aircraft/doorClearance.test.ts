import { describe, expect, it } from 'vitest'
import { DERIVED_SPECS, MODEL_SPECS } from './specs'
import { airframeKeepouts, doorBoxes, doorVolumes, heloCabin, propArcVolumes, renderDoorBoxes, volsOverlap } from './stands'

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

describe('turboprop doors clear the prop arc', () => {
  const PROPS = ['atr72', 'atr42', 'q400', 'dhc6']
  const arcHits = (id: string, boxes: ReturnType<typeof renderDoorBoxes>) => {
    const spec = ALL.find((s) => s.id === id)!
    const arcs = propArcVolumes(spec)
    const hits: string[] = []
    for (const b of boxes) {
      if (b.door.side === 0 || b.omit) continue
      for (const v of doorVolumes(spec, b)) for (const k of arcs) if (volsOverlap(v, k)) hits.push(`${id} ${b.door.kind} ${v.what} x ${k.what}`)
    }
    return hits
  }

  it('builds a swept prop volume for every wing-mounted turboprop', () => {
    for (const id of PROPS) {
      const spec = ALL.find((s) => s.id === id)!
      const arcs = propArcVolumes(spec)
      expect(arcs.some((v) => v.what === 'prop-arc'), id).toBe(true)
      expect(airframeKeepouts(spec).some((v) => v.what === 'prop-arc'), id).toBe(true)
    }
  })

  it('no open (or closed) drawn door intersects a prop disc or its swept arc', () => {
    for (const id of PROPS) {
      const spec = ALL.find((s) => s.id === id)!
      expect(arcHits(id, renderDoorBoxes(spec))).toEqual([])
    }
  })

  it('would fail on the old forward door stations (the test has teeth)', () => {
    for (const id of ['atr72', 'q400', 'dhc6']) {
      const spec = ALL.find((s) => s.id === id)!
      expect(arcHits(id, doorBoxes(spec)).length, id).toBeGreaterThan(0)
    }
  })
})

describe('helicopter doors sit on the cabin', () => {
  it('every drawn AW139 / S-76 door lies on the full-section cabin, not the boom', () => {
    for (const id of ['aw139', 's76']) {
      const spec = ALL.find((s) => s.id === id)!
      const cab = heloCabin(spec)
      const drawn = renderDoorBoxes(spec).filter((b) => b.door.side !== 0 && !b.omit)
      expect(drawn.length, id).toBeGreaterThan(0)
      for (const b of drawn) {
        expect(b.x - b.w / 2, `${id} ${b.door.kind}`).toBeGreaterThanOrEqual(cab.x0 - 1e-6)
        expect(b.x + b.w / 2, `${id} ${b.door.kind}`).toBeLessThanOrEqual(cab.x1 + 1e-6)
      }
    }
  })
})
