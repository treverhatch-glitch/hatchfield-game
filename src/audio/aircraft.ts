import { burst, loopVoice, noise, oneShot, tone, type Voice } from './synth';
import { hashSeed, jit, mulberry32 } from './rng';

/** Mirrors the ids in src/game/airframes.ts (AIRFRAMES). */
export const AIRCRAFT_TYPE_IDS = [
  'crj700', 'e175', 'a320neo', 'b738', 'a321', 'b789', 'b77w', 'a359', 'atr72', 'b752f', 'b763f', 'b748f',
  'c130', 'c17', 'kc135', 'f15', 'citation', 'pc12', 'cl415', 'at802', 'aw139', 's76', 'a380', 'an124', 'c5',
] as const;
export type AircraftTypeId = (typeof AIRCRAFT_TYPE_IDS)[number];

export type EngineClass =
  | 'piston' | 'singleTurboprop' | 'twinTurboprop' | 'quadTurboprop' | 'bizjet' | 'regionalJet'
  | 'narrowbodyTwin' | 'widebodyTwin' | 'quadJet' | 'heavyFreighter' | 'militaryHeavy' | 'fighter' | 'helicopter';

export const PHASES = ['approach', 'landing', 'taxi', 'start', 'takeoff', 'pushback'] as const;
export type AircraftPhase = (typeof PHASES)[number];
export const VARIANTS_PER_PHASE = 5;

/** Distinct character for each of the 5 variants in each phase. */
export const PHASE_CHARACTERS: Record<AircraftPhase, readonly [string, string, string, string, string]> = {
  approach: ['steady', 'gearRumble', 'flapWhistle', 'throttleSurge', 'distant'],
  landing: ['greaser', 'firm', 'bounce', 'maxReverse', 'idleReverse'],
  taxi: ['idle', 'breakaway', 'turning', 'brakeSqueal', 'singleEngine'],
  start: ['standard', 'slowLight', 'crossbleed', 'quickStart', 'windmill'],
  takeoff: ['standard', 'flexDerate', 'toga', 'buzzsaw', 'steepClimb'],
  pushback: ['apuOnly', 'apuPlusStart', 'idleAll', 'towHum', 'coldSoak'],
};

export const LOOPING_PHASES: Record<AircraftPhase, boolean> = {
  approach: true, landing: false, taxi: true, start: false, takeoff: false, pushback: true,
};

interface ClassBase {
  whineHz: number; whineLevel: number; roarLp: number; roarLevel: number; rumbleHz: number;
  propHz: number; propDepth: number; rotorHz: number; buzzHz: number; buzzLevel: number; reverse: number;
}
const B = (p: Partial<ClassBase>): ClassBase => ({
  whineHz: 0, whineLevel: 0, roarLp: 2000, roarLevel: 0.5, rumbleHz: 60, propHz: 0, propDepth: 0,
  rotorHz: 0, buzzHz: 0, buzzLevel: 0, reverse: 0, ...p,
});
export const CLASS_BASE: Record<EngineClass, ClassBase> = {
  piston: B({ roarLp: 900, roarLevel: 0.3, rumbleHz: 45, propHz: 70, propDepth: 0.5, buzzHz: 95, buzzLevel: 0.12 }),
  singleTurboprop: B({ whineHz: 6200, whineLevel: 0.03, roarLp: 1500, roarLevel: 0.35, propHz: 32, propDepth: 0.4, reverse: 0.4 }),
  twinTurboprop: B({ whineHz: 5600, whineLevel: 0.035, roarLp: 1300, roarLevel: 0.4, propHz: 26, propDepth: 0.45, reverse: 0.5 }),
  quadTurboprop: B({ whineHz: 4800, whineLevel: 0.04, roarLp: 1100, roarLevel: 0.55, rumbleHz: 40, propHz: 20, propDepth: 0.5, reverse: 0.6 }),
  bizjet: B({ whineHz: 7200, whineLevel: 0.06, roarLp: 2600, roarLevel: 0.35, rumbleHz: 70, reverse: 0.3 }),
  regionalJet: B({ whineHz: 5200, whineLevel: 0.06, roarLp: 2800, roarLevel: 0.45, rumbleHz: 60, reverse: 0.5 }),
  narrowbodyTwin: B({ whineHz: 3800, whineLevel: 0.055, roarLp: 3200, roarLevel: 0.6, rumbleHz: 50, buzzHz: 420, buzzLevel: 0.03, reverse: 0.7 }),
  widebodyTwin: B({ whineHz: 2600, whineLevel: 0.05, roarLp: 2400, roarLevel: 0.75, rumbleHz: 38, buzzHz: 300, buzzLevel: 0.025, reverse: 0.8 }),
  quadJet: B({ whineHz: 2200, whineLevel: 0.05, roarLp: 2000, roarLevel: 0.85, rumbleHz: 32, buzzHz: 260, buzzLevel: 0.03, reverse: 0.85 }),
  heavyFreighter: B({ whineHz: 2000, whineLevel: 0.055, roarLp: 1800, roarLevel: 0.9, rumbleHz: 28, buzzHz: 220, buzzLevel: 0.035, reverse: 0.9 }),
  militaryHeavy: B({ whineHz: 2400, whineLevel: 0.06, roarLp: 2100, roarLevel: 0.85, rumbleHz: 32, buzzHz: 280, buzzLevel: 0.04, reverse: 0.9 }),
  fighter: B({ whineHz: 4500, whineLevel: 0.07, roarLp: 5200, roarLevel: 0.9, rumbleHz: 45, buzzHz: 85, buzzLevel: 0.12 }),
  helicopter: B({ whineHz: 6500, whineLevel: 0.05, roarLp: 900, roarLevel: 0.25, rumbleHz: 35, rotorHz: 5.5, propHz: 24, propDepth: 0.2 }),
};

export interface AircraftProfile {
  typeId: AircraftTypeId; engineClass: EngineClass; engines: number;
  /** Airframe scale from airframes.ts; bigger = lower pitch, louder. */
  size: number;
  /** Per-type pitch & tone tweaks for distinct character. */
  pitch: number; brightness: number; roughness: number; note: string;
}
const P = (typeId: AircraftTypeId, engineClass: EngineClass, engines: number, size: number, pitch: number, brightness: number, roughness: number, note: string): AircraftProfile =>
  ({ typeId, engineClass, engines, size, pitch, brightness, roughness, note });

export const AIRCRAFT_PROFILES: Record<AircraftTypeId, AircraftProfile> = {
  crj700: P('crj700', 'regionalJet', 2, 0.78, 1.12, 1.15, 0.2, 'rear-mounted CF34, shrill whine'),
  e175: P('e175', 'regionalJet', 2, 0.84, 1.04, 1.05, 0.2, 'underwing CF34, smoother'),
  a320neo: P('a320neo', 'narrowbodyTwin', 2, 1.08, 1.05, 0.9, 0.15, 'LEAP/GTF, quiet with geared hum'),
  b738: P('b738', 'narrowbodyTwin', 2, 1.12, 0.98, 1.1, 0.35, 'CFM56 buzzsaw'),
  a321: P('a321', 'narrowbodyTwin', 2, 1.22, 0.95, 1.0, 0.25, 'heavier narrowbody, longer roll'),
  b789: P('b789', 'widebodyTwin', 2, 1.55, 0.9, 0.85, 0.15, 'GEnx/Trent 1000, smooth deep'),
  b77w: P('b77w', 'widebodyTwin', 2, 1.7, 0.86, 0.9, 0.22, 'GE90, deep twin'),
  a359: P('a359', 'widebodyTwin', 2, 1.62, 0.88, 0.8, 0.12, 'Trent XWB, very smooth'),
  atr72: P('atr72', 'twinTurboprop', 2, 0.7, 1.0, 1.0, 0.3, 'PW127 six-blade drone'),
  b752f: P('b752f', 'narrowbodyTwin', 2, 1.18, 0.86, 1.2, 0.45, 'RB211 hot-rod, loud climb'),
  b763f: P('b763f', 'widebodyTwin', 2, 1.35, 0.92, 1.05, 0.35, 'CF6, older rougher widebody'),
  b748f: P('b748f', 'quadJet', 4, 1.78, 0.85, 0.9, 0.3, 'GEnx-2B quad, four-engine beat'),
  c130: P('c130', 'quadTurboprop', 4, 1.18, 1.0, 1.1, 0.5, 'T56 growl, four-prop beating'),
  c17: P('c17', 'militaryHeavy', 4, 1.58, 0.9, 1.0, 0.4, 'F117 quad, heavy reverse'),
  kc135: P('kc135', 'militaryHeavy', 4, 1.42, 1.0, 1.15, 0.45, 'CFM56 quad tanker'),
  f15: P('f15', 'fighter', 2, 0.55, 1.0, 1.3, 0.8, 'F100 afterburner crackle'),
  citation: P('citation', 'bizjet', 2, 0.58, 1.1, 1.1, 0.1, 'PW306 small turbofan whine'),
  pc12: P('pc12', 'singleTurboprop', 1, 0.62, 1.05, 1.0, 0.25, 'PT6 single, high whine'),
  cl415: P('cl415', 'twinTurboprop', 2, 1.05, 0.85, 0.9, 0.55, 'PW123 high-wing amphibian, gruff'),
  at802: P('at802', 'singleTurboprop', 1, 0.72, 0.9, 1.1, 0.6, 'PT6-67F ag tanker, raw'),
  aw139: P('aw139', 'helicopter', 2, 0.88, 1.0, 1.0, 0.3, 'five-blade rotor, PT6C'),
  s76: P('s76', 'helicopter', 2, 0.82, 1.1, 1.05, 0.25, 'four-blade rotor, faster slap'),
  a380: P('a380', 'quadJet', 4, 2.05, 0.8, 0.75, 0.15, 'quiet giant, sub-bass'),
  an124: P('an124', 'heavyFreighter', 4, 1.95, 0.82, 1.0, 0.6, 'D-18T, rattly heavy'),
  c5: P('c5', 'militaryHeavy', 4, 1.88, 0.8, 0.95, 0.4, 'TF39/F138 quad, ultra heavy'),
};

/** Map a type id (or unknown id) to a profile; unknowns fall back to a narrowbody. */
export function profileFor(typeId: string): AircraftProfile {
  return (AIRCRAFT_PROFILES as Record<string, AircraftProfile>)[typeId]
    ?? { ...AIRCRAFT_PROFILES.a320neo, typeId: 'a320neo', note: `fallback for ${typeId}` };
}

/** Fully-resolved parameters for one variant. Pure data (testable). */
export interface AircraftSoundParams extends ClassBase {
  typeId: string; phase: AircraftPhase; variant: number; character: string; engineClass: EngineClass;
  engines: number; size: number; duration: number; gain: number;
  chirp: number; gearRumble: number; flapWhistleHz: number; spoolSec: number; squeal: number; beatHz: number; lowpass: number;
}

export function aircraftParams(typeId: string, phase: AircraftPhase, variant: number, seed = 0): AircraftSoundParams {
  const prof = profileFor(typeId);
  const base = CLASS_BASE[prof.engineClass];
  const v = ((Math.floor(variant) % VARIANTS_PER_PHASE) + VARIANTS_PER_PHASE) % VARIANTS_PER_PHASE;
  const rng = mulberry32(hashSeed(typeId, phase, v, seed));
  const sizeP = 1 / Math.sqrt(prof.size);
  const pitch = prof.pitch * sizeP;
  const p: AircraftSoundParams = {
    ...base,
    typeId, phase, variant: v, character: PHASE_CHARACTERS[phase][v], engineClass: prof.engineClass,
    engines: prof.engines, size: prof.size,
    whineHz: base.whineHz * pitch * jit(rng, 0.06),
    whineLevel: base.whineLevel * jit(rng, 0.15),
    roarLp: base.roarLp * prof.brightness * jit(rng, 0.1),
    roarLevel: base.roarLevel * Math.min(1.3, 0.7 + prof.size * 0.3) * jit(rng, 0.1),
    rumbleHz: base.rumbleHz * sizeP * jit(rng, 0.08),
    propHz: base.propHz * prof.pitch * jit(rng, 0.05),
    propDepth: base.propDepth * jit(rng, 0.15),
    rotorHz: base.rotorHz * prof.pitch * jit(rng, 0.04),
    buzzHz: base.buzzHz * pitch * jit(rng, 0.08),
    buzzLevel: base.buzzLevel * (1 + prof.roughness) * jit(rng, 0.2),
    reverse: base.reverse * jit(rng, 0.1),
    duration: Infinity, gain: 1, chirp: 0, gearRumble: 0, flapWhistleHz: 0,
    spoolSec: (4 + prof.size * 3) * jit(rng, 0.15), squeal: 0,
    beatHz: prof.engines > 1 ? (0.4 + rng() * 1.6) * (prof.roughness + 0.3) : 0,
    lowpass: 20000,
  };
  const c = p.character;
  switch (phase) {
    case 'approach':
      p.whineLevel *= 1.2; p.roarLevel *= 0.55;
      if (c === 'gearRumble') p.gearRumble = 0.3 * jit(rng, 0.2);
      if (c === 'flapWhistle') p.flapWhistleHz = 1800 * jit(rng, 0.15);
      if (c === 'throttleSurge') { p.roarLevel *= 1.5; p.beatHz += 0.3; }
      if (c === 'distant') { p.lowpass = 1400 * jit(rng, 0.2); p.gain = 0.5; }
      break;
    case 'landing':
      p.duration = 6 + prof.size * 2;
      p.chirp = { greaser: 0.25, firm: 0.8, bounce: 0.6, maxReverse: 0.6, idleReverse: 0.5 }[c as 'firm'] * jit(rng, 0.15);
      p.reverse *= { greaser: 0.6, firm: 0.8, bounce: 0.7, maxReverse: 1.4, idleReverse: 0.25 }[c as 'firm'];
      if (prof.engineClass === 'helicopter') { p.chirp *= 0.2; p.reverse = 0; }
      break;
    case 'taxi':
      p.roarLevel *= 0.25; p.whineLevel *= 0.9;
      if (c === 'breakaway') p.roarLevel *= 2;
      if (c === 'turning') p.beatHz += 0.6;
      if (c === 'brakeSqueal') p.squeal = 0.08 * jit(rng, 0.3);
      if (c === 'singleEngine') { p.engines = Math.max(1, Math.floor(p.engines / 2)); p.whineLevel *= 0.6; }
      break;
    case 'start':
      p.duration = p.spoolSec + 3;
      if (c === 'slowLight') p.spoolSec *= 1.5;
      if (c === 'crossbleed') p.whineLevel *= 1.3;
      if (c === 'quickStart') p.spoolSec *= 0.6;
      if (c === 'windmill') { p.roarLevel *= 0.5; p.lowpass = 6000; }
      p.duration = p.spoolSec + 3;
      break;
    case 'takeoff':
      p.duration = 8 + prof.size * 3;
      if (c === 'flexDerate') p.roarLevel *= 0.8;
      if (c === 'toga') p.roarLevel *= 1.2;
      if (c === 'buzzsaw') p.buzzLevel = Math.max(p.buzzLevel, 0.02) * 2.2;
      if (c === 'steepClimb') p.duration *= 0.75;
      break;
    case 'pushback':
      p.roarLevel *= 0.12; p.whineLevel *= 0.5;
      if (c === 'apuOnly') { p.whineHz = 7600 * jit(rng, 0.05); p.whineLevel = 0.03; }
      if (c === 'apuPlusStart') p.whineLevel *= 1.6;
      if (c === 'idleAll') p.roarLevel *= 2;
      if (c === 'towHum') p.gearRumble = 0.15;
      if (c === 'coldSoak') p.lowpass = 3000 * jit(rng, 0.1);
      break;
  }
  return p;
}

/** Build the node graph for an aircraft voice. */
export function buildAircraftSound(ctx: BaseAudioContext, p: AircraftSoundParams, out: AudioNode): Voice {
  const t = ctx.currentTime;
  const m = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.lowpass;
  const body = ctx.createGain(); body.gain.value = p.gain;
  body.connect(lp).connect(m);
  const srcs: AudioScheduledSourceNode[] = [];
  // Roar (broadband jet/prop wash)
  const n = noise(ctx); const roarF = ctx.createBiquadFilter(); roarF.type = 'lowpass'; roarF.frequency.value = p.roarLp;
  const roar = ctx.createGain(); roar.gain.value = p.roarLevel;
  n.connect(roarF).connect(roar).connect(body); srcs.push(n);
  // Turbine whine
  const whine = ctx.createGain(); whine.gain.value = p.whineLevel;
  const wosc: OscillatorNode[] = [];
  if (p.whineHz > 0) {
    for (let i = 0; i < Math.min(p.engines, 2); i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = p.whineHz * (1 + i * 0.004);
      o.connect(whine); srcs.push(o); wosc.push(o);
    }
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = p.whineHz; bp.Q.value = 6;
    whine.connect(bp).connect(body);
  }
  // Low rumble
  const rum = ctx.createOscillator(); rum.frequency.value = p.rumbleHz;
  const rumG = ctx.createGain(); rumG.gain.value = 0.15 + p.gearRumble; rum.connect(rumG).connect(body); srcs.push(rum);
  // Propeller blade-pass / rotor slap AM on the roar
  const am = (hz: number, depth: number) => {
    if (hz <= 0 || depth <= 0) return;
    const l = ctx.createOscillator(); l.type = 'square'; l.frequency.value = hz;
    const g = ctx.createGain(); g.gain.value = p.roarLevel * depth; l.connect(g).connect(roar.gain); srcs.push(l);
  };
  am(p.propHz, p.propDepth); am(p.rotorHz, 0.8); am(p.beatHz, 0.12);
  // Buzzsaw / afterburner crackle
  if (p.buzzLevel > 0 && p.buzzHz > 0) {
    const bz = ctx.createOscillator(); bz.type = 'square'; bz.frequency.value = p.buzzHz;
    const bg = ctx.createGain(); bg.gain.value = p.buzzLevel; bz.connect(bg).connect(body); srcs.push(bz);
  }
  if (p.flapWhistleHz > 0) {
    const fw = noise(ctx); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = p.flapWhistleHz; f.Q.value = 12;
    const g = ctx.createGain(); g.gain.value = 0.15; fw.connect(f).connect(g).connect(body); srcs.push(fw);
  }
  if (p.squeal > 0) tone(ctx, body, 'sine', 2900, t + 1, 0.05, p.squeal, 0.6, 2700);

  if (LOOPING_PHASES[p.phase]) {
    return loopVoice(ctx, out, srcs, m, (v, tt) => {
      roar.gain.setTargetAtTime(p.roarLevel * (0.4 + v), tt, 0.5);
      whine.gain.setTargetAtTime(p.whineLevel * (0.6 + v * 0.8), tt, 0.5);
      wosc.forEach((o) => o.frequency.setTargetAtTime(p.whineHz * (0.85 + v * 0.3), tt, 0.8));
    }, 0.5);
  }
  // One-shot phases: shape envelopes, then schedule stop.
  m.connect(out);
  const d = p.duration;
  if (p.phase === 'start') {
    wosc.forEach((o) => { o.frequency.setValueAtTime(p.whineHz * 0.1, t); o.frequency.exponentialRampToValueAtTime(p.whineHz * 0.7, t + p.spoolSec); });
    roar.gain.setValueAtTime(0.0001, t); roar.gain.exponentialRampToValueAtTime(p.roarLevel * 0.3, t + p.spoolSec);
    m.gain.setValueAtTime(1, t + d - 1); m.gain.exponentialRampToValueAtTime(0.0001, t + d);
  } else if (p.phase === 'takeoff') {
    roar.gain.setValueAtTime(p.roarLevel * 0.3, t); roar.gain.linearRampToValueAtTime(p.roarLevel * 1.3, t + 3);
    roarF.frequency.setValueAtTime(p.roarLp * 0.5, t); roarF.frequency.exponentialRampToValueAtTime(p.roarLp * 1.4, t + 3);
    roarF.frequency.exponentialRampToValueAtTime(p.roarLp * 0.3, t + d);
    wosc.forEach((o) => o.frequency.linearRampToValueAtTime(p.whineHz * 1.25, t + 3));
    m.gain.setValueAtTime(1, t + d * 0.45); m.gain.exponentialRampToValueAtTime(0.0001, t + d);
  } else {
    // landing: idle approach → chirp(s) → reverse thrust swell → rollout
    const td = t + 0.4;
    if (p.chirp > 0) {
      burst(ctx, body, td, 'bandpass', 2300, 3, p.chirp, 0.2);
      if (p.character === 'bounce') burst(ctx, body, td + 0.7, 'bandpass', 2100, 3, p.chirp * 0.8, 0.25);
      tone(ctx, body, 'sine', 80, td, 0.005, 0.3 + p.chirp * 0.5, 0.3, 40);
    }
    roar.gain.setValueAtTime(p.roarLevel * 0.3, t);
    if (p.reverse > 0) {
      roar.gain.linearRampToValueAtTime(p.roarLevel * (0.3 + p.reverse), td + 1.8);
      roar.gain.linearRampToValueAtTime(p.roarLevel * 0.2, td + 4.5);
    }
    m.gain.setValueAtTime(1, t + d - 1.5); m.gain.exponentialRampToValueAtTime(0.0001, t + d);
  }
  srcs.forEach((s) => { s.start(t); s.stop(t + d + 0.1); });
  return oneShot(d);
}
