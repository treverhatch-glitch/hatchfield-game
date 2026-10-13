import type {
  Agenda,
  AgendaId,
  AirlineSeed,
  DiplomacyTier,
  Interest,
  MetricKey,
  Trait,
  TraitId,
  VoiceStyle
} from './types.ts';

export const TRAITS: Record<TraitId, Trait> = {
  green: { id: 'green', label: 'Green', flavour: 'Every kilo of CO2 matters to us.' },
  proud: { id: 'proud', label: 'Proud', flavour: 'We expect to be treated as the leading carrier here.' },
  punctual: { id: 'punctual', label: 'Punctual', flavour: 'Our schedule is sacred; yours should be too.' },
  lavish: { id: 'lavish', label: 'Lavish', flavour: 'Passengers remember comfort, not discounts.' },
  showman: { id: 'showman', label: 'Showman', flavour: 'A little theatre never hurt a launch.' },
  hardball: { id: 'hardball', label: 'Hardball', flavour: 'Promises are a ledger. We keep score.' },
  frugal: { id: 'frugal', label: 'Frugal', flavour: 'Every cent on the fee sheet is a seat we cannot sell.' },
  patient: { id: 'patient', label: 'Patient', flavour: 'Good partnerships are built over seasons.' }
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

export const AGENDAS: Record<AgendaId, Agenda> = {
  never_second: { id: 'never_second', label: 'Never second at any field' },
  biggest_everywhere: { id: 'biggest_everywhere', label: 'Wants to be the biggest at every field it flies to' },
  loyal_partner: { id: 'loyal_partner', label: 'Rewards long, steady partnerships' },
  cost_cutter: { id: 'cost_cutter', label: 'Pushes every airport to cut fees' }
};

export const AGENDA_IDS = Object.keys(AGENDAS) as AgendaId[];

export const HOSTILE_TRAIT_PAIRS: [TraitId, TraitId][] = [
  ['frugal', 'lavish'],
  ['green', 'showman'],
  ['proud', 'proud']
];

/** Placeholder roster. Names are fictional and subject to replacement by the owner. */
export const ROSTER: AirlineSeed[] = [
  seed('northline', 'Northline', 1, 'pax', 'leisure', 'turboprop', ['cost', 'punctuality', 'family'], ['frugal'], ['#1f4e79', '#f2f2f2'], 'goose', 'north'),
  seed('puddle_air', 'Puddle Air', 1, 'pax', 'family', 'turboprop', ['family', 'cost', 'capacity'], ['patient'], ['#2e86c1', '#f7dc6f'], 'duck', 'west'),
  seed('coastal_hop', 'Coastal Hop', 1, 'pax', 'leisure', 'turboprop', ['punctuality', 'family', 'cost'], ['patient', 'green'], ['#16a085', '#fdfefe'], 'wave', 'south'),
  seed('skypenny', 'SkyPenny', 2, 'pax', 'leisure', 'narrowbody', ['cost', 'capacity', 'punctuality'], ['frugal', 'hardball'], ['#f1c40f', '#1c1c1c'], 'coin', 'east'),
  seed('zoomjet', 'Zoomjet', 2, 'pax', 'leisure', 'narrowbody', ['cost', 'punctuality', 'capacity'], ['frugal', 'showman'], ['#e74c3c', '#ffffff'], 'bolt', 'east'),
  seed('budgie_air', 'Budgie Air', 2, 'pax', 'family', 'narrowbody', ['family', 'cost', 'green'], ['green'], ['#27ae60', '#f9e79f'], 'bird', 'west'),
  {
    ...seed('meridian', 'Meridian', 3, 'pax', 'business', 'narrowbody', ['punctuality', 'premium', 'prestige'], ['punctual', 'proud'], ['#7d3c98', '#f4d03f'], 'compass', 'north'),
    hasKeyFigure: true,
    agenda: 'never_second',
    keyFigureName: 'Isabella Okafor',
    keyFigureTitle: 'Chief Executive',
    voice: 'formal'
  },
  seed('atlas_blue', 'Atlas Blue', 3, 'pax', 'business', 'narrowbody', ['capacity', 'premium', 'punctuality'], ['hardball'], ['#1a5276', '#aed6f1'], 'globe', 'south'),
  {
    ...seed('verdant_air', 'Verdant Air', 3, 'pax', 'leisure', 'narrowbody', ['green', 'premium', 'prestige'], ['green', 'lavish'], ['#1e8449', '#d5f5e3'], 'leaf', 'west'),
    hasKeyFigure: true,
    agenda: 'biggest_everywhere',
    keyFigureName: 'Tomas Lind',
    keyFigureTitle: 'Founder and Chair',
    voice: 'warm'
  },
  {
    ...seed('stackwing_cargo', 'Stackwing Cargo', 3, 'cargo', 'cargo', 'freighter', ['cargo', 'capacity', 'cost'], ['hardball', 'patient'], ['#6e2c00', '#f5cba7'], 'crate', 'south'),
    hasKeyFigure: true,
    agenda: 'loyal_partner',
    keyFigureName: 'Hana Brandt',
    keyFigureTitle: 'Head of Freight',
    voice: 'blunt'
  },
  {
    ...seed('skyglass', 'SkyGlass', 4, 'pax', 'business', 'widebody', ['premium', 'prestige', 'punctuality'], ['lavish', 'proud'], ['#2874a6', '#ebf5fb'], 'prism', 'north'),
    hasKeyFigure: true,
    agenda: 'never_second',
    keyFigureName: 'Rafael Quinn',
    keyFigureTitle: 'Chief Executive',
    voice: 'formal'
  },
  {
    ...seed('orient_crown', 'Orient Crown', 4, 'pax', 'business', 'widebody', ['prestige', 'premium', 'green'], ['proud', 'showman'], ['#b03a2e', '#f9e79f'], 'crown', 'east'),
    hasKeyFigure: true,
    agenda: 'biggest_everywhere',
    keyFigureName: 'Mei Tanaka-Ruiz',
    keyFigureTitle: 'President',
    voice: 'flamboyant'
  },
  seed('southern_cross', 'Southern Cross', 4, 'pax', 'leisure', 'widebody', ['cost', 'capacity', 'family'], ['patient'], ['#154360', '#fadbd8'], 'cross', 'south'),
  seed('ironbird_freight', 'Ironbird Freight', 4, 'cargo', 'cargo', 'freighter', ['cargo', 'cost', 'punctuality'], ['hardball'], ['#424949', '#f0b27a'], 'anvil', 'east'),
  {
    ...seed('royal_aurum', 'Royal Aurum', 5, 'pax', 'business', 'widebody', ['prestige', 'premium', 'punctuality'], ['proud', 'lavish'], ['#7d6608', '#fcf3cf'], 'scepter', 'north'),
    hasKeyFigure: true,
    agenda: 'never_second',
    keyFigureName: 'Alessandra Voss',
    keyFigureTitle: 'Chair',
    voice: 'formal'
  },
  {
    ...seed('global_one', 'Global One', 5, 'pax', 'business', 'widebody', ['capacity', 'premium', 'prestige'], ['hardball', 'punctual'], ['#212f3d', '#d6eaf8'], 'one', 'west'),
    hasKeyFigure: true,
    agenda: 'biggest_everywhere',
    keyFigureName: 'Jonas Adeyemi',
    keyFigureTitle: 'Group CEO',
    voice: 'blunt'
  },
  seed('aurora_pacific', 'Aurora Pacific', 5, 'pax', 'leisure', 'widebody', ['green', 'family', 'premium'], ['green', 'patient'], ['#117a65', '#fef9e7'], 'aurora', 'east')
];

function seed(
  id: string,
  name: string,
  tier: DiplomacyTier,
  kind: 'pax' | 'cargo',
  passengerType: AirlineSeed['passengerType'],
  fleetFamily: AirlineSeed['fleetFamily'],
  interests: [Interest, Interest, Interest],
  traits: TraitId[],
  livery: [string, string],
  glyph: string,
  region: string
): AirlineSeed {
  return { id, name, tier, kind, passengerType, fleetFamily, interests, traits, hasKeyFigure: false, livery, glyph, region };
}

export const ALLIANCE_SEEDS = [
  { id: 'orbit', name: 'Orbit', members: ['verdant_air', 'skyglass', 'southern_cross'] },
  { id: 'pacific_ring', name: 'Pacific Ring', members: ['orient_crown', 'aurora_pacific', 'royal_aurum'] }
];

export const RIVAL_AIRPORT_NAMES = ['Harrowmere Regional', 'Bellwater Intl', 'Kestrel Field'];

export interface DemandTemplate {
  id: string;
  interest: Interest;
  tierMin: DiplomacyTier;
  tierMax: DiplomacyTier;
  text: string;
  metric: MetricKey;
  compare: 'gte' | 'lte';
  /** 'delta' targets are sized as baseline + value, so asks never exceed the current airport by much. */
  mode: 'absolute' | 'delta';
  value: number;
  holdDays: number;
  deadlineDays: number;
  costly: boolean;
  conflictTag?: string;
  /** Tier-1 and 2 asks can only be issued once the airport could plausibly meet them. */
  requiresField?: number;
}

export const DEMAND_TEMPLATES: DemandTemplate[] = [
  { id: 'cost_freeze', interest: 'cost', tierMin: 1, tierMax: 2, text: 'Hold fees at or below baseline for 60 days', metric: 'feeIndex', compare: 'lte', mode: 'absolute', value: 1, holdDays: 60, deadlineDays: 120, costly: true },
  { id: 'cost_incentive', interest: 'cost', tierMin: 3, tierMax: 5, text: 'Run a published incentive deal for your tier', metric: 'incentiveDealActive', compare: 'gte', mode: 'absolute', value: 1, holdDays: 0, deadlineDays: 90, costly: true },
  { id: 'punct_85', interest: 'punctuality', tierMin: 1, tierMax: 2, text: 'On-time at least 85% for 30 days', metric: 'onTimePct', compare: 'gte', mode: 'absolute', value: 85, holdDays: 30, deadlineDays: 90, costly: false },
  { id: 'punct_90', interest: 'punctuality', tierMin: 3, tierMax: 5, text: 'On-time at least 90% for 60 days', metric: 'onTimePct', compare: 'gte', mode: 'absolute', value: 90, holdDays: 60, deadlineDays: 150, costly: false },
  { id: 'premium_cafe', interest: 'premium', tierMin: 1, tierMax: 2, text: 'Open a cafe at the gate', metric: 'cafes', compare: 'gte', mode: 'delta', value: 1, holdDays: 0, deadlineDays: 90, costly: false },
  { id: 'premium_lounge', interest: 'premium', tierMin: 3, tierMax: 5, text: 'Build a branded lounge with 40 more seats', metric: 'loungeSeats', compare: 'gte', mode: 'delta', value: 40, holdDays: 0, deadlineDays: 180, costly: false },
  { id: 'cap_stand', interest: 'capacity', tierMin: 1, tierMax: 2, text: 'Add one more stand', metric: 'standCount', compare: 'gte', mode: 'delta', value: 1, holdDays: 0, deadlineDays: 90, costly: false },
  { id: 'cap_wide', interest: 'capacity', tierMin: 3, tierMax: 5, text: 'Add a widebody stand and a guaranteed peak slot series', metric: 'heavyStands', compare: 'gte', mode: 'delta', value: 1, holdDays: 0, deadlineDays: 180, costly: true, conflictTag: 'peak_slots' },
  { id: 'green_tug', interest: 'green', tierMin: 1, tierMax: 2, text: 'Put an electric tug on the apron', metric: 'electricTugs', compare: 'gte', mode: 'delta', value: 1, holdDays: 0, deadlineDays: 90, costly: false },
  { id: 'green_solar', interest: 'green', tierMin: 3, tierMax: 5, text: 'Reach 30% more solar coverage', metric: 'solarCoveragePct', compare: 'gte', mode: 'delta', value: 30, holdDays: 0, deadlineDays: 150, costly: false },
  { id: 'family_corner', interest: 'family', tierMin: 1, tierMax: 2, text: 'Add a play corner', metric: 'familyAmenities', compare: 'gte', mode: 'delta', value: 1, holdDays: 0, deadlineDays: 90, costly: false },
  { id: 'family_lane', interest: 'family', tierMin: 3, tierMax: 5, text: 'Open a family security lane', metric: 'familyAmenities', compare: 'gte', mode: 'delta', value: 2, holdDays: 0, deadlineDays: 150, costly: false },
  { id: 'prestige_board', interest: 'prestige', tierMin: 1, tierMax: 2, text: 'Show our livery on a billboard', metric: 'prestigeItems', compare: 'gte', mode: 'delta', value: 1, holdDays: 0, deadlineDays: 90, costly: false },
  { id: 'prestige_pier', interest: 'prestige', tierMin: 3, tierMax: 5, text: 'Give us an exclusive pier', metric: 'exclusivePier', compare: 'gte', mode: 'absolute', value: 1, holdDays: 0, deadlineDays: 180, costly: true, conflictTag: 'exclusive_pier' },
  { id: 'cargo_night', interest: 'cargo', tierMin: 1, tierMax: 3, text: 'Guarantee two night slots a week', metric: 'nightSlots', compare: 'gte', mode: 'delta', value: 2, holdDays: 0, deadlineDays: 90, costly: true },
  { id: 'cargo_cold', interest: 'cargo', tierMin: 3, tierMax: 5, text: 'Build a cold-chain room', metric: 'coldChainRooms', compare: 'gte', mode: 'delta', value: 1, holdDays: 0, deadlineDays: 150, costly: false }
];

export const PROMISE_PITCHES: { id: string; text: string; metric: MetricKey; compare: 'gte' | 'lte'; value: number; holdDays: number; days: number }[] = [
  { id: 'pitch_ontime', text: 'On-time at least 90% for 30 days', metric: 'onTimePct', compare: 'gte', value: 90, holdDays: 30, days: 90 },
  { id: 'pitch_fees', text: 'No fee above baseline for 45 days', metric: 'feeIndex', compare: 'lte', value: 1, holdDays: 45, days: 90 }
];

export const NAME_PREFIXES = ['Brisk', 'Wren', 'Tern', 'Cinder', 'Lark', 'Marlow', 'Sable', 'Quill', 'Hollis', 'Ember', 'Fable', 'Juniper', 'Coral', 'Basalt', 'Opal'];
export const NAME_SUFFIXES = ['Air', 'Jet', 'Lines', 'Wings', 'Pacificline', 'Skyways', 'Connect', 'Express'];

/** Real carriers and well-known brand tokens. Generated names must not contain any of these. */
export const REAL_AIRLINE_BLOCKLIST = [
  'delta', 'united', 'american', 'southwest', 'jetblue', 'alaska', 'spirit', 'frontier', 'hawaiian',
  'lufthansa', 'ryanair', 'easyjet', 'wizz', 'vueling', 'iberia', 'klm', 'air france', 'british',
  'virgin', 'emirates', 'qatar', 'etihad', 'turkish', 'qantas', 'singapore', 'cathay', 'ana', 'jal',
  'korean', 'air canada', 'westjet', 'aeroflot', 'latam', 'avianca', 'copa', 'norwegian', 'finnair',
  'swiss', 'austrian', 'sas', 'tap', 'ethiopian', 'saudia', 'indigo', 'airasia', 'scoot', 'fedex',
  'ups', 'dhl', 'atlas air', 'cargolux', 'tui', 'condor', 'eurowings', 'aer lingus', 'icelandair'
];

export const KEY_FIGURE_FIRST = ['Amara', 'Tobias', 'Leila', 'Ivo', 'Priya', 'Mateo', 'Sunniva', 'Kofi', 'Elin', 'Rurik', 'Noor', 'Callum'];
export const KEY_FIGURE_LAST = ['Reyes', 'Hartmann', 'Osei', 'Lindqvist', 'Nakamura', 'Duval', 'Petrov', 'Okoro', 'Marsh', 'Valdez', 'Ketterer', 'Abara'];
export const KEY_FIGURE_TITLES: Record<DiplomacyTier, string[]> = {
  1: ['Owner'],
  2: ['Route Manager'],
  3: ['Head of Network', 'Chief Executive'],
  4: ['Chief Executive', 'President'],
  5: ['Chair', 'Group CEO']
};
export const VOICES: VoiceStyle[] = ['formal', 'warm', 'blunt', 'flamboyant'];

export const PROCEDURAL_GLYPHS = ['feather', 'star', 'arrow', 'ring', 'sun', 'tide'];
export const PROCEDURAL_LIVERIES: [string, string][] = [
  ['#c0392b', '#fdfefe'],
  ['#2471a3', '#f9e79f'],
  ['#1e8449', '#fef5e7'],
  ['#6c3483', '#fadbd8'],
  ['#d68910', '#1b2631'],
  ['#148f77', '#f2f4f4']
];
