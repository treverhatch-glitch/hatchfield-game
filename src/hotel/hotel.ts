/**
 * Hotel module for airport stay operations.
 */

export const ROOM_NIGHTLY_RATE = 95;
export const ROOM_DAILY_UPKEEP = 18;

export interface NightlyDemandParams {
  delayedOvernight?: number;
  transitOvernight?: number;
  crewNights?: number;
  baseShare?: number;
}

export interface OccupancyResult {
  occupied: number;
  overflow: number;
  occupancyRate: number;
}

/**
 * Calculates nightly room demand based on delayed passengers, transit passengers,
 * crew room nights, and baseline demand share.
 */
export function nightlyDemand(params?: NightlyDemandParams | null): number {
  if (!params) {
    return 0;
  }

  const delayed = Math.max(0, Number.isFinite(params.delayedOvernight) ? (params.delayedOvernight ?? 0) : 0);
  const transit = Math.max(0, Number.isFinite(params.transitOvernight) ? (params.transitOvernight ?? 0) : 0);
  const crew = Math.max(0, Number.isFinite(params.crewNights) ? (params.crewNights ?? 0) : 0);
  const base = Math.max(0, Number.isFinite(params.baseShare) ? (params.baseShare ?? 0) : 0);

  const total = delayed + transit + crew + base;
  return Number.isFinite(total) ? Math.round(total) : 0;
}

/**
 * Calculates room occupancy, overflow room demand beyond capacity,
 * and the occupancy rate factor (0.0 to 1.0).
 */
export function occupancy(demandInput: number, roomsInput: number): OccupancyResult {
  const demand = Math.max(0, Number.isFinite(demandInput) ? Math.round(demandInput) : 0);
  const rooms = Math.max(0, Number.isFinite(roomsInput) ? Math.round(roomsInput) : 0);

  const occupied = Math.min(demand, rooms);
  const overflow = Math.max(0, demand - rooms);
  const occupancyRate = rooms > 0 ? occupied / rooms : 0;

  return {
    occupied,
    overflow,
    occupancyRate,
  };
}

/**
 * Calculates total nightly revenue based on occupied rooms ($95 / room).
 */
export function nightlyRevenue(occupiedRooms: number): number {
  const safeRooms = Math.max(0, Number.isFinite(occupiedRooms) ? Math.floor(occupiedRooms) : 0);
  return safeRooms * ROOM_NIGHTLY_RATE;
}

/**
 * Calculates daily upkeep cost based on total hotel capacity ($18 / room / day).
 */
export function upkeep(rooms: number): number {
  const safeRooms = Math.max(0, Number.isFinite(rooms) ? Math.floor(rooms) : 0);
  return safeRooms * ROOM_DAILY_UPKEEP;
}

/**
 * Alias for upkeep function.
 */
export const dailyUpkeep = upkeep;
