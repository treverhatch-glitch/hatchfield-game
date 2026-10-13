/**
 * Engine event → sound bindings (INTEGRATION_REVIEW.md §3/§5 step 3).
 *
 * One table from every event emitted by the other modules to a `SoundEventName`
 * in EVENT_SOUNDS. The engines' own names are left alone; this table adapts.
 *
 * - #5 logistics: `LogisticsEvent['type']` (src/logistics/types.ts)
 * - #10 cargo:    `CargoEvent['type']` (src/cargo/types.ts), discriminated on `status`
 * - #9 airlines:  `AirlineEvent` names agreed in the review (#9 has no emitter yet)
 * - #7 features:  notification kinds, rating signals, undo/redo, reports, weather
 *
 * A binding is either a fixed sound name, or a resolver that discriminates on the
 * event's fields (e.g. `crew_dispatched.job`). `null` from a resolver means "this
 * variant is intentionally silent" (only used for no-op sub-states).
 */
import { EVENT_SOUNDS, type SoundEventName, type EventAction } from './events';

/** Minimal structural shape shared by all engine events. */
export interface BindableEvent { type: string; [field: string]: unknown }

export type Resolver = (e: BindableEvent) => SoundEventName | null;
export type Binding = SoundEventName | Resolver;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const SERVICE_START: Record<string, SoundEventName> = {
  deplane: 'bridge_dock', bag_unload: 'belt_loader_start', cargo_unload: 'uld_loader_start',
  loader: 'uld_loader_start', fuel: 'fuel_truck_start', catering: 'catering_lift_start',
  cleaning: 'truck_arrive', gpu: 'gpu_connect', boarding: 'boarding_start', bag_load: 'belt_loader_start',
  cargo_load: 'uld_loader_start', bag_offload: 'bag_tug_start', door_close: 'bus_doors', pushback: 'pushback_start',
};
const SERVICE_DONE: Record<string, SoundEventName> = {
  deplane: 'bus_doors', bag_unload: 'belt_loader_stop', cargo_unload: 'uld_loader_stop',
  loader: 'uld_loader_stop', fuel: 'fuel_truck_stop', catering: 'catering_lift_stop',
  cleaning: 'bus_doors', gpu: 'gpu_disconnect', boarding: 'boarding_call', bag_load: 'belt_loader_stop',
  cargo_load: 'uld_loader_stop', bag_offload: 'bag_tug_stop', door_close: 'bus_doors', pushback: 'pushback_complete',
};

/** #5 logistics. Keys are exactly `LogisticsEvent['type']`. */
export const LOGISTICS_BINDINGS = {
  truck_arrive: 'truck_arrive',
  refuel_start: (e) => (e.method === 'hydrant' ? 'hydrant_connect' : 'refuel_start'),
  refuel_stop: (e) => (e.method === 'hydrant' ? 'hydrant_disconnect' : 'refuel_stop'),
  service_start: (e) => SERVICE_START[str(e.service)] ?? 'truck_arrive',
  service_done: (e) => SERVICE_DONE[str(e.service)] ?? 'bus_doors',
  pax_deplaned: 'bridge_dock',
  bags_to_claim: 'bag_tug_stop',
  cargo_to_area: 'uld_loader_stop',
  gate_closed: 'boarding_call',
  pax_offloaded: 'disruption',
  bags_left_behind: 'disruption',
  low_stock: 'low_cash',
  delivery_ordered: 'fuel_truck_start',
  delivery_arrived: 'tanker_arrive', // fuel delivery (construction deliveries use audio `delivery_arrived`)
  turnaround_complete: (e) => (typeof e.delayMinutes === 'number' && e.delayMinutes > 0 ? 'cost_charged' : 'cash_in'),
  money: (e) => (typeof e.amount === 'number' && e.amount < 0 ? 'cost_charged' : 'cash_in'),
  vehicle_breakdown: 'vehicle_breakdown',
  vehicle_repaired: 'vehicle_repaired',
  vehicle_serviced: 'vehicle_repaired',
  crew_dispatched: (e) => {
    switch (e.job) {
      case 'repair': return 'repair_dispatch';
      case 'tow': return 'tow_start';
      case 'inspect': return 'sweeper';
      default: return 'crew_siren'; // 'facility'
    }
  },
  tow_start: 'tow_start',
  facility_status: (e) => (e.status === 'ok' ? null : 'disruption'),
  facility_repaired: 'crew_done',
  runway_fod: 'crew_siren',
  runway_closed: 'runway_closed',
  runway_reopened: 'sweeper_done',
  safety_incident: 'safety_alarm',
  pax_mood_hit: 'rating_down',
} satisfies Record<string, Binding>;

/** #10 cargo. Keys are `CargoEvent['type']`; statuses discriminate. */
export const CARGO_BINDINGS = {
  money: (e) => (typeof e.amount === 'number' && e.amount < 0 ? 'cost_charged' : 'cash_in'),
  truck_status: (e) => {
    switch (e.status) {
      case 'inbound': return 'delivery_start';
      case 'unloading': case 'loading': return 'uld_loader_start';
      case 'departed': return 'uld_loader_stop';
      default: return 'vehicle_reverse_start'; // 'queued' (backing into dock)
    }
  },
  contract_status: (e) => (e.status === 'failed' ? 'rating_down' : e.status === 'fulfilled' ? 'cash_in' : 'contract_offer'),
  import_status: (e) => (e.status === 'collected' ? 'bag_tug_stop' : e.status === 'awaiting_truck' ? 'disruption' : 'bag_tug_start'),
  flow: (e) => (e.direction === 'out' ? 'uld_loader_stop' : 'uld_loader_start'),
  bottlenecks: (e) => (Array.isArray(e.bottlenecks) && e.bottlenecks.length === 0 ? null : 'disruption'),
} satisfies Record<string, Binding>;

/** #9 airlines (AirlineEvent names from INTEGRATION_REVIEW §5 step 8 + task brief). */
export const AIRLINE_BINDINGS = {
  contract_offer: 'contract_offer',
  contract_signed: 'cash_in',
  contract_expired: 'disruption',
  contract_terminated: 'rating_down',
  satisfaction_changed: (e) => (typeof e.delta === 'number' && e.delta < 0 ? 'rating_down' : 'rating_up'),
  rating_up: 'rating_up',
  rating_down: 'rating_down',
} satisfies Record<string, Binding>;

/** #7 features: notifications, ratings signals, undo, reports, events/weather, research. */
export const FEATURE_BINDINGS = {
  notification: (e) => {
    switch (e.kind) {
      case 'report': return 'report_ready';
      case 'event': return 'disruption';
      case 'rating': return 'rating_down';
      case 'contract': return 'contract_offer';
      default: return 'boarding_call'; // 'info'
    }
  },
  report: 'report_ready',
  report_ready: 'report_ready',
  disruption: 'disruption',
  event: 'disruption',
  weather_change: (e) => (e.weather === 'thunderstorm' || e.weather === 'heavyRain' || e.weather === 'snow' ? 'disruption' : null),
  threat: 'rating_down',
  slotRequest: 'rating_up',
  undo: 'undo',
  redo: 'redo',
  save: 'cash_in',
  research_complete: 'research_complete',
  low_cash: 'low_cash',
} satisfies Record<string, Binding>;

export type BindingSource = 'logistics' | 'cargo' | 'airlines' | 'features';
export const BINDINGS: Record<BindingSource, Record<string, Binding>> = {
  logistics: LOGISTICS_BINDINGS, cargo: CARGO_BINDINGS, airlines: AIRLINE_BINDINGS, features: FEATURE_BINDINGS,
};

/**
 * Name drift: older / alternate names → the canonical engine event (with any
 * implied fields). Lets either spelling reach the right sound.
 */
export const EVENT_ALIASES: Record<string, { type: string; fields?: Record<string, unknown> }> = {
  repair_dispatch: { type: 'crew_dispatched', fields: { job: 'repair' } },
  tow_dispatch: { type: 'crew_dispatched', fields: { job: 'tow' } },
  safety_alarm: { type: 'safety_incident' },
  tanker_arrive: { type: 'delivery_arrived' },
  fuel_delivery_arrived: { type: 'delivery_arrived' },
  stock_low: { type: 'low_stock' },
  turnaround_done: { type: 'turnaround_complete' },
  contract_offered: { type: 'contract_offer' },
  contract_accepted: { type: 'contract_signed' },
  contract_cancelled: { type: 'contract_terminated' },
  contract_canceled: { type: 'contract_terminated' },
  airline_rating_up: { type: 'rating_up' },
  airline_rating_down: { type: 'rating_down' },
};

const lookup = (source: BindingSource | undefined, type: string): Binding | undefined => {
  const tables = source ? [BINDINGS[source]] : Object.values(BINDINGS);
  for (const t of tables) if (Object.prototype.hasOwnProperty.call(t, type)) return t[type];
  return undefined;
};

/** Resolve an engine event to a sound event name (or null if silent/unknown). */
export function soundForEvent(e: BindableEvent, source?: BindingSource): SoundEventName | null {
  let ev = e;
  let b = lookup(source, ev.type);
  if (b === undefined && Object.prototype.hasOwnProperty.call(EVENT_ALIASES, ev.type)) {
    const a = EVENT_ALIASES[ev.type];
    ev = { ...a.fields, ...e, type: a.type };
    b = lookup(source, ev.type);
  }
  if (b === undefined) {
    // Already a sound event name (e.g. adapter SoundCue) → pass through.
    return Object.prototype.hasOwnProperty.call(EVENT_SOUNDS, e.type) ? (e.type as SoundEventName) : null;
  }
  return typeof b === 'function' ? b(ev) : b;
}

/** Resolve straight to the EVENT_SOUNDS action. */
export function actionForEvent(e: BindableEvent, source?: BindingSource): EventAction | null {
  const n = soundForEvent(e, source);
  return n ? EVENT_SOUNDS[n] : null;
}
