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
} satisfies Record<string, EventAction>;

export type SoundEventName = keyof typeof EVENT_SOUNDS;
export const SOUND_EVENT_NAMES = Object.keys(EVENT_SOUNDS) as SoundEventName[];
/** The logistics adapter's SoundCue union (kept in sync with src/logistics/adapter.ts). */
export const LOGISTICS_CUES = ['refuel_start', 'refuel_stop', 'truck_arrive', 'tanker_arrive', 'vehicle_breakdown', 'vehicle_repaired', 'tow_start', 'crew_siren', 'sweeper', 'runway_closed', 'safety_alarm'] as const satisfies readonly SoundEventName[];
export const eventAction = (name: string): EventAction | undefined =>
  Object.prototype.hasOwnProperty.call(EVENT_SOUNDS, name) ? (EVENT_SOUNDS as Record<string, EventAction>)[name] : undefined;
