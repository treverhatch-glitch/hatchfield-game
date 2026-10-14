import type { KitCategory } from '../game/terminalKitData'
import type { TycoonTab } from '../tycoon/types'

/**
 * Hall kit and room lists. The build bar and manage menus live in nav/taxonomy.ts.
 */

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

