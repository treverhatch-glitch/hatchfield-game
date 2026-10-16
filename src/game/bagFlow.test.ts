import { describe, expect, it } from 'vitest'
import { dockBagSockets } from '../logistics/adapter.ts'
import { terminalSockets } from '../terminalbuild/sockets.ts'
import { split1f } from '../terminalbuild/starter/split1f.ts'
import { advancePortLegs, freshBook, portLegSec } from './luggage.ts'

describe('bag port legs', () => {
  it('moves a bag from the desk to bag_out and from bag_in onto the carousel', () => {
    const layout = split1f()
    const outSec = portLegSec(layout, 'out')
    const inSec = portLegSec(layout, 'in')
    expect(outSec).toBeGreaterThan(0)
    expect(inSec).toBeGreaterThan(0)
    const book = freshBook('F1', 4)
    book.dropped = 4
    advancePortLegs(book, outSec, outSec, inSec)
    expect(book.atPortOut).toBe(1)
    advancePortLegs(book, outSec * 3, outSec, inSec)
    expect(book.atPortOut).toBe(4)
    book.unloaded = 4
    advancePortLegs(book, inSec, outSec, inSec)
    expect(book.atPortIn).toBe(4)
    expect(book.onClaim).toBe(1)
    advancePortLegs(book, inSec * 3, outSec, inSec)
    expect(book.onClaim).toBe(4)
  })

  it('docks bag sockets to a bags tile when the apron has one', () => {
    const layout = split1f()
    const sockets = terminalSockets(layout, { c: 15, r: 7 }, 'starter')
    const bags = sockets.filter((s) => s.kind === 'bag_out' || s.kind === 'bag_in')
    expect(bags.length).toBeGreaterThan(0)
    const sort = dockBagSockets(bags, [{ id: '14,9', x: bags[0].x + 10, z: bags[0].z }])
    expect(sort.every((d) => d.dock === 'sort' && d.building === '14,9')).toBe(true)
    const hall = dockBagSockets(bags, [])
    expect(hall.every((d) => d.dock === 'hall' && d.building === null)).toBe(true)
  })
})
