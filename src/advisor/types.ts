/** Advisor: pure-logic rules engine. No three.js / DOM imports here. */
export type Severity = 'info' | 'warn' | 'critical';
export type Vec3 = { x: number; y: number; z: number };

/** Where "Show me" should fly the camera. */
export interface CameraTarget {
  kind: 'stand' | 'room' | 'runway' | 'vehicle' | 'shop' | 'panel';
  id: string;
  pos?: Vec3;
  /** For kind 'panel': which click-open submenu holds the numbers. */
  panel?: string;
}

export interface AdvisorCard {
  /** Stable key used for dedupe/cooldown, e.g. "security-queue:sec-1". */
  key: string;
  rule: RuleId;
  severity: Severity;
  title: string; // <= ~40 chars
  body: string; // one sentence diagnosis
  fix: string; // one actionable suggestion
  target?: CameraTarget;
  /** Numbers live in the click-open details, not on the card face. */
  details?: Record<string, number | string>;
  createdAt: number;
}

export type RuleId =
  | 'security-queue' | 'bags-left' | 'fuel' | 'shop-stock' | 'stand-size'
  | 'cash-burn' | 'airline-standing' | 'catering-late' | 'runway-capacity';

/** Minimal snapshot the game adapter fills each advisor tick. All fields optional. */
export interface AdvisorSnapshot {
  time: number; // sim seconds
  checkpoints?: { id: string; queue: number; queueHistory: number[]; lanesOpen: number; lanesMax: number; pos?: Vec3 }[];
  departures?: { flightId: string; standId?: string; bagsLoaded: number; bagsExpected: number; pos?: Vec3 }[];
  fuel?: { storagePct: number; groundedFlights: number; trucksIdle: number; trucksTotal: number; farmPos?: Vec3 };
  shops?: { id: string; name: string; outOfStock: string[]; pos?: Vec3 }[];
  standConflicts?: { standId: string; flightId: string; aircraft: string; standClass: string; needClass: string; pos?: Vec3 }[];
  cash?: { balance: number; perDay: number };
  airlines?: { id: string; name: string; standing: number; standingDelta7d: number; reason?: string }[];
  catering?: { flightId: string; standId?: string; minutesLate: number; pos?: Vec3 }[];
  runways?: { id: string; hourMovements: number; capacityPerHour: number; pos?: Vec3 }[];
}

export type Rule = (s: AdvisorSnapshot) => Omit<AdvisorCard, 'createdAt'>[];
