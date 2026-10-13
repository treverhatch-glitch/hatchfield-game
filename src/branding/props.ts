/**
 * In-world branded props (Three.js). Every factory returns { object, update?, dispose }.
 * - Textures come from a shared, ref-counted cache keyed by SVG, so ten gate signs share one texture per gate label
 *   and the logo decal/flag share across instances. dispose() releases refs; the GPU texture is freed at zero.
 * - Each prop is a THREE.LOD: textured detail up close, a flat-coloured low-poly stand-in far away (no texture fetch).
 * - Units are metres; props sit on y=0 facing +Z.
 */
import * as THREE from 'three';
import { decalSVG, facadeSVG, flagSVG, gateSVG, monumentSVG, SIGN_SIZES, wayfindingSVG } from './signs';
import { svgToCanvas } from './texture';
import type { LogoSpec } from './types';

export type TextureFactory = (svg: string, width: number, height: number) => THREE.Texture;

/** Browser default: blank CanvasTexture filled asynchronously once the SVG is rasterised. */
export const browserTextureFactory: TextureFactory = (svg, w, h) => {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  svgToCanvas(svg, w, h).then((c) => { tex.image = c; tex.needsUpdate = true; }).catch(() => {});
  return tex;
};

export class BrandTextureCache {
  private map = new Map<string, { tex: THREE.Texture; refs: number }>();
  constructor(private factory: TextureFactory = browserTextureFactory, private scale = 1) {}
  acquire(svg: string, w: number, h: number): THREE.Texture {
    const key = `${w}x${h}:${svg}`;
    let e = this.map.get(key);
    if (!e) { e = { tex: this.factory(svg, Math.round(w * this.scale), Math.round(h * this.scale)), refs: 0 }; this.map.set(key, e); }
    e.refs++;
    return e.tex;
  }
  release(tex: THREE.Texture) {
    for (const [k, e] of this.map) if (e.tex === tex) { if (--e.refs <= 0) { e.tex.dispose(); this.map.delete(k); } return; }
  }
  get size() { return this.map.size; }
  disposeAll() { for (const e of this.map.values()) e.tex.dispose(); this.map.clear(); }
}

export interface BrandProp { object: THREE.LOD; update?: (timeSeconds: number) => void; dispose: () => void }
export interface PropOptions { cache: BrandTextureCache; lodDistance?: number }

/** Builds the LOD + disposal bookkeeping shared by all props. */
function build(opts: PropOptions, name: string, detail: (track: Track) => THREE.Object3D, far: (track: Track) => THREE.Object3D): BrandProp {
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [];
  const track: Track = {
    geo: (g) => (geos.push(g), g), mat: (m) => (mats.push(m), m),
    tex: (svg, [w, h]) => { const t = opts.cache.acquire(svg, w, h); texs.push(t); return t; },
  };
  const lod = new THREE.LOD(); lod.name = name;
  lod.addLevel(detail(track), 0);
  lod.addLevel(far(track), opts.lodDistance ?? 180);
  let disposed = false;
  return { object: lod, dispose: () => {
    if (disposed) return; disposed = true;
    lod.removeFromParent(); geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((t) => opts.cache.release(t));
  } };
}
interface Track { geo<T extends THREE.BufferGeometry>(g: T): T; mat<T extends THREE.Material>(m: T): T; tex(svg: string, size: readonly [number, number]): THREE.Texture }

const box = (t: Track, w: number, h: number, d: number, color: THREE.ColorRepresentation, y = h / 2) => {
  const m = new THREE.Mesh(t.geo(new THREE.BoxGeometry(w, h, d)), t.mat(new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))); m.position.y = y; return m;
};
const face = (t: Track, tex: THREE.Texture, w: number, h: number, opts: { transparent?: boolean; emissive?: boolean } = {}) => {
  const mat = t.mat(new THREE.MeshStandardMaterial({ map: tex, transparent: !!opts.transparent, roughness: 0.6, ...(opts.emissive ? { emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.35 } : {}) }));
  return new THREE.Mesh(t.geo(new THREE.PlaneGeometry(w, h)), mat);
};
const group = (...o: THREE.Object3D[]) => { const g = new THREE.Group(); g.add(...o); return g; };

/** Flag on a pole. Wave is done in the vertex shader (onBeforeCompile), one uniform update per frame. */
export function createFlagProp(spec: LogoSpec, opts: PropOptions & { poleHeight?: number }): BrandProp {
  const H = opts.poleHeight ?? 10, fw = 3, fh = 2;
  const time = { value: 0 };
  const prop = build(opts, 'brand-flag', (t) => {
    const pole = new THREE.Mesh(t.geo(new THREE.CylinderGeometry(0.06, 0.08, H, 8)), t.mat(new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.7, roughness: 0.3 })));
    pole.position.y = H / 2;
    const geo = t.geo(new THREE.PlaneGeometry(fw, fh, 16, 4)); geo.translate(fw / 2, 0, 0);
    const mat = t.mat(new THREE.MeshStandardMaterial({ map: t.tex(flagSVG(spec), SIGN_SIZES.flag), side: THREE.DoubleSide, roughness: 0.9 }));
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
        float k = position.x / ${fw.toFixed(1)};
        transformed.z += sin(position.x * 2.2 - uTime * 4.0) * 0.18 * k + sin(position.y * 1.7 - uTime * 2.3) * 0.05 * k;
        transformed.y -= 0.12 * k * k;`);
    };
    mat.customProgramCacheKey = () => 'brand-flag-wave';
    const flag = new THREE.Mesh(geo, mat); flag.position.set(0.08, H - fh / 2 - 0.1, 0);
    return group(pole, flag);
  }, (t) => group(box(t, 0.15, H, 0.15, '#c8ccd2'), ((m) => (m.position.x = fw / 2, m))(box(t, fw, fh, 0.02, spec.colors.primary, H - fh / 2 - 0.1))));
  prop.update = (s) => { time.value = s; };
  return prop;
}

/** Entrance monument sign: stone plinth with name plate front and back. */
export function createMonumentSign(spec: LogoSpec, opts: PropOptions): BrandProp {
  const w = 6, h = 2.25;
  return build(opts, 'brand-monument', (t) => {
    const tex = t.tex(monumentSVG(spec), SIGN_SIZES.monument);
    const front = face(t, tex, w, h); front.position.set(0, 0.4 + h / 2, 0.41);
    const back = face(t, tex, w, h); back.position.set(0, 0.4 + h / 2, -0.41); back.rotation.y = Math.PI;
    return group(box(t, w + 0.4, 0.4, 1.2, '#8b8f96'), box(t, w, h, 0.8, '#2b2f36', 0.4 + h / 2), front, back);
  }, (t) => box(t, w, h + 0.4, 0.8, '#2b2f36'));
}

/** Terminal facade sign (lightbox), to be placed on the landside facade. Width in metres. */
export function createFacadeSign(spec: LogoSpec, opts: PropOptions & { width?: number }): BrandProp {
  const w = opts.width ?? 24, h = (w * SIGN_SIZES.facade[1]) / SIGN_SIZES.facade[0];
  return build(opts, 'brand-facade', (t) => {
    const f = face(t, t.tex(facadeSVG(spec), SIGN_SIZES.facade), w, h, { emissive: true }); f.position.set(0, h / 2, 0.16);
    return group(box(t, w + 0.3, h + 0.3, 0.3, '#1c1f24', h / 2), f);
  }, (t) => box(t, w, h, 0.3, spec.colors.primary));
}

/** Road wayfinding sign on two posts. */
export function createWayfindingSign(spec: LogoSpec, opts: PropOptions & { lines?: Parameters<typeof wayfindingSVG>[1] }): BrandProp {
  const w = 4, h = 2, post = 2.4;
  return build(opts, 'brand-wayfinding', (t) => {
    const f = face(t, t.tex(wayfindingSVG(spec, opts.lines), SIGN_SIZES.wayfinding), w, h); f.position.set(0, post + h / 2, 0.06);
    const p1 = box(t, 0.12, post + h, 0.12, '#9aa0a6'); p1.position.x = -1.4;
    const p2 = box(t, 0.12, post + h, 0.12, '#9aa0a6'); p2.position.x = 1.4;
    return group(p1, p2, box(t, w, h, 0.08, '#0b6b3a', post + h / 2), f);
  }, (t) => box(t, w, h, 0.1, '#0b6b3a', post + h / 2));
}

/** Logo decal for the control tower cab or terminal wall (transparent plane, polygonOffset to avoid z-fighting). */
export function createTowerDecal(spec: LogoSpec, opts: PropOptions & { size?: number }): BrandProp {
  const s = opts.size ?? 4;
  return build(opts, 'brand-tower-decal', (t) => {
    const f = face(t, t.tex(decalSVG(spec), SIGN_SIZES.decal), s, s, { transparent: true });
    const m = f.material as THREE.MeshStandardMaterial; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.depthWrite = false;
    return f;
  }, () => new THREE.Group());
}

/** Gate sign "HTF Gate N" hanging above a gate. */
export function createGateSign(spec: LogoSpec, gate: number | string, opts: PropOptions): BrandProp {
  const w = 3, h = 0.75;
  return build(opts, `brand-gate-${gate}`, (t) => {
    const tex = t.tex(gateSVG(spec, gate), SIGN_SIZES.gate);
    const front = face(t, tex, w, h, { emissive: true }); front.position.set(0, 0, 0.06);
    const back = face(t, tex, w, h, { emissive: true }); back.position.set(0, 0, -0.06); back.rotation.y = Math.PI;
    return group(box(t, w + 0.1, h + 0.1, 0.1, '#111418', 0), front, back);
  }, (t) => box(t, w, h, 0.1, '#111418', 0));
}
