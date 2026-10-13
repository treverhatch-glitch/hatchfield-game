import { paletteColors } from './validate';
import { LOGO_SPEC_VERSION, type EmblemShape, type LogoSpec, type TextLayout } from './types';

export interface LogoPreset { id: string; label: string; style: 'modern' | 'retro' | 'regional' | 'luxury' | 'cargo'; spec: LogoSpec }

const mk = (id: string, label: string, style: LogoPreset['style'], name: string, code: string, shape: EmblemShape, icon: string, paletteId: string, font: string, layout: TextLayout, extra: Partial<LogoSpec> = {}): LogoPreset => ({
  id, label, style,
  spec: { version: LOGO_SPEC_VERSION, airportName: name, code, showCode: true, shape, icon, paletteId, colors: paletteColors(paletteId), font, layout, iconScale: 1, strokeWidth: 4, ...extra },
});

export const PRESETS: LogoPreset[] = [
  // modern
  mk('m-sky', 'Skyline', 'modern', 'Hatchfield', 'HTF', 'roundel', 'plane-top', 'skyline', 'modern', 'below'),
  mk('m-mono', 'Monoline', 'modern', 'Hatchfield', 'HTF', 'circle-ring', 'plane-climb', 'mono', 'geometric', 'side', { strokeWidth: 0 }),
  mk('m-hex', 'Hex Hub', 'modern', 'Hatchfield Intl', 'HTF', 'hexagon', 'arrows-cross', 'lagoon', 'wide', 'below'),
  mk('m-tail', 'Tailfin', 'modern', 'Hatchfield', 'HTF', 'tail-fin', 'star', 'crimson', 'condensed', 'side', { strokeWidth: 0 }),
  mk('m-arrow', 'Departures', 'modern', 'Hatchfield', 'HTF', 'roundel', 'arrow-up', 'midnight', 'modern', 'ring'),
  // retro
  mk('r-wing', 'Golden Wing', 'retro', 'Hatchfield Field', 'HTF', 'wing', 'prop-plane', 'retro', 'slab', 'below', { iconScale: 0.8 }),
  mk('r-badge', 'Barnstormer', 'retro', 'Hatchfield', 'HTF', 'badge', 'prop-plane', 'sunset', 'script', 'below'),
  mk('r-shield', 'Aero Club', 'retro', 'Hatchfield Aero', 'HTF', 'shield', 'windsock', 'desert', 'slab', 'ring'),
  mk('r-jet', 'Jet Age', 'retro', 'Hatchfield', 'HTF', 'circle-ring', 'jet', 'retro', 'wide', 'side'),
  mk('r-beacon', 'Beacon', 'retro', 'Hatchfield', 'HTF', 'hexagon', 'beacon', 'midnight', 'mono', 'below'),
  // regional
  mk('g-palm', 'Island Hop', 'regional', 'Palm Bay', 'PBY', 'roundel', 'palm', 'tropic', 'geometric', 'below'),
  mk('g-lotus', 'Lotus', 'regional', 'Lotus Gate', 'LTG', 'circle-ring', 'lotus', 'jade', 'serif', 'ring'),
  mk('g-elephant', 'Elephant', 'regional', 'Chang Field', 'CHF', 'shield', 'elephant', 'jade', 'condensed', 'below', { iconScale: 0.9 }),
  mk('g-temple', 'Spire', 'regional', 'Golden Spire', 'GSP', 'badge', 'temple', 'royal', 'serif', 'below'),
  mk('g-peak', 'Alpine', 'regional', 'Summit Peak', 'SMP', 'hexagon', 'mountain', 'arctic', 'geometric', 'side'),
  mk('g-snow', 'Northern', 'regional', 'Frostvale', 'FRV', 'roundel', 'snowflake', 'arctic', 'wide', 'ring', { iconScale: 0.85 }),
  mk('g-wave', 'Coastal', 'regional', 'Seaview', 'SVW', 'tail-fin', 'wave', 'lagoon', 'modern', 'below'),
  // luxury
  mk('l-crown', 'Crown', 'luxury', 'Hatchfield', 'HTF', 'shield', 'crown', 'royal', 'serif', 'below'),
  mk('l-diamond', 'Diamond', 'luxury', 'Hatchfield', 'HTF', 'hexagon', 'diamond', 'midnight', 'serif', 'side', { colors: { ...paletteColors('midnight'), background: '#0a1428' } }),
  mk('l-star', 'Five Star', 'luxury', 'Hatchfield', 'HTF', 'circle-ring', 'star', 'royal', 'wide', 'ring', { iconScale: 0.9 }),
  // cargo
  mk('c-box', 'Freight', 'cargo', 'Hatchfield Cargo', 'HTF', 'hexagon', 'cargo', 'cargo', 'condensed', 'below', { strokeWidth: 6 }),
  mk('c-cont', 'Intermodal', 'cargo', 'Hatchfield Freight', 'HTF', 'badge', 'container', 'cargo', 'mono', 'side'),
  mk('c-globe', 'Global Logistics', 'cargo', 'Hatchfield Logistics', 'HTF', 'roundel', 'globe', 'forest', 'condensed', 'ring'),
  mk('c-radar', 'Night Ops', 'cargo', 'Hatchfield', 'HTF', 'tail-fin', 'radar', 'mono', 'mono', 'below', { colors: { ...paletteColors('mono'), accent: '#f2a900' } }),
];

/** Apply a preset to the player's own name/code. */
export const applyPreset = (p: LogoPreset, airportName: string, code: string): LogoSpec => ({ ...p.spec, colors: { ...p.spec.colors }, airportName, code });
