/**
 * Turnaround attachment order. Positions live on the rigs; this list is only
 * the sequence and which socket must meet which socket. 5 cm is the lock tolerance.
 */

export const LOCK_TOLERANCE_M = 0.05

export const TURN_STEPS = [
  'approach',
  'align',
  'carry_hose',
  'fuel',
  'stow_hose',
  'dock_belt',
  'dock_catering',
  'dock_stairs',
  'hitch_tug',
  'depart',
] as const

export type TurnStep = (typeof TURN_STEPS)[number]

/** Stand size to the airframe whose doors and gear the sockets are taken from. */
export const STAND_AIRFRAME = { S: 'e175', M: 'b738', L: 'a380' } as const

export type StandSize = keyof typeof STAND_AIRFRAME

/**
 * While a step is active, `from` (a prop or a vehicle socket) must sit on `to`.
 * Vehicle docks move the truck. The hose nozzle is reparented.
 */
export const STEP_LOCKS: Partial<Record<TurnStep, { from: string; to: string }>> = {
  approach: { from: 'hose_nozzle', to: 'hose_reel_out' },
  align: { from: 'hose_nozzle', to: 'hose_reel_out' },
  carry_hose: { from: 'hose_nozzle', to: 'crew_hand_r' },
  fuel: { from: 'hose_nozzle', to: 'plane_fuel_port' },
  stow_hose: { from: 'hose_nozzle', to: 'hose_reel_out' },
  dock_belt: { from: 'belt_tip', to: 'plane_cargo_door_fwd' },
  dock_catering: { from: 'catering_lip', to: 'catering_door' },
  dock_stairs: { from: 'stairs_top', to: 'plane_pax_door' },
  hitch_tug: { from: 'tug_hitch', to: 'plane_nose_gear' },
  depart: { from: 'hose_nozzle', to: 'hose_reel_out' },
}

/** Steps that slide a whole vehicle until its socket meets the aircraft socket. */
export const VEHICLE_DOCKS = ['dock_belt', 'dock_catering', 'dock_stairs', 'hitch_tug'] as const

/** Longest hop while an item is moving between two sockets. Longer than this is a teleport. */
export const HANDOFF_STEP_M = 0.4

/** One suitcase: check-in, the hold, then the carousel. */
export const BAG_STEPS = [
  'check_in',
  'onto_belt',
  'along_belt',
  'onto_cart',
  'cart_to_stand',
  'onto_loader',
  'up_to_hold',
  'in_hold',
  'out_of_hold',
  'down_loader',
  'onto_cart_return',
  'cart_to_claim',
  'onto_carousel',
] as const

export type BagStep = (typeof BAG_STEPS)[number]

export const ULD_STEPS = ['on_dolly', 'dolly_to_loader', 'onto_loader', 'into_hold'] as const
export const CATERING_STEPS = ['on_truck', 'to_lip', 'into_galley'] as const
export const PAX_STEPS = ['board_hall', 'board_cab', 'board_door', 'deplane_door', 'deplane_cab', 'deplane_hall'] as const
export const FUEL_STEPS = ['to_farm', 'fill', 'leave_farm'] as const

export type FlowName = 'bag' | 'uld' | 'catering' | 'pax' | 'fuel'
