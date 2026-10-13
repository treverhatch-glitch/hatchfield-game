import { describe, it, expect } from 'vitest';
import {
  AudioEngine, AIRCRAFT_TYPE_IDS, AIRCRAFT_PROFILES, CLASS_BASE, PHASES, PHASE_CHARACTERS, VARIANTS_PER_PHASE,
  aircraftParams, profileFor, WEATHER_KINDS, WEATHER_VARIANTS, weatherParams, eventParams, WEATHER_FILTERED, CATEGORIES,
} from '../index';
import { MockAudioContext } from './mockAudio';

const make = () => {
  const ctx = new MockAudioContext();
  const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, visibility: null, minRetriggerSec: 0, maxOneShotsPerId: 100 });
  return { ctx, engine };
};
const NUMERIC = (p: object) => Object.entries(p).filter(([, v]) => typeof v === 'number' && Number.isFinite(v));

describe('aircraft profiles', () => {
  it('every game aircraft type maps to a profile with a known engine class', () => {
    expect(AIRCRAFT_TYPE_IDS.length).toBe(25);
    for (const id of AIRCRAFT_TYPE_IDS) {
      const p = AIRCRAFT_PROFILES[id];
      expect(p, id).toBeDefined();
      expect(p.typeId).toBe(id);
      expect(CLASS_BASE[p.engineClass]).toBeDefined();
    }
  });
  it('unknown types fall back instead of throwing', () => {
    expect(profileFor('mystery').engineClass).toBe('narrowbodyTwin');
  });
  it('every phase has 5 distinct variant characters', () => {
    expect(PHASES.length).toBe(6);
    for (const ph of PHASES) {
      expect(PHASE_CHARACTERS[ph].length).toBe(VARIANTS_PER_PHASE);
      expect(new Set(PHASE_CHARACTERS[ph]).size).toBe(5);
    }
  });
  it('the 5 variants of every type/phase differ in params', () => {
    for (const id of AIRCRAFT_TYPE_IDS) for (const ph of PHASES) {
      const sigs = new Set(Array.from({ length: 5 }, (_, v) => JSON.stringify(NUMERIC(aircraftParams(id, ph, v)))));
      expect(sigs.size, `${id}/${ph}`).toBe(5);
    }
  });
  it('is deterministic per seed and changes with seed', () => {
    expect(aircraftParams('b738', 'takeoff', 2, 7)).toEqual(aircraftParams('b738', 'takeoff', 2, 7));
    expect(aircraftParams('b738', 'takeoff', 2, 7)).not.toEqual(aircraftParams('b738', 'takeoff', 2, 8));
  });
  it('types sharing a class still sound different', () => {
    const a = aircraftParams('a320neo', 'approach', 0), b = aircraftParams('b738', 'approach', 0);
    expect(a.whineHz).not.toBeCloseTo(b.whineHz, 0);
    // bigger metal is lower pitched
    expect(aircraftParams('a380', 'taxi', 0).rumbleHz).toBeLessThan(aircraftParams('crj700', 'taxi', 0).rumbleHz);
  });
  it('engine character: props pulse, helos slap, jets whine', () => {
    expect(aircraftParams('atr72', 'approach', 0).propHz).toBeGreaterThan(0);
    expect(aircraftParams('aw139', 'approach', 0).rotorHz).toBeGreaterThan(0);
    expect(aircraftParams('b789', 'approach', 0).propHz).toBe(0);
    expect(aircraftParams('aw139', 'landing', 3).reverse).toBe(0);
  });
  it('plays every type x phase x variant through the engine; loops vs one-shots', () => {
    const { engine, ctx } = make();
    for (const id of AIRCRAFT_TYPE_IDS) for (const ph of PHASES) for (let v = 0; v < 5; v++) {
      const h = engine.play(id, ph, { variant: v, position: { x: 0, y: 0, z: 0 }, intensity: 0.7 })!;
      expect(h.id).toBe(`${id}:${ph}`); expect(h.variant).toBe(v);
      expect(h.looping).toBe(ph === 'approach' || ph === 'taxi' || ph === 'pushback');
      if (h.looping) h.stop();
    }
    ctx.currentTime = 120;
    expect(engine.activeCount()).toBe(0);
  });
  it('random variant by default is within 0-4', () => {
    const { engine } = make();
    for (let i = 0; i < 20; i++) {
      const v = engine.play('c130', 'taxi')!.variant!;
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(5);
    }
  });
});

describe('weather', () => {
  it('every weather kind has 5 differing, deterministic variants', () => {
    expect(WEATHER_KINDS.length).toBe(8);
    for (const k of WEATHER_KINDS) {
      const sigs = new Set(Array.from({ length: WEATHER_VARIANTS }, (_, v) => JSON.stringify(weatherParams(k, v))));
      expect(sigs.size, k).toBe(5);
      expect(weatherParams(k, 3, 9)).toEqual(weatherParams(k, 3, 9));
    }
  });
  it('thunder and foghorn have 5 variants each', () => {
    for (const e of ['thunder', 'foghorn'] as const) {
      expect(new Set(Array.from({ length: 5 }, (_, v) => JSON.stringify(eventParams(e, v)))).size).toBe(5);
    }
    expect(weatherParams('thunderstorm', 0).eventEverySec).toBeGreaterThan(0);
    expect(weatherParams('fog', 0).eventEverySec).toBeGreaterThan(0);
  });
  it('heavy weather lowpasses world categories, clear removes it', () => {
    const { engine, ctx } = make();
    engine.unlock();
    const filter = ctx.filters[0];
    // world buses route through the filter; ui/ambience bypass it
    const buses = ctx.gains.slice(1, 1 + CATEGORIES.length);
    CATEGORIES.forEach((c, i) => expect(buses[i].connections[0] === filter).toBe(WEATHER_FILTERED.includes(c)));
    for (const k of ['heavyRain', 'snow', 'fog', 'thunderstorm'] as const) {
      engine.setWeather(k, { variant: 1 });
      expect(engine.getWeatherFilterHz(), k).toBeLessThan(5000);
      expect(filter.frequency.value).toBeLessThan(5000);
    }
    engine.setWeather('lightRain', { variant: 0 });
    expect(engine.getWeatherFilterHz()).toBeGreaterThan(5000);
    engine.setWeather('clearDay');
    expect(filter.frequency.value).toBe(20000);
    expect(engine.getWeather()).toBe('clearDay');
  });
  it('switching weather keeps one bed alive; events expire', () => {
    const { engine, ctx } = make();
    engine.setWeather('heavyRain'); engine.setWeather('thunderstorm');
    expect(engine.activeCount()).toBe(1);
    for (let v = 0; v < 5; v++) expect(engine.weatherEvent('thunder', { variant: v })).not.toBeNull();
    engine.weatherEvent('foghorn');
    expect(engine.activeCount()).toBe(7);
    ctx.currentTime = 60;
    expect(engine.activeCount()).toBe(1);
  });
});
