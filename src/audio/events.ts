/**
 * Game/logistics event name → sound mapping. Event names match the `SoundCue`s
 * emitted by the logistics adapter (src/logistics, PR #5) plus turnaround,
 * maintenance, construction, terminal and economy hooks.
 *
 * - `start` begins a loop keyed by (sound, key) — e.g. one pump per stand.
 * - `stop` ends the loop(s) named in `stops` for that key.
 * - `once` fires a one-shot.
 */
import type { SfxId } from './services';

export type EventAction =
  | { kind: 'once'; sound: SfxId }
  | { kind: 'start'; sound: SfxId }
  | { kind: 'stop'; stops: SfxId[] };

const once = (sound: SfxId): EventAction => ({ kind: 'once', sound });
const start = (sound: SfxId): EventAction => ({ kind: 'start', sound });
const stop = (...stops: SfxId[]): EventAction => ({ kind: 'stop', stops });

export const EVENT_SOUNDS = {
  // logistics adapter SoundCues (PR #5)
  refuel_start: start('hydrantPump'),
  refuel_stop: stop('hydrantPump'),
  truck_arrive: once('busDoorHiss'),
  tanker_arrive: start('heavyFuelTruck'),
  vehicle_breakdown: once('breakdownClunk'),
  vehicle_repaired: once('impactWrench'),
  tow_start: start('towTruck'),
  crew_siren: start('hazardTicks'),
  sweeper: start('runwaySweeper'),
  runway_closed: once('disruptionAlert'),
  safety_alarm: once('disruptionAlert'),
  // new service events
  deice_spray_start: start('deiceSpray'),
  deice_spray_stop: stop('deiceSpray'),
  hangar_door_open: once('hangarDoorOpen'),
  hangar_door_close: once('hangarDoorClose'),
  fire_siren_start: start('fireSiren'),
  fire_siren_stop: stop('fireSiren'),
  fire_water_start: start('fireWaterCannon'),
  fire_water_stop: stop('fireWaterCannon'),
  bus_engine_start: start('busEngine'),
  bus_engine_stop: stop('busEngine'),
  fuel_hose_start: start('fuelHoseReel'),
  fuel_hose_stop: stop('fuelHoseReel'),
  cargo_dock_door: once('cargoDockDoor'),
  cargo_forklift_start: start('cargoForklift'),
  cargo_forklift_stop: stop('cargoForklift'),
  tug_engine_start: start('tugEngine'),
  tug_engine_stop: stop('tugEngine'),
  catering_hydraulics_start: start('cateringHydraulics'),
  catering_hydraulics_stop: stop('cateringHydraulics'),
  // turnaround
  tanker_depart: stop('heavyFuelTruck'),
  hydrant_connect: start('hydrantDispenser'),
  hydrant_disconnect: stop('hydrantDispenser', 'hydrantPump'),
  fuel_truck_start: start('heavyFuelTruck'),
  fuel_truck_stop: stop('heavyFuelTruck'),
  catering_lift_start: start('cateringScissorLift'),
  catering_lift_stop: stop('cateringScissorLift'),
  belt_loader_start: start('beltLoader'),
  belt_loader_stop: stop('beltLoader'),
  uld_loader_start: start('uldLoader'),
  uld_loader_stop: stop('uldLoader'),
  bag_tug_start: start('baggageTugCart'),
  bag_tug_stop: stop('baggageTugCart'),
  gpu_connect: start('gpuHum'),
  gpu_disconnect: stop('gpuHum'),
  bus_depart: start('passengerBus'),
  bus_arrive: stop('passengerBus'),
  bus_doors: once('busDoorHiss'),
  vehicle_reverse_start: start('reversingBeeper'),
  vehicle_reverse_stop: stop('reversingBeeper'),
  pushback_start: start('towbarlessTug'),
  pushback_complete: stop('towbarlessTug'),
  bridge_dock: once('jetBridgeDock'),
  boarding_start: once('boardingChime'),
  boarding_call: once('boardingChime'),
  // maintenance
  repair_dispatch: start('repairVan'),
  repair_arrive: stop('repairVan'),
  tow_complete: stop('towTruck', 'hazardTicks'),
  sweeper_done: stop('runwaySweeper'),
  crew_done: stop('hazardTicks'),
  // construction
  construction_start: start('contractorVan'),
  contractor_arrive: stop('contractorVan'),
  delivery_start: start('deliveryTruck'),
  delivery_arrived: stop('deliveryTruck'),
  scaffold_up: once('scaffolding'),
  build_hammer: once('hammering'),
  concrete_pour_start: start('concreteMixer'),
  concrete_pour_stop: stop('concreteMixer'),
  // UI / economy / notifications
  report_ready: once('reportReady'),
  disruption: once('disruptionAlert'),
  rating_up: once('airlineRatingUp'),
  rating_down: once('airlineRatingDown'),
  contract_offer: once('contractOffer'),
  undo: once('undo'),
  redo: once('redo'),
  cash_in: once('cashInTick'),
  cost_charged: once('costTick'),
  low_cash: once('lowCashWarning'),
  research_complete: once('researchComplete'),
  // catering & shops (PR #15)
  catering_cart_roll_start: start('cateringCartRoll'),
  catering_cart_roll_stop: stop('cateringCartRoll'),
  catering_cart_latch: once('cartLatch'),
  crew_door: once('crewDoorSlam'),
  shop_sale: once('shopTill'),
  shop_restock: once('shelfStocking'),
  shop_out_of_stock: once('outOfStock'),
  // contracts & scheduling (PR #19)
  slot_moved: once('scheduleSnap'),
  slot_rejected: once('scheduleRejected'),
  slot_conflict: once('slotConflict'),
  season_published: once('seasonPublished'),
  sla_bonus: once('slaBonus'),
  sla_penalty: once('slaPenalty'),
  lawsuit: once('lawsuitGavel'),
  // crowd (PR #18)
  queue_grumble_start: start('queueGrumble'),
  queue_grumble_stop: stop('queueGrumble'),
  door_jam_start: start('doorShuffle'),
  door_jam_stop: stop('doorShuffle'),
  gridlock: once('gridlockAlert'),
  // diplomacy (PR #14)
  letter: once('letterArrive'),
  standing_up: once('standingUp'),
  standing_down: once('standingDown'),
  demand_issued: once('demandIssued'),
  exit_notice: once('exitNotice'),
  hub_granted: once('hubFanfare'),
  alliance: once('allianceSeal'),
  spat: once('spatHeadline'),
  // ambience beds (usually driven by AmbienceMixer, also reachable as events)
  pa_announcement: once('paAnnouncement'),
  checkin_chatter_start: start('checkinChatter'),
  checkin_chatter_stop: stop('checkinChatter'),
  security_lane_start: start('securityBeeps'),
  security_lane_stop: stop('securityBeeps'),
  apu_start: start('apuHum'),
  apu_stop: stop('apuHum'),
} satisfies Record<string, EventAction>;

export type SoundEventName = keyof typeof EVENT_SOUNDS;
export const SOUND_EVENT_NAMES = Object.keys(EVENT_SOUNDS) as SoundEventName[];
/** The logistics adapter's SoundCue union (kept in sync with src/logistics/adapter.ts). */
export const LOGISTICS_CUES = ['refuel_start', 'refuel_stop', 'truck_arrive', 'tanker_arrive', 'vehicle_breakdown', 'vehicle_repaired', 'tow_start', 'crew_siren', 'sweeper', 'runway_closed', 'safety_alarm'] as const satisfies readonly SoundEventName[];
export const eventAction = (name: string): EventAction | undefined =>
  Object.prototype.hasOwnProperty.call(EVENT_SOUNDS, name) ? (EVENT_SOUNDS as Record<string, EventAction>)[name] : undefined;
