import type { Tool } from '../game/types'
import type { KitCategory } from '../game/terminalKitData'
import type { TycoonTab } from '../tycoon/types'

/**
 * Player-facing menu tree. Build trays, info panels, and the hall kit all
 * read this file so a label and its category stay in one place.
 */

export type PanelId =
  | 'economy'
  | 'budget'
  | 'research'
  | 'growth'
  | 'rnd'
  | 'specialize'
  | 'airlines'
  | 'planner'
  | 'services'
  | 'settings'
  | 'premium'
  | 'tycoon'
  | 'rival'
  | 'staff'

export type EcoTab = 'overview' | 'income' | 'expenses' | 'loans' | 'charts'

export const BUILD_MENUS: { id: string; label: string; tools: Tool[] }[] = [
  {
    id: 'pavement',
    label: 'Pavement',
    tools: ['runway_short', 'runway', 'runway_heavy', 'taxi', 'road', 'helipad', 'deice'],
  },
  {
    id: 'stands',
    label: 'Stands',
    tools: ['stand_s', 'stand', 'stand_w', 'stand_l'],
  },
  {
    id: 'terminal',
    label: 'Terminal',
    tools: [
      'premade',
      'terminal',
      'term_bus',
      'people_mover',
      'xfer_bus',
      'hub_skywalk',
      'travelator',
      'skywalk',
      'mover',
    ],
  },
  {
    id: 'ops',
    label: 'Operations',
    tools: [
      'fuel',
      'fuel_rail',
      'oil',
      'saf_blending',
      'kitchen',
      'depot',
      'bags',
      'belt',
      'fire',
      'police',
      'cargo',
      'guard',
      'tower',
      'hangar',
      'hangar_w',
      'hangar_j',
      'mro',
      'nighthub',
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    tools: ['snack', 'hotel_inn', 'hotel_biz', 'hotel_resort', 'airport_hotel'],
  },
  {
    id: 'landside',
    label: 'Landside',
    tools: ['park_s', 'park_l', 'park_g', 'park_u', 'bus', 'rail', 'rail_link'],
  },
  {
    id: 'bulldoze',
    label: 'Bulldoze',
    tools: ['clear'],
  },
]

export interface InfoItem {
  id: string
  label: string
  tip: string
  panel: Exclude<PanelId, null>
  /** Commercial book tab, when several items share one panel. */
  tycoonTab?: TycoonTab
}

export interface InfoNode {
  id: string
  label: string
  tip: string
  panel?: Exclude<PanelId, null>
  items?: InfoItem[]
}

/** Bottom-bar tree. Groups open a submenu; a bare node opens its panel. */
export const INFO_TREE: InfoNode[] = [
  {
    id: 'economy',
    label: 'Economy',
    tip: 'Cash, loans, parcels, and the HATCH exchange',
    panel: 'economy',
  },
  {
    id: 'operations',
    label: 'Operations',
    tip: 'Fuel, catering, power, and the flight planner',
    items: [
      {
        id: 'services',
        label: 'Services',
        tip: 'Fuel contracts, catering, power, bags, and hall operations',
        panel: 'services',
      },
      {
        id: 'planner',
        label: 'Planner',
        tip: 'Timetable, stands, and the selected flight',
        panel: 'planner',
      },
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    tip: 'Shops, premium lanes, campaigns, and awards',
    items: [
      {
        id: 'shops',
        label: 'Shops',
        tip: 'Tenant bids for food and retail, plus hall shops',
        panel: 'tycoon',
        tycoonTab: 'shops',
      },
      {
        id: 'premium',
        label: 'Premium',
        tip: 'Premium check-in, fast-track, and the VIP room',
        panel: 'premium',
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        tip: 'Paid advertising that lifts demand',
        panel: 'tycoon',
        tycoonTab: 'ads',
      },
      {
        id: 'awards',
        label: 'Awards',
        tip: 'Yearly awards and prestige',
        panel: 'tycoon',
        tycoonTab: 'awards',
      },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    tip: 'Staff, housing, and operations budgets',
    items: [
      {
        id: 'staff',
        label: 'Staff',
        tip: 'Commute, housing, and morale',
        panel: 'staff',
      },
      {
        id: 'budget',
        label: 'Budget',
        tip: 'Operations payroll and hiring',
        panel: 'budget',
      },
    ],
  },
  {
    id: 'rd',
    label: 'R&D',
    tip: 'Research unlocks and specialization trees',
    items: [
      {
        id: 'research',
        label: 'Research',
        tip: 'Research points, lab crew, and unlocks',
        panel: 'research',
      },
      {
        id: 'branches',
        label: 'Branches',
        tip: 'Passenger, cargo, efficiency, and prestige research',
        panel: 'rnd',
      },
      {
        id: 'specialize',
        label: 'Specializations',
        tip: 'Hub, low-cost, cargo, and luxury trees',
        panel: 'specialize',
      },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    tip: 'Field level, category research, and specialisations',
    items: [
      {
        id: 'research-tree',
        label: 'Research tree',
        tip: 'One tree per build category, with research-point costs',
        panel: 'growth',
      },
    ],
  },
  {
    id: 'airlines',
    label: 'Airlines',
    tip: 'Standing, letters, and hubs',
    panel: 'airlines',
  },
  {
    id: 'rival',
    label: 'Rival',
    tip: 'Bellwater Intl — fees, roster, and catchment',
    panel: 'rival',
  },
  {
    id: 'settings',
    label: 'Settings',
    tip: 'Sound, graphics, hints, and game options',
    panel: 'settings',
  },
]

export const ECO_TABS: { id: EcoTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'loans', label: 'Loans' },
  { id: 'charts', label: 'Charts' },
]

export const TYCOON_TABS: { id: TycoonTab; label: string }[] = [
  { id: 'shops', label: 'Shops' },
  { id: 'ads', label: 'Campaigns' },
  { id: 'awards', label: 'Awards' },
]

export const SETTINGS_TABS: { id: 'game' | 'controls'; label: string }[] = [
  { id: 'game', label: 'Game' },
  { id: 'controls', label: 'Controls' },
]

export const KIT_TABS: { id: KitCategory; label: string }[] = [
  { id: 'commercial', label: 'Commercial' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'seating', label: 'Seating' },
  { id: 'decor', label: 'Decor' },
  { id: 'links', label: 'Links' },
  { id: 'service', label: 'Service' },
]

/** Hall rooms, split by the desk that actually uses them. */
export const HALL_ROOMS = {
  services: ['checkin', 'security', 'gate', 'bagclaim', 'bagdrop', 'bathroom'],
  commercial: ['food', 'souvenir', 'lounge', 'golf', 'waterfall', 'gaming', 'dayhotel', 'spa', 'pool'],
  research: ['rdesk', 'rboard', 'rmachine'],
} as const

export function infoNodes(): InfoNode[] {
  return INFO_TREE
}

export function panelHeading(panel: Exclude<PanelId, null>, tycoonTab: TycoonTab): string {
  if (panel === 'tycoon') {
    if (tycoonTab === 'year') return 'Year report'
    return TYCOON_TABS.find((tab) => tab.id === tycoonTab)?.label ?? 'Shops'
  }
  for (const node of INFO_TREE) {
    if (node.panel === panel) return node.label
    const item = node.items?.find((row) => row.panel === panel)
    if (item) return item.label
  }
  return panel
}
