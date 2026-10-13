/**
 * Procedural sound recipes. Each builds a node graph into `out` and returns
 * an optional updater (for loops) plus a stop function. No asset files.
 */
export type SoundId =
  | 'crowd'
  | 'uiHover' | 'uiClick' | 'buildThunk' | 'cashRegister' | 'chime'
  | 'truckIdle' | 'truckDrive' | 'airBrake' | 'reverseBeeper' | 'fuelPump' | 'baggageTug' | 'beltLoader' | 'cateringLift' | 'jetBridge' | 'gpuHum' | 'pushbackTug' | 'radioChatter' | 'paChime' | 'securityBeep' | 'metalDetector' | 'suitcaseRoll' | 'hammer' | 'drill' | 'craneBeep' | 'expense' | 'mailNotify' | 'contractFanfare' | 'warning' | 'errorBuzz' | 'levelUp' | 'rain' | 'wind' | 'birds' | 'dayNight';

export type Category = 'aircraft' | 'vehicles' | 'ambient' | 'ambience' | 'ui' | 'sfx';

export const SOUND_CATEGORY: Record<SoundId, Category> = {
  crowd: 'ambient', uiHover: 'ui', uiClick: 'ui', buildThunk: 'sfx', cashRegister: 'sfx', chime: 'ui',
  truckIdle: 'vehicles',
  truckDrive: 'vehicles',
  airBrake: 'vehicles',
  reverseBeeper: 'vehicles',
  fuelPump: 'vehicles',
  baggageTug: 'vehicles',
  beltLoader: 'vehicles',
  cateringLift: 'vehicles',
  jetBridge: 'vehicles',
  gpuHum: 'vehicles',
  pushbackTug: 'vehicles',
  radioChatter: 'sfx',
  paChime: 'ambient',
  securityBeep: 'sfx',
  metalDetector: 'sfx',
  suitcaseRoll: 'sfx',
  hammer: 'sfx',
  drill: 'sfx',
  craneBeep: 'sfx',
  expense: 'ui',
  mailNotify: 'ui',
  contractFanfare: 'ui',
  warning: 'ui',
  errorBuzz: 'ui',
  levelUp: 'ui',
  rain: 'ambience',
  wind: 'ambience',
  birds: 'ambience',
  dayNight: 'ambience',
};

export const LOOPING: Record<SoundId, boolean> = {
  crowd: true,
  uiHover: false, uiClick: false, buildThunk: false, cashRegister: false, chime: false,
  truckIdle: true,
  truckDrive: true,
  airBrake: false,
  reverseBeeper: true,
  fuelPump: true,
  baggageTug: true,
  beltLoader: true,
  cateringLift: false,
  jetBridge: true,
  gpuHum: true,
  pushbackTug: true,
  radioChatter: false,
  paChime: false,
  securityBeep: false,
  metalDetector: false,
  suitcaseRoll: true,
  hammer: false,
  drill: true,
  craneBeep: true,
  expense: false,
  mailNotify: false,
  contractFanfare: false,
  warning: false,
  errorBuzz: false,
  levelUp: false,
  rain: true,
  wind: true,
  birds: true,
  dayNight: true,
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

export function noise(ctx: BaseAudioContext, loop = true): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = loop;
  return s;
}

export function env(g: GainNode, t: number, a: number, peak: number, dcy: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}

export function tone(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, a: number, peak: number, dcy: number, fEnd?: number): void {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + a + dcy);
  env(g, t, a, peak, dcy);
  o.connect(g).connect(out); o.start(t); o.stop(t + a + dcy + 0.05);
}

export function burst(ctx: BaseAudioContext, out: AudioNode, t: number, type: BiquadFilterType, freq: number, q: number, peak: number, dcy: number): void {
  const n = noise(ctx, false); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t, 0.005, peak, dcy);
  n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + dcy + 0.05);
}

export function loopVoice(ctx: BaseAudioContext, out: AudioNode, sources: AudioScheduledSourceNode[], master: GainNode, apply: (v: number, t: number) => void, init = 0.5): Voice {
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

export function oneShot(duration: number): Voice {
  return { duration, setIntensity() {}, stop() {} };
}

export function buildSound(ctx: BaseAudioContext, id: SoundId, out: AudioNode): Voice {
  const t = ctx.currentTime;
  switch (id) {
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
    // ---- ground vehicles ----
    case 'truckIdle': return engineLoop(ctx, out, 32, 180, 0.15);
    case 'truckDrive': return engineLoop(ctx, out, 32, 180, 0.6);
    case 'baggageTug': return engineLoop(ctx, out, 70, 900, 0.4, 0.5);
    case 'pushbackTug': return engineLoop(ctx, out, 26, 140, 0.4, 1.3);
    case 'airBrake':
      burst(ctx, out, t, 'highpass', 2500, 0.7, 0.6, 0.9);
      burst(ctx, out, t, 'bandpass', 5000, 2, 0.25, 0.4);
      return oneShot(1);
    case 'reverseBeeper': return beepLoop(ctx, out, 1050, 1, 0.25);
    case 'craneBeep': return beepLoop(ctx, out, 1400, 2, 0.18);
    case 'fuelPump': return noiseLoop(ctx, out, 'bandpass', 320, 1.5, 0.35, 22, 0.5, 60);
    case 'beltLoader': return noiseLoop(ctx, out, 'bandpass', 800, 2, 0.25, 11, 0.6, 48);
    case 'suitcaseRoll': return noiseLoop(ctx, out, 'bandpass', 1600, 1.2, 0.18, 28, 0.7);
    case 'drill': return noiseLoop(ctx, out, 'bandpass', 2400, 4, 0.2, 40, 0.4, 220);
    case 'jetBridge': return humLoop(ctx, out, [100, 200, 300], 0.06, 0.4, 'sawtooth');
    case 'gpuHum': return humLoop(ctx, out, [400, 800, 1200], 0.04, 0.5, 'sine');
    case 'cateringLift':
      tone(ctx, out, 'sawtooth', 180, t, 0.3, 0.08, 2.2, 520);
      burst(ctx, out, t, 'lowpass', 300, 1, 0.15, 2.4);
      return oneShot(2.6);
    // ---- people / terminal ----
    case 'radioChatter': {
      burst(ctx, out, t, 'highpass', 3000, 1, 0.2, 0.05);
      let tt = t + 0.06;
      for (let i = 0; i < 6; i++) {
        const d = 0.06 + Math.random() * 0.1;
        burst(ctx, out, tt, 'bandpass', 900 + Math.random() * 1200, 6, 0.35, d);
        tt += d + 0.02;
      }
      tone(ctx, out, 'sine', 1800, tt, 0.003, 0.1, 0.06);
      return oneShot(tt - t + 0.1);
    }
    case 'paChime':
      tone(ctx, out, 'sine', 659.3, t, 0.005, 0.3, 1.1);
      tone(ctx, out, 'sine', 523.3, t + 0.55, 0.005, 0.3, 1.4);
      return oneShot(2);
    case 'securityBeep':
      tone(ctx, out, 'square', 2000, t, 0.003, 0.1, 0.07);
      tone(ctx, out, 'square', 2000, t + 0.12, 0.003, 0.1, 0.07);
      return oneShot(0.25);
    case 'metalDetector':
      for (let i = 0; i < 3; i++) tone(ctx, out, 'square', 820, t + i * 0.3, 0.005, 0.15, 0.22);
      return oneShot(0.95);
    case 'hammer':
      burst(ctx, out, t, 'bandpass', 1800, 3, 0.6, 0.08);
      tone(ctx, out, 'triangle', 320, t, 0.002, 0.4, 0.12, 200);
      return oneShot(0.2);
    // ---- UI / economy ----
    case 'expense':
      tone(ctx, out, 'triangle', 660, t, 0.004, 0.25, 0.12);
      tone(ctx, out, 'triangle', 440, t + 0.1, 0.004, 0.25, 0.25, 330);
      return oneShot(0.4);
    case 'mailNotify':
      tone(ctx, out, 'sine', 1568, t, 0.004, 0.2, 0.12);
      tone(ctx, out, 'sine', 2093, t + 0.09, 0.004, 0.2, 0.25);
      return oneShot(0.4);
    case 'contractFanfare': {
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(ctx, out, 'triangle', f, t + i * 0.12, 0.01, 0.25, 0.3));
      [523.3, 659.3, 784].forEach((f) => tone(ctx, out, 'sawtooth', f, t + 0.5, 0.02, 0.05, 1.0));
      return oneShot(1.6);
    }
    case 'warning':
      for (let i = 0; i < 2; i++) {
        tone(ctx, out, 'square', 880, t + i * 0.5, 0.005, 0.12, 0.2);
        tone(ctx, out, 'square', 660, t + i * 0.5 + 0.25, 0.005, 0.12, 0.2);
      }
      return oneShot(1);
    case 'errorBuzz':
      tone(ctx, out, 'sawtooth', 110, t, 0.005, 0.2, 0.3);
      tone(ctx, out, 'sawtooth', 116, t, 0.005, 0.2, 0.3);
      return oneShot(0.35);
    case 'levelUp':
      [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((f, i) => tone(ctx, out, 'square', f, t + i * 0.07, 0.005, 0.1, 0.18));
      tone(ctx, out, 'sine', 2093, t + 0.45, 0.01, 0.2, 0.8);
      return oneShot(1.3);
    // ---- ambience ----
    case 'rain': return noiseLoop(ctx, out, 'highpass', 1200, 0.5, 0.25, 0, 0, 0, 0.7);
    case 'wind': return windLoop(ctx, out);
    case 'birds': return birdsLoop(ctx, out);
    case 'dayNight': return dayNightLoop(ctx, out);
  }
}

// ---- generic loop builders for the extended sound set ----

/** Diesel/electric engine: pulsed saw (firing rate) + rumble. intensity = throttle. */
function engineLoop(ctx: BaseAudioContext, out: AudioNode, idleHz: number, lpHz: number, init: number, pitch = 1): Voice {
  const m = ctx.createGain();
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  const og = ctx.createGain(); og.gain.value = 0.3;
  o.connect(lp).connect(og).connect(m);
  const n = noise(ctx); const nf = ctx.createBiquadFilter(); nf.type = 'lowpass';
  const ng = ctx.createGain(); n.connect(nf).connect(ng).connect(m);
  return loopVoice(ctx, out, [o, n], m, (v, tt) => {
    o.frequency.setTargetAtTime(idleHz * pitch * (1 + v * 2), tt, 0.4);
    lp.frequency.setTargetAtTime(lpHz * pitch * (1 + v * 3), tt, 0.4);
    nf.frequency.setTargetAtTime(200 * pitch + v * 600, tt, 0.4);
    ng.gain.setTargetAtTime(0.1 + v * 0.3, tt, 0.4);
  }, init);
}

/** Square beeper gated by a square LFO (reverse alarm, crane). */
function beepLoop(ctx: BaseAudioContext, out: AudioNode, hz: number, rate: number, level: number): Voice {
  const m = ctx.createGain();
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz;
  const gate = ctx.createGain(); gate.gain.value = level / 2;
  const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = rate;
  const lg = ctx.createGain(); lg.gain.value = level / 2;
  lfo.connect(lg).connect(gate.gain);
  o.connect(gate).connect(m);
  return loopVoice(ctx, out, [o, lfo], m, () => {}, 1);
}

/** Filtered noise with optional AM (pump strokes, rattles) and an optional tonal motor. */
function noiseLoop(ctx: BaseAudioContext, out: AudioNode, type: BiquadFilterType, hz: number, q: number, level: number,
  amRate: number, amDepth: number, motorHz = 0, init = 0.5): Voice {
  const m = ctx.createGain();
  const n = noise(ctx); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = level;
  n.connect(f).connect(g).connect(m);
  const srcs: AudioScheduledSourceNode[] = [n];
  if (amRate > 0) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = amRate;
    const lg = ctx.createGain(); lg.gain.value = level * amDepth;
    lfo.connect(lg).connect(g.gain); srcs.push(lfo);
  }
  let mg: GainNode | null = null; let mo: OscillatorNode | null = null;
  if (motorHz > 0) {
    mo = ctx.createOscillator(); mo.type = 'sawtooth'; mo.frequency.value = motorHz;
    mg = ctx.createGain(); mg.gain.value = 0.04; mo.connect(mg).connect(m); srcs.push(mo);
  }
  return loopVoice(ctx, out, srcs, m, (v, tt) => {
    f.frequency.setTargetAtTime(hz * (0.7 + v * 0.6), tt, 0.3);
    if (mo) mo.frequency.setTargetAtTime(motorHz * (0.8 + v * 0.4), tt, 0.3);
  }, init);
}

/** Electrical hum: harmonic stack. */
function humLoop(ctx: BaseAudioContext, out: AudioNode, freqs: number[], level: number, init: number, type: OscillatorType): Voice {
  const m = ctx.createGain(); const lvl = ctx.createGain();
  const srcs = freqs.map((f, i) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = level / (i + 1);
    o.connect(g).connect(lvl); return o;
  });
  lvl.connect(m);
  return loopVoice(ctx, out, srcs, m, (v, tt) => {
    lvl.gain.setTargetAtTime(0.3 + v, tt, 0.3);
    srcs.forEach((o, i) => o.frequency.setTargetAtTime(freqs[i] * (0.9 + v * 0.2), tt, 0.5));
  }, init);
}

/** Gusting wind; intensity = wind strength. */
function windLoop(ctx: BaseAudioContext, out: AudioNode): Voice {
  const m = ctx.createGain();
  const n = noise(ctx); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
  const g = ctx.createGain();
  const gust = ctx.createOscillator(); gust.frequency.value = 0.13;
  const gg = ctx.createGain(); gg.gain.value = 250; gust.connect(gg).connect(bp.frequency);
  n.connect(bp).connect(g).connect(m);
  return loopVoice(ctx, out, [n, gust], m, (v, tt) => {
    bp.frequency.setTargetAtTime(300 + v * 500, tt, 1);
    g.gain.setTargetAtTime(0.1 + v * 0.6, tt, 1);
  }, 0.4);
}

/** FM chirps gated by slow LFOs; intensity = bird density. */
function birdsLoop(ctx: BaseAudioContext, out: AudioNode): Voice {
  const m = ctx.createGain(); const lvl = ctx.createGain();
  const srcs: AudioScheduledSourceNode[] = [];
  [[3200, 23, 0.37], [4100, 31, 0.23]].forEach(([f, fm, gate]) => {
    const o = ctx.createOscillator(); o.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = fm;
    const md = ctx.createGain(); md.gain.value = f * 0.25; mod.connect(md).connect(o.frequency);
    const g = ctx.createGain(); g.gain.value = 0;
    const gl = ctx.createOscillator(); gl.type = 'square'; gl.frequency.value = gate;
    const glg = ctx.createGain(); glg.gain.value = 0.05; gl.connect(glg).connect(g.gain);
    o.connect(g).connect(lvl); srcs.push(o, mod, gl);
  });
  lvl.connect(m);
  return loopVoice(ctx, out, srcs, m, (v, tt) => lvl.gain.setTargetAtTime(v, tt, 1), 0.5);
}

/** Outdoor bed that crossfades day (airy broadband) to night (crickets). intensity = daylight 0..1. */
function dayNightLoop(ctx: BaseAudioContext, out: AudioNode): Voice {
  const m = ctx.createGain();
  const n = noise(ctx); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
  const day = ctx.createGain(); n.connect(bp).connect(day).connect(m);
  const cr = ctx.createOscillator(); cr.frequency.value = 4500;
  const am = ctx.createGain(); am.gain.value = 0;
  const trill = ctx.createOscillator(); trill.type = 'square'; trill.frequency.value = 28;
  const tg = ctx.createGain(); tg.gain.value = 0.5; trill.connect(tg).connect(am.gain);
  const night = ctx.createGain(); cr.connect(am).connect(night).connect(m);
  return loopVoice(ctx, out, [n, cr, trill], m, (v, tt) => {
    day.gain.setTargetAtTime(0.02 + v * 0.18, tt, 2);
    night.gain.setTargetAtTime((1 - v) * 0.06, tt, 2);
  }, 1);
}
