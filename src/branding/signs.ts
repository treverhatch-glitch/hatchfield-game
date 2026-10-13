/** Pure SVG generators for the faces of in-world signs. These are the textures the 3D props use. */
import { FONTS } from './parts';
import { renderLogoSVG } from './render';
import type { LogoSpec } from './types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const nested = (spec: LogoSpec, x: number, y: number, w: number, h: number) =>
  renderLogoSVG({ ...spec, layout: 'none' }).replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
const font = (spec: LogoSpec) => FONTS[spec.font] ?? FONTS.modern;
const fit = (text: string, maxW: number, max: number) => Math.round(Math.min(max, maxW / Math.max(1, text.length * 0.66)) * 10) / 10;
const txt = (spec: LogoSpec, s: string, x: number, y: number, size: number, fill: string, anchor = 'middle', weight?: number) => {
  const f = font(spec);
  return `<text x="${x}" y="${y}" font-family="${esc(f.stack)}" font-size="${size}" font-weight="${weight ?? f.weight}"${f.italic ? ' font-style="italic"' : ''} fill="${fill}" text-anchor="${anchor}" dominant-baseline="central">${esc(s)}</text>`;
};
const wrap = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

export const SIGN_SIZES = { flag: [384, 256], monument: [512, 192], facade: [1024, 160], wayfinding: [512, 256], gate: [512, 128], decal: [256, 256] } as const;

/** Flag: primary field, secondary stripe at the hoist, emblem centred. */
export function flagSVG(spec: LogoSpec): string {
  const c = spec.colors; const [w, h] = SIGN_SIZES.flag;
  return wrap(w, h, `<rect width="${w}" height="${h}" fill="${c.primary}"/><rect width="48" height="${h}" fill="${c.secondary}"/>${nested(spec, 136, 40, 176, 176)}`);
}

/** Entrance monument / name plate. */
export function monumentSVG(spec: LogoSpec): string {
  const c = spec.colors; const [w, h] = SIGN_SIZES.monument; const name = spec.airportName.toUpperCase();
  return wrap(w, h, `<rect width="${w}" height="${h}" fill="#2b2f36"/><rect x="8" y="8" width="${w - 16}" height="${h - 16}" fill="none" stroke="${c.secondary}" stroke-width="3"/>${nested(spec, 24, 26, 140, 140)}${txt(spec, name, 184, 78, fit(name, 310, 40), '#f4f4f5', 'start')}${spec.code ? txt(spec, `${spec.code} · AIRPORT`, 184, 128, 22, c.secondary, 'start') : ''}`);
}

/** Long terminal facade sign (lightbox style). */
export function facadeSVG(spec: LogoSpec): string {
  const c = spec.colors; const [w, h] = SIGN_SIZES.facade; const name = `${spec.airportName.toUpperCase()}${spec.code ? `  ${spec.code}` : ''}`;
  return wrap(w, h, `<rect width="${w}" height="${h}" fill="${c.primary}"/>${nested(spec, 20, 10, 140, 140)}${txt(spec, name, 590, 80, fit(name, 820, 76), c.text)}`);
}

/** Road wayfinding sign: green road-sign style with the logo and arrows. */
export function wayfindingSVG(spec: LogoSpec, lines: { label: string; arrow: 'up' | 'left' | 'right' }[] = [{ label: 'Departures', arrow: 'up' }, { label: 'Parking', arrow: 'right' }]): string {
  const [w, h] = SIGN_SIZES.wayfinding; const rot = { up: 0, right: 90, left: -90 };
  let body = `<rect width="${w}" height="${h}" rx="14" fill="#0b6b3a"/><rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="10" fill="none" stroke="#fff" stroke-width="4"/>${nested(spec, 20, 18, 72, 72)}${txt(spec, spec.airportName, 104, 54, fit(spec.airportName, 380, 30), '#fff', 'start')}`;
  lines.slice(0, 2).forEach((l, i) => {
    const y = 140 + i * 60;
    body += `<g transform="translate(46 ${y}) rotate(${rot[l.arrow]})"><path d="M0 -20 L18 0 H7 V20 H-7 V0 H-18Z" fill="#fff"/></g>`;
    body += `<text x="88" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="700" fill="#fff" dominant-baseline="central">${esc(l.label)}</text>`;
  });
  return wrap(w, h, body);
}

/** Gate sign: "HTF Gate 4". */
export function gateSVG(spec: LogoSpec, gate: number | string): string {
  const c = spec.colors; const [w, h] = SIGN_SIZES.gate;
  return wrap(w, h, `<rect width="${w}" height="${h}" fill="#111418"/><rect width="128" height="${h}" fill="${c.primary}"/>${nested(spec, 14, 14, 100, 100)}${txt(spec, `${spec.code || 'GATE'}`, 150, 64, 34, c.secondary === c.primary ? '#fff' : c.secondary, 'start')}<text x="${w - 24}" y="64" font-family="Arial,Helvetica,sans-serif" font-size="${Math.min(56, Math.round(250 / (String(gate).length + 5) / 0.62))}" font-weight="800" fill="#ffd400" text-anchor="end" dominant-baseline="central">Gate ${esc(String(gate))}</text>`);
}

/** Tower decal: emblem only, transparent background. */
export const decalSVG = (spec: LogoSpec) => renderLogoSVG({ ...spec, layout: 'none', colors: { ...spec.colors, background: 'transparent' } });
