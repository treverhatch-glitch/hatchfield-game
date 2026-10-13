import {
  AGENDA_IDS,
  KEY_FIGURE_FIRST,
  KEY_FIGURE_LAST,
  KEY_FIGURE_TITLES,
  NAME_PREFIXES,
  NAME_SUFFIXES,
  PROCEDURAL_GLYPHS,
  PROCEDURAL_LIVERIES,
  REAL_AIRLINE_BLOCKLIST,
  TRAITS,
  TRAIT_IDS,
  VOICES
} from './data.ts';
import { hashString, nextFloat, pick, randInt } from './rng.ts';
import type { RngHolder } from './rng.ts';
import type {
  AirlineRelation,
  AirlineSeed,
  DiplomacyState,
  DiplomacyTier,
  Interest,
  KeyFigure,
  TraitId,
  VoiceStyle
} from './types.ts';

export function isNameAllowed(name: string, existing: Iterable<string> = []): boolean {
  const lower = name.toLowerCase();
  const tokens = lower.split(/[^a-z]+/).filter(Boolean);
  for (const banned of REAL_AIRLINE_BLOCKLIST) {
    if (banned.includes(' ')) {
      if (lower.includes(banned)) return false;
    } else if (tokens.includes(banned)) return false;
  }
  for (const other of existing) if (other.toLowerCase() === lower) return false;
  return true;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function distinctTraits(rng: RngHolder, count: number, keep: TraitId[] = []): TraitId[] {
  const out = [...keep];
  while (out.length < count) {
    const t = pick(rng, TRAIT_IDS);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export interface KeyFigureOptions {
  tier: DiplomacyTier;
  day: number;
  yearDays: number;
  generation: number;
  seed?: AirlineSeed;
  keepTraits?: TraitId[];
}

export function createKeyFigure(rng: RngHolder, opts: KeyFigureOptions): KeyFigure {
  const fromSeed = opts.generation === 0 ? opts.seed : undefined;
  const name =
    fromSeed?.keyFigureName ?? `${pick(rng, KEY_FIGURE_FIRST)} ${pick(rng, KEY_FIGURE_LAST)}`;
  const title = fromSeed?.keyFigureTitle ?? pick(rng, KEY_FIGURE_TITLES[opts.tier]);
  const seedTraits = fromSeed?.traits.slice(0, 2) ?? opts.keepTraits ?? [];
  const traits = distinctTraits(rng, 2, seedTraits) as [TraitId, TraitId];
  const voice: VoiceStyle = fromSeed?.voice ?? pick(rng, VOICES);
  const agenda = fromSeed?.agenda ?? pick(rng, AGENDA_IDS);
  return {
    name,
    title,
    portraitSeed: (hashString(name) ^ Math.floor(nextFloat(rng) * 0xffffff)) >>> 0,
    traits: [traits[0], traits[1]],
    agenda,
    voice,
    memory: [],
    tenureStartDay: opts.day,
    retireAtDay: opts.day + randInt(rng, 4, 8) * opts.yearDays,
    generation: opts.generation,
    keptTrait: null,
    freshTrait: null
  };
}

/** Spoken when a successor takes the chair: one trait stays, one is new. */
export function traitShiftLine(kf: KeyFigure): string | null {
  if (kf.generation < 1 || !kf.keptTrait || !kf.freshTrait) return null;
  return `Kept ${TRAITS[kf.keptTrait].label}. New trait: ${TRAITS[kf.freshTrait].label}.`;
}

export function createRelation(state: DiplomacyState, seed: AirlineSeed): AirlineRelation {
  const keyFigure = seed.hasKeyFigure
    ? createKeyFigure(state, {
        tier: seed.tier,
        day: state.day,
        yearDays: state.config.yearDays,
        generation: 0,
        seed
      })
    : null;
  const traits = keyFigure ? [...keyFigure.traits] : seed.traits.slice(0, 2);
  return {
    id: seed.id,
    name: seed.name,
    tier: seed.tier,
    kind: seed.kind,
    passengerType: seed.passengerType,
    fleetFamily: seed.fleetFamily,
    interests: seed.interests,
    traits,
    livery: seed.livery,
    glyph: seed.glyph,
    region: seed.region,
    portraitSeed: keyFigure?.portraitSeed ?? hashString(seed.id),
    keyFigure,
    status: 'locked',
    metDay: null,
    firstMeetDone: false,
    performance: 0,
    pendingGradeSum: 0,
    pendingGradeCount: 0,
    causeTally: {},
    modifiers: [],
    favours: [],
    leverage: 0,
    lastLeverageDay: -Infinity,
    band: 'neutral',
    standing: 0,
    prevStanding: 0,
    contract: null,
    flightsEma: 0,
    flightsToday: 0,
    shareClass: 'normal',
    sharePct: 0,
    coldSinceDay: null,
    hostileSinceDay: null,
    stage: 'none',
    exitNoticeDay: null,
    exitCounterUsed: false,
    pendingCancel: false,
    capacityFactor: 1,
    lastBandBeforeExit: null,
    exitedDay: null,
    exitReason: null,
    perks: [],
    isBase: false,
    isHub: false,
    allianceId: null,
    apologyDays: [],
    freeFavourYear: -1,
    poachShieldUntilDay: -1,
    nextLetterDay: 0,
    history: [],
    exits: 0
  };
}

export interface NewcomerOptions {
  tier: DiplomacyTier;
  kind: 'pax' | 'cargo';
  leaver?: AirlineRelation;
}

const PAX_TYPES: AirlineSeed['passengerType'][] = ['business', 'leisure', 'family'];
const FLEETS_BY_TIER: Record<DiplomacyTier, AirlineSeed['fleetFamily'][]> = {
  1: ['turboprop', 'narrowbody'],
  2: ['narrowbody', 'turboprop'],
  3: ['narrowbody', 'widebody'],
  4: ['widebody', 'narrowbody'],
  5: ['widebody']
};
const PAX_INTERESTS: Interest[] = ['cost', 'punctuality', 'premium', 'capacity', 'green', 'family', 'prestige'];

/**
 * Procedural replacement airline. It differs from the leaver on at least one of passenger type,
 * top interest and fleet family, and never uses a blocklisted (real) name.
 */
export function generateNewcomerSeed(
  state: DiplomacyState,
  opts: NewcomerOptions
): AirlineSeed {
  const existingNames = state.order.map((id) => state.relations[id].name);
  let name = '';
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = `${pick(state, NAME_PREFIXES)} ${pick(state, NAME_SUFFIXES)}`;
    if (isNameAllowed(candidate, existingNames) && !state.relations[slugify(candidate)]) {
      name = candidate;
      break;
    }
  }
  if (!name) name = `Newcomer ${state.nextId}`;
  const isCargo = opts.kind === 'cargo';
  let seedOut: AirlineSeed | null = null;
  for (let attempt = 0; attempt < 50 && !seedOut; attempt++) {
    const passengerType = isCargo ? 'cargo' : pick(state, PAX_TYPES);
    const fleetFamily = isCargo ? 'freighter' : pick(state, FLEETS_BY_TIER[opts.tier]);
    const pool = isCargo ? (['cargo', 'cost', 'capacity', 'punctuality'] as Interest[]) : PAX_INTERESTS;
    const first = pick(state, pool);
    const rest = pool.filter((i) => i !== first);
    const second = pick(state, rest);
    const third = pick(state, rest.filter((i) => i !== second));
    const leaver = opts.leaver;
    const differs =
      !leaver ||
      passengerType !== leaver.passengerType ||
      first !== leaver.interests[0] ||
      fleetFamily !== leaver.fleetFamily;
    if (!differs) continue;
    seedOut = {
      id: slugify(name),
      name,
      tier: opts.tier,
      kind: opts.kind,
      passengerType,
      fleetFamily,
      interests: [first, second, third],
      traits: distinctTraits(state, 1 + randInt(state, 0, 1)),
      hasKeyFigure: opts.tier >= 3 && nextFloat(state) < 0.5,
      livery: pick(state, PROCEDURAL_LIVERIES),
      glyph: pick(state, PROCEDURAL_GLYPHS),
      region: pick(state, ['north', 'south', 'east', 'west'])
    };
  }
  return (
    seedOut ?? {
      id: slugify(name),
      name,
      tier: opts.tier,
      kind: opts.kind,
      passengerType: isCargo ? 'cargo' : 'leisure',
      fleetFamily: isCargo ? 'freighter' : 'narrowbody',
      interests: ['cost', 'punctuality', 'capacity'],
      traits: ['patient'],
      hasKeyFigure: false,
      livery: PROCEDURAL_LIVERIES[0],
      glyph: PROCEDURAL_GLYPHS[0],
      region: 'north'
    }
  );
}

export type LetterTopic =
  | 'welcome'
  | 'demand'
  | 'cold_warning'
  | 'capacity_cut'
  | 'exit_notice'
  | 'exit'
  | 'succession'
  | 'newcomer'
  | 'spat'
  | 'kept_word';

const GREETING: Record<VoiceStyle, string> = {
  formal: 'Dear Airport Director,',
  warm: 'Hello again,',
  blunt: 'Director,',
  flamboyant: 'My dear Director!'
};

/** Every letter carries one trait-flavoured line and, if the sender has one, a remembered event. */
export function composeLetter(rel: AirlineRelation, topic: LetterTopic, detail = ''): string[] {
  const voice = rel.keyFigure?.voice ?? 'formal';
  const sender = rel.keyFigure ? `${rel.keyFigure.name}, ${rel.keyFigure.title}, ${rel.name}` : rel.name;
  const body: Record<LetterTopic, string> = {
    welcome: `We would like to operate at your field. ${detail}`,
    demand: `We have a request. ${detail}`,
    cold_warning: `Our patience is wearing thin. ${detail}`,
    capacity_cut: `We are cutting seats on your routes. ${detail}`,
    exit_notice: `We will leave at the end of the season unless things change. ${detail}`,
    exit: `Our flights end this season. ${detail}`,
    succession: `There is a change at the top. ${detail}`,
    newcomer: `We are new, and we hear there is room. ${detail}`,
    spat: `We are making our views public. ${detail}`,
    kept_word: `You kept your word. ${detail}`
  };
  const lines = [GREETING[voice], body[topic].trim()];
  const trait = rel.traits.length > 0 ? TRAITS[rel.traits[0]] : null;
  if (trait) lines.push(trait.flavour);
  const memory = rel.keyFigure?.memory[rel.keyFigure.memory.length - 1];
  if (memory) lines.push(`We remember: ${memory}`);
  lines.push(`\u2014 ${sender}`);
  return lines;
}
