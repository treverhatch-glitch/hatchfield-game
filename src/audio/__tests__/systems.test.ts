import { describe, it, expect } from 'vitest';
import {
  AudioEngine, EVENT_SOUNDS, soundForEvent, eventAction, SFX_GROUPS, sfxCategory, sfxLooping, sfxParams,
  AmbienceMixer, ambienceTargets, AMBIENCE_LAYERS, AMBIENCE_LAYER_IDS, countIntensity, paIntervalSec, PA_SOUND,
  type BindableEvent, type BindingSource, type SfxId,
} from '../index';
import { MockAudioContext } from './mockAudio';

const make = () => {
  const ctx = new MockAudioContext();
  const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, visibility: null, minRetriggerSec: 0, maxOneShotsPerId: 1000 });
  return { ctx, engine };
};
const ev = (src: BindingSource, type: string, f: Record<string, unknown> = {}) => soundForEvent({ type, ...f } as BindableEvent, src);

const CATERING_PHASES = ['loading_at_kitchen', 'driving_to_stand', 'parking', 'crew_exit', 'lift_raise', 'carts_out', 'carts_in', 'lift_lower', 'crew_board', 'driving_to_kitchen', 'unloading_at_kitchen'];
const SUPPLY_PHASES = ['loading_at_depot', 'driving_to_dock', 'security_screening', 'trolley_to_shop', 'shelving', 'returning'];

describe('catering bindings (PR #15)', () => {
  it('every catering and supply phase resolves to a real sound', () => {
    for (const phase of CATERING_PHASES) expect(EVENT_SOUNDS).toHaveProperty(ev('catering', 'catering_phase', { phase })!);
    for (const phase of SUPPLY_PHASES) expect(EVENT_SOUNDS).toHaveProperty(ev('catering', 'supply_phase', { phase })!);
  });
  it('the truck run plays the whole process: drive, park, crew out, lift up, carts, lift down', () => {
    const seq = CATERING_PHASES.map((phase) => ev('catering', 'catering_phase', { phase }));
    expect(seq).toEqual(['catering_cart_latch', 'delivery_start', 'delivery_arrived', 'crew_door', 'catering_lift_start',
      'catering_cart_latch', 'catering_cart_latch', 'catering_lift_stop', 'crew_door', 'delivery_start', 'delivery_arrived']);
  });
  it('every loop started in a run is stopped later in the same run (keyed by truck)', () => {
    const { engine } = make(); engine.unlock();
    for (const phase of CATERING_PHASES) engine.playEvent(ev('catering', 'catering_phase', { phase })!, { key: 'cat1' });
    for (const phase of SUPPLY_PHASES) engine.playEvent(ev('catering', 'supply_phase', { phase })!, { key: 'run1' });
    expect(engine.eventLoopCount()).toBe(0);
  });
  it('shop events', () => {
    expect(ev('catering', 'shop_sale')).toBe('shop_sale');
    expect(ev('catering', 'shop_out_of_stock')).toBe('shop_out_of_stock');
    expect(ev('catering', 'catering_done', { short: true })).toBe('shop_out_of_stock');
    expect(ev('catering', 'catering_done', { short: false })).toBe('catering_cart_latch');
    expect(soundForEvent({ type: 'stockout' })).toBe('shop_out_of_stock');
  });
});

describe('contracts bindings (PR #19)', () => {
  it('drag zones and failures', () => {
    expect(ev('contracts', 'slot_moved', { ok: true, zone: 'window' })).toBe('slot_moved');
    expect(ev('contracts', 'slot_moved', { ok: true, zone: 'hard_band' })).toBe('slot_conflict');
    expect(ev('contracts', 'slot_moved', { ok: false })).toBe('slot_rejected');
    expect(ev('contracts', 'slot_flagged', { flag: 'ok' })).toBeNull();
    expect(ev('contracts', 'slot_flagged', { flag: 'off_window' })).toBe('slot_conflict');
  });
  it('every ledger kind', () => {
    expect(ev('contracts', 'ledger', { kind: 'contract_revenue' })).toBe('cash_in');
    expect(ev('contracts', 'ledger', { kind: 'sla_penalty' })).toBe('sla_penalty');
    expect(ev('contracts', 'ledger', { kind: 'sla_bonus' })).toBe('sla_bonus');
    expect(ev('contracts', 'ledger', { kind: 'early_cancel_fee' })).toBe('cost_charged');
    expect(ev('contracts', 'week_audit', { breached: true })).toBe('sla_penalty');
    expect(soundForEvent({ type: 'airline_sued' })).toBe('lawsuit');
  });
});

describe('crowd bindings (PR #18)', () => {
  it('queue and door loops start and stop per key', () => {
    const { engine } = make(); engine.unlock();
    engine.playEvent(ev('crowd', 'queue_forming')!, { key: 'sec' });
    engine.playEvent(ev('crowd', 'door_jam')!, { key: 'd1' });
    expect(engine.eventLoopCount()).toBe(2);
    engine.playEvent(ev('crowd', 'queue_cleared')!, { key: 'sec' });
    engine.playEvent(ev('crowd', 'door_clear')!, { key: 'd1' });
    expect(engine.eventLoopCount()).toBe(0);
    expect(ev('crowd', 'day_stats', { missed: 0 })).toBeNull();
  });
});

describe('diplomacy bindings (PR #14)', () => {
  it('severity-driven events follow severity', () => {
    expect(ev('diplomacy', 'standing_band', { severity: 'good' })).toBe('standing_up');
    expect(ev('diplomacy', 'standing_band', { severity: 'bad' })).toBe('standing_down');
    expect(ev('diplomacy', 'perks_changed', { severity: 'warn' })).toBe('demand_issued');
    expect(ev('diplomacy', 'perks_changed', { severity: 'info' })).toBe('letter');
  });
  it('drama beats get their own cues', () => {
    expect(ev('diplomacy', 'exit_notice')).toBe('exit_notice');
    expect(ev('diplomacy', 'hub_granted')).toBe('hub_granted');
    expect(ev('diplomacy', 'spat')).toBe('spat');
    expect(ev('diplomacy', 'lawsuit_verdict')).toBe('lawsuit');
    expect(ev('diplomacy', 'contract_signed')).toBe('cash_in');
  });
});

describe('new sound categories', () => {
  it('ui cues are one-shots, ambience beds are loops', () => {
    for (const id of [...SFX_GROUPS.contracts.filter((i) => i !== 'lawsuitGavel'), ...SFX_GROUPS.diplomacy]) expect(sfxCategory(id), id).toBe('ui');
    for (const id of SFX_GROUPS.apronAmbience) { expect(sfxLooping(id)).toBe(true); expect(sfxCategory(id)).toBe('ambience'); }
    for (const id of ['checkinChatter', 'securityBeeps', 'queueGrumble', 'cateringCartRoll'] as SfxId[]) expect(sfxLooping(id)).toBe(true);
    expect(sfxLooping('paAnnouncement')).toBe(false);
    expect(sfxParams('paAnnouncement', 0).layers.length).toBeGreaterThan(10);
  });
  it('every new event name points at a real action', () => {
    for (const n of ['shop_sale', 'lawsuit', 'gridlock', 'letter', 'pa_announcement', 'apu_start', 'apu_stop']) expect(eventAction(n), n).toBeDefined();
  });
});

describe('ambience layers', () => {
  it('maps all 7 layers to looping sounds', () => {
    expect(AMBIENCE_LAYER_IDS.length).toBe(7);
    for (const id of AMBIENCE_LAYER_IDS) expect(sfxLooping(AMBIENCE_LAYERS[id].sound)).toBe(true);
    expect(sfxLooping(PA_SOUND)).toBe(false);
  });
  it('empty airport is silent; activity raises the right layers', () => {
    const z = ambienceTargets({});
    for (const id of AMBIENCE_LAYER_IDS) expect(z[id]).toBe(0);
    const t = ambienceTargets({ checkinOccupancy: 0.8, securityLanesOpen: 2, securityThroughputPerMin: 10, apusRunning: 3, fuelPumpsRunning: 1 });
    expect(t.checkinChatter).toBeGreaterThan(0.3); expect(t.securityBeeps).toBeGreaterThan(0.3);
    expect(t.apuHum).toBeGreaterThan(0); expect(t.fuelPump).toBeGreaterThan(0);
    expect(t.gpu).toBe(0); expect(t.beltLoader).toBe(0);
  });
  it('outdoor mix crossfades terminal vs apron', () => {
    const s = { checkinOccupancy: 1, apusRunning: 4 };
    const inside = ambienceTargets({ ...s, outdoorMix: 0 }), outside = ambienceTargets({ ...s, outdoorMix: 1 });
    expect(inside.checkinChatter).toBeGreaterThan(outside.checkinChatter);
    expect(outside.apuHum).toBeGreaterThan(inside.apuHum);
  });
  it('source counts saturate and stay in range', () => {
    expect(countIntensity(0)).toBe(0);
    expect(countIntensity(1)).toBeLessThan(countIntensity(4));
    expect(countIntensity(100)).toBe(1);
    expect(paIntervalSec(1)).toBeLessThan(paIntervalSec(0.05));
  });
  it('mixer starts, updates and stops loops, and schedules PA calls', () => {
    const { engine } = make(); engine.unlock();
    const played: string[] = [];
    const sink = { playSfx: (id: SfxId, o?: object) => { played.push(id); return engine.playSfx(id, o); } };
    const m = new AmbienceMixer(sink, () => 0);
    m.update({ checkinOccupancy: 1, gpusConnected: 2 }, 0.1);
    expect(m.activeLayers().sort()).toEqual(['checkinChatter', 'gpu']);
    m.update({ checkinOccupancy: 1, gpusConnected: 2 }, 0.1);
    expect(played.filter((p) => p === 'apronGpu').length).toBe(1); // no restacking
    m.update({ checkinOccupancy: 1 }, 200);
    expect(m.activeLayers()).toEqual(['checkinChatter']);
    expect(played).toContain('paAnnouncement');
    m.stopAll();
    expect(m.activeLayers()).toEqual([]);
  });
});
