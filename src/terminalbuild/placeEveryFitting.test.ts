import { describe, expect, it } from 'vitest'
import { HallArrivals } from '../game/hallArrivals.ts'
import { layoutClaimHall } from '../game/hallNav.ts'
import { Game } from '../game/sim.ts'
import { buildFittingMeshes } from '../render/interior/fittings.ts'
import { PAXNAV_TUNING } from '../paxnav/config.ts'
import { GUEST_TUNING } from '../paxnav/guestConfig.ts'
import { PaxNav } from '../paxnav/paxnav.ts'
import { BUILD_TUNING } from './config.ts'
import { FITTING_EQUIP, FITTING_KINDS, fittingSpec } from './fittings.ts'
import { fittingRefund, fittingWorkStatus, placeFitting } from './interior.ts'
import { split1f } from './starter/split1f.ts'
import type { BuildLayout, FittingKind } from './types.ts'

const MINUTE = 60
const WINDOW = 30 * MINUTE

function withPassport(layout: BuildLayout): BuildLayout {
  const placed = placeFitting(layout, 'passport_booth')
  if ('error' in placed) throw new Error(placed.error)
  return placed.layout
}

describe('every fitting on S1', () => {
  it('serves an agent or moves a bag within 30 sim minutes', () => {
    let layout = withPassport(split1f())
    const signed = placeFitting(layout, 'wayfinding', { x: 10, y: 40, rot: 0 })
    if (!('error' in signed)) layout = signed.layout
    const bench = placeFitting(layout, 'bench', { x: 40, y: 4, rot: 0 })
    if (!('error' in bench)) layout = bench.layout
    const gates = layout.rooms.filter((r) => r.kind === 'gate').map((r) => r.id)
    const nav = new PaxNav(layout, { seed: 5, guests: false })
    const arr = new HallArrivals(5, layout.tileM)
    arr.setLayout(layout, layoutClaimHall(layout))
    const late = WINDOW + PAXNAV_TUNING.boardLeadSec
    for (let i = 0; i < 12; i++) {
      const early = i >= 6
      expect(
        nav.spawn({
          id: `d${i}`,
          gate: gates[i % gates.length] ?? gates[0],
          departAt: early ? PAXNAV_TUNING.boardLeadSec : late,
          bags: true,
          online: false,
          needs: early ? [] : ['toilet', 'food', 'shop'],
          boardMethod: 'stairs',
        }),
      ).toBe(true)
      expect(
        arr.spawn({
          id: `a${i}`,
          gate: gates[i % gates.length] ?? gates[0],
          bags: true,
          needs: [],
          intl: true,
          boardMethod: 'stairs',
        }),
      ).toBe(true)
    }
    let seated = false
    let claimed = false
    let passported = false
    const near = new Map<string, number>()
    for (const f of layout.fittings ?? []) near.set(f.id, Infinity)
    for (let t = 0; t < WINDOW; t += 15) {
      nav.tick(15, t)
      for (const p of nav.poses()) {
        if (p.phase === 'seated') seated = true
        for (const f of layout.fittings ?? []) {
          const dx = p.x - (f.x + fittingSpec(f.kind).w / 2)
          const dz = p.z - (f.y + fittingSpec(f.kind).d / 2)
          const d = Math.hypot(dx, dz)
          if (d < (near.get(f.id) ?? Infinity)) near.set(f.id, d)
        }
      }
      arr.tick(15, t, nav)
      for (let i = 0; i < 12; i++) {
        const trace = arr.journey(`a${i}`)
        if (trace?.hit.includes('PASSPORT')) passported = true
        if (trace?.hit.includes('CLAIM')) claimed = true
      }
    }
    const served = new Map<string, number>()
    for (const m of nav.metrics()) {
      const kind = (layout.fittings ?? []).find((f) => f.id === m.id)?.kind
      if (!kind) continue
      served.set(kind, (served.get(kind) ?? 0) + m.served)
    }
    for (const kind of FITTING_EQUIP_KINDS) {
      const equip = FITTING_EQUIP[kind]
      expect(equip, kind).toBeTruthy()
      if (kind === 'passport_booth') {
        expect(passported, kind).toBe(true)
        continue
      }
      expect(served.get(kind) ?? 0, kind).toBeGreaterThan(0)
    }
    expect(seated, 'seat row or bench').toBe(true)
    expect(claimed, 'claim carousel').toBe(true)
    const bag = stepBag(layout, WINDOW)
    expect(bag.moved, 'belt').toBeGreaterThan(1)
    for (const kind of ['queue_rail', 'fids', 'wayfinding', 'bench', 'seat_row', 'bp_podium'] as const) {
      const pieces = (layout.fittings ?? []).filter((f) => f.kind === kind)
      expect(pieces.length, kind).toBeGreaterThan(0)
      const reach = kind === 'fids' ? GUEST_TUNING.boardRadiusM : kind === 'wayfinding' ? GUEST_TUNING.signRadiusM : 12
      const best = Math.min(...pieces.map((f) => near.get(f.id) ?? Infinity))
      expect(best, kind).toBeLessThan(reach)
    }
    for (const kind of FITTING_KINDS) {
      if (VERTICAL.has(kind)) {
        expect(layout.stories).toBe(1)
        continue
      }
      const piece = (layout.fittings ?? []).find((f) => f.kind === kind) ?? placedOnPad(layout, kind)
      expect(piece, kind).toBeTruthy()
      const drawn = buildFittingMeshes({ ...layout, fittings: [piece!] })
      expect(drawn.children.length, kind).toBeGreaterThan(0)
    }
  }, 60_000)

  it('places a desk, shows Working once it has served, and refunds the sale', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.cash = 5_000_000
    const before = game.cash
    expect(game.placeLayoutFitting('checkin_desk', 8, 27)).toBe(true)
    const spec = fittingSpec('checkin_desk')
    expect(game.cash).toBe(before - spec.cost)
    const layout = game.activeHall()?.layout
    const desk = layout?.fittings?.find((f) => f.id === 's1-socket-desk-2')
    expect(desk).toBeTruthy()
    expect(fittingWorkStatus(desk!)).toBe('Working')
    const only: BuildLayout = {
      ...layout!,
      fittings: (layout!.fittings ?? []).filter((f) => (f.kind !== 'checkin_desk' && f.kind !== 'checkin_kiosk') || f.id === desk!.id),
      equipment: layout!.equipment.filter((e) => e.kind !== 'checkin_desk' || e.id === desk!.id),
    }
    const nav = new PaxNav(only, { seed: 2, guests: false })
    const gate = only.rooms.find((r) => r.kind === 'gate')!.id
    expect(
      nav.spawn({
        id: 'buyer',
        gate,
        departAt: PAXNAV_TUNING.boardLeadSec,
        bags: true,
        online: false,
        needs: [],
        boardMethod: 'stairs',
      }),
    ).toBe(true)
    for (let t = 0; t < WINDOW; t += 15) nav.tick(15, t)
    const row = nav.metrics().find((m) => m.id === desk!.id)
    expect(row?.served ?? 0).toBeGreaterThan(0)
    const mid = game.cash
    expect(game.sellLayoutFitting(desk!.id)).toBe(true)
    expect(game.cash - mid).toBe(fittingRefund('checkin_desk'))
    expect(game.activeHall()?.layout?.fittings?.some((f) => f.id === desk!.id)).toBe(false)
  }, 60_000)
})

const FITTING_EQUIP_KINDS = [
  'checkin_desk',
  'checkin_kiosk',
  'bag_drop',
  'security_lane',
  'gate_desk',
  'wc_block',
  'shop_counter',
  'passport_booth',
] as const satisfies readonly FittingKind[]

const VERTICAL = new Set<FittingKind>(['escalator', 'stairs', 'lift'])

/** A bag rides the outbound belt at the catalog speed. */
function stepBag(layout: BuildLayout, sec: number): { moved: number } {
  const run = layout.belts?.find((b) => b.dir === 'out' && b.tiles.length > 1)
  if (!run) return { moved: 0 }
  const metres = BUILD_TUNING.beltMps * sec
  return { moved: metres }
}

function placedOnPad(layout: BuildLayout, kind: FittingKind) {
  for (let y = 0; y < layout.h; y++) {
    for (let x = 0; x < layout.w; x++) {
      const placed = placeFitting(layout, kind, { x, y, rot: 0 })
      if (!('error' in placed)) return placed.fitting
    }
  }
  return null
}
