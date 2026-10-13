/** Finance / IPO branding: ticker derivation and certificate / badge SVGs. */
import { FONTS } from './parts';
import { renderLogoSVG } from './render';
import type { LogoSpec } from './types';

export const EXCHANGE = { id: 'HATCH', name: 'HATCH Exchange' } as const;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * Ticker = the airport code when free (HTF). If taken (rival listed first), append letters
 * from the name (HTFH), then A-Z. Always 3-4 uppercase letters, deterministic.
 */
export function deriveTicker(code: string, airportName: string, taken: string[] = []): string {
  const used = new Set(taken.map((t) => t.toUpperCase()));
  const base = (code.toUpperCase().replace(/[^A-Z]/g, '') || airportName.toUpperCase().replace(/[^A-Z]/g, '') || 'HFD').padEnd(3, 'X').slice(0, 3);
  if (!used.has(base)) return base;
  const letters = airportName.toUpperCase().replace(/[^A-Z]/g, '') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const ch of letters) if (!used.has(base + ch)) return base + ch;
  return base + 'X';
}

export const formatTicker = (ticker: string) => `${EXCHANGE.id}:${ticker}`;

export interface CertificateData { spec: LogoSpec; ticker: string; shares: number; holder: string; serial: string; issued: string /* in-game date label */ }

const nested = (spec: LogoSpec, x: number, y: number, s: number) => renderLogoSVG({ ...spec, layout: 'none', colors: { ...spec.colors, background: 'transparent' } }).replace('<svg ', `<svg x="${x}" y="${y}" width="${s}" height="${s}" `);

/** Deterministic share certificate SVG (800x520). */
export function certificateSVG(d: CertificateData): string {
  const c = d.spec.colors; const f = FONTS[d.spec.font] ?? FONTS.modern;
  const serif = "Georgia,'Times New Roman',serif";
  const guilloche = Array.from({ length: 24 }, (_, i) => `<ellipse cx="400" cy="260" rx="${360 - i * 6}" ry="${230 - i * 4}" fill="none" stroke="${c.primary}" stroke-opacity="0.07"/>`).join('');
  const name = d.spec.airportName.toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" fill="#f7f1df"/>${guilloche}`
    + `<rect x="14" y="14" width="772" height="492" fill="none" stroke="${c.primary}" stroke-width="6"/><rect x="26" y="26" width="748" height="468" fill="none" stroke="${c.secondary}" stroke-width="2"/>`
    + nested(d.spec, 340, 40, 120)
    + `<text x="400" y="190" font-family="${esc(f.stack)}" font-weight="${f.weight}" font-size="${Math.min(40, 680 / Math.max(1, name.length * 0.66))}" fill="${c.primary}" text-anchor="middle">${esc(name)}</text>`
    + `<text x="400" y="226" font-family="${serif}" font-size="18" fill="#3f3a2e" text-anchor="middle" letter-spacing="3">AIRPORT HOLDINGS · LISTED ON THE ${EXCHANGE.name.toUpperCase()}</text>`
    + `<text x="400" y="292" font-family="${serif}" font-size="20" fill="#3f3a2e" text-anchor="middle">This certifies that ${esc(d.holder)} is the owner of</text>`
    + `<text x="400" y="342" font-family="${serif}" font-size="38" font-weight="700" fill="#1f1b12" text-anchor="middle">${d.shares.toLocaleString('en-US')} SHARES</text>`
    + `<text x="400" y="380" font-family="${serif}" font-size="18" fill="#3f3a2e" text-anchor="middle">of common stock, ticker ${esc(formatTicker(d.ticker))}</text>`
    + `<text x="60" y="462" font-family="${serif}" font-size="15" fill="#3f3a2e">No. ${esc(d.serial)}</text><text x="740" y="462" font-family="${serif}" font-size="15" fill="#3f3a2e" text-anchor="end">Issued ${esc(d.issued)}</text>`
    + `<circle cx="660" cy="400" r="40" fill="${c.secondary}" stroke="${c.primary}" stroke-width="3"/><text x="660" y="400" font-family="${serif}" font-size="14" font-weight="700" fill="${c.primary}" text-anchor="middle" dominant-baseline="central">${esc(d.ticker)}</text>`
    + `</svg>`;
}

/** Small "Listed on HATCH" badge (240x64). */
export function listingBadgeSVG(spec: LogoSpec, ticker: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64"><rect width="240" height="64" rx="10" fill="#0f172a"/>${nested(spec, 8, 8, 48)}`
    + `<text x="68" y="24" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#94a3b8" letter-spacing="2">LISTED ON ${EXCHANGE.id}</text>`
    + `<text x="68" y="46" font-family="'JetBrains Mono',Consolas,monospace" font-size="20" font-weight="700" fill="#ffffff">${esc(formatTicker(ticker))}</text></svg>`;
}
