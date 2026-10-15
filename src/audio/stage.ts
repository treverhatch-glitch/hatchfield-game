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
  taxi: 0.4,
  pushback: 0.28,
  start: 0.32,
  takeoff: 0.72,
  landing: 0.6,
  approach: 0.42,
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
  /** True only while the mesh is in the reverse-dock animation. */
  reversing?: boolean;
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
      const intensity = JET_INTENSITY[phase] ?? 0.4;
      const key = `jet:${f.id}:${phase}`;
      wanted.set(key, {
        position,
        intensity,
        start: () => this.sink.play(airframe, phase, { position, intensity, rolloff: JET_ROLLOFF, slot: `apron:${key}` }),
      });
    }
    for (const t of snap.trucks) {
      const position = cellToWorld(t.x, t.y, 1.2);
      const rolling = t.dwell <= 0 && t.preDwell <= 0 && t.path.length > 1;
      if (rolling) {
        const intensity = t.returning ? 0.42 : 0.55;
        const key = `veh:${t.id}`;
        wanted.set(key, {
          position,
          intensity,
          start: () => this.sink.playSfx('heavyFuelTruck', { position, intensity, rolloff: VEHICLE_ROLLOFF, slot: `apron:${key}` }),
        });
      }
      if (t.reversing) {
        const key = `rev:${t.id}`;
        wanted.set(key, {
          position,
          intensity: 0.7,
          start: () => this.sink.playSfx('reversingBeeper', { position, intensity: 0.7, rolloff: VEHICLE_ROLLOFF, slot: `apron:${key}` }),
        });
      }
      if (!rolling && t.dwell > 0 && (t.kind === 'fuel' || t.kind === 'deice')) {
        const key = `fuel:${t.id}`;
        wanted.set(key, {
          position,
          intensity: 0.5,
          start: () => this.sink.playSfx('hydrantPump', { position, intensity: 0.5, rolloff: VEHICLE_ROLLOFF, slot: `apron:${key}` }),
        });
      }
      if (!rolling && t.dwell > 0 && t.kind === 'bags') {
        const key = `belt:${t.id}`;
        wanted.set(key, {
          position,
          intensity: 0.48,
          start: () => this.sink.playSfx('beltLoader', { position, intensity: 0.48, rolloff: VEHICLE_ROLLOFF, slot: `apron:${key}` }),
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
    for (const handle of this.live.values()) handle.stop(0);
    this.live.clear();
  }

  active(): number { return this.live.size; }
}

const APRON_SLOT = '__hatchfieldApronMixer';

function pageApron(sink: ApronSink): ApronMixer {
  const g = globalThis as Record<string, unknown>;
  const held = g[APRON_SLOT];
  if (held instanceof ApronMixer) return held;
  if (held && typeof (held as ApronMixer).stop === 'function') (held as ApronMixer).stop();
  const created = new ApronMixer(sink);
  g[APRON_SLOT] = created;
  return created;
}

export function syncApronAudio(snap: ApronSnapshot, camera: ApronCamera, sink: ApronSink = getAudio()): void {
  pageApron(sink).sync(snap, camera);
}

/** Stop every apron loop this page owns. Safe to call on each hall frame and on unmount. */
export function releaseApronAudio(): void {
  const g = globalThis as Record<string, unknown>;
  const held = g[APRON_SLOT];
  if (held && typeof (held as ApronMixer).stop === 'function') (held as ApronMixer).stop();
  delete g[APRON_SLOT];
}
