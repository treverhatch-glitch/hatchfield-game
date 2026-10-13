export type AircraftClass = 'small' | 'regional' | 'narrowbody' | 'widebody' | 'jumbo';

export const KG_CO2_PER_LTO: Record<AircraftClass, number> = {
  small: 300,
  regional: 800,
  narrowbody: 2500,
  widebody: 6000,
  jumbo: 10000,
};

export const GROUND_OPS_KG_PER_DAY_PER_MW = 900;

/** SAF cuts flight CO2 by safBlend x 0.8 (e.g. 100% blend cuts flight CO2 by 80%). */
export const SAF_CUT_FACTOR = 0.8;

/** Cost per tonne of carbon offsets in USD ($25/t). */
export const OFFSET_COST_PER_TONNE = 25;
