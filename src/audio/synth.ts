/**
 * Procedural sound recipes. Each builds a node graph into `out` and returns
 * an optional updater (for loops) plus a stop function. No asset files.
 */
export type SoundId =
  | 'jetSpool' | 'jetTakeoff' | 'turboprop' | 'touchdown' | 'taxi' | 'crowd'
  | 'uiHover' | 'uiClick' | 'buildThunk' | 'cashRegister' | 'chime';

export type Category = 'aircraft' | 'ambient' | 'ui' | 'sfx';

export const SOUND_CATEGORY: Record<SoundId, Category> = {
  jetSpool: 'aircraft', jetTakeoff: 'aircraft', turboprop: 'aircraft', touchdown: 'aircraft', taxi: 'aircraft',
  crowd: 'ambient', uiHover: 'ui', uiClick: 'ui', buildThunk: 'sfx', cashRegister: 'sfx', chime: 'ui',
};

export const LOOPING: Record<SoundId, boolean> = {
  jetSpool: true, jetTakeoff: false, turboprop: true, touchdown: false, taxi: true, crowd: true,
  uiHover: false, uiClick: false, buildThunk: false, cashRegister: false, chime: false,
};

export interface Voice {
  /** For loops: intensity 0..1 (e.g. throttle). */
  setIntensity(v: number): void;
  stop(fadeSec?: number): void;
  /** Seconds until a one-shot finishes (Infinity for loops). */
  duration: number;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (b) return b;
  const len = Math.floor(ctx.sampleRate * 2);
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    brown = (brown + 0.02 * w) / 1.02;
    d[i] = w * 0.5 + brown * 3.5 * 0.5;
  }
  noiseCache.set(ctx, b);
  return b;
}

function noise(ctx: BaseAudioContext, loop = true): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = loop;
  return s;
}

function env(g: GainNode, t: number, a: number, peak: number, dcy: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}

function tone(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, a: number, peak: number, dcy: number, fEnd?: number): void {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + a + dcy);
  env(g, t, a, peak, dcy);
  o.connect(g).connect(out); o.start(t); o.stop(t + a + dcy + 0.05);
}

function burst(ctx: BaseAudioContext, out: AudioNode, t: number, type: BiquadFilterType, freq: number, q: number, peak: number, dcy: number): void {
  const n = noise(ctx, false); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t, 0.005, peak, dcy);
  n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + dcy + 0.05);
}

function loopVoice(ctx: BaseAudioContext, out: AudioNode, sources: AudioScheduledSourceNode[], master: GainNode, apply: (v: number, t: number) => void, init = 0.5): Voice {
  master.connect(out);
  const t0 = ctx.currentTime;
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(1, t0 + 0.4);
  sources.forEach((s) => s.start(t0));
  apply(init, t0);
  let stopped = false;
  return {
    duration: Infinity,
    setIntensity(v) { if (!stopped) apply(Math.max(0, Math.min(1, v)), ctx.currentTime); },
    stop(fade = 0.5) {
      if (stopped) return; stopped = true;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      sources.forEach((s) => s.stop(t + fade + 0.05));
    },
  };
}

function oneShot(duration: number): Voice {
  return { duration, setIntensity() {}, stop() {} };
}

export function buildSound(ctx: BaseAudioContext, id: SoundId, out: AudioNode): Voice {
  const t = ctx.currentTime;
  switch (id) {
    case 'jetSpool': {
      // Turbine whine (two detuned saws through bandpass) + broadband roar.
      const m = ctx.createGain();
      const w1 = ctx.createOscillator(), w2 = ctx.createOscillator();
      w1.type = 'sawtooth'; w2.type = 'sawtooth';
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 8;
      const wg = ctx.createGain();
      w1.connect(bp); w2.connect(bp); bp.connect(wg).connect(m);
      const n = noise(ctx); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const ng = ctx.createGain(); n.connect(lp).connect(ng).connect(m);
      return loopVoice(ctx, out, [w1, w2, n], m, (v, tt) => {
        const f = 400 + v * 2600;
        w1.frequency.setTargetAtTime(f, tt, 0.6); w2.frequency.setTargetAtTime(f * 1.007, tt, 0.6);
        bp.frequency.setTargetAtTime(f, tt, 0.6);
        wg.gain.setTargetAtTime(0.04 + v * 0.06, tt, 0.4);
        lp.frequency.setTargetAtTime(300 + v * 2500, tt, 0.8);
        ng.gain.setTargetAtTime(0.1 + v * 0.5, tt, 0.8);
      }, 0.2);
    }
    case 'jetTakeoff': {
      const dur = 9;
      const n = noise(ctx, true); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const g = ctx.createGain();
      lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(3500, t + 3);
      lp.frequency.exponentialRampToValueAtTime(600, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 2.5);
      g.gain.setValueAtTime(0.9, t + 4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(lp).connect(g).connect(out); n.start(t); n.stop(t + dur + 0.1);
      tone(ctx, out, 'sawtooth', 900, t, 2, 0.05, dur - 2, 3200);
      return oneShot(dur);
    }
    case 'turboprop': {
      // Low drone with propeller blade-pass amplitude modulation.
      const m = ctx.createGain();
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const am = ctx.createGain(); am.gain.value = 0.25;
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain(); lfoG.gain.value = 0.15;
      lfo.connect(lfoG).connect(am.gain);
      o.connect(lp).connect(am).connect(m);
      const n = noise(ctx); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900;
      const ng = ctx.createGain(); n.connect(nf).connect(ng).connect(m);
      return loopVoice(ctx, out, [o, lfo, n], m, (v, tt) => {
        o.frequency.setTargetAtTime(55 + v * 50, tt, 0.5);
        lfo.frequency.setTargetAtTime(18 + v * 30, tt, 0.5);
        ng.gain.setTargetAtTime(0.05 + v * 0.2, tt, 0.5);
      }, 0.4);
    }
    case 'touchdown': {
      // Two tyre chirps + thump.
      burst(ctx, out, t, 'bandpass', 2400, 3, 0.6, 0.18);
      burst(ctx, out, t + 0.12, 'bandpass', 2100, 3, 0.45, 0.22);
      tone(ctx, out, 'sine', 90, t, 0.005, 0.7, 0.3, 40);
      return oneShot(0.5);
    }
    case 'taxi': {
      const m = ctx.createGain();
      const n = noise(ctx); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const g = ctx.createGain(); n.connect(lp).connect(g).connect(m);
      return loopVoice(ctx, out, [n], m, (v, tt) => {
        lp.frequency.setTargetAtTime(120 + v * 300, tt, 0.4);
        g.gain.setTargetAtTime(0.2 + v * 0.4, tt, 0.4);
      }, 0.3);
    }
    case 'crowd': {
      // Formant-filtered noise with slow random-ish modulation = murmur.
      const m = ctx.createGain();
      const n = noise(ctx);
      const srcs: AudioScheduledSourceNode[] = [n];
      const level = ctx.createGain();
      [350, 900, 2200].forEach((f, i) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 4;
        const g = ctx.createGain(); g.gain.value = 0.3;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7 + i * 0.53;
        const lg = ctx.createGain(); lg.gain.value = 0.2;
        lfo.connect(lg).connect(g.gain); srcs.push(lfo);
        n.connect(bp).connect(g).connect(level);
      });
      level.connect(m);
      return loopVoice(ctx, out, srcs, m, (v, tt) => level.gain.setTargetAtTime(0.1 + v * 0.9, tt, 1), 0.5);
    }
    case 'uiHover': tone(ctx, out, 'sine', 1800, t, 0.002, 0.08, 0.03); return oneShot(0.05);
    case 'uiClick':
      tone(ctx, out, 'triangle', 1100, t, 0.002, 0.25, 0.05, 700);
      burst(ctx, out, t, 'highpass', 3000, 1, 0.1, 0.02);
      return oneShot(0.08);
    case 'buildThunk':
      tone(ctx, out, 'sine', 140, t, 0.004, 0.9, 0.25, 45);
      burst(ctx, out, t, 'lowpass', 600, 1, 0.5, 0.15);
      return oneShot(0.35);
    case 'cashRegister':
      burst(ctx, out, t, 'bandpass', 1500, 2, 0.3, 0.06);
      tone(ctx, out, 'sine', 2637, t + 0.08, 0.003, 0.3, 0.5);
      tone(ctx, out, 'sine', 3520, t + 0.08, 0.003, 0.18, 0.6);
      return oneShot(0.75);
    case 'chime':
      tone(ctx, out, 'sine', 880, t, 0.005, 0.3, 0.6);
      tone(ctx, out, 'sine', 1318.5, t + 0.15, 0.005, 0.25, 0.8);
      return oneShot(1);
  }
}
