import { MODIFIER_DEFAULTS, MONTH_DAYS, TIER_COST } from './constants.ts';
import type {
  AirlineRelation,
  DiplomacyContext,
  DiplomacyEvent,
  DiplomacyHost,
  DiplomacyState,
  ModifierKind,
  StandingModifier
} from './types.ts';

/** What every diplomacy subsystem gets: the serialisable state, host callbacks and this step's context. */
export interface EngineCore {
  state: DiplomacyState;
  host: DiplomacyHost;
  ctx: DiplomacyContext;
}

export function newId(core: EngineCore, prefix: string): string {
  core.state.nextId += 1;
  return `${prefix}_${core.state.nextId}`;
}

export function emit(
  core: EngineCore,
  type: DiplomacyEvent['type'],
  airlineId: string | null,
  text: string,
  severity: DiplomacyEvent['severity'] = 'info',
  data?: DiplomacyEvent['data']
): DiplomacyEvent {
  const event: DiplomacyEvent = { day: core.state.day, type, airlineId, text, severity, data };
  core.state.log.push(event);
  const max = core.state.config.maxLogEvents;
  if (core.state.log.length > max) core.state.log.splice(0, core.state.log.length - max);
  core.host.onEvent?.(event);
  return event;
}

export function relationOf(core: EngineCore, id: string): AirlineRelation | undefined {
  return core.state.relations[id];
}

export function signedRelations(core: EngineCore): AirlineRelation[] {
  return core.state.order.map((id) => core.state.relations[id]).filter((r) => r.status === 'signed');
}

export function allRelations(core: EngineCore): AirlineRelation[] {
  return core.state.order.map((id) => core.state.relations[id]);
}

export interface ModifierOptions {
  value?: number;
  months?: number;
  showMe?: string;
}

export function addModifier(
  core: EngineCore,
  rel: AirlineRelation,
  kind: ModifierKind,
  label: string,
  source: string,
  options: ModifierOptions = {}
): StandingModifier {
  const defaults = (MODIFIER_DEFAULTS as Record<string, { value: number; months: number }>)[kind];
  const value = options.value ?? defaults?.value ?? 0;
  const months = options.months ?? defaults?.months ?? 12;
  const mod: StandingModifier = {
    id: newId(core, 'mod'),
    kind,
    label,
    source,
    value,
    startDay: core.state.day,
    durationDays: months * MONTH_DAYS,
    showMe: options.showMe
  };
  rel.modifiers.push(mod);
  return mod;
}

export function remember(rel: AirlineRelation, line: string): void {
  rel.history.push(line);
  if (rel.history.length > 40) rel.history.shift();
  if (rel.keyFigure) {
    rel.keyFigure.memory.push(line);
    if (rel.keyFigure.memory.length > 3) rel.keyFigure.memory.shift();
  }
}

export function currentYear(core: EngineCore): number {
  return Math.floor(core.state.day / core.state.config.yearDays);
}

export function tierCost(tier: number): number {
  return (TIER_COST as Record<number, number>)[tier] ?? TIER_COST[1];
}

export function spend(core: EngineCore, amount: number, category: string, memo: string): boolean {
  if (amount <= 0) return true;
  return core.host.spend(Math.round(amount), category, memo);
}
