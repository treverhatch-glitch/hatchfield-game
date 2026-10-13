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
import type { SfxPlayOptions, SoundHandle } from './engine';
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
}

/** Many-source loudness: grows with count but saturates (sqrt) so 20 GPUs ≠ 20× louder. */
export const countIntensity = (n: number | undefined, full = 8): number =>
  !n || !Number.isFinite(n) || n <= 0 ? 0 : Math.min(1, 0.25 + 0.75 * Math.sqrt(Math.min(n, full) / full));

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

export function ambienceTargets(s: AmbienceState): Record<AmbienceLayer, number> {
  const out = clamp01(s.outdoorMix ?? 0.5);
  const inT = 1 - out * 0.85, inA = 0.15 + out * 0.85; // never fully gone: glass + open doors
  const lanes = s.securityLanesOpen ?? 0;
  const sec = lanes > 0 ? Math.min(1, 0.2 + 0.8 * Math.min(1, (s.securityThroughputPerMin ?? 0) / (lanes * 6))) : 0;
  return {
    checkinChatter: crowdIntensity(s.checkinOccupancy ?? 0) * inT,
    rollingSuitcases: crowdIntensity(s.walkingWithBagsOccupancy ?? 0) * inT,
    securityBeeps: sec * inT,
    apuHum: countIntensity(s.apusRunning) * inA,
    gpu: countIntensity(s.gpusConnected) * inA,
    beltLoader: countIntensity(s.beltLoadersRunning, 6) * inA,
    fuelPump: countIntensity(s.fuelPumpsRunning, 6) * inA,
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
        else { const n = this.sink.playSfx(AMBIENCE_LAYERS[id].sound, { intensity: v }); if (n) this.live.set(id, n); }
      } else if (h) { h.stop(1.5); this.live.delete(id); }
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
