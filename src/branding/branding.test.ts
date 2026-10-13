import { describe, expect, it } from 'vitest';
import { ICON_IDS, PALETTES, FONT_IDS } from './parts';
import { PRESETS } from './presets';
import { randomizeLogo } from './random';
import { renderLogoSVG } from './render';
import { deserializeBranding, serializeBranding, suggestCode, validateAirportName, validateCode, validateLogoSpec } from './validate';

const base = PRESETS[0].spec;

describe('parts catalogue', () => {
  it('has enough content', () => {
    expect(ICON_IDS.length).toBeGreaterThanOrEqual(30);
    expect(PALETTES.length).toBeGreaterThanOrEqual(12);
    expect(FONT_IDS.length).toBeGreaterThanOrEqual(6);
    expect(PRESETS).toHaveLength(24);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(24);
  });
});

describe('validation', () => {
  it('all presets are valid', () => { for (const p of PRESETS) expect(validateLogoSpec(p.spec), p.id).toEqual([]); });
  it('rejects bad fields', () => {
    expect(validateLogoSpec({ ...base, shape: 'blob' })).toContain('shape');
    expect(validateLogoSpec({ ...base, icon: 'nope' })).toContain('icon');
    expect(validateLogoSpec({ ...base, colors: { ...base.colors, primary: 'red' } })).toContain('colors.primary');
    expect(validateLogoSpec({ ...base, iconScale: 9 })).toContain('iconScale');
    expect(validateLogoSpec(null)).toEqual(['spec is not an object']);
  });
  it('names: length, charset, profanity', () => {
    expect(validateAirportName('Hatchfield')).toBeNull();
    expect(validateAirportName("St. Mary's-Côte d'Azur")).toBeNull();
    expect(validateAirportName('ab')).toMatch(/at least/);
    expect(validateAirportName('x'.repeat(33))).toMatch(/at most/);
    expect(validateAirportName('<script>')).toMatch(/letters/);
    expect(validateAirportName('Sh1t Field')).toMatch(/different/);
  });
  it('codes', () => {
    expect(validateCode('HTF')).toBeNull();
    expect(validateCode('')).toBeNull();
    expect(validateCode('ht')).not.toBeNull();
    expect(validateCode('ASS')).not.toBeNull();
  });
});

describe('code suggestion', () => {
  it('is deterministic and sensible', () => {
    expect(suggestCode('Hatchfield')).toBe(suggestCode('Hatchfield'));
    expect(suggestCode('Hatchfield')).toMatch(/^H[A-Z]{2}$/);
    expect(suggestCode('San Marco International')).toBe('SMA');
    expect(suggestCode('Big Sky Lake')).toBe('BSL');
    expect(suggestCode('!!!')).toBe('HFD');
  });
  it('avoids taken codes', () => {
    const first = suggestCode('Hatchfield');
    const second = suggestCode('Hatchfield', [first]);
    expect(second).not.toBe(first);
    expect(validateCode(second)).toBeNull();
  });
});

describe('serialization', () => {
  it('round-trips', () => {
    for (const p of PRESETS) {
      const save = { airportName: p.spec.airportName, code: p.spec.code, logo: p.spec, presetId: p.id };
      expect(deserializeBranding(serializeBranding(save))).toEqual(save);
    }
  });
  it('rejects corrupt data', () => {
    expect(deserializeBranding('{bad')).toBeNull();
    expect(deserializeBranding(JSON.stringify({ v: 99 }))).toBeNull();
    expect(deserializeBranding(serializeBranding({ airportName: 'X', code: 'HTF', logo: { ...base, font: 'zz' } }))).toBeNull();
  });
});

describe('render', () => {
  it('is deterministic and well-formed', () => {
    for (const p of PRESETS) {
      const a = renderLogoSVG(p.spec), b = renderLogoSVG(structuredClone(p.spec));
      expect(a).toBe(b);
      expect(a.startsWith('<svg')).toBe(true);
      expect(a).toContain(p.spec.airportName.toUpperCase().replace(/&/g, '&amp;'));
    }
  });
  it('escapes text', () => {
    const svg = renderLogoSVG({ ...base, airportName: "O'Hare & <Co>" });
    expect(svg).not.toContain('<Co>');
    expect(svg).toContain('&amp;');
  });
  it('randomize is seeded and valid', () => {
    expect(randomizeLogo(base, 42)).toEqual(randomizeLogo(base, 42));
    for (let s = 1; s < 50; s++) expect(validateLogoSpec(randomizeLogo(base, s))).toEqual([]);
  });
});
