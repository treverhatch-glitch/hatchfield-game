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

/** Named row under a build category. The thumbnail grid shows one group at a time. */
export interface BuildGroup {
  id: string
  label: string
  tools: readonly Tool[]
  progression: readonly string[]
  furnish?: readonly FurnishEntry[]
}

export interface BuildMenu {
  id: BuildMenuId
  label: string
  groups: readonly BuildGroup[]
  /** Flattened from groups so a tool is still listed once. */
  tools: readonly Tool[]
  progression: readonly string[]
  furnish: readonly FurnishEntry[]
}

function menu(
  id: BuildMenuId,
  label: string,
  groups: readonly BuildGroup[],
): BuildMenu {
  return {
    id,
    label,
    groups,
    tools: groups.flatMap((group) => group.tools),
    progression: groups.flatMap((group) => group.progression),
    furnish: groups.flatMap((group) => group.furnish ?? []),
  }
}

export const BUILD_MENUS: readonly BuildMenu[] = [
  menu('airfield', 'Airfield', [
    {
      id: 'runways',
      label: 'Runways',
      tools: ['runway_short', 'runway', 'runway_heavy', 'helipad'],
      progression: [],
    },
    {
      id: 'taxiways',
      label: 'Taxiways',
      tools: ['taxi', 'deice'],
      progression: [],
    },
    {
      id: 'stands',
      label: 'Stands',
      tools: ['stand_light', 'stand_narrow', 'stand_heavy'],
      progression: ['jet_bridge', 'code_e', 'code_f', 'jet_bridge_3'],
    },
    {
      id: 'tower',
      label: 'Tower',
      tools: ['tower'],
      progression: ['atc_approach'],
    },
  ]),
  menu('terminal', 'Terminal', [
    {
      id: 'halls',
      label: 'Halls',
      tools: ['premade', 'terminal'],
      progression: ['prefab_ii', 'concourse', 'pier_ii', 'satellite'],
    },
    {
      id: 'processing',
      label: 'Processing',
      tools: ['belt'],
      progression: ['checkin_hall', 'security_hall', 'remote_screening'],
      furnish: [
        { id: 'checkin', label: 'Check-in', kit: 'rooms' },
        { id: 'security', label: 'Security', kit: 'rooms' },
      ],
    },
    {
      id: 'gates',
      label: 'Gates',
      tools: [],
      progression: [],
      furnish: [{ id: 'gates', label: 'Gates', kit: 'rooms' }],
    },
    {
      id: 'movers',
      label: 'Movers',
      tools: ['travelator', 'skywalk', 'hub_skywalk', 'mover', 'people_mover', 'term_bus', 'xfer_bus'],
      progression: [],
    },
  ]),
  menu('airside', 'Airside Ops', [
    {
      id: 'fuel',
      label: 'Fuel',
      tools: ['fuel', 'fuel_rail', 'oil', 'fuel_pipe', 'manifold', 'berth', 'saf_blending'],
      progression: ['hydrant', 'fuel_farm_iii'],
    },
    {
      id: 'gse',
      label: 'GSE/Catering',
      tools: ['depot', 'kitchen'],
      progression: [],
    },
    {
      id: 'bags',
      label: 'Bags/Cargo',
      tools: ['bags', 'cargo', 'cargo_hub_ii', 'cold_store'],
      progression: ['tilt_tray'],
    },
    {
      id: 'hangars',
      label: 'Hangars/MRO',
      tools: ['hangar', 'hangar_w', 'hangar_j', 'mro', 'nighthub'],
      progression: ['substation'],
    },
  ]),
  menu('safety', 'Safety & Security', [
    {
      id: 'stations',
      label: 'Stations',
      tools: ['fire', 'police', 'guard'],
      progression: [],
    },
  ]),
  menu('landside', 'Landside', [
    {
      id: 'roads',
      label: 'Roads',
      tools: ['road'],
      progression: [],
    },
    {
      id: 'curb',
      label: 'Curb',
      tools: ['bus', 'curb_lane', 'taxi_rank'],
      progression: [],
    },
    {
      id: 'parking',
      label: 'Parking',
      tools: ['park_s', 'park_l', 'park_g', 'park_u'],
      progression: [],
    },
    {
      id: 'transit',
      label: 'Transit',
      tools: ['rail', 'rail_link'],
      progression: [],
    },
    {
      id: 'hotels',
      label: 'Hotels',
      tools: ['hotel_inn', 'hotel_biz', 'hotel_resort', 'airport_hotel'],
      progression: [],
    },
    {
      id: 'landmarks',
      label: 'Landmarks',
      tools: [
        'observation_tower',
        'aviation_museum',
        'sky_garden',
        'art_concourse',
        'grand_arrivals_hall',
        'quiet_hall',
        'spotters_deck',
      ],
      progression: [],
    },
  ]),
  menu('retail', 'Retail & Comfort', [
    {
      id: 'food',
      label: 'Food',
      tools: ['snack'],
      progression: [],
      furnish: [{ id: 'food', label: 'Food', kit: 'commercial' }],
    },
    {
      id: 'shops',
      label: 'Shops',
      tools: [],
      progression: [],
      furnish: [{ id: 'shops', label: 'Shops', kit: 'commercial' }],
    },
    {
      id: 'lounges',
      label: 'Lounges',
      tools: [],
      progression: [],
      furnish: [{ id: 'lounges', label: 'Lounges', kit: 'rooms' }],
    },
    {
      id: 'decor',
      label: 'Decor',
      tools: [],
      progression: ['prestige_landmark'],
      furnish: [{ id: 'decor', label: 'Decor', kit: 'decor' }],
    },
  ]),
  menu('tools', 'Tools', [
    {
      id: 'edit',
      label: 'Edit',
      tools: ['clear'],
      progression: [],
    },
  ]),
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
  | 'levels'
  | 'specialize'
  | 'wallet'
  | 'tycoon'
  | 'council'
  | 'achievements'

export type ManageTabId =
  | 'overview'
  | 'income'
  | 'expenses'
  | 'loans'
  | 'charts'
  | 'fees'
  | 'payroll'
  | 'commercial'
  | 'roster'
  | 'letters'
  | 'relations'
  | 'hubs'
  | 'rival'
  | 'council'
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
  | 'levels'
  | 'specializations'
  | 'wallet'
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
    tip: 'Cash, fees, payroll, and commercial',
    tabs: [
      { id: 'overview', label: 'Overview', tip: 'Cash, capital, and the live forecast', sheet: 'economy' },
      { id: 'income', label: 'Income', tip: 'Recent income and landside fees', sheet: 'economy' },
      { id: 'expenses', label: 'Expenses', tip: 'Daily charges and payroll', sheet: 'economy' },
      { id: 'loans', label: 'Loans', tip: 'Borrow and repay', sheet: 'economy' },
      { id: 'charts', label: 'Charts', tip: 'Cash, income, passengers, and cargo', sheet: 'economy' },
      { id: 'fees', label: 'Fees', tip: 'Landing, passenger, and service prices', sheet: 'fees' },
      { id: 'payroll', label: 'Payroll', tip: 'Operations budgets and hiring', sheet: 'budget' },
      { id: 'commercial', label: 'Commercial', tip: 'Shop bids, campaigns, and awards', sheet: 'tycoon' },
    ],
  },
  {
    id: 'airlines',
    label: 'Airlines',
    tip: 'Carriers, letters, hubs, and the rival',
    tabs: [
      { id: 'roster', label: 'Roster', tip: 'Signed and available carriers', sheet: 'airlines' },
      { id: 'letters', label: 'Letters', tip: 'Standing, contracts, and diplomacy', sheet: 'airlines' },
      { id: 'relations', label: 'Airlines hub', tip: 'Relationship, hub tier, checklist, rivals, and dedicated assets', sheet: 'airlines' },
      { id: 'hubs', label: 'Hubs', tip: 'Carriers based at this field', sheet: 'airlines' },
      { id: 'rival', label: 'Rival', tip: 'Bellwater Intl fees, roster, and catchment', sheet: 'rival' },
      { id: 'council', label: 'Council', tip: 'Regional requests, votes, standing, and prestige', sheet: 'council' },
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
    tip: 'Research tree, field levels, specializations, ops wallet, and achievements',
    tabs: [
      { id: 'research', label: 'Research tree', tip: 'Research points, the lab, and branch trees', sheet: 'research' },
      { id: 'levels', label: 'Field Levels', tip: 'What each field level unlocks', sheet: 'levels' },
      { id: 'specializations', label: 'Specializations', tip: 'Hub, low-cost, cargo, and luxury trees', sheet: 'specialize' },
      { id: 'wallet', label: 'Ops wallet', tip: 'Operations points and the nine upgrade branches they buy', sheet: 'wallet' },
      { id: 'achievements', label: 'Achievements', tip: 'Milestones already reached, and yearly awards', sheet: 'achievements' },
    ],
  },
]

export function manageTab(id: ManageTabId): ManageTab {
  for (const row of MANAGE_MENUS) {
    const tab = row.tabs.find((item) => item.id === id)
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
  return BUILD_MENUS.find((row) => row.tools.includes(tool))
}

/** How long a stamp waits before the hover card appears. Cities-style, not instant. */
export const STAMP_HOVER_MS = 400
