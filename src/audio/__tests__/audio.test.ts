import { describe, it, expect } from 'vitest';
import { AudioEngine, distanceGain, panFor, DEFAULT_ROLLOFF, SOUND_CATEGORY, type SoundId } from '../index';
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
    const h = engine.play('jetSpool', { position: { x: 0, y: 0, z: 0 } })!;
    const voiceGain = ctx.gains[ctx.gains.length - 1 - 0];
    // find the per-voice gain: the first gain created after the 5 bus gains
    const vg = ctx.gains[5];
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
});
