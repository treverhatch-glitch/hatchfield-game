import { DEPLANE_MINUTES } from '../hub/config.ts'
import { linkTravelMinutes } from '../hub/connect.ts'
import { LANDSIDE_RECHECK_MINUTES, TRANSFER_SECURITY_MINUTES } from './config.ts'
import type { TransferRoute, TransferRouteInput } from './types.ts'

/**
 * Airside transfer flow: arrival gate, optional transfer security, departure gate.
 * Without a transfer lane a re-screened passenger has to go out through
 * arrivals and back through main security — the only landside path.
 */
export function planTransfer(input: TransferRouteInput): TransferRoute {
  const metres = Number.isFinite(input.metres) ? Math.max(0, input.metres) : 0
  const travel = linkTravelMinutes(input.link, metres, Math.max(0, input.walkwayMetres ?? 0))
  const travelMinutes = Number.isFinite(travel) ? travel : 0
  const riding = input.link !== 'walk' && input.link !== 'walkway'
  const steps: TransferRoute['steps'] = ['deplane']
  let screenMinutes = 0
  let airsideOnly = true
  if (input.screened) {
    if (input.transferLane) {
      steps.push('transfer_security')
      screenMinutes = TRANSFER_SECURITY_MINUTES
    } else {
      steps.push('landside_recheck')
      screenMinutes = LANDSIDE_RECHECK_MINUTES
      airsideOnly = false
    }
  }
  steps.push(riding ? 'ride' : 'walk', 'departure_gate')
  return {
    steps,
    airsideOnly,
    minutes: DEPLANE_MINUTES + screenMinutes + travelMinutes,
    screenMinutes,
    travelMinutes,
  }
}
