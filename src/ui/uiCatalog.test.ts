import { describe, expect, it } from 'vitest'
import { FEE_FIELDS } from '../commercial/fees'
import { ROOMS } from '../game/catalog'
import { ITEMS } from '../game/terminal'
import type { Tool } from '../game/types'
import { BUILD_MENUS, HALL_ROOMS, INFO_TREE, KIT_TABS } from './uiCatalog'

/** Every stamp except Select. A missing key fails the type-check. */
const EVERY_STAMP = {
  runway_short: true,
  runway: true,
  runway_heavy: true,
  helipad: true,
  taxi: true,
  stand_s: true,
  stand: true,
  stand_l: true,
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
  term_bus: true,
  people_mover: true,
  xfer_bus: true,
  hub_skywalk: true,
  rail: true,
  kitchen: true,
  depot: true,
  mro: true,
  nighthub: true,
  stand_w: true,
  hangar_w: true,
  hangar_j: true,
  fuel_rail: true,
  oil: true,
  travelator: true,
  skywalk: true,
  mover: true,
  airport_hotel: true,
  rail_link: true,
  saf_blending: true,
  clear: true,
} satisfies Record<Exclude<Tool, 'pan'>, true>

const BANNED = /^(ops|specs|spec|ads|ad|late|todo|tbd|lorem|placeholder|click me|button|xxx|wip|n\/a|test|figure)$/i

function menuOf(tool: Tool): string | undefined {
  return BUILD_MENUS.find((menu) => menu.tools.includes(tool))?.id
}

function parentOf(id: string): string | undefined {
  return INFO_TREE.find((node) => node.items?.some((item) => item.id === id))?.id
}

describe('UI catalog', () => {
  it('puts every stamp in exactly one build menu', () => {
    const tools = BUILD_MENUS.flatMap((menu) => menu.tools)
    expect(new Set(tools).size).toBe(tools.length)
    expect(tools.slice().sort()).toEqual(Object.keys(EVERY_STAMP).sort())
    expect(tools).not.toContain('pan')
  })

  it('keeps fuel in operations, shops in commercial, and drops the late junk drawer', () => {
    expect(menuOf('fuel')).toBe('ops')
    expect(menuOf('fuel_rail')).toBe('ops')
    expect(menuOf('oil')).toBe('ops')
    expect(menuOf('saf_blending')).toBe('ops')
    expect(menuOf('belt')).toBe('ops')
    expect(menuOf('guard')).toBe('ops')
    expect(menuOf('snack')).toBe('commercial')
    expect(menuOf('hotel_inn')).toBe('commercial')
    expect(menuOf('hotel_biz')).toBe('commercial')
    expect(menuOf('hotel_resort')).toBe('commercial')
    expect(menuOf('airport_hotel')).toBe('commercial')
    expect(menuOf('rail_link')).toBe('landside')
    expect(BUILD_MENUS.map((menu) => menu.id)).not.toContain('late')
    expect(BUILD_MENUS.find((menu) => menu.id === 'ops')?.label).toBe('Operations')
    expect(BUILD_MENUS.find((menu) => menu.id === 'commercial')?.label).toBe('Commercial')
  })

  it('nests staff under management and research under R&D', () => {
    expect(parentOf('staff')).toBe('management')
    expect(parentOf('budget')).toBe('management')
    expect(parentOf('research')).toBe('rd')
    expect(parentOf('branches')).toBe('rd')
    expect(parentOf('specialize')).toBe('rd')
    expect(parentOf('services')).toBe('operations')
    expect(parentOf('shops')).toBe('commercial')
    expect(parentOf('premium')).toBe('commercial')
    expect(parentOf('campaigns')).toBe('commercial')
    expect(INFO_TREE.find((node) => node.id === 'rd')?.label).toBe('R&D')
    expect(INFO_TREE.find((node) => node.id === 'management')?.label).toBe('Management')
    const research = INFO_TREE.find((node) => node.id === 'rd')?.items?.find((item) => item.id === 'research')
    expect(research?.label).toBe('Research')
    const specs = INFO_TREE.find((node) => node.id === 'rd')?.items?.find((item) => item.id === 'specialize')
    expect(specs?.label).toBe('Specializations')
    const branches = INFO_TREE.find((node) => node.id === 'rd')?.items?.find((item) => item.id === 'branches')
    expect(branches?.label).toBe('Branches')
  })

  it('gives every hall room one desk and puts shops on the commercial kit tab', () => {
    const placed = [
      ...HALL_ROOMS.services,
      ...HALL_ROOMS.commercial,
      ...HALL_ROOMS.research,
    ]
    expect(new Set(placed).size).toBe(placed.length)
    expect(placed.slice().sort()).toEqual(ROOMS.map((room) => room.id).sort())
    expect(KIT_TABS.map((tab) => tab.label)).toContain('Commercial')
    expect(KIT_TABS.map((tab) => tab.id)).not.toContain('food')
    for (const id of ['fast_food', 'cafe', 'restaurant', 'newsagent']) {
      expect(ITEMS.find((item) => item.id === id)?.category).toBe('commercial')
    }
  })

  it('rejects empty, duplicate, and placeholder labels', () => {
    for (const menu of BUILD_MENUS) {
      expect(menu.label.trim().length).toBeGreaterThan(0)
      expect(menu.label).not.toMatch(BANNED)
      expect(new Set(menu.tools).size).toBe(menu.tools.length)
    }
    for (const node of INFO_TREE) {
      expect(node.label.trim().length).toBeGreaterThan(0)
      expect(node.label).not.toMatch(BANNED)
      const labels = (node.items ?? []).map((item) => item.label)
      expect(new Set(labels).size).toBe(labels.length)
      for (const item of node.items ?? []) {
        expect(item.label.trim().length).toBeGreaterThan(0)
        expect(item.label).not.toMatch(BANNED)
        expect(item.tip.trim().length).toBeGreaterThan(8)
      }
    }
    const feeLabels = FEE_FIELDS.map((field) => field.label)
    expect(new Set(feeLabels).size).toBe(feeLabels.length)
    for (const label of feeLabels) expect(label).not.toMatch(BANNED)
  })
})
