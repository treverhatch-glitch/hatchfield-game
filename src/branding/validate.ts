import { FONT_IDS, ICON_IDS, PALETTE_IDS, PALETTES, SHAPES, LAYOUTS } from './parts';
import { LOGO_SPEC_VERSION, type BrandingSave, type LogoSpec } from './types';

export const NAME_MIN = 3, NAME_MAX = 32;
const HEX = /^#[0-9a-fA-F]{6}$/;
// Small, conservative blocklist (substring match on letters only, so l33t/spacing tricks are partly caught).
const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fagg', 'whore', 'slut', 'rape', 'nazi', 'dick', 'cock', 'pussy', 'asshole', 'retard', 'wank', 'twat', 'kike', 'spic', 'chink'];
const deLeet = (s: string) => s.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4|@/g, 'a').replace(/5|\$/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');

export function validateAirportName(name: string): string | null {
  const t = name.trim();
  if (t.length < NAME_MIN) return `Name must be at least ${NAME_MIN} characters`;
  if (t.length > NAME_MAX) return `Name must be at most ${NAME_MAX} characters`;
  if (!/^[\p{L}\p{N} .'&-]+$/u.test(t)) return 'Use letters, numbers, spaces and . \' & - only';
  const flat = deLeet(t);
  if (BLOCKED.some((b) => flat.includes(b))) return 'Please choose a different name';
  return null;
}

const STOP = new Set(['international', 'intl', 'airport', 'airfield', 'field', 'regional', 'municipal', 'the', 'of', 'and', 'air', 'port']);
/** Suggest a 3-letter code: e.g. "Hatchfield Regional" -> HTC, "San Marco Intl" -> SMA. Deterministic. */
export function suggestCode(name: string, taken: string[] = []): string {
  const words = name.toUpperCase().normalize('NFD').replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean);
  const core = words.filter((w) => !STOP.has(w.toLowerCase()));
  const ws = core.length ? core : words;
  if (!ws.length) return 'HFD';
  const cands: string[] = [];
  const w0 = ws[0];
  if (ws.length >= 3) cands.push(ws[0][0] + ws[1][0] + ws[2][0]);
  if (ws.length === 2) cands.push(ws[0][0] + ws[1].slice(0, 2), ws[0].slice(0, 2) + ws[1][0]);
  const cons = w0.slice(1).replace(/[AEIOU]/g, '');
  if (cons.length >= 2) cands.push(w0[0] + cons.slice(0, 2), w0[0] + cons[0] + cons[cons.length - 1]);
  cands.push(w0.slice(0, 3));
  for (let i = 1; i < w0.length; i++) for (let j = i + 1; j < w0.length; j++) cands.push(w0[0] + w0[i] + w0[j]);
  const used = new Set(taken.map((t) => t.toUpperCase()));
  for (const c of cands) if (c.length === 3 && !used.has(c) && validateCode(c) === null) return c;
  for (let n = 0; n < 26 * 26; n++) {
    const c = (w0[0] + String.fromCharCode(65 + Math.floor(n / 26)) + String.fromCharCode(65 + (n % 26))).padEnd(3, 'X');
    if (!used.has(c) && validateCode(c) === null) return c;
  }
  return 'HFD';
}

export function validateCode(code: string): string | null {
  if (code === '') return null;
  if (!/^[A-Z]{3}$/.test(code)) return 'Code must be exactly 3 letters A-Z';
  if (BLOCKED.some((b) => b.length <= 3 && code.toLowerCase().includes(b)) || ['ASS', 'FUK', 'FAG', 'SEX', 'KKK', 'NIG', 'WTF', 'CUM', 'TIT'].includes(code)) return 'Please choose a different code';
  return null;
}

export function validateLogoSpec(s: unknown): string[] {
  const e: string[] = [];
  if (!s || typeof s !== 'object') return ['spec is not an object'];
  const x = s as Partial<LogoSpec>;
  if (x.version !== LOGO_SPEC_VERSION) e.push('version');
  if (typeof x.airportName !== 'string' || validateAirportName(x.airportName)) e.push('airportName');
  if (typeof x.code !== 'string' || validateCode(x.code)) e.push('code');
  if (typeof x.showCode !== 'boolean') e.push('showCode');
  if (!SHAPES.some((sh) => sh.id === x.shape)) e.push('shape');
  if (x.icon !== 'none' && !ICON_IDS.includes(x.icon as string)) e.push('icon');
  if (x.paletteId !== 'custom' && !PALETTE_IDS.includes(x.paletteId as string)) e.push('paletteId');
  if (!FONT_IDS.includes(x.font as string)) e.push('font');
  if (!LAYOUTS.some((l) => l.id === x.layout)) e.push('layout');
  if (typeof x.iconScale !== 'number' || !(x.iconScale >= 0.5 && x.iconScale <= 1.4)) e.push('iconScale');
  if (typeof x.strokeWidth !== 'number' || !(x.strokeWidth >= 0 && x.strokeWidth <= 8)) e.push('strokeWidth');
  const c = x.colors;
  if (!c || typeof c !== 'object') e.push('colors');
  else for (const k of ['primary', 'secondary', 'accent', 'text'] as const) if (!HEX.test(c[k] ?? '')) e.push(`colors.${k}`);
  if (c && c.background !== 'transparent' && !HEX.test(c.background ?? '')) e.push('colors.background');
  return e;
}

export function serializeBranding(save: BrandingSave): string {
  return JSON.stringify({ v: LOGO_SPEC_VERSION, ...save });
}

/** Parses saved branding; returns null if corrupt or invalid (caller falls back to defaults). */
export function deserializeBranding(raw: string): BrandingSave | null {
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== LOGO_SPEC_VERSION) return null;
    const save: BrandingSave = { airportName: o.airportName, code: o.code, logo: o.logo, ...(o.presetId ? { presetId: o.presetId } : {}) };
    if (validateLogoSpec(save.logo).length) return null;
    return save;
  } catch { return null; }
}

export const paletteColors = (id: string) => ({ ...(PALETTES.find((p) => p.id === id) ?? PALETTES[0]).colors });
