/**
 * Positional apron voices: jets (taxi, takeoff, landing) and service vehicles.
 * Distance and pan come from the engine listener. Terminal beds stay on the
 * ambience mixer; this layer is the apron, and it goes quiet in the hall.
 */
import type { AircraftPhase } from './aircraft';
import { getAudio, type SfxPlayOptions, type SoundHandle } from './engine';
import type { SfxId } from './services';
import { CELL } from '../render/aircraft/specs';
import { SIZE } from '../game/types';
import type { Vec3 } from './spatial';

const JET_ROLLOFF = { refDistance: 70, maxDistance: 900, rolloff: 0.85 };
const VEHICLE_ROLLOFF = { refDistance: 28, maxDistance: 320, rolloff: 1 };

const JET_PHASE: Record<string, AircraftPhase | undefined> = {
  taxi_in: 'taxi',
  taxi_out: 'taxi',
  mx_taxi: 'taxi',
  mx_return: 'taxi',
  pushback: 'pushback',
  takeoff: 'takeoff',
  landing: 'landing',
  approach: 'approach',
};

const JET_INTENSITY: Partial<Record<AircraftPhase, number>> = {
  taxi: 0.45,
  pushback: 0.3,
  start: 0.35,
  takeoff: 1,
  landing: 0.85,
  approach: 0.55,
};

export interface ApronFlight {
  id: string;
  airframeId: string;
  craft: string;
  phase: string;
  x: number;
  y: number;
  z: number;
}

export interface ApronTruck {
  id: string;
  kind: string;
  x: number;
  y: number;
  returning: boolean;
  dwell: number;
  preDwell: number;
  path: readonly unknown[];
}

export interface ApronSnapshot {
  view: 'apron' | 'hall';
  flights: readonly ApronFlight[];
  trucks: readonly ApronTruck[];
}

export interface ApronCamera {
  position: Vec3;
  right: Vec3;
}

export interface ApronSink {
  setListener(position: Vec3, right?: Vec3): void;
  play(aircraftTypeId: string, phase: AircraftPhase, options?: SfxPlayOptions): SoundHandle | null;
  playSfx(id: SfxId, options?: SfxPlayOptions): SoundHandle | null;
}

interface Wanted {
  position: Vec3;
  intensity: number;
  start: () => SoundHandle | null;
}

export function cellToWorld(c: number, r: number, y = 1.2): Vec3 {
  return {
    x: (c - (SIZE - 1) / 2) * CELL,
    y,
    z: (r - (SIZE - 1) / 2) * CELL,
  };
}

export class ApronMixer {
  private live = new Map<string, SoundHandle>();
  private sink: ApronSink;
  constructor(sink: ApronSink) { this.sink = sink; }

  sync(snap: ApronSnapshot, camera: ApronCamera): void {
    this.sink.setListener(camera.position, camera.right);
    if (snap.view !== 'apron') {
      this.stop();
      return;
    }
    const wanted = new Map<string, Wanted>();
    for (const f of snap.flights) {
      if (f.craft === 'helo') continue;
      const phase = JET_PHASE[f.phase];
      if (!phase) continue;
      const position = cellToWorld(f.x, f.y, 1.5 + Math.max(0, f.z) * CELL * 0.2);
      const airframe = f.airframeId || 'b738';
      wanted.set(`jet:${f.id}`, {
        position,
        intensity: JET_INTENSITY[phase] ?? 0.5,
        start: () => this.sink.play(airframe, phase, { position, intensity: JET_INTENSITY[phase] ?? 0.5, rolloff: JET_ROLLOFF }),
      });
    }
    for (const t of snap.trucks) {
      const position = cellToWorld(t.x, t.y, 1.2);
      const rolling = t.dwell <= 0 && t.preDwell <= 0 && t.path.length > 1;
      if (rolling) {
        wanted.set(`veh:${t.id}`, {
          position,
          intensity: t.returning ? 0.55 : 0.75,
          start: () => this.sink.playSfx('heavyFuelTruck', { position, intensity: 0.7, rolloff: VEHICLE_ROLLOFF }),
        });
      }
      if (rolling && t.returning) {
        wanted.set(`rev:${t.id}`, {
          position,
          intensity: 1,
          start: () => this.sink.playSfx('reversingBeeper', { position, rolloff: VEHICLE_ROLLOFF }),
        });
      }
      if (!rolling && t.dwell > 0 && (t.kind === 'fuel' || t.kind === 'deice')) {
        wanted.set(`fuel:${t.id}`, {
          position,
          intensity: 0.7,
          start: () => this.sink.playSfx('hydrantPump', { position, intensity: 0.7, rolloff: VEHICLE_ROLLOFF }),
        });
      }
      if (!rolling && t.dwell > 0 && t.kind === 'bags') {
        wanted.set(`belt:${t.id}`, {
          position,
          intensity: 0.65,
          start: () => this.sink.playSfx('beltLoader', { position, intensity: 0.65, rolloff: VEHICLE_ROLLOFF }),
        });
      }
    }
    for (const [key, handle] of this.live) {
      if (!wanted.has(key) || handle.stopped) {
        handle.stop(0.2);
        this.live.delete(key);
      }
    }
    for (const [key, item] of wanted) {
      const have = this.live.get(key);
      if (have && !have.stopped) {
        have.setPosition(item.position);
        have.setIntensity(item.intensity);
        continue;
      }
      const next = item.start();
      if (next) this.live.set(key, next);
    }
  }

  stop(): void {
    for (const handle of this.live.values()) handle.stop(0.25);
    this.live.clear();
  }

  active(): number { return this.live.size; }
}

let shared: ApronMixer | null = null;

export function syncApronAudio(snap: ApronSnapshot, camera: ApronCamera, sink: ApronSink = getAudio()): void {
  shared ??= new ApronMixer(sink);
  shared.sync(snap, camera);
}

export function releaseApronAudio(): void {
  shared?.stop();
}
