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
