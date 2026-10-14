export type SecurityTech = 'xray' | 'ct' | 'biometric';

export interface SecurityTechSpec {
  paxPerHr: number;
}

export const SECURITY_TECH_RATES: Record<SecurityTech, number> = {
  xray: 150,
  ct: 200,
  biometric: 260,
};

export type CheckinType = 'desk' | 'kiosk' | 'bagDrop';

export const CHECKIN_RATES: Record<CheckinType, number> = {
  desk: 60,
  kiosk: 90,
  bagDrop: 120,
};

export const DEFAULT_BAG_SHARE = 0.8;

export type SorterTier = 'manual' | 'tilt-tray' | 'ics';

export interface SorterSpec {
  bagsPerHr: number;
  mishandleRate: number;
}

export const SORTER_SPECS: Record<SorterTier, SorterSpec> = {
  manual: { bagsPerHr: 400, mishandleRate: 0.025 },
  'tilt-tray': { bagsPerHr: 2500, mishandleRate: 0.008 },
  ics: { bagsPerHr: 6000, mishandleRate: 0.003 },
};

export const DEFAULT_GATE_BUFFER_MIN = 20;

export type AircraftClass = 'small' | 'regional' | 'narrowbody' | 'widebody' | 'jumbo';

export const AIRCRAFT_CLASS_RANK: Record<AircraftClass, number> = {
  small: 1,
  regional: 2,
  narrowbody: 3,
  widebody: 4,
  jumbo: 5,
};
