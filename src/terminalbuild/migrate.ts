/**
 * Save schema 5 → 6. Prefab halls become the 1-story starter.
 * A legacy 4 m build is scaled onto 1 m tiles. Player fittings are refunded.
 * The upper floor is not stamped: that upgrade is WP6.
 */
import { itemDef } from '../game/terminal.ts'
import { DOOR_COST, PAINT_COST, ROOM_SPEC, floorTileCost, wallEdgeCost, zoneTileCost } from './config.ts'
import { fittingRoomViolation, fittingSize, fittingTiles } from './fittings.ts'
import { split1f } from './starter/split1f.ts'
import type { BuildLayout, EquipKind, Fitting, FittingKind, UnplacedFitting } from './types.ts'

export interface TerminalRebuildNote {
  label: 'Terminal rebuild refund'
  amount: number
  note: string
}

const EQUIP_KIND: Record<EquipKind, FittingKind> = {
  checkin_desk: 'checkin_desk',
  security_lane: 'security_lane',
  gate_desk: 'gate_desk',
  bag_belt: 'belt',
  makeup_carousel: 'claim_carousel',
  seat: 'seat_row',
  shop_counter: 'shop_counter',
  toilet: 'wc_block',
  office_desk: 'bench',
  bag_drop: 'bag_drop',
  passport_booth: 'passport_booth',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function interiorRefund(edit: unknown): number {
  if (!isRecord(edit)) return 0
  const tileM = 4
  let n = 0
  if (Array.isArray(edit.walls)) n += edit.walls.length * wallEdgeCost(tileM)
  if (Array.isArray(edit.doors)) {
    for (const d of edit.doors) {
      if (!isRecord(d) || typeof d.kind !== 'string') continue
      const cost = DOOR_COST[d.kind as keyof typeof DOOR_COST]
      if (cost) n += cost.build
    }
  }
  if (Array.isArray(edit.rooms)) {
    for (const r of edit.rooms) {
      if (!isRecord(r) || typeof r.kind !== 'string') continue
      const spec = ROOM_SPEC[r.kind as keyof typeof ROOM_SPEC]
      if (spec) n += spec.build
    }
  }
  if (Array.isArray(edit.zones)) n += edit.zones.length * zoneTileCost(tileM)
  if (Array.isArray(edit.floorPaint)) n += edit.floorPaint.length * PAINT_COST.floor
  if (Array.isArray(edit.wallPaint)) n += edit.wallPaint.length * PAINT_COST.wall
  if (Array.isArray(edit.foundation)) n += edit.foundation.length * floorTileCost(tileM)
  return n
}

function roomsFrom(layout: BuildLayout, prev: unknown): Record<string, number> {
  const base = isRecord(prev) ? { ...prev } : {}
  const n = (kind: FittingKind) => (layout.fittings ?? []).filter((f) => f.kind === kind).length
  return {
    ...base,
    checkin: n('checkin_desk') + n('checkin_kiosk'),
    security: n('security_lane'),
    gate: n('gate_desk'),
    bagclaim: Math.max(1, n('claim_carousel')),
    bagdrop: n('bag_drop'),
    food: (layout.fittings ?? []).filter((f) => f.kind === 'shop_counter' && f.id.includes('cafe')).length || Number(base.food ?? 0) || 1,
    souvenir: (layout.fittings ?? []).filter((f) => f.kind === 'shop_counter' && (f.id.includes('shop') || f.id.includes('news'))).length || Number(base.souvenir ?? 0) || 1,
    bathroom: n('wc_block') || Number(base.bathroom ?? 0) || 1,
    lounge: Number(base.lounge ?? 0) || 1,
  }
}

function applyStarter(fit: Record<string, unknown>, layout: BuildLayout): Record<string, unknown> {
  const next: Record<string, unknown> = { ...fit, layout, premade: fit.premade !== false, tier: 1, redesigned: false }
  next.rooms = roomsFrom(layout, fit.rooms)
  delete next.zones
  delete next.items
  delete next.floorExtra
  delete next.build
  delete next.interior
  return next
}

function scaleLegacy(old: BuildLayout): { layout: BuildLayout; unplaced: UnplacedFitting[] } {
  const f = 4
  const w = old.w * f
  const h = old.h * f
  const floor = Array.from({ length: h }, () => Array.from({ length: w }, () => false))
  const zones: BuildLayout['zones'] = Array.from({ length: h }, () => Array.from({ length: w }, () => null))
  for (let y = 0; y < old.h; y++) {
    for (let x = 0; x < old.w; x++) {
      if (!old.floor[y]?.[x]) continue
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          floor[y * f + dy][x * f + dx] = true
          zones[y * f + dy][x * f + dx] = old.zones[y]?.[x] ?? null
        }
      }
    }
  }
  const expand = (e: { x: number; y: number; dir: 'E' | 'S'; floor?: number; kind?: string }) => {
    const out: { x: number; y: number; dir: 'E' | 'S'; floor?: number; kind?: string }[] = []
    if (e.dir === 'E') {
      const x = e.x < 0 ? -1 : e.x * f + f - 1
      const y0 = Math.max(0, e.y) * f
      for (let i = 0; i < f; i++) out.push({ x, y: e.y < 0 ? -1 : y0 + i, dir: 'E', floor: e.floor, kind: e.kind })
    } else {
      const y = e.y < 0 ? -1 : e.y * f + f - 1
      const x0 = Math.max(0, e.x) * f
      for (let i = 0; i < f; i++) out.push({ x: e.x < 0 ? -1 : x0 + i, y, dir: 'S', floor: e.floor, kind: e.kind })
    }
    return out
  }
  const walls = old.walls.flatMap((e) => expand(e))
  const doors = old.doors.flatMap((e) => expand(e))
  const rooms = old.rooms.map((r) => ({ ...r, x: r.x * f, y: r.y * f, w: r.w * f, h: r.h * f }))
  const layout: BuildLayout = {
    version: 2,
    tileM: 1,
    w,
    h,
    stories: 1,
    floor,
    zones,
    walls,
    doors: doors as BuildLayout['doors'],
    rooms,
    equipment: old.equipment.map((e) => ({ ...e, x: e.x * f + 1, y: e.y * f + 1 })),
    verticals: [],
    slabs: [],
    fittings: [],
    belts: [],
    ports: [],
    sockets: [],
    unplaced: [],
  }
  const occupied = new Set<string>()
  const fittings: Fitting[] = []
  const unplaced: UnplacedFitting[] = []
  for (const eq of old.equipment) {
    const kind = EQUIP_KIND[eq.kind]
    const size = fittingSize(kind, 0)
    const cx = eq.x * f + 2
    const cy = eq.y * f + 2
    const piece: Fitting = {
      id: eq.id,
      kind,
      x: cx - size.w / 2,
      y: cy - size.d / 2,
      floor: eq.floor ?? 0,
      rot: 0,
      wear: eq.wear ?? 0,
    }
    const tiles = fittingTiles(piece)
    const hit = tiles.some((t) => occupied.has(`${t.x},${t.y}`))
    const rule = fittingRoomViolation(layout, kind, piece.x, piece.y)
    if (hit || rule || tiles.some((t) => t.x < 0 || t.y < 0 || t.x >= w || t.y >= h)) {
      unplaced.push({ id: eq.id, kind, wear: eq.wear ?? 0, reason: rule ?? 'No free space in the rebuilt hall.' })
      continue
    }
    fittings.push(piece)
    for (const t of tiles) occupied.add(`${t.x},${t.y}`)
  }
  layout.fittings = fittings
  layout.unplaced = unplaced
  return { layout, unplaced }
}

function placePassport(layout: BuildLayout, id: string, wear: number, onSterile: boolean): void {
  if (!onSterile) {
    layout.unplaced = [...(layout.unplaced ?? []), { id, kind: 'passport_booth', wear, reason: 'Passport booths only stand in claim or arrivals.' }]
    return
  }
  const socket = (layout.sockets ?? []).find((s) => s.kind === 'passport_booth' && !(layout.fittings ?? []).some((f) => f.x === s.x && f.y === s.y))
  if (!socket) {
    layout.unplaced = [...(layout.unplaced ?? []), { id, kind: 'passport_booth', wear, reason: 'No empty passport socket.' }]
    return
  }
  layout.fittings = [...(layout.fittings ?? []), { id, kind: 'passport_booth', x: socket.x, y: socket.y, floor: 0, rot: 0, wear, staffed: true }]
}

/** One hall. Returns the refund for player-bought kit and interior edits. */
export function migrateFit(fit: Record<string, unknown>): { fit: Record<string, unknown>; refund: number; note: string } {
  if (isRecord(fit.layout) && fit.layout.version === 2) return { fit, refund: 0, note: '' }
  let refund = interiorRefund(fit.interior)
  const items = Array.isArray(fit.items) ? fit.items : []
  const zones = Array.isArray(fit.zones) ? (fit.zones as unknown[][]) : []
  const passports: { id: string; wear: number; sterile: boolean }[] = []
  for (const raw of items) {
    if (!isRecord(raw) || raw.bundle === true) continue
    const def = typeof raw.def === 'string' ? raw.def : ''
    if (def === 'passport_booth') {
      const c = Number(raw.c)
      const r = Number(raw.r)
      const zone = zones[r]?.[c]
      passports.push({
        id: typeof raw.id === 'string' ? raw.id : `pass-${passports.length}`,
        wear: typeof raw.wear === 'number' ? raw.wear : 0,
        sterile: zone === 'arrivals' || zone === 'claim',
      })
      continue
    }
    refund += itemDef(def)?.cost ?? 0
  }
  const tier = fit.tier === 2 || fit.tier === 3 ? Number(fit.tier) : 1
  let layout: BuildLayout
  let note = ''
  if (isRecord(fit.build) && fit.build.version !== 2 && Array.isArray(fit.build.floor)) {
    const scaled = scaleLegacy(fit.build as unknown as BuildLayout)
    layout = scaled.layout
    note = 'Built hall rebuilt on 1 m tiles. Pieces that did not fit are in the tray.'
  } else {
    layout = split1f()
    note =
      tier > 1
        ? 'This hall is the one-story starter. The upper floor waits for a later upgrade.'
        : 'Interior rebuilt as the one-story starter.'
  }
  for (const p of passports) placePassport(layout, p.id, p.wear, p.sterile)
  if (refund > 0) note = `${note} Terminal rebuild refund $${refund}.`.trim()
  return { fit: applyStarter(fit, layout), refund, note }
}

/** 5 → 6. Leaves `terminalRebuild` for the loader to pay out and announce once. */
export function migrateV5ToV6(data: unknown): unknown {
  if (!isRecord(data)) return data
  const next: Record<string, unknown> = { ...data }
  if (Array.isArray(next.hallGuests)) next.hallGuests = []
  if (!Array.isArray(next.terminalFits)) return next
  let refund = 0
  const notes: string[] = []
  next.terminalFits = next.terminalFits.map((fit) => {
    if (!isRecord(fit)) return fit
    const res = migrateFit(fit)
    refund += res.refund
    if (res.note) notes.push(res.note)
    return res.fit
  })
  if (refund > 0 || notes.length) {
    const note = notes.filter(Boolean).join(' ')
    next.terminalRebuild = {
      label: 'Terminal rebuild refund',
      amount: refund,
      note: note || 'Terminal rebuild refund',
    } satisfies TerminalRebuildNote
  }
  return next
}
