import { ASH_HOTEL_ROOMS } from './data.ts'
import type { WeatherDivertAsk } from './types.ts'

/**
 * Build one weather-divert ask for the inbound path (PR #42).
 * The live field should land it with `spawnOffer(state, 'weather_divert')`
 * once that module is on the branch. Until then the apron bridge calls the
 * trunk divert landing (`spawnEmergencyDivert`) — same ask, no second path.
 */
export function weatherDivertAsk(): WeatherDivertAsk {
  return {
    kind: 'weather_divert',
    needsStand: true,
    arff: true,
    hotelRooms: ASH_HOTEL_ROOMS,
  }
}
