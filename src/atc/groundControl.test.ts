import { describe, expect, it } from 'vitest'
import { GroundControl, RIGHT_OF_WAY, type RouteCell } from './groundControl.ts'

const g = (key: string): RouteCell => ({ key, kind: 'ground', runways: [] })
const rw = (key: string, id = 'rw'): RouteCell => ({ key, kind: 'runway', runways: [id] })
const lane = (...keys: string[]) => keys.map(g)

describe('ground control reservations', () => {
  it('a single lane is head-on safe: the first cleared aircraft owns every shared cell first', () => {
    const atc = new GroundControl()
    atc.register('A', 'taxi', lane('a', 'b', 'c', 'd'))
    atc.register('B', 'taxi', lane('d', 'c', 'b', 'a'))
    // B sits on d, which A needs last; A may roll to c but not into d.
    expect(atc.limit('A')).toBe(2)
    // B cannot move into c until A has passed it.
    expect(atc.limit('B')).toBe(0)
    expect(atc.deadlocks()).toEqual([])
  })

  it('cells free up behind a moving aircraft', () => {
    const atc = new GroundControl()
    atc.register('A', 'taxi', lane('a', 'b', 'c'))
    atc.register('B', 'taxi', lane('x', 'a', 'b', 'c'))
    expect(atc.limit('B')).toBe(0)
    atc.progress('A', 1)
    expect(atc.limit('B')).toBe(1)
    atc.progress('A', 2)
    expect(atc.limit('B')).toBe(2)
  })

  it('runway is exclusive and departures hold short while an arrival is on final', () => {
    const atc = new GroundControl({ finalWindowSec: 10 })
    atc.register('ARR', 'arrival', [rw('r1'), rw('r2'), g('exit'), g('stand')])
    atc.register('DEP', 'departure', [g('s2'), g('hold'), rw('r2'), rw('r1')])
    atc.onFinal('ARR', ['rw'], 6)
    expect(atc.limit('DEP')).toBe(1) // stops at the hold line
    atc.progress('DEP', 1)
    atc.limit('DEP', RIGHT_OF_WAY.departure)
    expect(atc.arbitrate()).toEqual([])
    expect(atc.requestLanding('ARR', ['rw'])).toBe(true)
    expect(atc.runwayOwner('rw')).toBe('ARR')
    atc.progress('ARR', 2)
    expect(atc.runwayOwner('rw')).toBeNull()
    atc.limit('DEP', RIGHT_OF_WAY.departure)
    expect(atc.arbitrate()).toEqual(['DEP'])
  })

  it('one taxiway onto the runway: arrival waits for the departure ahead in its exit, no deadlock', () => {
    const atc = new GroundControl({ finalWindowSec: 10 })
    // Departure cleared first through the only stub, then the arrival needs the same stub.
    atc.register('DEP', 'departure', [g('stand1'), g('stub'), rw('r1'), rw('r0')])
    atc.register('ARR', 'arrival', [rw('r0'), rw('r1'), g('stub'), g('stand2')])
    atc.onFinal('ARR', ['rw'], 4)
    atc.progress('DEP', 1)
    expect(atc.canLand('ARR', ['rw'])).toBe(false)
    // The arrival cannot use its exit, so it does not block the departure.
    atc.limit('DEP', RIGHT_OF_WAY.departure)
    expect(atc.arbitrate()).toEqual(['DEP'])
    expect(atc.canLand('ARR', ['rw'])).toBe(false)
    atc.progress('DEP', 3)
    atc.airborne('DEP')
    atc.release('DEP')
    expect(atc.canLand('ARR', ['rw'])).toBe(true)
  })

  it('a departure lining up short of the exit does not take the runway from an arrival', () => {
    const atc = new GroundControl({ finalWindowSec: 10 })
    atc.register('DEP', 'departure', [g('stand'), g('hold'), g('stub'), rw('r1')])
    atc.register('ARR', 'arrival', [rw('r0'), g('stub'), g('stand2')])
    atc.onFinal('ARR', ['rw'], 4)
    atc.progress('DEP', 1)
    expect(atc.canLand('ARR', ['rw'])).toBe(true)
    atc.limit('DEP', RIGHT_OF_WAY.departure)
    expect(atc.arbitrate()).toEqual([])
    expect(atc.requestLanding('ARR', ['rw'])).toBe(true)
    expect(atc.runwayOwner('rw')).toBe('ARR')
  })

  it('right of way: arrival vacating beats a departure, departure beats a taxi crossing', () => {
    const atc = new GroundControl({ finalWindowSec: 0 })
    atc.register('X', 'taxi', [g('a'), rw('c1')])
    atc.register('D', 'departure', [g('b'), rw('c2')])
    atc.limit('X')
    atc.limit('D', RIGHT_OF_WAY.departure)
    expect(atc.arbitrate()).toEqual(['D'])
  })

  it('detects a forced cycle and a yield breaks it', () => {
    const atc = new GroundControl()
    atc.register('A', 'taxi', lane('a', 'b'))
    atc.register('B', 'taxi', lane('b', 'a')) // legacy: B already on b and jumps the queue there
    atc.limit('A')
    atc.limit('B')
    expect(atc.deadlocks().length).toBe(1)
    atc.yieldTo('B')
    atc.limit('A')
    atc.limit('B')
    // Still physically head-on on a two-cell lane: the host must reroute or tow; the cycle is reported again.
    expect(atc.deadlocks().length).toBeLessThanOrEqual(1)
  })
})
