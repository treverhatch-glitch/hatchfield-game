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

/** Open SAF blending supplies a 50% blend; the carbon model applies SAF_CUT_FACTOR to it. */
export const SAF_BLEND_WITH_PLANT = 0.5;

/** Keep enough daily detail for the 40-day Green Pioneer window plus a small audit tail. */
export const CARBON_HISTORY_DAYS = 60;

/**
 * Direct operating emissions for one open building, in kg CO2 per game day.
 * Pavement and passive links are intentionally absent. Values live here so balance can
 * change without changing the ledger. A terminal shell is counted once, not once per tile.
 */
export const BUILDING_KG_CO2_PER_DAY: Readonly<Record<string, number>> = {
  terminal: 180,
  snack: 45,
  bags: 90,
  fuel: 120,
  fire: 55,
  police: 35,
  cargo: 140,
  guard: 25,
  tower: 70,
  hangar: 160,
  hotel: 110,
  park_s: 18,
  park_l: 32,
  park_g: 65,
  park_u: 80,
  deice: 75,
  bus: 40,
  rail: 55,
  termbus: 65,
  mover: 50,
  xferbus: 65,
  travelator: 20,
  kitchen: 95,
  depot: 85,
  mro: 260,
  nighthub: 310,
  oil: 45,
  late_hotel: 220,
  late_rail: 90,
  saf: 130,
};

export const CARBON_BUILDING_LABELS: Readonly<Record<string, string>> = {
  terminal: 'Terminal',
  snack: 'Snack bar',
  bags: 'Bag sort',
  fuel: 'Fuel farm',
  fire: 'Fire station',
  police: 'Police post',
  cargo: 'Cargo shed',
  guard: 'Guard post',
  tower: 'Control tower',
  hangar: 'Hangar',
  hotel: 'Hotel',
  park_s: 'Small car park',
  park_l: 'Large car park',
  park_g: 'Parking garage',
  park_u: 'Underground parking',
  deice: 'De-ice pad',
  bus: 'Bus curb',
  rail: 'Rail station',
  termbus: 'Terminal bus depot',
  mover: 'People mover',
  xferbus: 'Transfer bus depot',
  travelator: 'Travelator',
  kitchen: 'Catering kitchen',
  depot: 'Vehicle depot',
  mro: 'MRO hangar',
  nighthub: 'Cargo night hub',
  oil: 'Oil station',
  late_hotel: 'Airport hotel',
  late_rail: 'Rail link',
  saf: 'SAF blending',
};
