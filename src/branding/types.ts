/** Airport branding data model. Everything is plain JSON so it can live in save files. */
export const LOGO_SPEC_VERSION = 1 as const;

export type EmblemShape = 'roundel' | 'shield' | 'wing' | 'badge' | 'hexagon' | 'circle-ring' | 'tail-fin' | 'none';
export type TextLayout = 'below' | 'ring' | 'side' | 'none';

export interface LogoColors {
  primary: string;   // emblem fill
  secondary: string; // emblem accent / stroke
  accent: string;    // icon colour
  text: string;      // wordmark colour
  background: string; // 'transparent' or hex
}

export interface LogoSpec {
  version: typeof LOGO_SPEC_VERSION;
  airportName: string;
  code: string;        // 3-letter IATA-style code, '' = hidden
  showCode: boolean;
  shape: EmblemShape;
  icon: string;        // IconId or 'none'
  paletteId: string;   // palette id or 'custom'
  colors: LogoColors;
  font: string;        // FontId
  layout: TextLayout;
  iconScale: number;   // 0.5 .. 1.4
  strokeWidth: number; // 0 .. 8
}

export interface BrandingSave {
  airportName: string;
  code: string;
  logo: LogoSpec;
  presetId?: string;
}
