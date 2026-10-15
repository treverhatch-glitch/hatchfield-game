import { describe, expect, it } from 'vitest'
import { BodyList, penetration } from './list.ts'
import type { Body, BodySource } from './types.ts'

function body(id: string, x: number, y: number, heading = 0, halfLength = 2.25, halfWidth = 0.9): Body {
  return { id, owner: id.split(':')[0]!, kind: 'car', x, y, heading, halfLength, halfWidth, speed: 0 }
}

function source(owner: string, bodies: Body[]): BodySource {
  return { bodyOwner: owner, bodies: () => bodies }
}

describe('shared body list', () => {
  it('measures overlap between oriented rectangles', () => {
    expect(penetration(body('a:1', 0, 0), body('b:1', 4, 0))).toBeCloseTo(0.5)
    expect(penetration(body('a:1', 0, 0), body('b:1', 5, 0))).toBeCloseTo(-0.5)
    // Side by side in neighbouring lanes, 3.5 m apart, do not touch.
    expect(penetration(body('a:1', 0, 0), body('b:1', 0, 3.5))).toBeLessThan(0)
    // A car turned across another's nose touches it.
    expect(penetration(body('a:1', 0, 0), body('b:1', 3, 0, Math.PI / 2))).toBeGreaterThan(0)
  })

  it('reads every registered source and drops one on unregister', () => {
    const list = new BodyList([source('landside', [body('landside:1', 0, 0)])])
    const off = list.register(source('apron', [body('apron:tug', 50, 0)]))
    expect(list.owners().sort()).toEqual(['apron', 'landside'])
    expect(list.all().map((b) => b.id).sort()).toEqual(['apron:tug', 'landside:1'])
    expect(list.near(48, 0, 1).map((b) => b.id)).toEqual(['apron:tug'])
    expect(list.near(48, 0, 1, 'apron:tug')).toEqual([])
    off()
    expect(list.owners()).toEqual(['landside'])
  })

  it('replaces a source with the same owner, and an old unregister does not remove the new one', () => {
    const list = new BodyList()
    const off = list.register(source('apron', [body('apron:a', 0, 0)]))
    list.register(source('apron', [body('apron:b', 0, 0)]))
    off()
    expect(list.all().map((b) => b.id)).toEqual(['apron:b'])
  })

  it('reports overlapping pairs across sources, deepest first', () => {
    const list = new BodyList([
      source('landside', [body('landside:1', 0, 0), body('landside:2', 30, 0)]),
      source('apron', [body('apron:1', 4, 0), body('apron:2', 31, 0)]),
    ])
    const pairs = list.overlaps(0.01).map((p) => [p.a.id, p.b.id].sort().join('/'))
    expect(pairs).toEqual(['apron:2/landside:2', 'apron:1/landside:1'])
    expect(new BodyList([source('x', [body('x:1', 0, 0), body('x:2', 4.6, 0)])]).overlaps(0.01)).toEqual([])
  })
})
