import { describe, expect, it } from 'vitest'
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import { serialize } from '../features/save/save.ts'
import { Game } from '../game/sim.ts'
import { SAVE_KEY } from '../game/types.ts'
import { migrateFit, migrateV5ToV6 } from './migrate.ts'
import { blankLayout, placeFloor } from './layout.ts'
import { split1f } from './starter/split1f.ts'

describe('terminal save migration', () => {
  it('replaces a prefab with the one-story starter and refunds a bought desk', () => {
    const res = migrateFit({
      premade: true,
      tier: 2,
      origin: { c: 14, r: 8 },
      rooms: { checkin: 2, security: 2, gate: 2, bagclaim: 1 },
      items: [
        { id: 'bundle-desk', def: 'checkin_belt', c: 1, r: 1, wear: 0, bundle: true },
        { id: 'bought-desk', def: 'checkin_belt', c: 2, r: 1, wear: 0, bundle: false },
        { id: 'pass', def: 'passport_booth', c: 0, r: 3, wear: 1, bundle: false },
      ],
      zones: [
        ['checkin', 'checkin', 'checkin'],
        ['security', 'security', 'security'],
        ['gates', 'gates', 'gates'],
        ['arrivals', 'arrivals', 'arrivals'],
      ],
      interior: { walls: [{ x: 0, y: 0, dir: 'E' }], doors: [], rooms: [], zones: [], floorPaint: [], wallPaint: [], removed: [], equipment: [] },
    })
    const layout = res.fit.layout as ReturnType<typeof split1f>
    expect(layout.version).toBe(2)
    expect(layout.stories).toBe(1)
    expect(layout.tileM).toBe(1)
    expect(res.fit.tier).toBe(1)
    expect(res.fit.items).toBeUndefined()
    expect(res.refund).toBeGreaterThan(6000)
    expect(res.note).toMatch(/upper floor/)
    expect(res.note).toMatch(/Terminal rebuild refund/)
    expect((layout.fittings ?? []).some((f) => f.kind === 'passport_booth')).toBe(true)
  })

  it('records one terminal rebuild refund on the snapshot', () => {
    const snap = migrateV5ToV6({
      cash: 1000,
      terminalFits: [
        {
          premade: true,
          tier: 1,
          rooms: {},
          items: [{ id: 'bought', def: 'checkin_belt', c: 0, r: 0, wear: 0, bundle: false }],
        },
      ],
    }) as { terminalRebuild: { label: string; amount: number; note: string }; terminalFits: { layout?: { version?: number; stories?: number } }[] }
    expect(snap.terminalRebuild.label).toBe('Terminal rebuild refund')
    expect(snap.terminalRebuild.amount).toBe(6000)
    expect(snap.terminalFits[0].layout?.version).toBe(2)
    expect(snap.terminalFits[0].layout?.stories).toBe(1)
  })

  it('scales a 4 m build onto 1 m tiles', () => {
    let layout = blankLayout(2, 2)
    layout = placeFloor(layout, { x: 0, y: 0, w: 2, h: 2 }).layout
    layout.zones[0][0] = 'checkin'
    layout.equipment.push({ id: 'desk', kind: 'checkin_desk', x: 0, y: 0, wear: 0 })
    const res = migrateFit({ premade: false, build: layout, rooms: {} })
    const next = res.fit.layout as ReturnType<typeof split1f>
    expect(next.w).toBe(8)
    expect(next.h).toBe(8)
    expect(next.tileM).toBe(1)
    expect(next.stories).toBe(1)
    expect((next.fittings ?? []).some((f) => f.kind === 'checkin_desk') || (next.unplaced ?? []).some((f) => f.kind === 'checkin_desk')).toBe(true)
  })

  it('loads an old prefab and runs one sim day', () => {
    const game = new Game()
    expect(game.startChosenKit('city', 'pax')).toBe(true)
    game.persist()
    const raw = localStorage.getItem(SAVE_KEY)
    expect(raw).toBeTruthy()
    const data = JSON.parse(raw!).data as { terminalFits: Record<string, unknown>[] }
    delete data.terminalFits[0].layout
    const text = serialize({ version: 5, snapshot: () => data, restore() {} }, 1)
    localStorage.setItem(SAVE_KEY, text)
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.fits[0]?.layout?.version).toBe(2)
    loaded.speed = 1
    const steps = Math.ceil(REAL_SECONDS_PER_GAME_DAY / 5)
    for (let i = 0; i < steps; i++) loaded.tick(5)
    expect(loaded.gameDay()).toBeGreaterThanOrEqual(1)
  }, 20000)
})
