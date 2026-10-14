import { buildSound, LOOPING, SOUND_CATEGORY, type Category, type SoundId, type Voice } from './synth';
import { CLIP_FILE, aircraftSample, sfxSample, soundSample, type SampleSpec } from './library';
import { buildSample } from './samples';
import { aircraftParams, buildAircraftSound, LOOPING_PHASES, PHASES, VARIANTS_PER_PHASE, type AircraftPhase } from './aircraft';
import { buildWeatherBed, buildWeatherEvent, eventParams, weatherParams, WEATHER_VARIANTS, type WeatherEvent, type WeatherKind } from './weather';
import { buildSfx, sfxParams, SFX_VARIANTS, type SfxId } from './services';
import { eventAction } from './events';
import { DEFAULT_ROLLOFF, distance, distanceGain, panFor, type Rolloff, type Vec3 } from './spatial';

export type { Category, SoundId } from './synth';
export type { Vec3, Rolloff } from './spatial';

export interface PlayOptions {
  /** World position; omit for non-positional (UI) sounds. */
  position?: Vec3;
  /** Base gain multiplier (default 1). */
  volume?: number;
  /** Initial loop intensity 0..1. */
  intensity?: number;
  rolloff?: Rolloff;
}

export interface AircraftPlayOptions extends PlayOptions {
  /** 0-4; random when omitted. */
  variant?: number;
  /** Jitter seed; same (type, phase, variant, seed) = identical params. */
  seed?: number;
}

export interface SfxPlayOptions extends PlayOptions {
  /** 0-4; random when omitted. */
  variant?: number;
  /** Jitter seed; same (id, variant, seed) = identical params. */
  seed?: number;
}

export interface EventPlayOptions extends SfxPlayOptions {
  /** Loop identity, e.g. a stand or vehicle id, so start/stop events pair up. */
  key?: string;
}

export interface SoundHandle {
  /** SoundId, or `${aircraftTypeId}:${phase}` for aircraft voices. */
  readonly id: string;
  readonly variant?: number;
  readonly looping: boolean;
  setPosition(p: Vec3): void;
  setIntensity(v: number): void;
  setVolume(v: number): void;
  stop(fadeSec?: number): void;
  readonly stopped: boolean;
}

export interface VisibilitySource {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', cb: () => void): void;
  removeEventListener(type: 'visibilitychange', cb: () => void): void;
}

export interface AudioEngineOptions {
  createContext?: () => AudioContext;
  visibility?: VisibilitySource | null;
  /** Max simultaneous one-shot voices per sound id (prevents UI tick spam). */
  maxOneShotsPerId?: number;
  /** Min seconds between identical one-shots. */
  minRetriggerSec?: number;
}

/** 'ambient' = terminal/indoor beds & PA; 'ambience' = outdoor weather/nature/day-night. */
export const CATEGORIES: Category[] = ['aircraft', 'vehicles', 'ambient', 'ambience', 'ui', 'sfx'];

/** Categories muffled by weather (UI and the weather bed itself stay clear). */
export const WEATHER_FILTERED: Category[] = ['aircraft', 'vehicles', 'ambient', 'sfx'];

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

interface Live {
  handle: SoundHandle;
  gain: GainNode;
  pan: StereoPannerNode | null;
  voice: Voice;
  position?: Vec3;
  volume: number;
  rolloff: Rolloff;
  category: Category;
  endsAt: number;
}

/**
 * Hatchfield procedural audio engine. Safe to construct before a user gesture;
 * the AudioContext is created lazily on `unlock()` or first `play()`.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private catGains = new Map<Category, GainNode>();
  private weatherFilter: BiquadFilterNode | null = null;
  private weatherFilterHz = 20000;
  private weatherBed: SoundHandle | null = null;
  private weatherKind: WeatherKind | null = null;
  private master = 1;
  private cat: Record<Category, number> = { aircraft: 0.8, vehicles: 0.7, ambient: 0.5, ambience: 0.5, ui: 0.6, sfx: 0.8 };
  private muted = false;
  private hiddenPaused = false;
  private live = new Set<Live>();
  private lastFired = new Map<string, number>();
  private eventLoops = new Map<string, SoundHandle>();
  private clips = new Map<string, AudioBuffer>();
  private listener: Vec3 = { x: 0, y: 0, z: 0 };
  private listenerRight: Vec3 = { x: 1, y: 0, z: 0 };
  private readonly opts: Required<Omit<AudioEngineOptions, 'visibility'>> & { visibility: VisibilitySource | null };
  private readonly onVis = () => this.handleVisibility();

  constructor(options: AudioEngineOptions = {}) {
    const vis = options.visibility !== undefined ? options.visibility
      : (typeof document !== 'undefined' ? (document as unknown as VisibilitySource) : null);
    this.opts = {
      createContext: options.createContext ?? (() => new AudioContext()),
      visibility: vis,
      maxOneShotsPerId: options.maxOneShotsPerId ?? 6,
      minRetriggerSec: options.minRetriggerSec ?? 0.03,
    };
    this.opts.visibility?.addEventListener('visibilitychange', this.onVis);
  }

  /** Call from a user gesture (click/keydown) to satisfy autoplay policy. */
  unlock(): AudioContext {
    if (!this.ctx) {
      const ctx = this.opts.createContext();
      this.ctx = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.connect(ctx.destination);
      this.weatherFilter = ctx.createBiquadFilter();
      this.weatherFilter.type = 'lowpass';
      this.weatherFilter.frequency.value = this.weatherFilterHz;
      this.weatherFilter.connect(this.masterGain);
      for (const c of CATEGORIES) {
        const g = ctx.createGain();
        g.connect(WEATHER_FILTERED.includes(c) ? this.weatherFilter : this.masterGain);
        this.catGains.set(c, g);
      }
      this.applyGains();
      if (this.opts.visibility?.hidden) this.handleVisibility();
    }
    if (this.ctx.state === 'suspended' && !this.hiddenPaused) void this.ctx.resume();
    return this.ctx;
  }

  get context(): AudioContext | null { return this.ctx; }

  /** Register a decoded CC0 clip. `file` is the name in CLIP_FILE (e.g. crowd.ogg). */
  setClip(file: string, buffer: AudioBuffer): void { this.clips.set(file, buffer); }
  hasClip(file: string): boolean { return this.clips.has(file); }

  // ---- volume API ----
  getMasterVolume(): number { return this.master; }
  setMasterVolume(v: number): void { this.master = clamp01(v); this.applyGains(); }
  getCategoryVolume(c: Category): number { return this.cat[c]; }
  setCategoryVolume(c: Category, v: number): void { this.cat[c] = clamp01(v); this.applyGains(); }
  isMuted(): boolean { return this.muted; }
  setMuted(m: boolean): void { this.muted = m; this.applyGains(); }
  toggleMute(): boolean { this.setMuted(!this.muted); return this.muted; }
  /** Effective gain a category plays at (0 when muted). */
  effectiveVolume(c: Category): number { return this.muted ? 0 : this.master * this.cat[c]; }
  isPausedForHiddenTab(): boolean { return this.hiddenPaused; }

  // ---- listener ----
  /** Call each frame (or on camera move) with the camera position and right vector. */
  setListener(position: Vec3, right?: Vec3): void {
    this.listener = { ...position };
    if (right) this.listenerRight = { ...right };
    this.updateSpatial();
  }

  // ---- playback ----
  /** Play a named sound, or an aircraft voice: play('b738', 'takeoff', { variant, position }). */
  play(id: SoundId, options?: PlayOptions): SoundHandle | null;
  play(aircraftTypeId: string, phase: AircraftPhase, options?: AircraftPlayOptions): SoundHandle | null;
  play(id: string, a?: PlayOptions | AircraftPhase, b?: AircraftPlayOptions): SoundHandle | null {
    if (typeof a === 'string') return this.playAircraft(id, a, b ?? {});
    const sid = id as SoundId;
    const spec = soundSample(sid);
    if (spec && this.hasClip(CLIP_FILE[spec.clip])) {
      return this.playSample(sid, SOUND_CATEGORY[sid], LOOPING[sid], spec, a ?? {});
    }
    return this.spawn(sid, SOUND_CATEGORY[sid], LOOPING[sid], (ctx, out) => buildSound(ctx, sid, out), a ?? {});
  }

  playAircraft(typeId: string, phase: AircraftPhase, options: AircraftPlayOptions = {}): SoundHandle | null {
    if (!PHASES.includes(phase)) throw new Error(`unknown aircraft phase ${phase}`);
    const variant = options.variant ?? Math.floor(Math.random() * VARIANTS_PER_PHASE);
    const spec = aircraftSample(phase);
    if (spec && this.hasClip(CLIP_FILE[spec.clip])) {
      return this.playSample(`${typeId}:${phase}`, 'aircraft', LOOPING_PHASES[phase], spec, options, variant);
    }
    const p = aircraftParams(typeId, phase, variant, options.seed ?? 0);
    return this.spawn(`${typeId}:${phase}`, 'aircraft', LOOPING_PHASES[phase], (ctx, out) => buildAircraftSound(ctx, p, out), options, p.variant);
  }

  // ---- service / maintenance / construction / terminal / UI sounds ----
  /** Play a seeded 5-variation system sound (see SFX_IDS). Handle id is `sfx:<id>`. */
  playSfx(id: SfxId, options: SfxPlayOptions = {}): SoundHandle | null {
    const variant = options.variant ?? Math.floor(Math.random() * SFX_VARIANTS);
    const p = sfxParams(id, variant, options.seed ?? 0);
    const spec = sfxSample(id);
    if (spec && this.hasClip(CLIP_FILE[spec.clip])) {
      return this.playSample(`sfx:${id}`, p.category, p.looping, spec, options, p.variant);
    }
    return this.spawn(`sfx:${id}`, p.category, p.looping, (ctx, out) => buildSfx(ctx, p, out), options, p.variant);
  }

  private playSample(id: string, category: Category, looping: boolean, spec: SampleSpec, options: PlayOptions, variant?: number): SoundHandle | null {
    const buf = this.clips.get(CLIP_FILE[spec.clip]);
    if (!buf) return null;
    return this.spawn(id, category, looping, (ctx, out) => buildSample(ctx, buf, out, spec, looping), options, variant);
  }

  /**
   * Route a game/logistics event (see EVENT_SOUNDS) to its sound. Loop starts are
   * keyed by `options.key` so a later stop event for the same key ends them;
   * restarting an already-running key just repositions it. Unknown events → null.
   */
  playEvent(name: string, options: EventPlayOptions = {}): SoundHandle | null {
    const action = eventAction(name);
    if (!action) return null;
    const key = options.key ?? '';
    if (action.kind === 'stop') {
      for (const s of action.stops) {
        const k = `${s}|${key}`;
        this.eventLoops.get(k)?.stop();
        this.eventLoops.delete(k);
      }
      return null;
    }
    if (action.kind === 'once') return this.playSfx(action.sound, options);
    const k = `${action.sound}|${key}`;
    const existing = this.eventLoops.get(k);
    if (existing && !existing.stopped) {
      if (options.position) existing.setPosition(options.position);
      return existing;
    }
    const h = this.playSfx(action.sound, options);
    if (h) this.eventLoops.set(k, h);
    return h;
  }

  /** Number of event-driven loops currently running. */
  eventLoopCount(): number {
    for (const [k, h] of this.eventLoops) if (h.stopped) this.eventLoops.delete(k);
    return this.eventLoops.size;
  }

  // ---- weather ----
  /** Switch weather bed (crossfades) and apply its world lowpass. */
  setWeather(kind: WeatherKind, opts: { variant?: number; intensity?: number; seed?: number } = {}): number {
    const ctx = this.unlock();
    const variant = opts.variant ?? Math.floor(Math.random() * WEATHER_VARIANTS);
    const p = weatherParams(kind, variant, opts.seed ?? 0);
    this.weatherBed?.stop(2);
    this.weatherKind = kind;
    this.weatherBed = this.spawn(`weather:${kind}`, 'ambience', true, (c, out) => buildWeatherBed(c, p, out), { intensity: opts.intensity });
    this.weatherFilterHz = p.worldLowpass;
    this.weatherFilter?.frequency.setTargetAtTime(p.worldLowpass, ctx.currentTime, 1);
    return p.variant;
  }
  getWeather(): WeatherKind | null { return this.weatherKind; }
  /** Current weather lowpass on world categories (Hz; 20000 = clear). */
  getWeatherFilterHz(): number { return this.weatherFilterHz; }
  /** Fire a thunder clap / distant foghorn. Call on the sim clock (see weatherParams().eventEverySec). */
  weatherEvent(event: WeatherEvent, opts: { variant?: number; seed?: number; position?: Vec3 } = {}): SoundHandle | null {
    const p = eventParams(event, opts.variant ?? Math.floor(Math.random() * WEATHER_VARIANTS), opts.seed ?? 0);
    return this.spawn(`weather:${event}`, 'ambience', false, (c, out) => buildWeatherEvent(c, p, out), { position: opts.position }, p.variant);
  }

  private spawn(id: string, category: Category, looping: boolean, build: (ctx: AudioContext, out: AudioNode) => Voice, options: PlayOptions, variant?: number): SoundHandle | null {
    const ctx = this.unlock();
    const now = ctx.currentTime;
    this.reap(now);
    if (!looping) {
      const last = this.lastFired.get(id);
      if (last !== undefined && now - last < this.opts.minRetriggerSec) return null;
      let count = 0;
      for (const l of this.live) if (l.handle.id === id) count++;
      if (count >= this.opts.maxOneShotsPerId) return null;
      this.lastFired.set(id, now);
    }
    const gain = ctx.createGain();
    let pan: StereoPannerNode | null = null;
    if (options.position && typeof ctx.createStereoPanner === 'function') {
      pan = ctx.createStereoPanner();
      gain.connect(pan).connect(this.catGains.get(category)!);
    } else {
      gain.connect(this.catGains.get(category)!);
    }
    const voice = build(ctx, gain);
    if (options.intensity !== undefined) voice.setIntensity(options.intensity);
    let stopped = false;
    const engine = this;
    const live: Live = {
      gain, pan, voice, category,
      position: options.position ? { ...options.position } : undefined,
      volume: options.volume ?? 1,
      rolloff: options.rolloff ?? DEFAULT_ROLLOFF,
      endsAt: now + voice.duration,
      handle: {
        id, looping, variant,
        get stopped() { return stopped; },
        setPosition(p) { live.position = { ...p }; engine.updateOne(live); },
        setIntensity(v) { voice.setIntensity(v); },
        setVolume(v) { live.volume = Math.max(0, v); engine.updateOne(live); },
        stop(fade) {
          if (stopped) return; stopped = true;
          voice.stop(fade);
          engine.live.delete(live);
        },
      },
    };
    this.live.add(live);
    this.updateOne(live);
    return live.handle;
  }

  stopAll(): void { for (const l of [...this.live]) l.handle.stop(0.1); }

  activeCount(): number { if (this.ctx) this.reap(this.ctx.currentTime); return this.live.size; }

  dispose(): void {
    this.stopAll();
    this.opts.visibility?.removeEventListener('visibilitychange', this.onVis);
    void this.ctx?.close();
    this.eventLoops.clear();
    this.ctx = null; this.masterGain = null; this.weatherFilter = null; this.catGains.clear(); this.weatherBed = null;
  }

  /** Gain a source at `p` would receive from distance alone (exposed for tests/debug). */
  spatialGainAt(p: Vec3, rolloff: Rolloff = DEFAULT_ROLLOFF): number {
    return distanceGain(distance(this.listener, p), rolloff);
  }

  // ---- internals ----
  private reap(now: number): void {
    for (const l of this.live) if (!l.handle.looping && now >= l.endsAt) this.live.delete(l);
  }

  private applyGains(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.master, t, 0.02);
    for (const c of CATEGORIES) this.catGains.get(c)?.gain.setTargetAtTime(this.cat[c], t, 0.02);
  }

  private updateSpatial(): void { for (const l of this.live) this.updateOne(l); }

  private updateOne(l: Live): void {
    if (!this.ctx) return;
    const g = l.position ? this.spatialGainAt(l.position, l.rolloff) : 1;
    l.gain.gain.setTargetAtTime(g * l.volume, this.ctx.currentTime, 0.05);
    if (l.pan && l.position) l.pan.pan.setTargetAtTime(panFor(this.listener, this.listenerRight, l.position), this.ctx.currentTime, 0.05);
  }

  private handleVisibility(): void {
    const hidden = !!this.opts.visibility?.hidden;
    this.hiddenPaused = hidden;
    if (!this.ctx) return;
    if (hidden && this.ctx.state === 'running') void this.ctx.suspend();
    else if (!hidden && this.ctx.state === 'suspended') void this.ctx.resume();
  }
}

let singleton: AudioEngine | null = null;
/** Shared app-wide engine. */
export function getAudio(): AudioEngine { return (singleton ??= new AudioEngine()); }
