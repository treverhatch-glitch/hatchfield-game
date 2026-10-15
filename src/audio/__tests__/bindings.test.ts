import { describe, it, expect } from 'vitest';
import { EVENT_SOUNDS } from '../events';
import {
  BINDINGS, LOGISTICS_BINDINGS, CARGO_BINDINGS, AIRLINE_BINDINGS, FEATURE_BINDINGS,
  EVENT_ALIASES, soundForEvent, actionForEvent, type BindableEvent, type BindingSource,
} from '../bindings';

// Every event type each module emits (mirrors the unions in PRs #5, #10, #9, #7).
const KNOWN: Record<BindingSource, string[]> = {
  logistics: ['truck_arrive', 'refuel_start', 'refuel_stop', 'service_start', 'service_done', 'pax_deplaned',
    'bags_to_claim', 'cargo_to_area', 'gate_closed', 'pax_offloaded', 'bags_left_behind', 'low_stock',
    'delivery_ordered', 'delivery_arrived', 'turnaround_complete', 'money', 'vehicle_breakdown', 'vehicle_repaired',
    'vehicle_serviced', 'crew_dispatched', 'tow_start', 'facility_status', 'facility_repaired', 'runway_fod',
    'runway_closed', 'runway_reopened', 'safety_incident', 'pax_mood_hit'],
  cargo: ['money', 'truck_status', 'contract_status', 'import_status', 'flow', 'bottlenecks'],
  airlines: ['contract_offer', 'contract_signed', 'contract_expired', 'contract_terminated', 'satisfaction_changed', 'rating_up', 'rating_down'],
  features: ['notification', 'report', 'report_ready', 'disruption', 'event', 'weather_change', 'threat', 'slotRequest',
    'undo', 'redo', 'save', 'research_complete', 'low_cash'],
  catering: ['catering_phase', 'catering_done', 'catering_late', 'supply_phase', 'shop_restocked', 'shop_sale',
    'shop_out_of_stock', 'pax_walk_away', 'low_stock'],
  contracts: ['season_scheduled', 'slot_moved', 'slot_flagged', 'slot_cancelled', 'stand_pinned', 'stands_swapped',
    'ledger', 'week_audit', 'lawsuit'],
  crowd: ['queue_forming', 'queue_cleared', 'door_jam', 'door_clear', 'gridlock', 'gridlock_cleared', 'day_stats'],
  diplomacy: ['letter', 'standing_band', 'cold_warning', 'capacity_cut', 'capacity_restored', 'exit_notice', 'exit',
    'exit_rescued', 'demand_issued', 'demand_met', 'demand_timeout', 'promise_kept', 'promise_broken', 'spat',
    'spat_resolved', 'rival_offer', 'poached', 'hostile_action', 'lawsuit_verdict', 'succession', 'tier_unlocked',
    'era_reset', 'newcomer', 'slot_pool', 'slot_series_reverted', 'contract_signed', 'contract_renewed',
    'contract_cancelled', 'hub_granted', 'hub_revoked', 'base_granted', 'alliance', 'perks_changed', 'info'],
};

// Representative non-silent payload per event.
const SAMPLE: Record<string, Record<string, unknown>> = {
  facility_status: { status: 'failed' }, truck_status: { status: 'inbound' }, bottlenecks: { bottlenecks: [{}] }, weather_change: { weather: 'thunderstorm' }, slot_flagged: { flag: 'over_capacity' }, day_stats: { missed: 2 },
};

const SERVICES = ['deplane', 'bag_unload', 'cargo_unload', 'loader', 'fuel', 'catering', 'cleaning', 'gpu', 'boarding',
  'bag_load', 'cargo_load', 'bag_offload', 'door_close', 'pushback'];

describe('audio bindings', () => {
  it('has a binding for every known event, and nothing unknown', () => {
    for (const src of Object.keys(KNOWN) as BindingSource[]) {
      expect(Object.keys(BINDINGS[src]).sort()).toEqual([...KNOWN[src]].sort());
    }
  });

  it('every known event maps to a real sound', () => {
    for (const src of Object.keys(KNOWN) as BindingSource[]) for (const type of KNOWN[src]) {
      const e: BindableEvent = { type, time: 0, ...SAMPLE[type] };
      const n = soundForEvent(e, src);
      expect(n, `${src}:${type}`).not.toBeNull();
      expect(EVENT_SOUNDS).toHaveProperty(n as string);
      expect(actionForEvent(e, src)).toEqual(EVENT_SOUNDS[n!]);
    }
  });

  it('every field variant resolves to a sound', () => {
    const variants: [BindingSource, BindableEvent][] = [
      ...SERVICES.flatMap((service) => (['service_start', 'service_done'] as const).map((type): [BindingSource, BindableEvent] => ['logistics', { type, service }])),
      ...['repair', 'tow', 'facility', 'inspect'].map((job): [BindingSource, BindableEvent] => ['logistics', { type: 'crew_dispatched', job }]),
      ...['truck', 'hydrant'].flatMap((method) => ['refuel_start', 'refuel_stop'].map((type): [BindingSource, BindableEvent] => ['logistics', { type, method }])),
      ...['worn', 'failed'].map((status): [BindingSource, BindableEvent] => ['logistics', { type: 'facility_status', status }]),
      ...['inbound', 'unloading', 'loading', 'departed'].map((status): [BindingSource, BindableEvent] => ['cargo', { type: 'truck_status', status }]),
      ...['active', 'fulfilled', 'failed'].map((status): [BindingSource, BindableEvent] => ['cargo', { type: 'contract_status', status }]),
      ...['processing', 'awaiting_truck', 'collected'].map((status): [BindingSource, BindableEvent] => ['cargo', { type: 'import_status', status }]),
      ...['in', 'out'].map((direction): [BindingSource, BindableEvent] => ['cargo', { type: 'flow', direction }]),
      ...['report', 'event', 'rating', 'contract', 'info'].map((kind): [BindingSource, BindableEvent] => ['features', { type: 'notification', kind }]),
    ];
    for (const [src, e] of variants) {
      const n = soundForEvent(e, src);
      expect(n, JSON.stringify(e)).not.toBeNull();
      expect(EVENT_SOUNDS).toHaveProperty(n as string);
    }
  });

  it('discriminates on fields', () => {
    expect(soundForEvent({ type: 'crew_dispatched', job: 'repair' })).toBe('repair_dispatch');
    expect(soundForEvent({ type: 'crew_dispatched', job: 'tow' })).toBe('tow_start');
    expect(soundForEvent({ type: 'refuel_start', method: 'hydrant' })).toBe('hydrant_connect');
    expect(soundForEvent({ type: 'money', amount: -5 }, 'cargo')).toBe('cost_charged');
    expect(soundForEvent({ type: 'satisfaction_changed', delta: 3 })).toBe('rating_up');
    expect(soundForEvent({ type: 'turnaround_complete', delayMinutes: 0 })).toBe('cash_in');
  });

  it('only documented sub-states are silent', () => {
    expect(soundForEvent({ type: 'facility_status', status: 'ok' })).toBeNull();
    expect(soundForEvent({ type: 'truck_status', status: 'queued' }, 'cargo')).toBeNull();
    expect(soundForEvent({ type: 'bottlenecks', bottlenecks: [] }, 'cargo')).toBeNull();
    expect(soundForEvent({ type: 'weather_change', weather: 'clear' })).toBeNull();
    expect(soundForEvent({ type: 'definitely_not_an_event' })).toBeNull();
  });

  it('aliases handle name drift', () => {
    expect(soundForEvent({ type: 'repair_dispatch' })).toBe('repair_dispatch');
    expect(soundForEvent({ type: 'safety_alarm' })).toBe('safety_alarm');
    expect(soundForEvent({ type: 'safety_incident' })).toBe('safety_alarm');
    expect(soundForEvent({ type: 'tanker_arrive' })).toBe('tanker_arrive');
    for (const [alias, target] of Object.entries(EVENT_ALIASES)) {
      expect(soundForEvent({ type: alias, ...target.fields }), alias).not.toBeNull();
    }
  });

  it('passes adapter SoundCues straight through', () => {
    expect(soundForEvent({ type: 'sweeper' })).toBe('sweeper');
    expect(soundForEvent({ type: 'crew_siren' })).toBe('crew_siren');
  });

  it('brief-named events are all bound', () => {
    for (const t of ['turnaround_complete', 'crew_dispatched', 'safety_incident', 'low_stock']) expect(LOGISTICS_BINDINGS).toHaveProperty(t);
    for (const t of ['contract_offer', 'contract_signed', 'contract_terminated', 'rating_up', 'rating_down']) expect(AIRLINE_BINDINGS).toHaveProperty(t);
    expect(Object.keys(CARGO_BINDINGS).length).toBeGreaterThan(0);
    expect(Object.keys(FEATURE_BINDINGS).length).toBeGreaterThan(0);
  });
});
