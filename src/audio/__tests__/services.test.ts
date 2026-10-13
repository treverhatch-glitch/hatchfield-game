import { describe, it, expect } from 'vitest';
import {
  AudioEngine, SFX_IDS, SFX_GROUPS, SFX_VARIANTS, sfxParams, sfxDuration, sfxCategory, sfxLooping, isSfxId, crowdIntensity,
  EVENT_SOUNDS, SOUND_EVENT_NAMES, LOGISTICS_CUES, eventAction, CATEGORIES, wrapVariant, type SfxId,
} from '../index';
import { MockAudioContext } from './mockAudio';

const make = () => {
  const ctx = new MockAudioContext();
  const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, visibility: null, minRetriggerSec: 0, maxOneShotsPerId: 1000 });
  return { ctx, engine };
};

describe('system sound catalogue', () => {
  it('has every requested sound, grouped, with no strays', () => {
    const grouped = Object.values(SFX_GROUPS).flat();
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...SFX_IDS].sort());
    expect(SFX_GROUPS.serviceVehicles.length).toBe(12);
    expect(SFX_GROUPS.maintenance.length).toBe(6);
    expect(SFX_GROUPS.construction.length).toBe(5);
    expect(SFX_GROUPS.terminal.length).toBe(4);
    expect(SFX_GROUPS.ui.length).toBe(11);
    expect(SFX_IDS.length).toBe(38);
    for (const id of SFX_IDS) expect(CATEGORIES).toContain(sfxCategory(id));
    for (const id of SFX_GROUPS.ui) { expect(sfxCategory(id)).toBe('ui'); expect(sfxLooping(id)).toBe(false); }
    expect(isSfxId('gpuHum')).toBe(true); expect(isSfxId('toString')).toBe(false);
  });
  it('every sound has 5 distinct variants', () => {
    expect(SFX_VARIANTS).toBe(5);
    for (const id of SFX_IDS) {
      const sigs = new Set(Array.from({ length: 5 }, (_, v) => JSON.stringify(sfxParams(id, v).layers)));
      expect(sigs.size, id).toBe(5);
    }
  });
  it('is deterministic per seed and changes with seed', () => {
    for (const id of SFX_IDS) {
      expect(sfxParams(id, 3, 42)).toEqual(sfxParams(id, 3, 42));
      expect(sfxParams(id, 3, 42).layers).not.toEqual(sfxParams(id, 3, 43).layers);
    }
  });
  it('variants wrap and params stay finite and positive', () => {
    expect(wrapVariant(7)).toBe(2); expect(wrapVariant(-1)).toBe(4); expect(wrapVariant(Number.NaN)).toBe(0);
    for (const id of SFX_IDS) for (let v = 0; v < 5; v++) {
      const p = sfxParams(id, v, 9);
      for (const l of p.layers) for (const [k, n] of Object.entries(l)) {
        if (typeof n === 'number') { expect(Number.isFinite(n), `${id}/${k}`).toBe(true); expect(n).toBeGreaterThanOrEqual(0); }
      }
      const d = sfxDuration(p);
      if (p.looping) expect(d).toBe(Infinity); else { expect(d).toBeGreaterThan(0.05); expect(d).toBeLessThan(5); }
    }
  });
  it('heavy kit sounds bigger than light kit', () => {
    const base = (id: SfxId) => sfxParams(id, 0).layers[0];
    const hz = (id: SfxId) => { const l = base(id); return 'hz' in l ? l.hz : 0; };
    expect(hz('heavyFuelTruck')).toBeLessThan(hz('repairVan'));
    expect(hz('towbarlessTug')).toBeLessThan(hz('baggageTugCart'));
  });
  it('rating up rises and rating down falls; undo/redo mirror', () => {
    const pitches = (id: SfxId) => sfxParams(id, 0).layers.flatMap((l) => (l.k === 'tone' ? [l.hz] : []));
    const up = pitches('airlineRatingUp'), down = pitches('airlineRatingDown');
    expect(up[up.length - 1]).toBeGreaterThan(up[0]); expect(down[down.length - 1]).toBeLessThan(down[0]);
    const u = sfxParams('undo', 0).layers[0], r = sfxParams('redo', 0).layers[0];
    if (u.k !== 'tone' || r.k !== 'tone') throw new Error('expected tones');
    expect(u.hzEnd).toBeLessThan(u.hz); expect(r.hzEnd).toBeGreaterThan(r.hz);
  });
});

describe('crowd density', () => {
  it('is silent when empty, monotonic, and capped', () => {
    expect(crowdIntensity(0)).toBe(0); expect(crowdIntensity(-1)).toBe(0); expect(crowdIntensity(Number.NaN)).toBe(0);
    let prev = 0;
    for (let o = 0.05; o <= 1.5; o += 0.05) { const v = crowdIntensity(o); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    expect(crowdIntensity(5)).toBe(1);
    expect(crowdIntensity(0.5)).toBeGreaterThan(0.5);
  });
  it('murmur loudness follows density', () => {
    const { engine, ctx } = make();
    const h = engine.playSfx('crowdMurmur', { variant: 0 })!;
    const before = ctx.gains.length;
    h.setIntensity(crowdIntensity(0.1));
    const quiet = ctx.gains.slice(0, before).map((g) => g.gain.value);
    h.setIntensity(crowdIntensity(1.2));
    const loud = ctx.gains.slice(0, before).map((g) => g.gain.value);
    expect(loud.reduce((a, b) => a + b, 0)).toBeGreaterThan(quiet.reduce((a, b) => a + b, 0));
    h.stop();
  });
});

describe('engine playback', () => {
  it('plays every sound x variant; one-shots expire, loops persist until stopped', () => {
    const { engine, ctx } = make();
    const loops = [];
    for (const id of SFX_IDS) for (let v = 0; v < 5; v++) {
      const h = engine.playSfx(id, { variant: v, seed: 1, position: { x: 3, y: 0, z: 4 }, intensity: 0.6 })!;
      expect(h.id).toBe(`sfx:${id}`); expect(h.variant).toBe(v); expect(h.looping).toBe(sfxLooping(id));
      if (h.looping) loops.push(h);
    }
    ctx.currentTime = 60;
    expect(engine.activeCount()).toBe(loops.length);
    loops.forEach((h) => h.stop());
    expect(engine.activeCount()).toBe(0);
    expect(ctx.sources.every((s) => s.started)).toBe(true);
  });
  it('random variants stay in range', () => {
    const { engine } = make();
    for (let i = 0; i < 20; i++) { const v = engine.playSfx('cashInTick')!.variant!; expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(5); }
  });
  it('routes sounds through their category buses (UI bypasses weather)', () => {
    const { engine } = make();
    engine.setCategoryVolume('ui', 0);
    expect(engine.effectiveVolume('ui')).toBe(0);
    expect(engine.playSfx('reportReady')).not.toBeNull();
  });
});

describe('event mappings', () => {
  it('covers every logistics adapter SoundCue', () => {
    for (const c of LOGISTICS_CUES) expect(eventAction(c), c).toBeDefined();
  });
  it('every mapping points at real sounds; starts are loops, onces are one-shots or loops', () => {
    for (const n of SOUND_EVENT_NAMES) {
      const a = EVENT_SOUNDS[n];
      if (a.kind === 'stop') { expect(a.stops.length).toBeGreaterThan(0); a.stops.forEach((s) => { expect(isSfxId(s)).toBe(true); expect(sfxLooping(s), `${n}->${s}`).toBe(true); }); }
      else { expect(isSfxId(a.sound)).toBe(true); if (a.kind === 'start') expect(sfxLooping(a.sound), n).toBe(true); else expect(sfxLooping(a.sound), n).toBe(false); }
    }
    // every started loop has some event that stops it
    const stopped = new Set(SOUND_EVENT_NAMES.flatMap((n) => { const a = EVENT_SOUNDS[n]; return a.kind === 'stop' ? a.stops : []; }));
    for (const n of SOUND_EVENT_NAMES) { const a = EVENT_SOUNDS[n]; if (a.kind === 'start') expect(stopped.has(a.sound), `${n} never stopped`).toBe(true); }
    expect(eventAction('nope')).toBeUndefined(); expect(eventAction('constructor')).toBeUndefined();
  });
  it('requested UI hooks are mapped', () => {
    for (const n of ['report_ready', 'disruption', 'rating_up', 'rating_down', 'contract_offer', 'undo', 'redo', 'cash_in', 'cost_charged', 'low_cash', 'research_complete']) expect(eventAction(n), n).toBeDefined();
  });
  it('start/stop pair per key; repeats do not stack', () => {
    const { engine } = make();
    const a = engine.playEvent('refuel_start', { key: 'S1' })!;
    expect(engine.playEvent('refuel_start', { key: 'S1', position: { x: 1, y: 0, z: 0 } })).toBe(a);
    const b = engine.playEvent('refuel_start', { key: 'S2' })!;
    expect(b).not.toBe(a);
    expect(engine.eventLoopCount()).toBe(2);
    expect(engine.playEvent('refuel_stop', { key: 'S1' })).toBeNull();
    expect(a.stopped).toBe(true); expect(b.stopped).toBe(false);
    engine.playEvent('hydrant_disconnect', { key: 'S2' });
    expect(b.stopped).toBe(true);
    expect(engine.eventLoopCount()).toBe(0);
    expect(engine.activeCount()).toBe(0);
  });
  it('one-shot events fire, unknown events are ignored', () => {
    const { engine } = make();
    const h = engine.playEvent('vehicle_breakdown', { variant: 2, seed: 5 })!;
    expect(h.id).toBe('sfx:breakdownClunk'); expect(h.variant).toBe(2);
    expect(engine.playEvent('not_a_thing')).toBeNull();
    for (const n of SOUND_EVENT_NAMES) engine.playEvent(n, { key: 'k' });
    engine.stopAll();
    expect(engine.eventLoopCount()).toBe(0);
  });
});
