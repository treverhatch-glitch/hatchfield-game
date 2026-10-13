import { FONTS, ICONS, SHAPE_PATHS } from './parts';
import type { LogoSpec } from './types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const r = (n: number) => Math.round(n * 100) / 100;

/** Emblem group in a 100x100 box. */
function emblem(spec: LogoSpec): string {
  const { colors: c } = spec;
  const parts: string[] = [];
  if (spec.shape !== 'none') {
    parts.push(`<path d="${SHAPE_PATHS[spec.shape]}" fill="${c.primary}" fill-rule="evenodd" stroke="${c.secondary}" stroke-width="${spec.strokeWidth}" stroke-linejoin="round"/>`);
  }
  const icon = ICONS[spec.icon];
  if (icon) {
    const base = spec.shape === 'none' ? 0.9 : spec.shape === 'circle-ring' ? 0.42 : 0.55;
    const s = r(base * spec.iconScale);
    const off = r(50 - 50 * s);
    parts.push(`<g transform="translate(${off} ${off}) scale(${s})"><path d="${icon.d}" fill="${c.accent}" fill-rule="evenodd"/></g>`);
  } else if (spec.showCode && spec.code) {
    parts.push(textEl(spec, spec.code, 50, 50, 30, c.accent, 'middle', 'central'));
  }
  return parts.join('');
}

function textEl(spec: LogoSpec, text: string, x: number, y: number, size: number, fill: string, anchor = 'middle', baseline = 'auto'): string {
  const f = FONTS[spec.font] ?? FONTS.modern;
  return `<text x="${x}" y="${y}" font-family="${esc(f.stack)}" font-size="${size}" font-weight="${f.weight}"${f.italic ? ' font-style="italic"' : ''} letter-spacing="${f.letterSpacing}" fill="${fill}"${fill === spec.colors.text && text === spec.code ? ' fill-opacity="0.7"' : ''} text-anchor="${anchor}" dominant-baseline="${baseline}">${esc(text)}</text>`;
}

/** Font size that fits `text` in maxW, accounting for the font's letter-spacing (wide fonts track out a lot). */
const fitSize = (spec: LogoSpec, text: string, maxW: number, max: number) => {
  const ls = (FONTS[spec.font] ?? FONTS.modern).letterSpacing;
  const n = Math.max(1, text.length);
  return r(Math.min(max, (maxW - ls * n) / (n * 0.68)));
};

/** Ring layout geometry (240x240 viewBox). Path starts at the bottom so the label is centred at the top (50%) and can use the whole circle without wrapping off the path start. Text baseline sits on RING_TEXT_RADIUS; glyphs extend outward by up to the font size. */
export const RING_VIEWBOX = 240;
export const RING_TEXT_RADIUS = 90;
export const RING_FONT_MAX = 18;
export const RING_PADDING = 6;
export function ringFontSize(spec: LogoSpec, label: string): number {
  // usable arc ~ 90% of circumference so start/end never collide
  return fitSize(spec, label, 2 * Math.PI * RING_TEXT_RADIUS * 0.9, RING_FONT_MAX);
}
export function ringLabel(spec: LogoSpec): string {
  const name = spec.airportName.trim().toUpperCase();
  const code = spec.showCode && spec.code && ICONS[spec.icon] ? spec.code : '';
  return code ? `${name} • ${code} •` : `${name} •`;
}

/** Deterministic: identical specs always produce byte-identical SVG. */
export function renderLogoSVG(spec: LogoSpec, opts: { size?: number } = {}): string {
  const c = spec.colors;
  const name = spec.airportName.trim().toUpperCase();
  const codeLine = spec.showCode && spec.code && ICONS[spec.icon] ? spec.code : '';
  let w = 240, h = 240, body = '';
  switch (spec.layout) {
    case 'ring': {
      const R = RING_TEXT_RADIUS, label = ringLabel(spec), fs = ringFontSize(spec, label);
      body += `<g transform="translate(57 57) scale(1.26)">${emblem(spec)}</g>`;
      body += `<defs><path id="ring" d="M120 ${120 + R}a${R} ${R} 0 1 1 0 -${2 * R}a${R} ${R} 0 1 1 0 ${2 * R}"/></defs>`;
      body += `<circle cx="120" cy="120" r="${r(R + fs + 4)}" fill="none" stroke="${c.secondary}" stroke-width="3"/>`;
      const f = FONTS[spec.font] ?? FONTS.modern;
      body += `<text font-family="${esc(f.stack)}" font-size="${fs}" font-weight="${f.weight}"${f.italic ? ' font-style="italic"' : ''} letter-spacing="${f.letterSpacing}" fill="${c.text}"><textPath href="#ring" startOffset="50%" text-anchor="middle">${esc(label)}</textPath></text>`;
      break;
    }
    case 'side': {
      w = 480; h = 160;
      body += `<g transform="translate(10 10) scale(1.4)">${emblem(spec)}</g>`;
      body += textEl(spec, name, 164, codeLine ? 72 : 88, fitSize(spec, name, 300, 34), c.text, 'start');
      if (codeLine) body += textEl(spec, codeLine, 164, 116, 28, c.text, 'start');
      break;
    }
    case 'none':
      body += `<g transform="translate(20 20) scale(2)">${emblem(spec)}</g>`;
      break;
    default: {
      body += `<g transform="translate(55 8) scale(1.3)">${emblem(spec)}</g>`;
      body += textEl(spec, name, 120, 180, fitSize(spec, name, 224, 26), c.text);
      if (codeLine) body += textEl(spec, codeLine, 120, 216, 22, c.text);
    }
  }
  const bg = c.background && c.background !== 'transparent' ? `<rect width="${w}" height="${h}" rx="16" fill="${c.background}"/>` : '';
  const sizeAttr = opts.size ? ` width="${opts.size}" height="${r((opts.size * h) / w)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${sizeAttr}>${bg}${body}</svg>`;
}

export const logoDataURL = (spec: LogoSpec) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderLogoSVG(spec))}`;
