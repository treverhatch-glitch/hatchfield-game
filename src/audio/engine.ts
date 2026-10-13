import { buildSound, LOOPING, SOUND_CATEGORY, type Category, type SoundId, type Voice } from './synth';
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

export interface SoundHandle {
  readonly id: SoundId;
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

export const CATEGORIES: Category[] = ['aircraft', 'ambient', 'ui', 'sfx'];

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
  private master = 1;
  private cat: Record<Category, number> = { aircraft: 0.8, ambient: 0.5, ui: 0.6, sfx: 0.8 };
  private muted = false;
  private hiddenPaused = false;
  private live = new Set<Live>();
  private lastFired = new Map<SoundId, number>();
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
      for (const c of CATEGORIES) {
        const g = ctx.createGain();
        g.connect(this.masterGain);
        this.catGains.set(c, g);
      }
      this.applyGains();
      if (this.opts.visibility?.hidden) this.handleVisibility();
    }
    if (this.ctx.state === 'suspended' && !this.hiddenPaused) void this.ctx.resume();
    return this.ctx;
  }

  get context(): AudioContext | null { return this.ctx; }

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
  play(id: SoundId, options: PlayOptions = {}): SoundHandle | null {
    const ctx = this.unlock();
    const looping = LOOPING[id];
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
    const category = SOUND_CATEGORY[id];
    const gain = ctx.createGain();
    let pan: StereoPannerNode | null = null;
    if (options.position && typeof ctx.createStereoPanner === 'function') {
      pan = ctx.createStereoPanner();
      gain.connect(pan).connect(this.catGains.get(category)!);
    } else {
      gain.connect(this.catGains.get(category)!);
    }
    const voice = buildSound(ctx, id, gain);
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
        id, looping,
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
    this.ctx = null; this.masterGain = null; this.catGains.clear();
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
