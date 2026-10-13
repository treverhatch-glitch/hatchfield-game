import { burst, loopVoice, noise, oneShot, tone, type Voice } from './synth';
import { hashSeed, jit, mulberry32 } from './rng';

export const WEATHER_KINDS = ['lightRain', 'heavyRain', 'thunderstorm', 'wind', 'snow', 'fog', 'clearDay', 'clearNight'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];
export const WEATHER_VARIANTS = 5;

export interface WeatherParams {
  kind: WeatherKind; variant: number;
  rainHp: number; rainLevel: number; dripRate: number;
  windHz: number; windLevel: number; gustRate: number;
  crickets: number; dayAir: number;
  /** Lowpass applied to world categories (aircraft/vehicles/sfx/ambient). 20000 = off. */
  worldLowpass: number;
  /** Seconds between auto one-shots (thunder/foghorn); 0 = none. Driven by caller's clock. */
  eventEverySec: number;
}

const BASE: Record<WeatherKind, Omit<WeatherParams, 'kind' | 'variant'>> = {
  lightRain: { rainHp: 3000, rainLevel: 0.12, dripRate: 6, windHz: 400, windLevel: 0.04, gustRate: 0.1, crickets: 0, dayAir: 0.05, worldLowpass: 9000, eventEverySec: 0 },
  heavyRain: { rainHp: 1200, rainLevel: 0.4, dripRate: 14, windHz: 500, windLevel: 0.12, gustRate: 0.15, crickets: 0, dayAir: 0, worldLowpass: 3500, eventEverySec: 0 },
  thunderstorm: { rainHp: 1000, rainLevel: 0.45, dripRate: 16, windHz: 450, windLevel: 0.2, gustRate: 0.2, crickets: 0, dayAir: 0, worldLowpass: 3000, eventEverySec: 18 },
  wind: { rainHp: 0, rainLevel: 0, dripRate: 0, windHz: 380, windLevel: 0.35, gustRate: 0.18, crickets: 0, dayAir: 0.05, worldLowpass: 12000, eventEverySec: 0 },
  snow: { rainHp: 0, rainLevel: 0, dripRate: 0, windHz: 250, windLevel: 0.08, gustRate: 0.06, crickets: 0, dayAir: 0.02, worldLowpass: 2200, eventEverySec: 0 },
  fog: { rainHp: 0, rainLevel: 0, dripRate: 0, windHz: 200, windLevel: 0.03, gustRate: 0.04, crickets: 0, dayAir: 0.03, worldLowpass: 2800, eventEverySec: 40 },
  clearDay: { rainHp: 0, rainLevel: 0, dripRate: 0, windHz: 350, windLevel: 0.04, gustRate: 0.1, crickets: 0, dayAir: 0.15, worldLowpass: 20000, eventEverySec: 0 },
  clearNight: { rainHp: 0, rainLevel: 0, dripRate: 0, windHz: 300, windLevel: 0.02, gustRate: 0.05, crickets: 0.06, dayAir: 0.02, worldLowpass: 20000, eventEverySec: 0 },
};

export function weatherParams(kind: WeatherKind, variant: number, seed = 0): WeatherParams {
  const v = ((Math.floor(variant) % WEATHER_VARIANTS) + WEATHER_VARIANTS) % WEATHER_VARIANTS;
  const r = mulberry32(hashSeed('weather', kind, v, seed));
  const b = BASE[kind];
  return {
    kind, variant: v,
    rainHp: b.rainHp * jit(r, 0.2), rainLevel: b.rainLevel * jit(r, 0.25), dripRate: b.dripRate * jit(r, 0.3),
    windHz: b.windHz * jit(r, 0.25), windLevel: b.windLevel * jit(r, 0.3), gustRate: b.gustRate * jit(r, 0.4),
    crickets: b.crickets * jit(r, 0.3), dayAir: b.dayAir * jit(r, 0.3),
    worldLowpass: b.worldLowpass >= 20000 ? 20000 : b.worldLowpass * jit(r, 0.12),
    eventEverySec: b.eventEverySec * jit(r, 0.3),
  };
}

/** Continuous weather bed. intensity scales the whole bed. */
export function buildWeatherBed(ctx: BaseAudioContext, p: WeatherParams, out: AudioNode): Voice {
  const m = ctx.createGain(); const lvl = ctx.createGain();
  const srcs: AudioScheduledSourceNode[] = [];
  if (p.rainLevel > 0) {
    const n = noise(ctx); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.rainHp;
    const g = ctx.createGain(); g.gain.value = p.rainLevel; n.connect(hp).connect(g).connect(lvl); srcs.push(n);
    const drip = ctx.createOscillator(); drip.type = 'square'; drip.frequency.value = p.dripRate;
    const dg = ctx.createGain(); dg.gain.value = p.rainLevel * 0.3; drip.connect(dg).connect(g.gain); srcs.push(drip);
  }
  if (p.windLevel > 0) {
    const n = noise(ctx); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = p.windHz; bp.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.value = p.windLevel;
    const gust = ctx.createOscillator(); gust.frequency.value = p.gustRate;
    const gg = ctx.createGain(); gg.gain.value = p.windHz * 0.6; gust.connect(gg).connect(bp.frequency);
    const ga = ctx.createGain(); ga.gain.value = p.windLevel * 0.5; gust.connect(ga).connect(g.gain);
    n.connect(bp).connect(g).connect(lvl); srcs.push(n, gust);
  }
  if (p.dayAir > 0) {
    const n = noise(ctx); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = p.dayAir; n.connect(bp).connect(g).connect(lvl); srcs.push(n);
  }
  if (p.crickets > 0) {
    const o = ctx.createOscillator(); o.frequency.value = 4500 * (1 + p.variant * 0.03);
    const am = ctx.createGain(); am.gain.value = 0;
    const tr = ctx.createOscillator(); tr.type = 'square'; tr.frequency.value = 28;
    const tg = ctx.createGain(); tg.gain.value = p.crickets; tr.connect(tg).connect(am.gain);
    o.connect(am).connect(lvl); srcs.push(o, tr);
  }
  lvl.connect(m);
  return loopVoice(ctx, out, srcs, m, (v, tt) => lvl.gain.setTargetAtTime(v * 1.5, tt, 1.5), 0.66);
}

export type WeatherEvent = 'thunder' | 'foghorn';
export interface EventParams { event: WeatherEvent; variant: number; delay: number; lp: number; level: number; rolls: number; dur: number; hz: number }
export function eventParams(event: WeatherEvent, variant: number, seed = 0): EventParams {
  const v = ((Math.floor(variant) % WEATHER_VARIANTS) + WEATHER_VARIANTS) % WEATHER_VARIANTS;
  const r = mulberry32(hashSeed('event', event, v, seed));
  // thunder variants: close crack, near, rolling, distant, very distant
  if (event === 'thunder') return {
    event, variant: v, delay: [0, 0.3, 0.6, 1.5, 3][v] * jit(r, 0.3), lp: [4000, 2000, 900, 400, 250][v] * jit(r, 0.2),
    level: [1, 0.8, 0.65, 0.4, 0.25][v] * jit(r, 0.15), rolls: [1, 2, 4, 3, 2][v], dur: [2.5, 3.5, 6, 5, 4][v] * jit(r, 0.2), hz: 40,
  };
  return { event, variant: v, delay: 0, lp: 600 * jit(r, 0.2), level: 0.12 * jit(r, 0.2), rolls: 1 + (v % 2), dur: 2.5 * jit(r, 0.2), hz: [110, 98, 123, 87, 104][v] * jit(r, 0.02) };
}

export function buildWeatherEvent(ctx: BaseAudioContext, p: EventParams, out: AudioNode): Voice {
  const t = ctx.currentTime + p.delay;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.lp; lp.connect(out);
  if (p.event === 'thunder') {
    if (p.variant === 0) burst(ctx, lp, t, 'highpass', 1500, 0.7, p.level * 0.8, 0.25);
    for (let i = 0; i < p.rolls; i++) burst(ctx, lp, t + i * (p.dur / (p.rolls + 1)), 'lowpass', p.lp, 0.5, p.level, p.dur / p.rolls + 0.8);
    tone(ctx, lp, 'sine', p.hz, t, 0.05, p.level * 0.5, p.dur, 25);
  } else {
    for (let i = 0; i < p.rolls; i++) {
      tone(ctx, lp, 'sawtooth', p.hz, t + i * (p.dur + 0.8), 0.4, p.level, p.dur);
      tone(ctx, lp, 'sawtooth', p.hz * 1.5, t + i * (p.dur + 0.8), 0.4, p.level * 0.5, p.dur);
    }
  }
  return oneShot(p.delay + p.dur * (p.event === 'foghorn' ? p.rolls + 0.5 : 1) + 1);
}
