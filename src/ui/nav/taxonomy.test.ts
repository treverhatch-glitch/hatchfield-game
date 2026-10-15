import { describe, expect, it } from 'vitest'
import { PROGRESSION_BUILDABLES } from '../../progression/unlocks'
import type { Tool } from '../../game/types'
import { BUILD_MENUS, MANAGE_MENUS, STAMP_HOVER_MS, type ManageTabId } from './taxonomy'

/** Every stamp except Select. A missing key fails the type-check. */
const EVERY_STAMP = {
  runway_short: true,
  runway: true,
  runway_heavy: true,
  helipad: true,
  taxi: true,
  stand_light: true,
  stand_narrow: true,
  stand_heavy: true,
  terminal: true,
  premade: true,
  snack: true,
  bags: true,
  belt: true,
  fuel: true,
  fire: true,
  police: true,
  cargo: true,
  guard: true,
  road: true,
  tower: true,
  hangar: true,
  hotel_inn: true,
  hotel_biz: true,
  hotel_resort: true,
  park_s: true,
  park_l: true,
  park_g: true,
  park_u: true,
  deice: true,
  bus: true,
  curb_lane: true,
  taxi_rank: true,
  term_bus: true,
  people_mover: true,
  xfer_bus: true,
  hub_skywalk: true,
  rail: true,
  kitchen: true,
  depot: true,
  mro: true,
  nighthub: true,
  hangar_w: true,
  hangar_j: true,
  fuel_rail: true,
  oil: true,
  fuel_pipe: true,
  manifold: true,
  berth: true,
  travelator: true,
  skywalk: true,
  mover: true,
  airport_hotel: true,
  rail_link: true,
  saf_blending: true,
  clear: true,
} as const satisfies Record<Exclude<Tool, 'pan' | 'stand_s' | 'stand' | 'stand_w' | 'stand_l'>, true>

const BANNED = /\b(todo|tbd|lorem|placeholder|click me|untitled|coming soon)\b/i
const SHORT = /^(ops|specs|ads|late)$/i

describe('menu taxonomy', () => {
  it('lists every tool once and has no Late tray', () => {
    const seen = new Map<string, string>()
    for (const menu of BUILD_MENUS) {
      expect(menu.label.trim().length).toBeGreaterThan(0)
      expect(menu.label).not.toMatch(BANNED)
      expect(menu.label).not.toMatch(SHORT)
      for (const tool of menu.tools) {
        expect(seen.has(tool), `${tool} is also in ${seen.get(tool)}`).toBe(false)
        seen.set(tool, menu.id)
      }
    }
    expect(BUILD_MENUS.map((menu) => menu.id)).not.toContain('late')
    expect([...seen.keys()].sort()).toEqual(Object.keys(EVERY_STAMP).sort())
    expect(seen.get('belt')).toBe('terminal')
    expect(seen.get('guard')).toBe('safety')
    expect(seen.get('fuel')).toBe('airside')
    expect(seen.get('saf_blending')).toBe('airside')
    expect(seen.get('snack')).toBe('retail')
    expect(seen.get('airport_hotel')).toBe('landside')
    expect(seen.get('rail_link')).toBe('landside')
    expect(seen.get('road')).toBe('landside')
    expect(seen.get('bus')).toBe('landside')
    expect(seen.get('curb_lane')).toBe('landside')
    expect(seen.get('taxi_rank')).toBe('landside')
    expect(seen.get('tower')).toBe('airfield')
    for (const menu of BUILD_MENUS) {
      expect(menu.groups.length).toBeGreaterThan(0)
      const grouped = menu.groups.flatMap((group) => group.tools)
      expect(grouped).toEqual([...menu.tools])
      expect(menu.groups.every((group) => group.label.trim().length > 1)).toBe(true)
    }
    expect(BUILD_MENUS.find((menu) => menu.id === 'airfield')?.groups.map((group) => group.label)).toEqual([
      'Runways',
      'Taxiways',
      'Stands',
      'Tower',
    ])
    expect(STAMP_HOVER_MS).toBe(400)
  })

  it('lists every progression row once', () => {
    const seen = new Map<string, string>()
    for (const menu of BUILD_MENUS) {
      for (const id of menu.progression) {
        expect(seen.has(id), `${id} is also in ${seen.get(id)}`).toBe(false)
        seen.set(id, menu.id)
      }
    }
    expect([...seen.keys()].sort()).toEqual(PROGRESSION_BUILDABLES.map((row) => row.id).sort())
  })

  it('lists every manage panel once, two levels deep', () => {
    const seen = new Map<ManageTabId, string>()
    expect(MANAGE_MENUS).toHaveLength(5)
    for (const menu of MANAGE_MENUS) {
      expect(menu.tabs.length).toBeGreaterThan(0)
      expect(menu.label).not.toMatch(BANNED)
      expect(menu.label).not.toMatch(SHORT)
      for (const tab of menu.tabs) {
        expect(seen.has(tab.id), `${tab.id} is also in ${seen.get(tab.id)}`).toBe(false)
        seen.set(tab.id, menu.id)
        expect(tab.label).not.toMatch(BANNED)
        expect(tab.label).not.toMatch(SHORT)
        expect(tab.tip.length).toBeGreaterThan(8)
      }
    }
    expect(seen.get('payroll')).toBe('money')
    expect(seen.get('fees')).toBe('money')
    expect(seen.get('rival')).toBe('airlines')
    expect(seen.get('premium')).toBe('operations')
    expect(seen.get('staff')).toBe('people')
    expect(seen.get('thoughts')).toBe('people')
    expect(seen.get('specializations')).toBe('growth')
    expect(seen.get('commercial')).toBe('money')
    expect(seen.get('levels')).toBe('growth')
    expect(seen.get('wallet')).toBe('growth')
    expect(seen.get('achievements')).toBe('growth')
    expect(MANAGE_MENUS.find((menu) => menu.id === 'growth')?.tabs.find((tab) => tab.id === 'specializations')?.label).toBe(
      'Specializations',
    )
    expect(MANAGE_MENUS.find((menu) => menu.id === 'growth')?.tabs.find((tab) => tab.id === 'research')?.label).toBe(
      'Research tree',
    )
    expect(MANAGE_MENUS.find((menu) => menu.id === 'growth')?.tabs.map((tab) => tab.id)).toEqual([
      'research',
      'levels',
      'specializations',
      'wallet',
      'achievements',
    ])
    expect(seen.has('awards' as ManageTabId)).toBe(false)
    const settings = [...seen.keys()].filter((id) => id === ('settings' as ManageTabId))
    expect(settings).toHaveLength(0)
  })
})
