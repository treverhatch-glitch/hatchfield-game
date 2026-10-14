import type { KitCategory } from '../../game/terminalKitData'
import type { Tool } from '../../game/types'

/**
 * The only menu tree. Every apron tool and every manage panel is listed once.
 * Hud, the click-through, and the uniqueness test all read this file.
 */

export type BuildMenuId =
  | 'airfield'
  | 'terminal'
  | 'airside'
  | 'safety'
  | 'landside'
  | 'retail'
  | 'tools'

export interface FurnishEntry {
  id: string
  label: string
  /** Hall kit opened after a hall is selected. */
  kit: KitCategory
}

export interface BuildMenu {
  id: BuildMenuId
  label: string
  tools: readonly Tool[]
  /** Progression rows that share this tray. Ids from the unlock table. */
  progression: readonly string[]
  furnish?: readonly FurnishEntry[]
}

export const BUILD_MENUS: readonly BuildMenu[] = [
  {
    id: 'airfield',
    label: 'Airfield',
    tools: [
      'runway_short',
      'runway',
      'runway_heavy',
      'taxi',
      'stand_s',
      'stand',
      'stand_w',
      'stand_l',
      'helipad',
      'deice',
      'tower',
    ],
    progression: ['jet_bridge', 'code_e', 'code_f', 'jet_bridge_3', 'atc_approach'],
  },
  {
    id: 'terminal',
    label: 'Terminal',
    tools: [
      'premade',
      'terminal',
      'belt',
      'travelator',
      'skywalk',
      'hub_skywalk',
      'mover',
      'people_mover',
      'term_bus',
      'xfer_bus',
    ],
    progression: ['prefab_ii', 'checkin_hall', 'security_hall', 'concourse', 'pier_ii', 'satellite', 'remote_screening'],
    furnish: [
      { id: 'checkin', label: 'Check-in', kit: 'rooms' },
      { id: 'security', label: 'Security', kit: 'rooms' },
      { id: 'gates', label: 'Gates', kit: 'rooms' },
    ],
  },
  {
    id: 'airside',
    label: 'Airside Ops',
    tools: [
      'fuel',
      'fuel_rail',
      'oil',
      'saf_blending',
      'depot',
      'kitchen',
      'bags',
      'cargo',
      'hangar',
      'hangar_w',
      'hangar_j',
      'mro',
      'nighthub',
    ],
    progression: ['hydrant', 'substation', 'tilt_tray', 'fuel_farm_iii'],
  },
  {
    id: 'safety',
    label: 'Safety & Security',
    tools: ['fire', 'police', 'guard'],
    progression: [],
  },
  {
    id: 'landside',
    label: 'Landside',
    tools: [
      'road',
      'park_s',
      'park_l',
      'park_g',
      'park_u',
      'bus',
      'rail',
      'rail_link',
      'hotel_inn',
      'hotel_biz',
      'hotel_resort',
      'airport_hotel',
    ],
    progression: [],
  },
  {
    id: 'retail',
    label: 'Retail & Comfort',
    tools: ['snack'],
    progression: ['prestige_landmark'],
    furnish: [
      { id: 'food', label: 'Food', kit: 'commercial' },
      { id: 'shops', label: 'Shops', kit: 'commercial' },
      { id: 'lounges', label: 'Lounges', kit: 'rooms' },
      { id: 'decor', label: 'Decor', kit: 'decor' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    tools: ['clear'],
    progression: [],
  },
]

export type ManageMenuId = 'money' | 'airlines' | 'operations' | 'people' | 'growth'

/** Which existing sheet a sub-tab fills. One sheet can back several sub-tabs. */
export type ManageSheet =
  | 'economy'
  | 'fees'
  | 'budget'
  | 'airlines'
  | 'rival'
  | 'planner'
  | 'stands'
  | 'services'
  | 'premium'
  | 'staff'
  | 'thoughts'
  | 'research'
  | 'specialize'
  | 'tycoon'
  | 'achievements'

export type ManageTabId =
  | 'overview'
  | 'income'
  | 'expenses'
  | 'loans'
  | 'charts'
  | 'fees'
  | 'payroll'
  | 'roster'
  | 'letters'
  | 'hubs'
  | 'rival'
  | 'negotiation'
  | 'planner'
  | 'stands'
  | 'services'
  | 'premium'
  | 'staff'
  | 'commute'
  | 'morale'
  | 'thoughts'
  | 'research'
  | 'specializations'
  | 'commercial'
  | 'awards'
  | 'achievements'

export interface ManageTab {
  id: ManageTabId
  label: string
  tip: string
  sheet: ManageSheet
}

export interface ManageMenu {
  id: ManageMenuId
  label: string
  tip: string
  tabs: readonly ManageTab[]
}

export const MANAGE_MENUS: readonly ManageMenu[] = [
  {
    id: 'money',
    label: 'Money',
    tip: 'Cash, fees, and payroll',
    tabs: [
      { id: 'overview', label: 'Overview', tip: 'Cash, capital, and the live forecast', sheet: 'economy' },
      { id: 'income', label: 'Income', tip: 'Recent income and landside fees', sheet: 'economy' },
      { id: 'expenses', label: 'Expenses', tip: 'Daily charges and payroll', sheet: 'economy' },
      { id: 'loans', label: 'Loans', tip: 'Borrow and repay', sheet: 'economy' },
      { id: 'charts', label: 'Charts', tip: 'Cash, income, passengers, and cargo', sheet: 'economy' },
      { id: 'fees', label: 'Fees', tip: 'Landing, passenger, and service prices', sheet: 'fees' },
      { id: 'payroll', label: 'Payroll', tip: 'Operations budgets and hiring', sheet: 'budget' },
    ],
  },
  {
    id: 'airlines',
    label: 'Airlines',
    tip: 'Carriers, letters, hubs, and the rival',
    tabs: [
      { id: 'roster', label: 'Roster', tip: 'Signed and available carriers', sheet: 'airlines' },
      { id: 'letters', label: 'Letters', tip: 'Standing, contracts, and diplomacy', sheet: 'airlines' },
      { id: 'hubs', label: 'Hubs', tip: 'Carriers based at this field', sheet: 'airlines' },
      { id: 'rival', label: 'Rival', tip: 'Bellwater Intl fees, roster, and catchment', sheet: 'rival' },
      { id: 'negotiation', label: 'Negotiation', tip: 'Counter the open offer', sheet: 'airlines' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    tip: 'Planner, stands, services, and premium lanes',
    tabs: [
      { id: 'planner', label: 'Planner', tip: 'Timetable and the selected flight', sheet: 'planner' },
      { id: 'stands', label: 'Stands', tip: 'Jetway and remote stands', sheet: 'stands' },
      { id: 'services', label: 'Services', tip: 'Fuel, catering, power, and bags', sheet: 'services' },
      { id: 'premium', label: 'Premium', tip: 'Premium check-in, fast-track, and the VIP room', sheet: 'premium' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    tip: 'Staff, the commute, morale, and passenger thoughts',
    tabs: [
      { id: 'staff', label: 'Staff', tip: 'Housing and the crew roster', sheet: 'staff' },
      { id: 'commute', label: 'Commute', tip: 'How the crew reaches the field', sheet: 'staff' },
      { id: 'morale', label: 'Morale', tip: 'Retention and whether the shift is late', sheet: 'staff' },
      { id: 'thoughts', label: 'Thoughts', tip: 'What passengers are saying on the field', sheet: 'thoughts' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    tip: 'Research, specializations, commercial, awards, and achievements',
    tabs: [
      { id: 'research', label: 'Research', tip: 'Research points, the lab, and branch trees', sheet: 'research' },
      { id: 'specializations', label: 'Specializations', tip: 'Hub, low-cost, cargo, and luxury trees', sheet: 'specialize' },
      { id: 'commercial', label: 'Commercial', tip: 'Shop bids and campaigns', sheet: 'tycoon' },
      { id: 'awards', label: 'Awards', tip: 'Yearly awards and prestige', sheet: 'tycoon' },
      { id: 'achievements', label: 'Achievements', tip: 'Milestones already reached', sheet: 'achievements' },
    ],
  },
]

export function manageTab(id: ManageTabId): ManageTab {
  for (const menu of MANAGE_MENUS) {
    const tab = menu.tabs.find((row) => row.id === id)
    if (tab) return tab
  }
  throw new Error(`unknown manage tab ${id}`)
}

export function sheetFor(id: ManageTabId): ManageSheet {
  return manageTab(id).sheet
}

export function headingFor(id: ManageTabId): string {
  return manageTab(id).label
}

export function menuForTool(tool: Tool): BuildMenu | undefined {
  return BUILD_MENUS.find((menu) => menu.tools.includes(tool))
}
