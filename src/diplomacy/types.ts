import type { AirlineTier, AirportCapabilities, ContractTerms } from '../airlines/index.ts';

export type Band = 'hostile' | 'cold' | 'neutral' | 'warm' | 'partner';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type Interest =
  | 'cost'
  | 'punctuality'
  | 'premium'
  | 'capacity'
  | 'green'
  | 'family'
  | 'prestige'
  | 'cargo';
export type TraitId =
  | 'green'
  | 'proud'
  | 'punctual'
  | 'lavish'
  | 'showman'
  | 'hardball'
  | 'frugal'
  | 'patient';
export type AgendaId = 'never_second' | 'biggest_everywhere' | 'loyal_partner' | 'cost_cutter';
export type VoiceStyle = 'formal' | 'warm' | 'blunt' | 'flamboyant';
export type PassengerType = 'business' | 'leisure' | 'family' | 'cargo';
export type FleetFamily = 'turboprop' | 'narrowbody' | 'widebody' | 'freighter';
export type DiplomacyTier = 1 | 2 | 3 | 4 | 5;
export type ShareClass = 'major' | 'normal' | 'minor';

export type MetricKey =
  | 'onTimePct'
  | 'feeIndex'
  | 'cafes'
  | 'loungeSeats'
  | 'standCount'
  | 'standUtilization'
  | 'heavyStands'
  | 'electricTugs'
  | 'solarCoveragePct'
  | 'familyAmenities'
  | 'prestigeItems'
  | 'exclusivePier'
  | 'nightSlots'
  | 'coldChainRooms'
  | 'cargoFacilities'
  | 'incentiveDealActive'
  | 'hubDepartures'
  | 'maintenanceLevel';

export type Metrics = Partial<Record<MetricKey, number>>;

export interface DiplomacyContext {
  fieldLevel: number;
  metrics: Metrics;
  /** Airport reputation 0–100. First-meet quotes it when the host supplies it. */
  reputation?: number;
  /** Optional airport capabilities from `src/airlines`; used for the "needs" checklist and unlock gating. */
  airport?: AirportCapabilities;
  /** Optional traffic share (0..100) per airline id. If omitted the engine derives it from recorded flights. */
  shares?: Record<string, number>;
}

export type ModifierKind =
  | 'signed_rival'
  | 'signed_ally'
  | 'demand_met'
  | 'demand_timeout'
  | 'demand_declined'
  | 'endeavor_accepted'
  | 'endeavor_supported'
  | 'fee_rise'
  | 'fee_cut'
  | 'incident'
  | 'first_meet'
  | 'promise_kept'
  | 'promise_broken'
  | 'perk_rival'
  | 'slot_rival'
  | 'hub_rival'
  | 'era_carry'
  | 'apology'
  | 'mediation'
  | 'vouch'
  | 'incentive'
  | 'counter_rejected'
  | 'partner_left'
  | 'compliance'
  | 'cancelled_by_player'
  | 'concession'
  | 'court_rival'
  | 'spat_loss'
  | 'letter_ignored'
  | 'reentry'
  | 'rescue'
  | 'lawsuit_settled'
  | 'poach_defence'
  | 'missed_connection'
  | 'negotiation'
  | 'rival_poach'
  | 'premium_screen'
  | 'other';

export interface StandingModifier {
  id: string;
  kind: ModifierKind;
  label: string;
  source: string;
  value: number;
  startDay: number;
  durationDays: number;
  showMe?: string;
}

export interface BreakdownLine {
  label: string;
  value: number;
  kind: ModifierKind | 'performance' | 'trait' | 'agenda';
  /** Present when the player can jump the camera to the cause. */
  showMe?: string;
  /** 0..1 how much of the modifier is left; used for fade bars. */
  remaining: number;
}

export interface StandingBreakdown {
  performance: number;
  modifiers: number;
  traits: number;
  raw: number;
  value: number;
  band: Band;
  lines: BreakdownLine[];
  visibleLines: BreakdownLine[];
  hiddenLineCount: number;
  formula: string;
}

export interface Trait {
  id: TraitId;
  label: string;
  flavour: string;
}

export interface Agenda {
  id: AgendaId;
  label: string;
}

export interface KeyFigure {
  name: string;
  title: string;
  portraitSeed: number;
  traits: [TraitId, TraitId];
  agenda: AgendaId;
  voice: VoiceStyle;
  memory: string[];
  tenureStartDay: number;
  retireAtDay: number;
  generation: number;
  /** Trait carried from the previous chair. Empty for the founding exec. */
  keptTrait?: TraitId | null;
  /** Trait rolled at succession. Empty for the founding exec. */
  freshTrait?: TraitId | null;
}

export interface Favour {
  grantedDay: number;
  reason: string;
}

export interface ContractRecord {
  terms: ContractTerms;
  signedDay: number;
  termEndDay: number;
  discountPct: number;
  discountEndDay: number;
  /** Peak slots per week that could revert under the optional 80% slot rule. */
  peakSlotsPerWeek: number;
  seasonFlights: number;
  seasonExcused: number;
  baseGranted: boolean;
  /** Opening bank is 1. Later flight-contract letters add banks on the same master. */
  flightBanks?: number;
}

export type RelationStatus = 'locked' | 'prospect' | 'signed' | 'former';
export type DepartureStage = 'none' | 'cold_warning' | 'capacity_cut' | 'exit_notice';
export type ExitReason = 'standing' | 'player_cancelled' | 'poached' | 'slot_series' | 'succession';

export interface AirlineSeed {
  id: string;
  name: string;
  tier: DiplomacyTier;
  kind: 'pax' | 'cargo';
  passengerType: PassengerType;
  fleetFamily: FleetFamily;
  interests: [Interest, Interest, Interest];
  traits: TraitId[];
  agenda?: AgendaId;
  hasKeyFigure: boolean;
  livery: [string, string];
  glyph: string;
  region: string;
  keyFigureName?: string;
  keyFigureTitle?: string;
  voice?: VoiceStyle;
}

export interface AirlineRelation {
  id: string;
  name: string;
  tier: DiplomacyTier;
  kind: 'pax' | 'cargo';
  passengerType: PassengerType;
  fleetFamily: FleetFamily;
  interests: [Interest, Interest, Interest];
  traits: TraitId[];
  livery: [string, string];
  glyph: string;
  region: string;
  portraitSeed: number;
  keyFigure: KeyFigure | null;
  status: RelationStatus;
  metDay: number | null;
  firstMeetDone: boolean;
  performance: number;
  pendingGradeSum: number;
  pendingGradeCount: number;
  causeTally: Record<string, number>;
  modifiers: StandingModifier[];
  favours: Favour[];
  leverage: number;
  lastLeverageDay: number;
  band: Band;
  standing: number;
  prevStanding: number;
  contract: ContractRecord | null;
  flightsEma: number;
  flightsToday: number;
  shareClass: ShareClass;
  sharePct: number;
  coldSinceDay: number | null;
  hostileSinceDay: number | null;
  stage: DepartureStage;
  exitNoticeDay: number | null;
  exitCounterUsed: boolean;
  pendingCancel: boolean;
  capacityFactor: number;
  lastBandBeforeExit: Band | null;
  exitedDay: number | null;
  exitReason: ExitReason | null;
  perks: string[];
  isBase: boolean;
  isHub: boolean;
  allianceId: string | null;
  apologyDays: number[];
  freeFavourYear: number;
  poachShieldUntilDay: number;
  nextLetterDay: number;
  history: string[];
  exits: number;
}

export type ProposalKind = 'contract' | 'flights' | 'base' | 'endeavor' | 'newcomer_incentive';
export type ProposalResponse = 'accept' | 'support' | 'counter' | 'decline';

export interface Proposal {
  id: string;
  airlineId: string;
  kind: ProposalKind;
  text: string;
  terms: ContractTerms | null;
  discountPct: number;
  discountDays: number;
  issuedDay: number;
  expiresDay: number;
  counterUsed: boolean;
  supportCost: number;
}

export type LadderStepId = 'master' | 'flights' | 'base' | 'hub';
export type LadderState = 'done' | 'offered' | 'open' | 'locked';

export interface LadderStep {
  id: LadderStepId;
  label: string;
  state: LadderState;
  detail: string;
}

export type CounterLineKey = 'landing' | 'passenger' | 'slots' | 'discount' | 'penalties';

export interface CounterLine {
  key: CounterLineKey;
  label: string;
  offered: string;
  countered: string;
}

export interface CounterQuote {
  lines: CounterLine[];
  ticked: CounterLineKey[];
  /** 0..1 chance the airline accepts this exact set of ticks. Shown before the roll. */
  chance: number;
  cost: number;
}

export type RivalStance = 'back' | 'oppose' | 'ignore';

export interface Commitment {
  id: string;
  airlineId: string;
  kind: 'demand' | 'promise';
  interest: Interest | null;
  text: string;
  metric: MetricKey;
  compare: 'gte' | 'lte';
  target: number;
  baseline: number;
  holdDays: number;
  heldDays: number;
  issuedDay: number;
  deadlineDay: number;
  status: 'open' | 'accepted';
  costly: boolean;
  conflictTag: string | null;
  rivalStances: Record<string, RivalStance>;
  rewardS: number;
  penaltyS: number;
  progress: number;
  extended: boolean;
  timeoutWaived: boolean;
  counterUsed: boolean;
}

export interface Alliance {
  id: string;
  name: string;
  members: string[];
  active: boolean;
}

export interface Spat {
  id: string;
  airlineId: string;
  startedDay: number;
  headline: string;
  reputationPerMonth: number;
  resolved: boolean;
  resolvedDay: number | null;
  resolution: 'concede' | 'hold' | 'court' | 'faded' | 'recovered' | 'exited' | null;
  rivalOffers: string[];
  holdFailed: boolean;
}

export interface Lawsuit {
  id: string;
  airlineId: string;
  filedDay: number;
  legalFee: number;
  verdictDay: number;
  settled: boolean;
  closed: boolean;
}

export type HostileActionKind = 'lawsuit' | 'late_slot_change' | 'refused_gate' | 'slowed_turnarounds';

export interface HostileAction {
  id: string;
  kind: HostileActionKind;
  airlineId: string;
  day: number;
  expiresDay: number;
  /** Money charged now (lawsuit only). */
  legalFee: number;
  /** Multiplier on turnaround service times while active (>= 1). */
  turnaroundSlowFactor: number;
  /** Gates the airline refuses to use while active. */
  refusedGates: number;
  /** Late slot changes: extra delay minutes applied to the airline's flights. */
  extraDelayMinutes: number;
  text: string;
}

export interface OperationalEffects {
  turnaroundSlowFactor: number;
  refusedGates: number;
  extraDelayMinutes: number;
  openLawsuits: number;
  active: HostileAction[];
  perAirline: Record<string, { turnaroundSlowFactor: number; refusedGates: number; extraDelayMinutes: number }>;
}

export interface RivalAirport {
  name: string;
  appeal: number;
  poached: string[];
  lastPoachDay: number | null;
}

export interface SlotPoolEvent {
  id: string;
  openedDay: number;
  spawnDay: number;
  tier: DiplomacyTier;
  leaverId: string;
  leaverName: string;
  newcomers: number;
  done: boolean;
}

export interface IncentiveDeal {
  id: string;
  tier: DiplomacyTier;
  discountPct: number;
  startDay: number;
  endDay: number;
}

export type DiplomacyEventType =
  | 'letter'
  | 'standing_band'
  | 'cold_warning'
  | 'capacity_cut'
  | 'capacity_restored'
  | 'exit_notice'
  | 'exit'
  | 'exit_rescued'
  | 'demand_issued'
  | 'demand_met'
  | 'demand_timeout'
  | 'promise_kept'
  | 'promise_broken'
  | 'spat'
  | 'spat_resolved'
  | 'rival_offer'
  | 'poached'
  | 'hostile_action'
  | 'lawsuit_verdict'
  | 'succession'
  | 'tier_unlocked'
  | 'era_reset'
  | 'newcomer'
  | 'slot_pool'
  | 'slot_series_reverted'
  | 'contract_signed'
  | 'contract_renewed'
  | 'contract_cancelled'
  | 'hub_granted'
  | 'hub_revoked'
  | 'base_granted'
  | 'alliance'
  | 'perks_changed'
  | 'info';

export interface DiplomacyEvent {
  day: number;
  type: DiplomacyEventType;
  airlineId: string | null;
  text: string;
  severity: 'info' | 'good' | 'warn' | 'bad';
  data?: Record<string, number | string | boolean>;
}

export interface DiplomacyConfig {
  seasonDays: number;
  yearDays: number;
  /** Optional 80% slot-series rule (off by default). */
  slotRule80: boolean;
  maxLogEvents: number;
  maxExitsPerYear: number;
}

export interface DiplomacyState {
  version: 1;
  day: number;
  rngState: number;
  nextId: number;
  config: DiplomacyConfig;
  highestTier: number;
  fieldLevel: number;
  relations: Record<string, AirlineRelation>;
  order: string[];
  proposals: Proposal[];
  commitments: Commitment[];
  alliances: Alliance[];
  spats: Spat[];
  lawsuits: Lawsuit[];
  hostileActions: HostileAction[];
  rivalAirport: RivalAirport;
  hubAirlineId: string | null;
  slotPools: SlotPoolEvent[];
  incentiveDeals: IncentiveDeal[];
  exitLog: { day: number; airlineId: string }[];
  feeIndex: number;
  feeRiseLog: number[];
  lastDemandCheckDay: number;
  lastDemandIssuedDay: number;
  tierFloorSpawnDay: Record<string, number>;
  reputationDelta: number;
  log: DiplomacyEvent[];
  /** 0..1 premium passengers clearing screening inside the comfort window. */
  premiumScreenPct?: number;
}

export interface DiplomacyHost {
  /** Optional player-initiated spend. Return false when the player cannot afford it. */
  spend(amount: number, category: string, memo: string): boolean;
  /** Forced charge (lawsuit fees, settlements). May drive cash negative. */
  charge(amount: number, category: string, memo: string): void;
  onEvent?(event: DiplomacyEvent): void;
  onHostileAction?(action: HostileAction): void;
}

export interface ActionResult {
  ok: boolean;
  cost: number;
  message: string;
  chance?: number;
  data?: Record<string, number | string | boolean>;
}

export interface PortraitCard {
  seed: number;
  style: 'flat-2d';
  frame: 'bronze' | 'silver' | 'gold';
  background: string;
  skin: string;
  hair: { style: string; color: string };
  face: { shape: string; eyes: string; brows: string; mouth: string };
  facialHair: string | null;
  accessory: string | null;
  clothing: { style: string; color: string; accent: string };
  logoOnly: boolean;
}

export interface BandChip {
  band: Band;
  color: string;
  icon: string;
  word: string;
}

export interface NeedLine {
  label: string;
  ok: boolean;
  showMe: string;
}

export interface AirlineCard {
  id: string;
  name: string;
  tier: DiplomacyTier;
  baseTier: AirlineTier;
  status: RelationStatus;
  portrait: PortraitCard;
  figure: {
    name: string;
    title: string;
    traits: string[];
    agenda: string;
    voice: VoiceStyle;
    memory: string[];
    generation: number;
    /** Null until a successor takes the chair. */
    shift: string | null;
    retireDay: number;
  } | null;
  livery: [string, string];
  glyph: string;
  band: BandChip;
  standing: number;
  trend: 'up' | 'down' | 'flat';
  sharePct: number;
  shareClass: ShareClass;
  breakdown: StandingBreakdown | null;
  needs: NeedLine[];
  interests: Interest[];
  openCommitment: Commitment | null;
  rivals: string[];
  allies: string[];
  stage: DepartureStage;
  perks: string[];
  isBase: boolean;
  isHub: boolean;
  favours: number;
  leverage: number;
  topCauses: BreakdownLine[];
  history: string[];
  contractTermEndDay: number | null;
  poachRisk: number;
  /** Master → flight contracts → Base → Hub. */
  ladder: LadderStep[];
}
