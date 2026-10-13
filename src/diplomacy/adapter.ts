import type { FlightEvent } from '../airlines/index.ts';
import { DiplomacyEngine } from './engine.ts';
import type { CreateStateOptions } from './engine.ts';
import { gradeTurnaround } from './standing.ts';
import type { TurnaroundResult } from './standing.ts';
import type {
  ActionResult,
  AirlineCard,
  DiplomacyContext,
  DiplomacyEvent,
  DiplomacyState,
  Grade,
  HostileAction,
  OperationalEffects,
  CounterLineKey,
  ProposalResponse
} from './types.ts';

export type Severity = 'info' | 'good' | 'warn' | 'bad';

/**
 * What the game (the terminal agent) must supply. Everything is a callback, so the diplomacy
 * module never imports `sim.ts`, React or Three.js.
 */
export interface DiplomacyAdapterHost {
  /** Credit (positive) or debit (negative) the sim's cash. */
  addMoney(amount: number, category: string): void;
  /** Current cash, used to refuse player actions the player cannot afford. */
  getCash(): number;
  /** Current Field Level, metrics and (optionally) AirportCapabilities and traffic shares. */
  getContext(): DiplomacyContext;
  /** News ticker / letters. Called for letters and for any warn/bad/good event. */
  notify(message: string, severity: Severity, event: DiplomacyEvent): void;
  /** Change the airport's Reputation (public spats drain it by 2 per month). */
  applyReputation?(delta: number): void;
  /** Called when a hostile airline sues or disrupts operations. */
  onHostileAction?(action: HostileAction): void;
  /** Called whenever the active operational penalties change; apply them to turnaround times, gates and delays. */
  onOperationalEffects?(effects: OperationalEffects): void;
}

export interface DiplomacyAdapter {
  readonly engine: DiplomacyEngine;
  /** Advance by game minutes (call from the sim step). */
  tick(dtMinutes: number): DiplomacyEvent[];
  /** Grade a finished turnaround and record the flight. Returns the grade given to Performance. */
  onTurnaroundComplete(airlineId: string, result: TurnaroundResult & { excused?: boolean; cause?: string }): Grade | null;
  /** Record a cancelled or diverted flight. Excused cancellations (weather) count as C. */
  onFlightCancelled(airlineId: string, excused: boolean): void;
  /** Passenger or landing-fee change; 1.0 is the baseline schedule. */
  onFeeChange(newFeeIndex: number): void;
  /** Serious incident on one airline's flight (-20 standing for 24 months). */
  onIncident(airlineId: string, label: string, showMe?: string): void;
  respondToProposal(
    proposalId: string,
    response: ProposalResponse,
    payWith?: 'money' | 'favour',
    ticks?: CounterLineKey[]
  ): ActionResult;
  cards(): AirlineCard[];
  save(): string;
  load(json: string): void;
}

export function createDiplomacyAdapter(
  host: DiplomacyAdapterHost,
  options: CreateStateOptions = {},
  restore?: DiplomacyState
): DiplomacyAdapter {
  let lastEffectsKey = '';
  const engine = new DiplomacyEngine(
    {
      spend(amount, category) {
        if (host.getCash() < amount) return false;
        host.addMoney(-amount, category);
        return true;
      },
      charge(amount, category) {
        host.addMoney(-amount, category);
      },
      onEvent(event) {
        if (event.type === 'letter' || event.severity !== 'info') host.notify(event.text, event.severity, event);
      },
      onHostileAction(action) {
        host.onHostileAction?.(action);
      }
    },
    restore,
    options
  );

  const flush = (): void => {
    const delta = engine.consumeReputationDelta();
    if (delta !== 0) host.applyReputation?.(delta);
    const effects = engine.operationalEffects();
    const key = effects.active.map((a) => a.id).join(',');
    if (key !== lastEffectsKey) {
      lastEffectsKey = key;
      host.onOperationalEffects?.(effects);
    }
  };

  return {
    engine,
    tick(dtMinutes) {
      const events = engine.advance(dtMinutes / 1440, host.getContext());
      flush();
      return events;
    },
    onTurnaroundComplete(airlineId, result) {
      const grade = gradeTurnaround(result);
      const effective = engine.recordGrade(airlineId, grade, { excused: result.excused, cause: result.cause });
      engine.recordFlight(airlineId, { excused: false });
      return effective;
    },
    onFlightCancelled(airlineId, excused) {
      engine.recordGrade(airlineId, 'F', { excused, cause: 'cancellation' });
      if (excused) engine.recordFlight(airlineId, { excused: true });
    },
    onFeeChange(newFeeIndex) {
      engine.notifyFeeChange(newFeeIndex);
    },
    onIncident(airlineId, label, showMe) {
      engine.recordIncident(airlineId, label, showMe);
    },
    respondToProposal(proposalId, response, payWith, ticks) {
      return engine.respondToProposal(proposalId, response, payWith, ticks);
    },
    cards: () => engine.cards(),
    save: () => engine.serialize(),
    load(json) {
      engine.loadState(DiplomacyEngine.parse(json));
      lastEffectsKey = '';
    }
  };
}

/** Bridge to `src/airlines` flight events, so existing satisfaction code can share the same grades. */
export function gradeToFlightEventType(grade: Grade): FlightEvent['type'] {
  if (grade === 'A' || grade === 'B') return 'success';
  if (grade === 'F') return 'cancellation';
  return 'delay';
}

/** Build a `src/airlines` flight event from a turnaround so contract satisfaction stays in step. */
export function toAirlinesFlightEvent(contractId: string, grade: Grade, delayMinutes = 0): FlightEvent {
  return { contractId, type: gradeToFlightEventType(grade), delayMinutes: Math.max(0, delayMinutes) };
}
