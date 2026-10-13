import type { EmblemShape, LogoColors, TextLayout } from './types';

export const SHAPES: { id: EmblemShape; label: string }[] = [
  { id: 'roundel', label: 'Roundel' }, { id: 'shield', label: 'Shield' }, { id: 'wing', label: 'Wing' },
  { id: 'badge', label: 'Badge' }, { id: 'hexagon', label: 'Hexagon' }, { id: 'circle-ring', label: 'Ring' },
  { id: 'tail-fin', label: 'Tail fin' }, { id: 'none', label: 'None' },
];

export const LAYOUTS: { id: TextLayout; label: string }[] = [
  { id: 'below', label: 'Name below' }, { id: 'ring', label: 'Around ring' },
  { id: 'side', label: 'Side by side' }, { id: 'none', label: 'Emblem only' },
];

/** Shape outlines drawn in a 100x100 box centred at 50,50. */
export const SHAPE_PATHS: Record<Exclude<EmblemShape, 'none'>, string> = {
  roundel: 'M50 4a46 46 0 1 0 0.01 0Z',
  shield: 'M50 4 L90 16 V48 C90 74 72 88 50 96 C28 88 10 74 10 48 V16 Z',
  wing: 'M4 58 C20 30 46 22 96 24 C84 36 78 44 74 58 C62 74 40 80 24 76 C16 74 8 66 4 58Z',
  badge: 'M50 3 L61 14 L77 11 L80 27 L95 35 L88 50 L95 65 L80 73 L77 89 L61 86 L50 97 L39 86 L23 89 L20 73 L5 65 L12 50 L5 35 L20 27 L23 11 L39 14 Z',
  hexagon: 'M50 3 L91 26.5 V73.5 L50 97 L9 73.5 V26.5 Z',
  'circle-ring': 'M50 4a46 46 0 1 0 0.01 0Z M50 20a30 30 0 1 1 -0.01 0Z',
  'tail-fin': 'M30 96 L44 8 C48 4 56 4 60 8 L92 70 C94 76 92 82 86 84 L30 96Z',
};

/** ~32 icons, each a path in a 100x100 box, filled (evenodd). */
export const ICONS: Record<string, { label: string; d: string }> = {
  'plane-top': { label: 'Airliner', d: 'M47 6h6l3 32 34 18v8l-34-8-2 22 10 8v6l-14-4-14 4v-6l10-8-2-22-34 8v-8l34-18z' },
  'plane-side': { label: 'Jet side', d: 'M6 54l10-2 8-12h6l-2 12 34-2 20-12c6-3 12 0 10 6-2 4-8 8-14 10L30 64H16z' },
  'plane-climb': { label: 'Take-off', d: 'M10 80h80v6H10zM14 62l8-4 10 6 16-8-18-20 8-4 28 16 18-9c6-3 12 0 10 5-2 4-14 10-24 15L28 70z' },
  'prop-plane': { label: 'Prop plane', d: 'M46 10h8v18h36v10H54v26l14 4v8H32v-8l14-4V38H10V28h36zM42 4h16v4H42z' },
  jet: { label: 'Delta jet', d: 'M50 4l8 30 34 40v8l-34-14-4 16 10 8v4H38v-4l10-8-4-16-34 14v-8l34-40z' },
  helicopter: { label: 'Helicopter', d: 'M8 20h84v5H52v8c18 2 26 12 26 24 0 8-6 13-16 13H40c-12 0-18-8-16-18l-18-2v-8l20 2c4-8 12-11 22-11v-8H8zM34 78h40v5H34z' },
  tower: { label: 'Control tower', d: 'M30 18h40l-6 20H36zM24 10h52v8H24zM40 38h20v48h10v6H30v-6h10zM34 22h32v10H34z' },
  compass: { label: 'Compass', d: 'M50 4l10 36 36 10-36 10-10 36-10-36L4 50l36-10zM50 40a10 10 0 1 0 .01 0z' },
  globe: { label: 'Globe', d: 'M50 6a44 44 0 1 0 .01 0zm0 6c-8 10-12 22-12 38s4 28 12 38c8-10 12-22 12-38s-4-28-12-38zM12 46h76v8H12z' },
  sun: { label: 'Sun', d: 'M50 28a22 22 0 1 0 .01 0zM46 2h8v16h-8zM46 82h8v16h-8zM2 46h16v8H2zM82 46h16v8H82zM14 20l6-6 11 11-6 6zM69 75l6-6 11 11-6 6zM80 14l6 6-11 11-6-6zM25 69l6 6-11 11-6-6z' },
  palm: { label: 'Palm', d: 'M47 40h6l4 50h-14zM50 40C40 22 22 18 8 26c14 0 28 4 42 14zM50 40c10-18 28-22 42-14-14 0-28 4-42 14zM50 40C44 26 34 12 20 10c10 8 22 18 30 30zM50 40c6-14 16-28 30-30-10 8-22 18-30 30z' },
  mountain: { label: 'Mountain', d: 'M4 86L36 26l14 22 12-18 34 56zM36 26l8 16-8-4-6 6z' },
  wave: { label: 'Wave', d: 'M4 50c12-14 24-14 32 0s20 14 32 0 20-14 28-4v12c-8-10-16-8-28 6-12 14-24 14-32 0S16 50 4 62zM4 72c12-14 24-14 32 0s20 14 32 0 20-14 28-4v12c-8-10-16-8-28 6-12 14-24 14-32 0S16 72 4 84z' },
  star: { label: 'Star', d: 'M50 4l13 30 33 3-25 22 8 33-29-17-29 17 8-33L4 37l33-3z' },
  lotus: { label: 'Lotus', d: 'M50 14c10 12 14 26 0 52-14-26-10-40 0-52zM50 66C38 50 22 40 8 40c4 18 22 28 42 26zM50 66c12-16 28-26 42-26-4 18-22 28-42 26zM14 72h72c-8 10-22 14-36 14S22 82 14 72z' },
  elephant: { label: 'Elephant', d: 'M20 36c0-14 12-22 28-22h14c16 0 28 10 28 26v38h-12V64H70v14H58V64H40v14H28V56c-6 4-8 12-6 22h-8c-4-12 0-26 10-32zM64 34a4 4 0 1 0 .01 0z' },
  crown: { label: 'Crown', d: 'M8 30l20 18 22-30 22 30 20-18-8 50H16zM16 84h68v8H16z' },
  'arrow-up': { label: 'Departures', d: 'M50 6l34 34H62v52H38V40H16z' },
  'arrows-cross': { label: 'Connections', d: 'M10 30h52V16l28 22-28 22V46H10zM90 70H38v14L10 62l28-22v14h52z' },
  chevrons: { label: 'Chevrons', d: 'M10 70l40-40 40 40-12 12-28-28-28 28zM10 40l40-40 40 40-12 12-28-28-28 28z' },
  runway: { label: 'Runway', d: 'M36 4h28l10 92H26zM47 14h6v12h-6zM47 36h6v12h-6zM47 58h6v12h-6zM47 80h6v10h-6z' },
  windsock: { label: 'Windsock', d: 'M14 6h6v90h-6zM20 14l70 10v20L20 54z' },
  radar: { label: 'Radar', d: 'M50 10a40 40 0 0 1 40 40H78a28 28 0 0 0-28-28zM50 30a20 20 0 0 1 20 20H58a8 8 0 0 0-8-8zM46 50h8v40h12v6H34v-6h12z' },
  cargo: { label: 'Cargo box', d: 'M50 6l40 18v52L50 94 10 76V24zM50 16L22 28l28 12 28-12zM16 34v38l30 14V48z' },
  container: { label: 'Container', d: 'M6 28h88v48H6zM14 36v32h8V36zm16 0v32h8V36zm16 0v32h8V36zm16 0v32h8V36zm16 0v32h8V36z' },
  bird: { label: 'Bird', d: 'M4 40c18-6 32 0 42 14 10-22 28-34 50-32-18 8-28 22-34 42-4 12-14 18-26 16 6-4 8-10 6-16C30 52 18 44 4 40z' },
  feather: { label: 'Feather', d: 'M84 6C50 10 24 36 22 70l-12 24 8 2 10-22c34-2 58-26 58-60zM30 70l34-40' },
  leaf: { label: 'Leaf', d: 'M88 8C40 8 12 36 14 76l-8 16 8 2 6-14c42 2 70-26 68-72zM24 76c14-20 30-36 50-48-16 16-30 30-44 52z' },
  snowflake: { label: 'Snowflake', d: 'M46 4h8v92h-8zM8 26l4-7 80 48-4 7zM8 74l80-48 4 7-80 48zM36 8l14 12 14-12 4 6-18 14-18-14zM36 92l14-12 14 12 4-6-18-14-18 14z' },
  anchor: { label: 'Anchor', d: 'M50 6a10 10 0 1 0 .01 0zM46 24h8v60c14-2 26-12 28-26h-8l12-14 12 14h-8c-2 22-20 38-40 38S12 80 10 58H2l12-14 12 14h-8c2 14 14 24 28 26zM34 34h32v8H34z' },
  diamond: { label: 'Diamond', d: 'M26 12h48l20 24-44 56L6 36zM16 36h68L50 80z' },
  beacon: { label: 'Beacon', d: 'M40 30h20v60H40zM34 90h32v6H34zM50 6a12 12 0 1 0 .01 0zM6 14l26 10-2 6L4 20zM94 14L68 24l2 6 26-10z' },
  temple: { label: 'Temple spire', d: 'M50 2l6 18 4 18 8 14v10l10 4v10l8 4v10H14V80l8-4V66l10-4V52l8-14 4-18z' },
};
export const ICON_IDS = Object.keys(ICONS);

export interface Palette { id: string; label: string; colors: LogoColors }
const p = (id: string, label: string, primary: string, secondary: string, accent: string, text: string, background = 'transparent'): Palette =>
  ({ id, label, colors: { primary, secondary, accent, text, background } });

export const PALETTES: Palette[] = [
  p('midnight', 'Midnight', '#0f1e3d', '#f5c542', '#f5c542', '#f3f4f6'),
  p('skyline', 'Skyline', '#1d6fd8', '#ffffff', '#ffffff', '#e8f1ff'),
  p('sunset', 'Sunset', '#e4572e', '#ffc857', '#fff4d6', '#ffc857'),
  p('tropic', 'Tropic', '#0a9396', '#ee9b00', '#ffffff', '#94d2bd'),
  p('forest', 'Forest', '#2d5a3d', '#d8c99b', '#f0ead2', '#d8c99b'),
  p('royal', 'Royal', '#4b1d6e', '#d4af37', '#d4af37', '#f5e6b8'),
  p('crimson', 'Crimson', '#9b1c1c', '#f8f8f8', '#ffffff', '#ffffff'),
  p('arctic', 'Arctic', '#e6f2fa', '#2b6ca3', '#2b6ca3', '#cfe6f7'),
  p('cargo', 'Cargo', '#f2a900', '#1b1b1b', '#1b1b1b', '#f2a900'),
  p('retro', 'Retro', '#d9653b', '#2e4a62', '#f4e3c1', '#f4e3c1'),
  p('mono', 'Monochrome', '#1a1a1a', '#e5e5e5', '#ffffff', '#e5e5e5'),
  p('jade', 'Jade', '#0b6e4f', '#c9a227', '#ffffff', '#c9e4d4'),
  p('lagoon', 'Lagoon', '#00a8e8', '#003459', '#ffffff', '#b3e5fc'),
  p('desert', 'Desert', '#c2803d', '#5a3214', '#fff1d6', '#f0d3a5'),
];
export const PALETTE_IDS = PALETTES.map((x) => x.id);

export const FONTS: Record<string, { label: string; stack: string; weight: number; letterSpacing: number; italic?: boolean }> = {
  modern: { label: 'Modern', stack: "'Inter','Helvetica Neue',Arial,sans-serif", weight: 700, letterSpacing: 2 },
  geometric: { label: 'Geometric', stack: "'Futura','Century Gothic','Avenir',sans-serif", weight: 600, letterSpacing: 4 },
  condensed: { label: 'Condensed', stack: "'Oswald','Arial Narrow','Roboto Condensed',sans-serif", weight: 700, letterSpacing: 1 },
  serif: { label: 'Classic serif', stack: "'Playfair Display',Georgia,'Times New Roman',serif", weight: 700, letterSpacing: 1 },
  slab: { label: 'Slab', stack: "'Rockwell','Roboto Slab','Courier New',serif", weight: 700, letterSpacing: 2 },
  mono: { label: 'Stencil mono', stack: "'JetBrains Mono','Consolas','Courier New',monospace", weight: 700, letterSpacing: 3 },
  script: { label: 'Retro italic', stack: "'Brush Script MT','Segoe Script',cursive", weight: 400, letterSpacing: 0, italic: true },
  wide: { label: 'Wide', stack: "'Eurostile','Microgramma','Verdana',sans-serif", weight: 800, letterSpacing: 6 },
};
export const FONT_IDS = Object.keys(FONTS);
