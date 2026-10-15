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
  deice: 'deice_spray_start', hangar: 'hangar_door_open', fire: 'fire_siren_start', bus: 'bus_engine_start',
  fuel_hose: 'fuel_hose_start', cargo_dock: 'cargo_dock_door', tug: 'tug_engine_start',
  catering_hydraulics: 'catering_hydraulics_start',
};
const SERVICE_DONE: Record<string, SoundEventName> = {
  deplane: 'bus_doors', bag_unload: 'belt_loader_stop', cargo_unload: 'uld_loader_stop',
  loader: 'uld_loader_stop', fuel: 'fuel_truck_stop', catering: 'catering_lift_stop',
  cleaning: 'bus_doors', gpu: 'gpu_disconnect', boarding: 'boarding_call', bag_load: 'belt_loader_stop',
  cargo_load: 'uld_loader_stop', bag_offload: 'bag_tug_stop', door_close: 'bus_doors', pushback: 'pushback_complete',
  deice: 'deice_spray_stop', hangar: 'hangar_door_close', fire: 'fire_siren_stop', bus: 'bus_engine_stop',
  fuel_hose: 'fuel_hose_stop', cargo_dock: 'cargo_dock_door', tug: 'tug_engine_stop',
  catering_hydraulics: 'catering_hydraulics_stop',
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
      default: return null; // 'queued' is not a reverse. The apron mixer beeps only while a vehicle is reversing.
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

/** #15 catering. Keys are exactly `CateringEvent['type']` (src/catering/types.ts). Loops keyed by truckId / runnerId. */
const CATERING_PHASE: Record<string, SoundEventName> = {
  loading_at_kitchen: 'catering_cart_latch', driving_to_stand: 'delivery_start', parking: 'delivery_arrived',
  crew_exit: 'crew_door', lift_raise: 'catering_lift_start', carts_out: 'catering_cart_latch', carts_in: 'catering_cart_latch',
  lift_lower: 'catering_lift_stop', crew_board: 'crew_door', driving_to_kitchen: 'delivery_start', unloading_at_kitchen: 'delivery_arrived',
};
const SUPPLY_PHASE: Record<string, SoundEventName> = {
  loading_at_depot: 'catering_cart_latch', driving_to_dock: 'delivery_start', security_screening: 'delivery_arrived',
  trolley_to_shop: 'catering_cart_roll_start', shelving: 'catering_cart_roll_stop', returning: 'catering_cart_latch',
};
export const CATERING_BINDINGS = {
  catering_phase: (e) => CATERING_PHASE[str(e.phase)] ?? 'catering_cart_latch',
  catering_done: (e) => (e.short === true ? 'shop_out_of_stock' : 'catering_cart_latch'),
  catering_late: 'disruption',
  supply_phase: (e) => SUPPLY_PHASE[str(e.phase)] ?? 'catering_cart_latch',
  shop_restocked: 'shop_restock',
  shop_sale: 'shop_sale',
  shop_out_of_stock: 'shop_out_of_stock',
  pax_walk_away: 'rating_down',
  low_stock: 'low_cash',
} satisfies Record<string, Binding>;

/**
 * #19 contracts & scheduling. src/contracts is pure (returns new state, no emitter), so these are the
 * events the host emits around it: autoSchedule/rerun → season_scheduled, dragSlot/pull/bump → slot_moved
 * {ok, zone}, evaluateFlags changes → slot_flagged {flag}, setCancelled → slot_cancelled, pinStand →
 * stand_pinned, swapStands → stands_swapped, each LedgerEntry → ledger {kind}, auditWeek → week_audit
 * {breached} and lawsuit when `lawsuit` is true.
 */
export const CONTRACTS_BINDINGS = {
  season_scheduled: 'season_published',
  slot_moved: (e) => (e.ok === false ? 'slot_rejected' : e.zone === 'hard_band' || e.zone === 'outside' ? 'slot_conflict' : 'slot_moved'),
  slot_flagged: (e) => (e.flag === 'ok' ? null : 'slot_conflict'),
  slot_cancelled: 'cost_charged',
  stand_pinned: 'slot_moved',
  stands_swapped: 'slot_moved',
  ledger: (e) => {
    switch (e.kind) {
      case 'sla_penalty': return 'sla_penalty';
      case 'sla_bonus': return 'sla_bonus';
      case 'early_cancel_fee': return 'cost_charged';
      default: return 'cash_in'; // contract_revenue
    }
  },
  week_audit: (e) => (e.breached === true ? 'sla_penalty' : 'report_ready'),
  lawsuit: 'lawsuit',
} satisfies Record<string, Binding>;

/**
 * #18 crowd. The crowd sim exposes state (AgentState, DayStats), not events; the host emits these on
 * transitions. Loops keyed by queue / door id.
 */
export const CROWD_BINDINGS = {
  queue_forming: 'queue_grumble_start',
  queue_cleared: 'queue_grumble_stop',
  door_jam: 'door_jam_start',
  door_clear: 'door_jam_stop',
  gridlock: 'gridlock',
  gridlock_cleared: 'rating_up',
  day_stats: (e) => (typeof e.missed === 'number' && e.missed > 0 ? 'rating_down' : null),
} satisfies Record<string, Binding>;

const bySeverity = (e: BindableEvent): SoundEventName =>
  e.severity === 'good' ? 'standing_up' : e.severity === 'bad' ? 'standing_down' : e.severity === 'warn' ? 'demand_issued' : 'letter';

/** #14 diplomacy. Keys are exactly `DiplomacyEventType` (src/diplomacy/types.ts). */
export const DIPLOMACY_BINDINGS = {
  letter: 'letter', standing_band: bySeverity, cold_warning: 'standing_down', capacity_cut: 'disruption',
  capacity_restored: 'standing_up', exit_notice: 'exit_notice', exit: 'exit_notice', exit_rescued: 'standing_up',
  demand_issued: 'demand_issued', demand_met: 'rating_up', demand_timeout: 'rating_down',
  promise_kept: 'standing_up', promise_broken: 'standing_down', spat: 'spat', spat_resolved: 'standing_up',
  rival_offer: 'demand_issued', poached: 'exit_notice', hostile_action: 'disruption', lawsuit_verdict: 'lawsuit',
  succession: 'letter', tier_unlocked: 'research_complete', era_reset: 'letter', newcomer: 'contract_offer',
  slot_pool: 'letter', slot_series_reverted: 'rating_down', contract_signed: 'cash_in', contract_renewed: 'cash_in',
  contract_cancelled: 'rating_down', hub_granted: 'hub_granted', hub_revoked: 'standing_down', base_granted: 'hub_granted',
  alliance: 'alliance', perks_changed: bySeverity, info: 'letter',
} satisfies Record<string, Binding>;

export type BindingSource = 'logistics' | 'cargo' | 'airlines' | 'features' | 'catering' | 'contracts' | 'crowd' | 'diplomacy';
export const BINDINGS: Record<BindingSource, Record<string, Binding>> = {
  logistics: LOGISTICS_BINDINGS, cargo: CARGO_BINDINGS, airlines: AIRLINE_BINDINGS, features: FEATURE_BINDINGS,
  catering: CATERING_BINDINGS, contracts: CONTRACTS_BINDINGS, crowd: CROWD_BINDINGS, diplomacy: DIPLOMACY_BINDINGS,
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
  // catering / contracts / crowd / diplomacy drift
  restock: { type: 'shop_restocked' },
  stockout: { type: 'shop_out_of_stock' },
  out_of_stock: { type: 'shop_out_of_stock' },
  sla_breach: { type: 'week_audit', fields: { breached: true } },
  airline_sued: { type: 'lawsuit' },
  schedule_published: { type: 'season_scheduled' },
  flight_dragged: { type: 'slot_moved' },
  queue_jam: { type: 'door_jam' },
  crowd_gridlock: { type: 'gridlock' },
  band_changed: { type: 'standing_band' },
  diplomacy_letter: { type: 'letter' },
  exit_warning: { type: 'exit_notice' },
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
