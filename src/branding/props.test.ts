import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { PRESETS } from './presets';
import { BrandTextureCache, createFacadeSign, createFlagProp, createGateSign, createMonumentSign, createTowerDecal, createWayfindingSign } from './props';
import { certificateSVG, deriveTicker, formatTicker, listingBadgeSVG } from './finance';
import { facadeSVG, flagSVG, gateSVG, monumentSVG, wayfindingSVG } from './signs';

const spec = PRESETS[0].spec;
const fakeFactory = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);

describe('ticker', () => {
  it('uses the code when free', () => expect(deriveTicker('HTF', 'Hatchfield')).toBe('HTF'));
  it('extends with name letters when taken', () => {
    expect(deriveTicker('HTF', 'Hatchfield', ['HTF'])).toBe('HTFH');
    expect(deriveTicker('HTF', 'Hatchfield', ['htf', 'HTFH'])).toBe('HTFA');
  });
  it('normalises odd input', () => {
    expect(deriveTicker('', 'Palm Bay')).toBe('PAL');
    expect(deriveTicker('', '')).toBe('HFD');
    expect(deriveTicker('a', 'X')).toBe('AXX');
  });
  it('formats with exchange', () => expect(formatTicker('HTF')).toBe('HATCH:HTF'));
});

describe('prop factories', () => {
  const makers = [
    (c: BrandTextureCache) => createFlagProp(spec, { cache: c }),
    (c: BrandTextureCache) => createMonumentSign(spec, { cache: c }),
    (c: BrandTextureCache) => createFacadeSign(spec, { cache: c }),
    (c: BrandTextureCache) => createWayfindingSign(spec, { cache: c }),
    (c: BrandTextureCache) => createTowerDecal(spec, { cache: c }),
    (c: BrandTextureCache) => createGateSign(spec, 4, { cache: c }),
  ];
  it('create LODs with meshes and dispose everything', () => {
    const cache = new BrandTextureCache(fakeFactory);
    for (const make of makers) {
      const p = make(cache);
      expect(p.object).toBeInstanceOf(THREE.LOD);
      expect(p.object.levels.length).toBe(2);
      const meshes: THREE.Mesh[] = []; p.object.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      expect(meshes.length).toBeGreaterThan(0);
      const geoSpies = meshes.map((m) => vi.spyOn(m.geometry, 'dispose'));
      const scene = new THREE.Scene(); scene.add(p.object);
      p.update?.(1.5);
      p.dispose(); p.dispose(); // idempotent
      expect(p.object.parent).toBeNull();
      geoSpies.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
    }
    expect(cache.size).toBe(0);
  });
  it('share textures between instances and free at zero refs', () => {
    const factory = vi.fn(fakeFactory);
    const cache = new BrandTextureCache(factory);
    const a = createGateSign(spec, 1, { cache }), b = createGateSign(spec, 1, { cache }), c = createGateSign(spec, 2, { cache });
    expect(factory).toHaveBeenCalledTimes(2);
    const tex = factory.mock.results[0].value as THREE.Texture; const spy = vi.spyOn(tex, 'dispose');
    a.dispose(); expect(spy).not.toHaveBeenCalled();
    b.dispose(); expect(spy).toHaveBeenCalledTimes(1);
    c.dispose(); expect(cache.size).toBe(0);
  });
});

describe('deterministic SVGs', () => {
  const cert = { spec, ticker: 'HTF', shares: 1_000_000, holder: 'Hatchfield Founders', serial: 'HTF-0001', issued: 'Year 3, Spring' };
  it('certificate', () => {
    expect(certificateSVG(cert)).toBe(certificateSVG(structuredClone(cert)));
    expect(certificateSVG(cert)).toContain('1,000,000 SHARES');
    expect(certificateSVG(cert)).toContain('HATCH:HTF');
    expect(certificateSVG({ ...cert, holder: '<b>' })).not.toContain('<b>');
  });
  it('signs and badge', () => {
    for (const f of [flagSVG, monumentSVG, facadeSVG, (s: typeof spec) => wayfindingSVG(s), (s: typeof spec) => gateSVG(s, 4), (s: typeof spec) => listingBadgeSVG(s, 'HTF')])
      expect(f(spec)).toBe(f(structuredClone(spec)));
    expect(gateSVG(spec, 4)).toContain('Gate 4');
  });
});
