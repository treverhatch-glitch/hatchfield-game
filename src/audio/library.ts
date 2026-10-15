/**
 * CC0 sample map. Files live in public/assets/audio and are listed in CREDITS.md.
 * Procedural recipes stay in place until a clip is decoded into the engine.
 */
import type { AircraftPhase } from './aircraft';
import type { SfxId } from './services';
import type { SoundId } from './synth';

export type ClipId =
  | 'crowd' | 'pa' | 'jetTaxi' | 'jetTakeoff' | 'jetLanding'
  | 'vehicle' | 'reverse' | 'refuel' | 'belt'
  | 'click' | 'cash' | 'contract' | 'alert';

export const CLIP_FILE: Record<ClipId, string> = {
  crowd: 'crowd.ogg',
  pa: 'pa_chime.ogg',
  jetTaxi: 'jet_taxi.ogg',
  jetTakeoff: 'jet_takeoff.ogg',
  jetLanding: 'jet_landing.ogg',
  vehicle: 'vehicle_engine.ogg',
  reverse: 'reverse_beep.ogg',
  refuel: 'refuel_hum.ogg',
  belt: 'baggage_belt.ogg',
  click: 'ui_click.ogg',
  cash: 'cash_chime.ogg',
  contract: 'contract_chime.ogg',
  alert: 'alert.ogg',
};

export const CLIP_FILES = Object.values(CLIP_FILE);

export type SampleDrive = 'throttle' | 'level' | 'none';

export interface SampleSpec {
  clip: ClipId;
  gain: number;
  rate: number;
  drive: SampleDrive;
}

const spec = (clip: ClipId, gain: number, rate = 1, drive: SampleDrive = 'none'): SampleSpec =>
  ({ clip, gain, rate, drive });

const SFX_SAMPLE: Partial<Record<SfxId, SampleSpec>> = {
  crowdMurmur: spec('crowd', 0.34, 1, 'level'),
  checkinChatter: spec('crowd', 0.3, 1.02, 'level'),
  queueGrumble: spec('crowd', 0.26, 0.94, 'level'),
  doorShuffle: spec('crowd', 0.18, 1.08, 'level'),
  paAnnouncement: spec('pa', 0.4),
  boardingChime: spec('pa', 0.36),
  reversingBeeper: spec('reverse', 0.22, 1, 'none'),
  hydrantPump: spec('refuel', 0.26, 1, 'level'),
  apronFuelPump: spec('refuel', 0.22, 0.97, 'level'),
  beltLoader: spec('belt', 0.26, 1, 'level'),
  apronBeltLoader: spec('belt', 0.2, 1.03, 'level'),
  heavyFuelTruck: spec('vehicle', 0.32, 0.86, 'throttle'),
  passengerBus: spec('vehicle', 0.3, 1.05, 'throttle'),
  towbarlessTug: spec('vehicle', 0.3, 0.78, 'throttle'),
  towTruck: spec('vehicle', 0.3, 0.8, 'throttle'),
  repairVan: spec('vehicle', 0.26, 1.12, 'throttle'),
  contractorVan: spec('vehicle', 0.26, 1.08, 'throttle'),
  deliveryTruck: spec('vehicle', 0.32, 0.9, 'throttle'),
  runwaySweeper: spec('vehicle', 0.28, 1.15, 'throttle'),
  baggageTugCart: spec('vehicle', 0.24, 1.2, 'throttle'),
  uldLoader: spec('vehicle', 0.28, 0.95, 'throttle'),
  cashInTick: spec('cash', 0.36),
  shopTill: spec('cash', 0.3),
  contractOffer: spec('contract', 0.38),
  slaBonus: spec('contract', 0.34, 1.04),
  seasonPublished: spec('contract', 0.34, 0.98),
  hubFanfare: spec('contract', 0.4),
  disruptionAlert: spec('alert', 0.32),
  lowCashWarning: spec('alert', 0.3, 0.92),
  gridlockAlert: spec('alert', 0.32, 1.06),
};

const SOUND_SAMPLE: Partial<Record<SoundId, SampleSpec>> = {
  crowd: spec('crowd', 0.34, 1, 'level'),
  uiClick: spec('click', 0.32),
  cashRegister: spec('cash', 0.36),
  chime: spec('pa', 0.36),
  paChime: spec('pa', 0.36),
  reverseBeeper: spec('reverse', 0.22),
  fuelPump: spec('refuel', 0.26, 1, 'level'),
  beltLoader: spec('belt', 0.26, 1, 'level'),
  baggageTug: spec('vehicle', 0.24, 1.2, 'throttle'),
  truckIdle: spec('vehicle', 0.26, 0.82, 'throttle'),
  truckDrive: spec('vehicle', 0.32, 1, 'throttle'),
  contractFanfare: spec('contract', 0.38),
  warning: spec('alert', 0.32),
  errorBuzz: spec('alert', 0.32, 0.9),
};

const PHASE_SAMPLE: Partial<Record<AircraftPhase, SampleSpec>> = {
  taxi: spec('jetTaxi', 0.38, 0.92, 'throttle'),
  pushback: spec('jetTaxi', 0.24, 0.72, 'throttle'),
  start: spec('jetTaxi', 0.28, 0.8, 'throttle'),
  takeoff: spec('jetTakeoff', 0.55, 1, 'throttle'),
  landing: spec('jetLanding', 0.5, 1, 'none'),
  approach: spec('jetLanding', 0.34, 0.86, 'throttle'),
};

export const sfxSample = (id: SfxId): SampleSpec | null => SFX_SAMPLE[id] ?? null;
export const soundSample = (id: SoundId): SampleSpec | null => SOUND_SAMPLE[id] ?? null;
export const aircraftSample = (phase: AircraftPhase): SampleSpec | null => PHASE_SAMPLE[phase] ?? null;

/** Roles the sound pass has to cover. Tests check each one resolves to a file. */
export const REQUIRED_ROLES = [
  'crowd', 'pa', 'jetTaxi', 'jetTakeoff', 'jetLanding', 'vehicle', 'reverse', 'refuel', 'belt', 'click', 'cash', 'contract', 'alert',
] as const satisfies readonly ClipId[];
