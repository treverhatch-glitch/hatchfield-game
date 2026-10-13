import { BAND_CHIPS } from './constants.ts';
import { seededStream } from './rng.ts';
import type { Band, BandChip, DiplomacyTier, PortraitCard } from './types.ts';

const SKIN = ['#f5d5b8', '#e8b98f', '#c98f63', '#a06a45', '#7a4a2d', '#5a3520'];
const HAIR_COLORS = ['#1b1b1b', '#3b2a1d', '#6b4423', '#a9743b', '#c9c9c9', '#8e3b2e'];
const HAIR_STYLES = ['short', 'long', 'bun', 'curly', 'bald', 'swept', 'braids'];
const FACE_SHAPES = ['oval', 'round', 'square', 'long'];
const EYES = ['round', 'narrow', 'wide', 'sleepy'];
const BROWS = ['straight', 'arched', 'thick', 'thin'];
const MOUTHS = ['smile', 'neutral', 'smirk', 'grin'];
const FACIAL_HAIR = ['moustache', 'beard', 'goatee', 'stubble'];
const ACCESSORIES = ['glasses', 'round glasses', 'earring', 'cap', 'scarf'];
const CLOTHING = ['suit', 'blazer', 'uniform', 'turtleneck', 'coat'];
const BACKGROUNDS = ['#dfe9f3', '#f3e9df', '#e6f0e4', '#efe4f1', '#f1efe0', '#e0eef0'];

export interface PortraitInput {
  seed: number;
  tier: DiplomacyTier;
  hasKeyFigure: boolean;
  livery: [string, string];
}

/**
 * Data for a 2D illustrated card (owner decision 19). Pure data only: the UI picks art layers
 * from these tokens. The same seed always yields the same face, so succession can reroll by
 * changing the seed.
 */
export function buildPortraitCard(input: PortraitInput): PortraitCard {
  const next = seededStream(input.seed);
  const choose = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  const frame: PortraitCard['frame'] = !input.hasKeyFigure ? 'bronze' : input.tier >= 4 ? 'gold' : 'silver';
  const skin = choose(SKIN);
  const hair = { style: choose(HAIR_STYLES), color: choose(HAIR_COLORS) };
  const face = { shape: choose(FACE_SHAPES), eyes: choose(EYES), brows: choose(BROWS), mouth: choose(MOUTHS) };
  const facialHair = next() < 0.3 && hair.style !== 'long' ? choose(FACIAL_HAIR) : null;
  const accessory = next() < 0.4 ? choose(ACCESSORIES) : null;
  const clothing = { style: choose(CLOTHING), color: input.livery[0], accent: input.livery[1] };
  return {
    seed: input.seed,
    style: 'flat-2d',
    frame,
    background: choose(BACKGROUNDS),
    skin,
    hair,
    face,
    facialHair,
    accessory,
    clothing,
    logoOnly: !input.hasKeyFigure
  };
}

export function bandChip(band: Band): BandChip {
  return { band, ...BAND_CHIPS[band] };
}
