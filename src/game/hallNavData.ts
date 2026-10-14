/** Tunables for the live passenger walk in the Terminal view (src/game/hallNav.ts). */
import type { EquipKind } from '../terminalbuild/types.ts'
import type { ItemDef } from './terminal.ts'

export const HALL_NAV_TUNING = {
  /**
   * PaxNav seconds per sim clock second at 1x. PaxNav walks and serves in real
   * seconds (1.3 m/s, 75 s check-in); a game day is 180 clock seconds. 30 keeps
   * walkers near the old hall guests' pace (a clock second is 8 game minutes,
   * so any readable walk is already fast-forward against the timetable).
   */
  navSecPerClockSec: 30,
  /**
   * Nav seconds of departure lead per clock second left to STD. Larger than
   * the walk scale because the sim's show-up window (3 game hours = 22.5 clock s)
   * is far shorter than a real one once walking is readable: 120 turns a
   * leisure show-up into 45 nav minutes, time for security and a toilet or
   * shop stop before boarding opens (30 nav min out). Only real queues make
   * anyone miss.
   */
  departLeadScale: 120,
  /** Departure lead, clock seconds, for a walker with no flight yet (day-one walkers, unbound slots). */
  unknownLeadClockSec: 20,
  /** Seed for each hall's walker rolls (bags, needs, curb door). */
  seed: 204,
}

/**
 * Prefab kit room -> build kit it stands for when a prefab hall is read as a
 * build layout. One piece per server, as far as the item's cell has room.
 */
export const PREFAB_ROOM_KIT: Partial<Record<NonNullable<ItemDef['room']>, EquipKind>> = {
  checkin: 'checkin_desk',
  bagdrop: 'checkin_desk',
  security: 'security_lane',
  gate: 'gate_desk',
  bathroom: 'toilet',
  food: 'shop_counter',
  souvenir: 'shop_counter',
}
