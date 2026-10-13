import type { FieldCapabilities, InboundState, PadKind, ResourceHold, ServiceNeeds } from './types.ts'

export const PAD_FIELD: Record<PadKind, keyof ResourceHold> = {
  stand: 'stands',
  remote: 'remoteStands',
  grass: 'grassPads',
  heli: 'heliPads',
  guard: 'guardPads',
}

export function emptyHold(): ResourceHold {
  return {
    stands: 0,
    remoteStands: 0,
    grassPads: 0,
    heliPads: 0,
    guardPads: 0,
    hotelRooms: 0,
    hangarBays: 0,
  }
}

export function freePads(state: InboundState, caps: FieldCapabilities, pad: PadKind): number {
  const key = PAD_FIELD[pad]
  return caps[key] - state.held[key]
}

/** Which pad this request will actually take, or null when every option is full. */
export function resolvePad(state: InboundState, caps: FieldCapabilities, needs: ServiceNeeds): PadKind | 'none' | null {
  if (needs.pad === 'none') return 'none'
  const order: PadKind[] = [needs.pad]
  if (needs.padFallback) order.push(needs.padFallback)
  for (const pad of order) {
    if (freePads(state, caps, pad) > 0) return pad
  }
  return null
}

/**
 * Missing hooks. Empty means the field can host.
 * These are offers: a gap refuses or fails the ask, it never spawns a stuck aircraft.
 */
export function hostGaps(state: InboundState, caps: FieldCapabilities, needs: ServiceNeeds): string[] {
  const gaps: string[] = []
  if (needs.arff && !caps.arff) gaps.push('arff')
  if (needs.ambulance && !caps.ambulance) gaps.push('ambulance')
  if (needs.securityCorridor && (!caps.securityCorridor || state.corridorHeld)) gaps.push('security_corridor')
  if (needs.catering && !caps.catering) gaps.push('catering')
  if (needs.cleaning && !caps.cleaning) gaps.push('cleaning')
  if (needs.gpu && !caps.gpu) gaps.push('gpu')
  if (needs.customs && !caps.customs) gaps.push('customs')
  if (needs.runwayMetres > 0 && caps.runwayMetres < needs.runwayMetres) gaps.push('runway')
  if (needs.fuelLitres > caps.fuelLitres - state.burnedFuel) gaps.push('fuel')
  if (needs.hotelRooms > caps.hotelRooms - state.held.hotelRooms) gaps.push('hotel')
  if (needs.hangarBays > caps.hangarBays - state.held.hangarBays) gaps.push('hangar')
  if (needs.pad !== 'none' && resolvePad(state, caps, needs) == null) gaps.push('stand')
  return gaps
}

export function reserve(state: InboundState, needs: ServiceNeeds, pad: PadKind | 'none'): void {
  if (pad !== 'none') state.held[PAD_FIELD[pad]] += 1
  state.held.hotelRooms += needs.hotelRooms
  state.held.hangarBays += needs.hangarBays
  state.burnedFuel += needs.fuelLitres
  if (needs.securityCorridor) state.corridorHeld = true
}

export function release(state: InboundState, needs: ServiceNeeds, pad: PadKind | 'none'): void {
  if (pad !== 'none') state.held[PAD_FIELD[pad]] = Math.max(0, state.held[PAD_FIELD[pad]] - 1)
  state.held.hotelRooms = Math.max(0, state.held.hotelRooms - needs.hotelRooms)
  state.held.hangarBays = Math.max(0, state.held.hangarBays - needs.hangarBays)
  if (needs.securityCorridor) state.corridorHeld = false
}
