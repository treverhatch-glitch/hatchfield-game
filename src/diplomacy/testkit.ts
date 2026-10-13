import { addModifier } from './core.ts';
import { DiplomacyEngine } from './engine.ts';
import { evaluate } from './relations.ts';
import type { CreateStateOptions } from './engine.ts';
import type { DiplomacyContext, DiplomacyEvent, Grade, HostileAction, Metrics } from './types.ts';

export interface Harness {
  engine: DiplomacyEngine;
  ledger: { amount: number; category: string; memo: string }[];
  events: DiplomacyEvent[];
  hostile: HostileAction[];
  cash: { value: number };
  ctx: DiplomacyContext;
  run(days: number, perDay?: (day: number) => void): void;
  /** Sign the first prospect letter for an airline, whatever it takes. */
  sign(airlineId: string): void;
  totalSpent(): number;
  /** Advance until a contract-style proposal is on the table and return it. */
  nextProposal(): import('./types.ts').Proposal;
}

export const GOOD_METRICS: Metrics = {
  onTimePct: 94,
  feeIndex: 1,
  cafes: 2,
  loungeSeats: 60,
  standCount: 8,
  standUtilization: 0.7,
  heavyStands: 2,
  electricTugs: 1,
  solarCoveragePct: 40,
  familyAmenities: 3,
  prestigeItems: 3,
  exclusivePier: 1,
  nightSlots: 4,
  coldChainRooms: 1,
  cargoFacilities: 3,
  hubDepartures: 3,
  maintenanceLevel: 3
};

export function createHarness(options: CreateStateOptions & { cash?: number; fieldLevel?: number; metrics?: Metrics } = {}): Harness {
  const ledger: Harness['ledger'] = [];
  const events: DiplomacyEvent[] = [];
  const hostile: HostileAction[] = [];
  const cash = { value: options.cash ?? 1_000_000_000 };
  const engine = new DiplomacyEngine(
    {
      spend(amount, category, memo) {
        if (cash.value < amount) return false;
        cash.value -= amount;
        ledger.push({ amount, category, memo });
        return true;
      },
      charge(amount, category, memo) {
        cash.value -= amount;
        ledger.push({ amount, category, memo });
      },
      onEvent: (e) => events.push(e),
      onHostileAction: (a) => hostile.push(a)
    },
    undefined,
    { seed: options.seed ?? 7, config: options.config }
  );
  const ctx: DiplomacyContext = { fieldLevel: options.fieldLevel ?? 1, metrics: { ...(options.metrics ?? GOOD_METRICS) } };
  const harness: Harness = {
    engine,
    ledger,
    events,
    hostile,
    cash,
    ctx,
    run(days, perDay) {
      for (let i = 0; i < days; i++) {
        perDay?.(engine.day);
        engine.advance(1, ctx);
      }
    },
    sign(airlineId) {
      let guard = 0;
      while (guard++ < 400) {
        const proposal = engine.state.proposals.find((p) => p.airlineId === airlineId && (p.kind === 'contract' || p.kind === 'newcomer_incentive'));
        if (proposal) {
          const res = engine.respondToProposal(proposal.id, 'accept');
          if (!res.ok) throw new Error(res.message);
          return;
        }
        engine.advance(1, ctx);
      }
      throw new Error(`no proposal from ${airlineId}`);
    },
    totalSpent: () => ledger.reduce((s, l) => s + l.amount, 0),
    nextProposal() {
      for (let i = 0; i < 400; i++) {
        const p = engine.state.proposals.find((x) => x.kind === 'contract' || x.kind === 'newcomer_incentive');
        if (p) return p;
        engine.advance(1, ctx);
      }
      throw new Error('no proposal arrived');
    }
  };
  return harness;
}

/** Feed an airline's flights for one day with a fixed grade profile. */
export function flyDay(engine: DiplomacyEngine, airlineId: string, grades: Grade[], excused = false): void {
  for (const g of grades) {
    engine.recordGrade(airlineId, g, { excused });
    engine.recordFlight(airlineId, { excused: false });
  }
}

/** Shove an airline's standing by adding a long-lived modifier, then re-evaluate it. */
export function push(h: Harness, airlineId: string, value: number, months = 24): void {
  const rel = h.engine.relation(airlineId);
  if (!rel) throw new Error(`unknown airline ${airlineId}`);
  addModifier(h.engine.core, rel, 'other', 'test push', 'test', { value, months });
  evaluate(h.engine.core, rel, false);
}
