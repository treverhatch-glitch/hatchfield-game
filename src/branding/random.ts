import { FONT_IDS, ICON_IDS, PALETTES, SHAPES, LAYOUTS } from './parts';
import type { LogoSpec } from './types';

/** mulberry32: seeded so "randomize" can be reproduced from a seed in replays/tests. */
export function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)];

export function randomizeLogo(base: LogoSpec, seed = Date.now()): LogoSpec {
  const r = rng(seed);
  const pal = pick(r, PALETTES);
  return {
    ...base,
    shape: pick(r, SHAPES.filter((s) => s.id !== 'none')).id,
    icon: pick(r, ICON_IDS), paletteId: pal.id, colors: { ...pal.colors },
    font: pick(r, FONT_IDS), layout: pick(r, LAYOUTS.filter((l) => l.id !== 'none')).id,
    iconScale: Math.round((0.8 + r() * 0.4) * 100) / 100, strokeWidth: Math.round(r() * 6),
  };
}
