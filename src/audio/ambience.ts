/**
 * Ambience layers: continuous beds whose loudness follows live sim state.
 *
 * Terminal: check-in chatter, PA announcements (periodic one-shots), rolling
 * suitcases, security beeps. Apron: APU hum, GPU, belt loader, fuel pump.
 *
 * `ambienceTargets(state)` is pure (state → per-layer intensity 0..1).
 * `AmbienceMixer` starts a loop when a layer becomes audible, sets its intensity
 * each update, stops it when it falls silent, and schedules PA announcements.
 */
import { crowdIntensity, type SfxId } from './services';
import { peekAudio, type SfxPlayOptions, type SoundHandle } from './engine';
import type { Vec3 } from './spatial';

export type AmbienceLayer =
  | 'checkinChatter' | 'rollingSuitcases' | 'securityBeeps'
  | 'apuHum' | 'gpu' | 'beltLoader' | 'fuelPump';

export const AMBIENCE_LAYERS: Record<AmbienceLayer, { sound: SfxId; zone: 'terminal' | 'apron' }> = {
  checkinChatter: { sound: 'checkinChatter', zone: 'terminal' },
  rollingSuitcases: { sound: 'rollingSuitcases', zone: 'terminal' },
  securityBeeps: { sound: 'securityBeeps', zone: 'terminal' },
  apuHum: { sound: 'apuHum', zone: 'apron' },
  gpu: { sound: 'apronGpu', zone: 'apron' },
  beltLoader: { sound: 'apronBeltLoader', zone: 'apron' },
  fuelPump: { sound: 'apronFuelPump', zone: 'apron' },
};
export const AMBIENCE_LAYER_IDS = Object.keys(AMBIENCE_LAYERS) as AmbienceLayer[];
/** PA announcement one-shot sound. */
export const PA_SOUND: SfxId = 'paAnnouncement';

export interface AmbienceState {
  /** People in the check-in hall / its capacity. */
  checkinOccupancy?: number;
  /** People walking with roller bags / capacity of the landside+concourse walk areas. */
  walkingWithBagsOccupancy?: number;
  /** Open security lanes and passengers screened per minute across them. */
  securityLanesOpen?: number;
  securityThroughputPerMin?: number;
  /** Parked aircraft running APU, GPUs connected, belt loaders running, fuel pumps running. */
  apusRunning?: number;
  gpusConnected?: number;
  beltLoadersRunning?: number;
  fuelPumpsRunning?: number;
  /** 0 = camera fully inside terminal, 1 = fully out on the apron (crossfades zones). */
  outdoorMix?: number;
  /**
   * Who plays the close belt and fuel loops. `apron` leaves those beds silent
   * so the positional apron mixer is the only copy.
   */
  serviceOwner?: 'apron' | 'ambience';
}

/**
 * Loops a bed or the apron mixer already plays. Game events must not start a
 * second copy (gpuHum is the event name for the apron GPU bed).
 */
export const OWNED_LOOP_SOUNDS = [
  'checkinChatter', 'rollingSuitcases', 'securityBeeps',
  'apuHum', 'apronGpu', 'gpuHum',
  'apronBeltLoader', 'apronFuelPump',
  'beltLoader', 'hydrantPump', 'heavyFuelTruck', 'reversingBeeper',
] as const;

export function isOwnedLoop(sound: string): boolean {
  return (OWNED_LOOP_SOUNDS as readonly string[]).includes(sound);
}

/** Stop leftover event loops for beds the mixers own. No-op if the engine was never opened. */
export function silenceOwnedEventLoops(): void {
  peekAudio()?.stopEventSounds(OWNED_LOOP_SOUNDS);
}

/** Many-source loudness: grows with count but saturates (sqrt) so 20 GPUs ≠ 20× louder. */
export const countIntensity = (n: number | undefined, full = 8): number =>
  !n || !Number.isFinite(n) || n <= 0 ? 0 : Math.min(1, 0.25 + 0.75 * Math.sqrt(Math.min(n, full) / full));

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

export function ambienceTargets(s: AmbienceState): Record<AmbienceLayer, number> {
  const out = clamp01(s.outdoorMix ?? 0.5);
  const inT = 1 - out * 0.85, inA = 0.15 + out * 0.85; // never fully gone: glass + open doors
  const lanes = s.securityLanesOpen ?? 0;
  const throughput = s.securityThroughputPerMin ?? 0;
  // An open lane with nobody in it does not beep. The old 0.2 floor ran from the menu.
  const sec = lanes > 0 && throughput > 0 ? Math.min(1, throughput / (lanes * 6)) : 0;
  const apronOwnsServices = s.serviceOwner === 'apron';
  return {
    checkinChatter: crowdIntensity(s.checkinOccupancy ?? 0) * inT,
    rollingSuitcases: crowdIntensity(s.walkingWithBagsOccupancy ?? 0) * inT,
    securityBeeps: sec * inT,
    apuHum: countIntensity(s.apusRunning) * inA,
    gpu: countIntensity(s.gpusConnected) * inA,
    beltLoader: apronOwnsServices ? 0 : countIntensity(s.beltLoadersRunning, 6) * inA,
    fuelPump: apronOwnsServices ? 0 : countIntensity(s.fuelPumpsRunning, 6) * inA,
  };
}

/** Seconds until the next PA announcement: busier terminal → more frequent (45–150 s). */
export function paIntervalSec(checkinOccupancy: number, rand = 0.5): number {
  const busy = crowdIntensity(checkinOccupancy);
  return (150 - 90 * busy) * (0.8 + 0.4 * clamp01(rand));
}

/** Engine subset the mixer needs (AudioEngine satisfies it). */
export interface AmbienceSink { playSfx(id: SfxId, options?: SfxPlayOptions): SoundHandle | null }

export const AMBIENCE_SILENT = 0.02;

export class AmbienceMixer {
  private live = new Map<AmbienceLayer, SoundHandle>();
  private paIn: number;
  private sink: AmbienceSink;
  private rand: () => number;
  private paPosition?: Vec3;
  constructor(sink: AmbienceSink, rand: () => number = Math.random, paPosition?: Vec3) {
    this.sink = sink; this.rand = rand; this.paPosition = paPosition;
    this.paIn = paIntervalSec(0, this.rand());
  }
  /** Call every frame or sim tick with elapsed real seconds. */
  update(state: AmbienceState, dtSec: number): void {
    const t = ambienceTargets(state);
    for (const id of AMBIENCE_LAYER_IDS) {
      const v = t[id], h = this.live.get(id);
      if (v > AMBIENCE_SILENT) {
        if (h && !h.stopped) h.setIntensity(v);
        else {
          const n = this.sink.playSfx(AMBIENCE_LAYERS[id].sound, { intensity: v, slot: `bed:${id}` });
          if (n) this.live.set(id, n);
        }
      } else if (h) {
        h.stop(id === 'beltLoader' || id === 'fuelPump' ? 0 : 1.5);
        this.live.delete(id);
      }
    }
    const people = state.checkinOccupancy ?? 0;
    if (people > 0) {
      this.paIn -= dtSec;
      if (this.paIn <= 0) {
        this.sink.playSfx(PA_SOUND, this.paPosition ? { position: this.paPosition } : {});
        this.paIn = paIntervalSec(people, this.rand());
      }
    }
  }
  activeLayers(): AmbienceLayer[] { return [...this.live.keys()]; }
  stopAll(fade = 1): void { for (const h of this.live.values()) h.stop(fade); this.live.clear(); }
}

const AMBIENCE_SLOT = '__hatchfieldAmbience';

/** One ambience mixer for the page. A reloaded module stops the previous owner first. */
export function claimAmbience(sink: AmbienceSink, rand: () => number = Math.random): AmbienceMixer {
  const g = globalThis as Record<string, unknown>;
  const held = g[AMBIENCE_SLOT];
  if (held instanceof AmbienceMixer) return held;
  if (held && typeof (held as AmbienceMixer).stopAll === 'function') (held as AmbienceMixer).stopAll(0);
  const created = new AmbienceMixer(sink, rand);
  g[AMBIENCE_SLOT] = created;
  return created;
}

/** Stop the page ambience owner and drop it so the next claim starts clean. */
export function releaseAmbience(): void {
  const g = globalThis as Record<string, unknown>;
  const held = g[AMBIENCE_SLOT];
  if (held && typeof (held as AmbienceMixer).stopAll === 'function') (held as AmbienceMixer).stopAll(0);
  delete g[AMBIENCE_SLOT];
}
