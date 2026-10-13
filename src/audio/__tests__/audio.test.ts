import { describe, it, expect } from 'vitest';
import { AudioEngine, CATEGORIES, LOOPING, distanceGain, panFor, DEFAULT_ROLLOFF, SOUND_CATEGORY, type SoundId } from '../index';
import { MockAudioContext, MockVisibility } from './mockAudio';

function make(opts: { vis?: MockVisibility } = {}) {
  const ctx = new MockAudioContext();
  const vis = opts.vis ?? new MockVisibility();
  const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, visibility: vis, minRetriggerSec: 0 });
  return { ctx, vis, engine };
}

describe('spatial', () => {
  it('full volume inside ref distance, silent past max', () => {
    expect(distanceGain(0)).toBe(1);
    expect(distanceGain(DEFAULT_ROLLOFF.refDistance)).toBe(1);
    expect(distanceGain(DEFAULT_ROLLOFF.maxDistance)).toBe(0);
    expect(distanceGain(NaN)).toBe(0);
  });
  it('monotonically decreases', () => {
    let prev = 1;
    for (let d = 0; d < 2000; d += 50) { const g = distanceGain(d); expect(g).toBeLessThanOrEqual(prev); prev = g; }
  });
  it('pans left/right', () => {
    const o = { x: 0, y: 0, z: 0 }, r = { x: 1, y: 0, z: 0 };
    expect(panFor(o, r, { x: 10, y: 0, z: 0 })).toBeCloseTo(1);
    expect(panFor(o, r, { x: -10, y: 0, z: 0 })).toBeCloseTo(-1);
    expect(panFor(o, r, { x: 0, y: 0, z: 10 })).toBeCloseTo(0);
  });
});

describe('AudioEngine', () => {
  it('is lazy: no context until unlock/play', () => {
    const { engine } = make();
    expect(engine.context).toBeNull();
    engine.unlock();
    expect(engine.context).not.toBeNull();
  });
  it('clamps master and category volumes', () => {
    const { engine } = make();
    engine.setMasterVolume(2); expect(engine.getMasterVolume()).toBe(1);
    engine.setMasterVolume(-1); expect(engine.getMasterVolume()).toBe(0);
    engine.setMasterVolume(0.5); engine.setCategoryVolume('ui', 0.5);
    expect(engine.effectiveVolume('ui')).toBeCloseTo(0.25);
  });
  it('mute zeroes master gain and restores it', () => {
    const { engine, ctx } = make();
    engine.unlock(); engine.setMasterVolume(0.7);
    const master = ctx.gains[0];
    engine.setMuted(true);
    expect(master.gain.value).toBe(0); expect(engine.effectiveVolume('sfx')).toBe(0);
    expect(engine.toggleMute()).toBe(false);
    expect(master.gain.value).toBeCloseTo(0.7);
  });
  it('plays every sound without throwing', () => {
    const { engine } = make();
    for (const id of Object.keys(SOUND_CATEGORY) as SoundId[]) {
      const h = engine.play(id, { position: { x: 0, y: 0, z: 0 }, intensity: 0.5 });
      expect(h).not.toBeNull();
      h!.stop();
    }
  });
  it('positional gain follows camera distance', () => {
    const { engine, ctx } = make();
    engine.unlock();
    const busCount = ctx.gains.length; // master + one per category
    expect(busCount).toBe(1 + CATEGORIES.length);
    const h = engine.play('jetSpool', { position: { x: 0, y: 0, z: 0 } })!;
    const voiceGain = ctx.gains[busCount];
    const vg = voiceGain;
    expect(vg.gain.value).toBeCloseTo(1);
    engine.setListener({ x: 500, y: 0, z: 0 });
    expect(vg.gain.value).toBeCloseTo(distanceGain(500));
    engine.setListener({ x: 5000, y: 0, z: 0 });
    expect(vg.gain.value).toBe(0);
    h.setVolume(0.5); engine.setListener({ x: 0, y: 0, z: 0 });
    expect(vg.gain.value).toBeCloseTo(0.5);
    expect(voiceGain).toBeDefined();
  });
  it('stereo pan updates with listener', () => {
    const { engine, ctx } = make();
    engine.play('turboprop', { position: { x: 100, y: 0, z: 0 } });
    expect(ctx.panners[0].pan.value).toBeCloseTo(1);
  });
  it('tracks loops until stopped; one-shots expire', () => {
    const { engine, ctx } = make();
    const loop = engine.play('crowd')!;
    engine.play('uiClick');
    expect(engine.activeCount()).toBe(2);
    ctx.currentTime = 5;
    expect(engine.activeCount()).toBe(1);
    loop.stop(); expect(loop.stopped).toBe(true);
    expect(engine.activeCount()).toBe(0);
  });
  it('caps one-shot spam per id', () => {
    const { engine } = make();
    const results = Array.from({ length: 10 }, () => engine.play('uiHover'));
    expect(results.filter(Boolean).length).toBe(6);
  });
  it('rate-limits retriggers', () => {
    const ctx = new MockAudioContext();
    const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, visibility: null, minRetriggerSec: 0.1 });
    expect(engine.play('uiClick')).not.toBeNull();
    expect(engine.play('uiClick')).toBeNull();
    ctx.currentTime = 0.2;
    expect(engine.play('uiClick')).not.toBeNull();
  });
  it('suspends on hidden tab and resumes on visible', async () => {
    const { engine, ctx, vis } = make();
    engine.unlock();
    vis.set(true);
    await Promise.resolve();
    expect(ctx.state).toBe('suspended'); expect(engine.isPausedForHiddenTab()).toBe(true);
    vis.set(false);
    await Promise.resolve();
    expect(ctx.state).toBe('running');
  });
  it('stopAll and dispose clean up', () => {
    const { engine, ctx } = make();
    engine.play('taxi'); engine.play('jetSpool');
    engine.stopAll(); expect(engine.activeCount()).toBe(0);
    engine.dispose(); expect(ctx.state).toBe('closed'); expect(engine.context).toBeNull();
  });

  it('new categories have independent volume', () => {
    const { engine } = make();
    engine.setCategoryVolume('vehicles', 0.2); engine.setCategoryVolume('ambience', 0.9);
    expect(engine.effectiveVolume('vehicles')).toBeCloseTo(0.2);
    expect(engine.effectiveVolume('ambience')).toBeCloseTo(0.9);
  });
  it('every sound id has a category and loop flag', () => {
    for (const id of Object.keys(SOUND_CATEGORY) as SoundId[]) {
      expect(CATEGORIES).toContain(SOUND_CATEGORY[id]);
      expect(typeof LOOPING[id]).toBe('boolean');
    }
    expect(Object.keys(SOUND_CATEGORY).length).toBe(40);
  });
  it('extended loops stay alive until stopped and accept intensity', () => {
    const { engine, ctx } = make();
    const ids: SoundId[] = ['truckIdle', 'truckDrive', 'reverseBeeper', 'fuelPump', 'baggageTug', 'beltLoader', 'jetBridge', 'gpuHum', 'pushbackTug', 'suitcaseRoll', 'drill', 'craneBeep', 'rain', 'wind', 'birds', 'dayNight'];
    const hs = ids.map((id) => { expect(LOOPING[id]).toBe(true); return engine.play(id, { position: { x: 10, y: 0, z: 0 } })!; });
    hs.forEach((h) => h.setIntensity(0.9));
    ctx.currentTime = 60;
    expect(engine.activeCount()).toBe(ids.length);
    hs.forEach((h) => h.stop());
    expect(engine.activeCount()).toBe(0);
  });
  it('extended one-shots expire on their own', () => {
    const { engine, ctx } = make();
    const ids: SoundId[] = ['airBrake', 'cateringLift', 'radioChatter', 'paChime', 'securityBeep', 'metalDetector', 'hammer', 'expense', 'mailNotify', 'contractFanfare', 'warning', 'errorBuzz', 'levelUp'];
    ids.forEach((id) => { expect(LOOPING[id]).toBe(false); expect(engine.play(id)).not.toBeNull(); });
    expect(engine.activeCount()).toBe(ids.length);
    ctx.currentTime = 10;
    expect(engine.activeCount()).toBe(0);
  });
  it('dayNight intensity crossfades day and night beds', () => {
    const { engine, ctx } = make();
    engine.unlock();
    const before = ctx.gains.length;
    const h = engine.play('dayNight')!;
    // gains created: voice, master(loop), day, am, tg, night
    const day = ctx.gains[before + 2], night = ctx.gains[before + 5];
    h.setIntensity(1);
    expect(day.gain.value).toBeGreaterThan(night.gain.value);
    h.setIntensity(0);
    expect(night.gain.value).toBeGreaterThan(day.gain.value);
  });
  it('vehicle voices obey the same per-id one-shot cap', () => {
    const { engine } = make();
    expect(Array.from({ length: 9 }, () => engine.play('airBrake')).filter(Boolean).length).toBe(6);
  });
});
