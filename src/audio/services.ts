/**
 * Seeded, 5-variation procedural sounds for the logistics, maintenance,
 * construction, terminal-life and UI/notification systems.
 *
 * Every sound is a small data recipe (layers). `sfxParams(id, variant, seed)`
 * resolves it into concrete numbers: a fixed per-variant character offset plus
 * seeded jitter, so (id, variant, seed) always yields identical params and the
 * 5 variants of every sound are guaranteed to differ.
 */
import { burst, loopVoice, noise, oneShot, tone, type Category, type Voice } from './synth';
import { hashSeed, jit, mulberry32 } from './rng';

export const SFX_VARIANTS = 5;

/** Loop layers: driven continuously; intensity = throttle / load / density. */
export type LoopLayer =
  | { k: 'engine'; hz: number; lp: number; lvl: number }
  | { k: 'noise'; filter: BiquadFilterType; hz: number; q: number; lvl: number; am: number; amDepth: number }
  | { k: 'hum'; hz: number; harmonics: number; lvl: number; wave: OscillatorType }
  | { k: 'beep'; hz: number; rate: number; lvl: number };
/** One-shot layers, scheduled `at` seconds after start. */
export type ShotLayer =
  | { k: 'tone'; wave: OscillatorType; hz: number; hzEnd: number; at: number; a: number; dcy: number; lvl: number }
  | { k: 'burst'; filter: BiquadFilterType; hz: number; q: number; at: number; dcy: number; lvl: number };
export type Layer = LoopLayer | ShotLayer;

interface Recipe {
  category: Category;
  looping: boolean;
  /** 'throttle' = intensity raises pitch + level; 'level' = intensity scales loudness only (crowds). */
  drive?: 'throttle' | 'level';
  layers: Layer[];
}

// --- tiny recipe helpers (keep the table readable) ---
const eng = (hz: number, lp: number, lvl = 0.3): LoopLayer => ({ k: 'engine', hz, lp, lvl });
const nz = (filter: BiquadFilterType, hz: number, q: number, lvl: number, am = 0, amDepth = 0): LoopLayer => ({ k: 'noise', filter, hz, q, lvl, am, amDepth });
const hum = (hz: number, harmonics: number, lvl: number, wave: OscillatorType = 'sine'): LoopLayer => ({ k: 'hum', hz, harmonics, lvl, wave });
const beep = (hz: number, rate: number, lvl: number): LoopLayer => ({ k: 'beep', hz, rate, lvl });
const tn = (wave: OscillatorType, hz: number, at: number, dcy: number, lvl: number, hzEnd = 0, a = 0.005): ShotLayer => ({ k: 'tone', wave, hz, hzEnd, at, a, dcy, lvl });
const bs = (filter: BiquadFilterType, hz: number, at: number, dcy: number, lvl: number, q = 1): ShotLayer => ({ k: 'burst', filter, hz, q, at, dcy, lvl });
const loop = (category: Category, layers: Layer[], drive: 'throttle' | 'level' = 'throttle'): Recipe => ({ category, looping: true, drive, layers });
const shot = (category: Category, layers: Layer[]): Recipe => ({ category, looping: false, layers });
const seq = (n: number, gap: number, f: (i: number, at: number) => ShotLayer[]): ShotLayer[] =>
  Array.from({ length: n }, (_, i) => f(i, i * gap)).flat();
const arp = (wave: OscillatorType, freqs: number[], gap: number, dcy: number, lvl: number): ShotLayer[] =>
  freqs.map((f, i) => tn(wave, f, i * gap, dcy, lvl));

const RECIPES = {
  // ---- service vehicles ----
  heavyFuelTruck: loop('vehicles', [eng(24, 150, 0.35), nz('lowpass', 180, 0.7, 0.12, 0.6, 0.3)]),
  hydrantDispenser: loop('vehicles', [eng(40, 260, 0.25), nz('bandpass', 420, 1.2, 0.08)]),
  hydrantPump: loop('vehicles', [nz('bandpass', 300, 1.5, 0.3, 18, 0.5), hum(55, 3, 0.05, 'sawtooth')]),
  cateringScissorLift: loop('vehicles', [hum(160, 3, 0.06, 'sawtooth'), nz('bandpass', 900, 3, 0.06, 3, 0.6)]),
  beltLoader: loop('vehicles', [nz('bandpass', 800, 2, 0.22, 11, 0.6), hum(48, 2, 0.04, 'sawtooth')]),
  uldLoader: loop('vehicles', [eng(36, 220, 0.25), nz('bandpass', 600, 1.5, 0.1, 2, 0.5), hum(120, 2, 0.04, 'sawtooth')]),
  baggageTugCart: loop('vehicles', [eng(70, 900, 0.25), nz('bandpass', 2200, 2.5, 0.12, 9, 0.9)]),
  towbarlessTug: loop('vehicles', [eng(22, 130, 0.4), hum(90, 2, 0.04, 'sawtooth')]),
  gpuHum: loop('vehicles', [hum(400, 4, 0.05), eng(30, 160, 0.12)]),
  passengerBus: loop('vehicles', [eng(30, 200, 0.3), nz('lowpass', 250, 0.7, 0.08)]),
  busDoorHiss: shot('vehicles', [bs('highpass', 2800, 0, 0.7, 0.45, 0.7), bs('bandpass', 5000, 0.05, 0.35, 0.2, 2), tn('triangle', 300, 0.75, 0.08, 0.15, 180)]),
  reversingBeeper: loop('vehicles', [beep(1050, 1, 0.2)]),
  // ---- maintenance ----
  repairVan: loop('vehicles', [eng(45, 400, 0.25), nz('lowpass', 300, 0.7, 0.06)]),
  towTruck: loop('vehicles', [eng(28, 170, 0.35), nz('bandpass', 1400, 4, 0.05, 6, 0.8)]),
  runwaySweeper: loop('vehicles', [eng(34, 240, 0.25), nz('bandpass', 3000, 0.8, 0.25, 7, 0.4)]),
  impactWrench: shot('sfx', seq(8, 0.045, (_, at) => [bs('bandpass', 2600, at, 0.035, 0.4, 3)]).concat([tn('sawtooth', 220, 0, 0.5, 0.06, 140)])),
  breakdownClunk: shot('sfx', [tn('sine', 90, 0, 0.35, 0.8, 40, 0.003), bs('lowpass', 500, 0, 0.3, 0.6), bs('bandpass', 1200, 0.18, 0.2, 0.3, 3), bs('highpass', 2500, 0.35, 0.6, 0.15, 0.7)]),
  hazardTicks: loop('vehicles', [beep(1600, 1.6, 0.06), nz('highpass', 4000, 0.7, 0.02, 1.6, 1)]),
  // ---- construction ----
  contractorVan: loop('vehicles', [eng(48, 450, 0.25), nz('lowpass', 320, 0.7, 0.06)]),
  deliveryTruck: loop('vehicles', [eng(30, 190, 0.32), nz('bandpass', 1800, 3, 0.04, 5, 0.7)]),
  scaffolding: shot('sfx', [bs('bandpass', 2400, 0, 0.25, 0.4, 6), tn('triangle', 1250, 0.01, 0.6, 0.15), tn('triangle', 1870, 0.12, 0.45, 0.1), bs('bandpass', 1600, 0.3, 0.2, 0.25, 6)]),
  hammering: shot('sfx', seq(4, 0.32, (_, at) => [bs('bandpass', 1800, at, 0.08, 0.5, 3), tn('triangle', 320, at, 0.12, 0.35, 200, 0.002)])),
  concreteMixer: loop('vehicles', [eng(28, 180, 0.3), nz('lowpass', 500, 0.8, 0.2, 0.8, 0.6)]),
  // ---- terminal life ----
  crowdMurmur: loop('ambient', [nz('bandpass', 350, 4, 0.3, 0.7, 0.4), nz('bandpass', 900, 4, 0.25, 1.2, 0.4), nz('bandpass', 2200, 4, 0.12, 1.7, 0.4)], 'level'),
  rollingSuitcases: loop('sfx', [nz('bandpass', 1600, 1.2, 0.16, 28, 0.7), nz('bandpass', 700, 2, 0.06, 4, 0.8)], 'level'),
  boardingChime: shot('ambient', [tn('sine', 784, 0, 0.9, 0.3), tn('sine', 988, 0.4, 0.9, 0.28), tn('sine', 1175, 0.8, 1.3, 0.25)]),
  jetBridgeDock: shot('vehicles', [tn('sawtooth', 100, 0, 1.6, 0.06, 80, 0.2), bs('lowpass', 300, 0, 1.8, 0.12), tn('sine', 70, 1.8, 0.4, 0.6, 35, 0.003), bs('bandpass', 900, 1.8, 0.25, 0.4, 2), bs('highpass', 3000, 2.1, 0.5, 0.15, 0.7)]),
  // ---- UI / notifications ----
  reportReady: shot('ui', arp('sine', [1046.5, 1318.5, 1568], 0.08, 0.4, 0.2)),
  disruptionAlert: shot('ui', seq(3, 0.28, (_, at) => [tn('square', 740, at, 0.12, 0.12), tn('square', 554, at + 0.13, 0.12, 0.12)])),
  airlineRatingUp: shot('ui', arp('triangle', [659.3, 784, 987.8, 1318.5], 0.07, 0.3, 0.2)),
  airlineRatingDown: shot('ui', arp('triangle', [987.8, 784, 622.3, 493.9], 0.09, 0.3, 0.2)),
  contractOffer: shot('ui', arp('triangle', [523.3, 784, 1046.5], 0.1, 0.4, 0.22).concat([tn('sine', 1568, 0.35, 0.8, 0.12)])),
  undo: shot('ui', [tn('triangle', 900, 0, 0.12, 0.2, 600), bs('highpass', 3000, 0, 0.03, 0.06)]),
  redo: shot('ui', [tn('triangle', 600, 0, 0.12, 0.2, 900), bs('highpass', 3000, 0, 0.03, 0.06)]),
  cashInTick: shot('ui', [tn('sine', 2093, 0, 0.12, 0.15), tn('sine', 3136, 0.03, 0.1, 0.08)]),
  costTick: shot('ui', [tn('triangle', 440, 0, 0.12, 0.15, 330)]),
  lowCashWarning: shot('ui', seq(2, 0.45, (_, at) => [tn('sawtooth', 330, at, 0.3, 0.12, 290), tn('sine', 165, at, 0.3, 0.15)])),
  researchComplete: shot('ui', arp('square', [523.3, 659.3, 784, 1046.5, 1318.5], 0.06, 0.2, 0.08).concat([tn('sine', 2093, 0.35, 1.0, 0.18), tn('sine', 1568, 0.35, 1.0, 0.12)])),
} satisfies Record<string, Recipe>;

export type SfxId = keyof typeof RECIPES;
export const SFX_IDS = Object.keys(RECIPES) as SfxId[];
export const SFX_GROUPS: Record<'serviceVehicles' | 'maintenance' | 'construction' | 'terminal' | 'ui', SfxId[]> = {
  serviceVehicles: ['heavyFuelTruck', 'hydrantDispenser', 'hydrantPump', 'cateringScissorLift', 'beltLoader', 'uldLoader', 'baggageTugCart', 'towbarlessTug', 'gpuHum', 'passengerBus', 'busDoorHiss', 'reversingBeeper'],
  maintenance: ['repairVan', 'towTruck', 'runwaySweeper', 'impactWrench', 'breakdownClunk', 'hazardTicks'],
  construction: ['contractorVan', 'deliveryTruck', 'scaffolding', 'hammering', 'concreteMixer'],
  terminal: ['crowdMurmur', 'rollingSuitcases', 'boardingChime', 'jetBridgeDock'],
  ui: ['reportReady', 'disruptionAlert', 'airlineRatingUp', 'airlineRatingDown', 'contractOffer', 'undo', 'redo', 'cashInTick', 'costTick', 'lowCashWarning', 'researchComplete'],
};
export const isSfxId = (id: string): id is SfxId => Object.prototype.hasOwnProperty.call(RECIPES, id);
export const sfxCategory = (id: SfxId): Category => RECIPES[id].category;
export const sfxLooping = (id: SfxId): boolean => RECIPES[id].looping;

/** Fixed per-variant character so variants differ even with zero jitter: [pitch, level, tempo]. */
const CHARACTER: [number, number, number][] = [[1, 1, 1], [0.92, 1.08, 1.1], [1.07, 0.92, 0.9], [0.86, 1.12, 1.18], [1.13, 0.88, 0.84]];
/** Jitter kept small for UI so cues stay recognisable. */
const JITTER: Record<Category, number> = { aircraft: 0.08, vehicles: 0.08, ambient: 0.06, ambience: 0.06, sfx: 0.08, ui: 0.025 };

export interface SfxParams {
  id: SfxId; variant: number; seed: number;
  category: Category; looping: boolean; drive: 'throttle' | 'level';
  layers: Layer[];
}

export const wrapVariant = (variant: number): number =>
  ((Math.floor(Number.isFinite(variant) ? variant : 0) % SFX_VARIANTS) + SFX_VARIANTS) % SFX_VARIANTS;

export function sfxParams(id: SfxId, variant: number, seed = 0): SfxParams {
  const rec: Recipe = RECIPES[id];
  if (!rec) throw new Error(`unknown sfx ${id}`);
  const v = wrapVariant(variant);
  const r = mulberry32(hashSeed('sfx', id, v, seed));
  const [pitch, level, tempo] = CHARACTER[v];
  const j = JITTER[rec.category];
  const P = () => pitch * jit(r, j), L = () => level * jit(r, j * 1.5), T = () => tempo * jit(r, j);
  const layers = rec.layers.map((l): Layer => {
    switch (l.k) {
      case 'engine': return { ...l, hz: l.hz * P(), lp: l.lp * P(), lvl: l.lvl * L() };
      case 'noise': return { ...l, hz: l.hz * P(), lvl: l.lvl * L(), am: l.am / T() };
      case 'hum': return { ...l, hz: l.hz * P(), lvl: l.lvl * L() };
      case 'beep': return { ...l, hz: l.hz * P(), lvl: l.lvl * L(), rate: l.rate / T() };
      case 'tone': { const p = P(); return { ...l, hz: l.hz * p, hzEnd: l.hzEnd * p, lvl: l.lvl * L(), at: l.at * T(), dcy: l.dcy * T() }; }
      case 'burst': return { ...l, hz: l.hz * P(), lvl: l.lvl * L(), at: l.at * T(), dcy: l.dcy * T() };
    }
  });
  return { id, variant: v, seed, category: rec.category, looping: rec.looping, drive: rec.drive ?? 'throttle', layers };
}

/** Length of a one-shot in seconds (Infinity for loops). */
export function sfxDuration(p: SfxParams): number {
  if (p.looping) return Infinity;
  let end = 0;
  for (const l of p.layers) if (l.k === 'tone') end = Math.max(end, l.at + l.a + l.dcy); else if (l.k === 'burst') end = Math.max(end, l.at + l.dcy);
  return end + 0.1;
}

/**
 * Crowd density → loop intensity. `occupancy` is people / capacity of the zone
 * (0 = empty, 1 = at capacity, >1 = overcrowded). Perceptual (sqrt) curve so a
 * half-full hall already sounds busy; never fully silent while anyone is there.
 */
export function crowdIntensity(occupancy: number): number {
  if (!Number.isFinite(occupancy) || occupancy <= 0) return 0;
  return Math.min(1, 0.08 + 0.92 * Math.sqrt(Math.min(occupancy, 1.5) / 1.5));
}

export function buildSfx(ctx: BaseAudioContext, p: SfxParams, out: AudioNode): Voice {
  if (!p.looping) {
    const t = ctx.currentTime;
    for (const l of p.layers) {
      if (l.k === 'tone') tone(ctx, out, l.wave, l.hz, t + l.at, l.a, l.lvl, l.dcy, l.hzEnd || undefined);
      else if (l.k === 'burst') burst(ctx, out, t + l.at, l.filter, l.hz, l.q, l.lvl, l.dcy);
    }
    return oneShot(sfxDuration(p));
  }
  const m = ctx.createGain();
  const srcs: AudioScheduledSourceNode[] = [];
  const updaters: ((v: number, t: number) => void)[] = [];
  const throttle = p.drive === 'throttle';
  for (const l of p.layers) {
    const g = ctx.createGain(); g.gain.value = l.lvl; g.connect(m);
    if (l.k === 'engine') {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      o.connect(lp).connect(g); srcs.push(o);
      updaters.push((v, t) => {
        o.frequency.setTargetAtTime(l.hz * (1 + v * 2), t, 0.4);
        lp.frequency.setTargetAtTime(l.lp * (1 + v * 3), t, 0.4);
        g.gain.setTargetAtTime(l.lvl * (0.5 + v * 0.7), t, 0.4);
      });
    } else if (l.k === 'noise') {
      const n = noise(ctx); const f = ctx.createBiquadFilter(); f.type = l.filter; f.frequency.value = l.hz; f.Q.value = l.q;
      n.connect(f).connect(g); srcs.push(n);
      if (l.am > 0) {
        const lfo = ctx.createOscillator(); lfo.frequency.value = l.am;
        const lg = ctx.createGain(); lg.gain.value = l.lvl * l.amDepth;
        lfo.connect(lg).connect(g.gain); srcs.push(lfo);
      }
      updaters.push((v, t) => {
        if (throttle) f.frequency.setTargetAtTime(l.hz * (0.7 + v * 0.6), t, 0.3);
        else g.gain.setTargetAtTime(l.lvl * v * 1.4, t, 1);
      });
    } else if (l.k === 'hum') {
      const os = Array.from({ length: Math.max(1, l.harmonics) }, (_, i) => {
        const o = ctx.createOscillator(); o.type = l.wave; o.frequency.value = l.hz * (i + 1);
        const hg = ctx.createGain(); hg.gain.value = 1 / (i + 1);
        o.connect(hg).connect(g); srcs.push(o); return o;
      });
      updaters.push((v, t) => os.forEach((o, i) => o.frequency.setTargetAtTime(l.hz * (i + 1) * (0.9 + v * 0.2), t, 0.5)));
    } else if (l.k === 'beep') {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = l.hz;
      const gate = ctx.createGain(); gate.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = l.rate;
      const lg = ctx.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg).connect(gate.gain); o.connect(gate).connect(g); srcs.push(o, lfo);
    }
  }
  return loopVoice(ctx, out, srcs, m, (v, t) => updaters.forEach((u) => u(v, t)), 0.5);
}
