import {
  BAND_FLOOR,
  BAND_ORDER,
  EARLY_SAFETY_DAYS,
  GRADE_POINTS,
  HYSTERESIS,
  PERFORMANCE_HALF_LIFE_DAYS,
  PERFORMANCE_MAX,
  PERFORMANCE_MIN,
  STACK_FACTORS,
  STANDING_MAX,
  STANDING_MIN,
  TRAIT_BIAS_LIMIT,
  VISIBLE_MODIFIER_LINES,
  clamp
} from './constants.ts';
import { TRAITS } from './data.ts';
import type {
  AirlineRelation,
  Band,
  BreakdownLine,
  Grade,
  Metrics,
  StandingBreakdown,
  StandingModifier,
  TraitId
} from './types.ts';

/** Raw band without hysteresis: Hostile < -60, Cold -60..-20, Neutral +-20, Warm 20..60, Partner > 60. */
export function rawBand(value: number): Band {
  if (value < -60) return 'hostile';
  if (value < -20) return 'cold';
  if (value <= 20) return 'neutral';
  if (value <= 60) return 'warm';
  return 'partner';
}

export function bandIndex(band: Band): number {
  return BAND_ORDER.indexOf(band);
}

/** Gain a band the moment its edge is crossed; lose one only HYSTERESIS points past its edge. */
export function bandWithHysteresis(value: number, previous: Band | null): Band {
  const raw = rawBand(value);
  if (previous === null) return raw;
  let band = previous;
  if (bandIndex(raw) > bandIndex(band)) return raw;
  while (bandIndex(band) > bandIndex(raw) && value < BAND_FLOOR[band] - HYSTERESIS) {
    band = BAND_ORDER[bandIndex(band) - 1];
  }
  return band;
}

export function midpointOfBand(band: Band): number {
  switch (band) {
    case 'hostile':
      return -80;
    case 'cold':
      return -40;
    case 'neutral':
      return 0;
    case 'warm':
      return 40;
    case 'partner':
      return 80;
  }
}

export function oneBandBelow(band: Band): Band {
  return BAND_ORDER[Math.max(0, bandIndex(band) - 1)];
}

export function modifierRemaining(m: StandingModifier, day: number): number {
  if (m.durationDays <= 0) return 0;
  return clamp(1 - (day - m.startDay) / m.durationDays, 0, 1);
}

export function modifierCurrent(m: StandingModifier, day: number): number {
  return m.value * modifierRemaining(m, day);
}

export function pruneModifiers(mods: StandingModifier[], day: number): StandingModifier[] {
  return mods.filter((m) => modifierRemaining(m, day) > 0);
}

/**
 * Same-kind modifiers stack with diminishing returns (2nd x0.5, 3rd+ x0.25), strongest first.
 * Positive and negative stacks are kept apart so a good deed never hides a bad one.
 */
export function modifierLines(mods: StandingModifier[], day: number): BreakdownLine[] {
  const groups = new Map<string, StandingModifier[]>();
  for (const m of mods) {
    const key = `${m.kind}:${m.value >= 0 ? '+' : '-'}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }
  const lines: BreakdownLine[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => Math.abs(modifierCurrent(b, day)) - Math.abs(modifierCurrent(a, day)));
    list.forEach((m, i) => {
      const factor = STACK_FACTORS[Math.min(i, STACK_FACTORS.length - 1)];
      const value = modifierCurrent(m, day) * factor;
      if (Math.abs(value) < 0.05) return;
      lines.push({
        label: `${m.label}${factor < 1 ? ` (x${factor})` : ''}`,
        value,
        kind: m.kind,
        showMe: m.showMe,
        remaining: modifierRemaining(m, day)
      });
    });
  }
  return lines.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** Per-trait lean of the key figure toward the current airport. Each is capped at +-6. */
export function traitLines(traits: TraitId[], metrics: Metrics): BreakdownLine[] {
  const lines: BreakdownLine[] = [];
  const m = (k: keyof Metrics, fallback: number) => metrics[k] ?? fallback;
  for (const id of traits) {
    let value = 0;
    let showMe: string | undefined;
    switch (id) {
      case 'green':
        value = clamp((m('solarCoveragePct', 0) - 20) / 8, -6, 6);
        showMe = 'solar';
        break;
      case 'punctual':
        value = clamp((m('onTimePct', 85) - 85) / 2.5, -6, 6);
        showMe = 'punctuality';
        break;
      case 'lavish':
        value = clamp((m('loungeSeats', 0) - 30) / 10, -6, 6);
        showMe = 'lounge';
        break;
      case 'frugal':
        value = clamp(-(m('feeIndex', 1) - 1) * 20, -6, 6);
        showMe = 'fees';
        break;
      case 'proud':
        value = m('prestigeItems', 0) >= 1 ? 3 : -1;
        showMe = 'prestige';
        break;
      case 'showman':
        value = clamp(m('prestigeItems', 0) * 1.5 - 1, -1, 5);
        showMe = 'prestige';
        break;
      case 'patient':
        value = 2;
        break;
      case 'hardball':
        value = 0;
        break;
    }
    if (Math.abs(value) >= 0.05) {
      lines.push({ label: `${TRAITS[id].label} leaning`, value, kind: 'trait', showMe, remaining: 1 });
    }
  }
  return lines;
}

export function formatSigned(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : `\u2212${Math.abs(r)}`;
}

export function bandWord(band: Band): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export interface BreakdownInput {
  relation: AirlineRelation;
  day: number;
  metrics: Metrics;
  agendaBias: number;
  agendaLabel: string | null;
}

export function computeBreakdown(input: BreakdownInput): StandingBreakdown {
  const { relation, day, metrics, agendaBias, agendaLabel } = input;
  const mLines = modifierLines(relation.modifiers, day);
  const tLines = traitLines(relation.traits, metrics);
  if (agendaLabel && Math.abs(agendaBias) >= 0.05) {
    tLines.push({ label: `Agenda: ${agendaLabel}`, value: agendaBias, kind: 'agenda', remaining: 1 });
  }
  const modifiers = mLines.reduce((s, l) => s + l.value, 0);
  const traits = clamp(
    tLines.reduce((s, l) => s + l.value, 0),
    -TRAIT_BIAS_LIMIT,
    TRAIT_BIAS_LIMIT
  );
  const performance = relation.performance;
  const raw = performance + modifiers + traits;
  let value = clamp(raw, STANDING_MIN, STANDING_MAX);
  if (relation.tier === 1 && day < EARLY_SAFETY_DAYS) value = Math.max(value, BAND_FLOOR.cold);
  const band = bandWithHysteresis(value, relation.band);
  const perfLine: BreakdownLine = {
    label: topPerformanceCause(relation) ?? 'Turnaround performance',
    value: performance,
    kind: 'performance',
    showMe: topPerformanceCauseKey(relation) ?? undefined,
    remaining: 1
  };
  const lines = [perfLine, ...mLines, ...tLines].filter((l) => Math.abs(l.value) >= 0.05);
  const visible = [...lines].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, VISIBLE_MODIFIER_LINES);
  return {
    performance,
    modifiers,
    traits,
    raw,
    value,
    band,
    lines,
    visibleLines: visible,
    hiddenLineCount: Math.max(0, lines.length - visible.length),
    formula: `Performance ${formatSigned(performance)} \u00b7 Modifiers ${formatSigned(modifiers)} \u00b7 Traits ${formatSigned(traits)} = ${formatSigned(value)} ${bandWord(band)}`
  };
}

function topPerformanceCauseKey(relation: AirlineRelation): string | null {
  let best: string | null = null;
  let bestVal = 0;
  for (const [key, val] of Object.entries(relation.causeTally)) {
    if (val > bestVal) {
      best = key;
      bestVal = val;
    }
  }
  return best;
}

function topPerformanceCause(relation: AirlineRelation): string | null {
  const key = topPerformanceCauseKey(relation);
  if (!key || relation.performance >= 0) return null;
  return `Turnaround performance: ${key.replace(/_/g, ' ')}`;
}

/** Fold one day's (or one step's) batch of grades into the slow performance score. */
export function stepPerformance(relation: AirlineRelation, dtDays: number): void {
  const decay = Math.pow(0.5, dtDays / PERFORMANCE_HALF_LIFE_DAYS);
  if (relation.pendingGradeCount > 0) {
    const target = relation.pendingGradeSum / relation.pendingGradeCount;
    relation.performance += (target - relation.performance) * (1 - decay);
    relation.pendingGradeSum = 0;
    relation.pendingGradeCount = 0;
  }
  relation.performance = clamp(relation.performance, PERFORMANCE_MIN, PERFORMANCE_MAX);
  for (const key of Object.keys(relation.causeTally)) {
    relation.causeTally[key] *= decay;
    if (relation.causeTally[key] < 0.05) delete relation.causeTally[key];
  }
}

export function recordGrade(relation: AirlineRelation, grade: Grade, excused: boolean, cause?: string): Grade {
  const effective: Grade = excused ? 'C' : grade;
  relation.pendingGradeSum += GRADE_POINTS[effective];
  relation.pendingGradeCount += 1;
  if (cause && GRADE_POINTS[effective] < 0) {
    relation.causeTally[cause] = (relation.causeTally[cause] ?? 0) + Math.abs(GRADE_POINTS[effective]);
  }
  return effective;
}

export interface TurnaroundResult {
  delayMinutes: number;
  bagMinutes: number;
  /** 0..1 passenger mood at departure. */
  paxMood: number;
  standFit: boolean;
}

/** Spec section 2: on-time with a 60-minute grace, bag time, pax mood and stand fit. */
export function gradeTurnaround(r: TurnaroundResult): Grade {
  const delay = Math.max(0, r.delayMinutes);
  const delayPts = delay <= 15 ? 40 : delay <= 60 ? 40 - (30 * (delay - 15)) / 45 : 0;
  const bag = Math.max(0, r.bagMinutes);
  const bagPts = bag <= 20 ? 20 : bag >= 60 ? 0 : 20 * (1 - (bag - 20) / 40);
  const moodPts = clamp(r.paxMood, 0, 1) * 30;
  const fitPts = r.standFit ? 10 : 0;
  const total = delayPts + bagPts + moodPts + fitPts;
  if (total >= 90) return 'A';
  if (total >= 75) return 'B';
  if (total >= 55) return 'C';
  if (total >= 35) return 'D';
  return 'F';
}
