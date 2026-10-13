import {
  CAPACITY_CUT_FACTOR,
  COLD_WARNING_DAYS,
  EXIT_NOTICE_DAYS,
  HOSTILE_TO_NOTICE_DAYS,
  NOTICE_WINDOW_DAYS,
  NEWCOMER_MAX_DAYS,
  NEWCOMER_MIN_DAYS,
  REENTRY_MIN_DAYS,
  SLOT_USE_THRESHOLD,
  TIER_FLOOR_PROSPECTS
} from './constants.ts';
import {
  addModifier,
  allRelations,
  currentYear,
  emit,
  newId,
  signedRelations,
  spend
} from './core.ts';
import type { EngineCore } from './core.ts';
import { composeLetter, createRelation, generateNewcomerSeed } from './generator.ts';
import { nextFloat, randInt } from './rng.ts';
import { alliesOf, evaluate } from './relations.ts';
import { bandIndex, midpointOfBand, oneBandBelow } from './standing.ts';
import { defaultTermsFor } from './proposals.ts';
import type { ActionResult, AirlineRelation, Band, ExitReason, Proposal } from './types.ts';

export function exitsInCurrentYear(core: EngineCore): number {
  const year = currentYear(core);
  return core.state.exitLog.filter((e) => Math.floor(e.day / core.state.config.yearDays) === year).length;
}

export function airlinesInExitStage(core: EngineCore): AirlineRelation[] {
  return allRelations(core).filter((r) => r.status === 'signed' && r.stage === 'exit_notice');
}

export function openSlotPool(core: EngineCore, rel: AirlineRelation, why: string): void {
  const state = core.state;
  state.slotPools.push({
    id: newId(core, 'pool'),
    openedDay: state.day,
    spawnDay: state.day + randInt(state, NEWCOMER_MIN_DAYS, NEWCOMER_MAX_DAYS),
    tier: rel.tier,
    leaverId: rel.id,
    leaverName: rel.name,
    newcomers: randInt(state, 1, 2),
    done: false
  });
  emit(core, 'slot_pool', rel.id, `${rel.name}'s slots are free (${why}).`, 'info');
}

function topCauses(rel: AirlineRelation): string {
  const mods = [...rel.modifiers].sort((a, b) => a.value - b.value).slice(0, 2).map((m) => m.label);
  return mods.length ? mods.join('; ') : 'turnaround performance';
}

/** Daily staged departure state machine: cold warning, capacity cut, exit notice. */
export function tickDeparture(core: EngineCore, rel: AirlineRelation): void {
  const state = core.state;
  const idx = bandIndex(rel.band);

  if (idx < bandIndex('neutral')) {
    rel.coldSinceDay ??= state.day;
  } else {
    rel.coldSinceDay = null;
  }
  if (rel.band === 'hostile') rel.hostileSinceDay ??= state.day;
  else rel.hostileSinceDay = null;

  if (rel.stage === 'none' && rel.coldSinceDay !== null && state.day - rel.coldSinceDay >= COLD_WARNING_DAYS) {
    rel.stage = 'cold_warning';
    emit(core, 'cold_warning', rel.id, `${rel.name} sends a cold warning.`, 'warn');
    emit(core, 'letter', rel.id, composeLetter(rel, 'cold_warning', topCauses(rel)).join(' '), 'warn');
  }

  if ((rel.stage === 'none' || rel.stage === 'cold_warning') && rel.band === 'hostile') {
    rel.stage = 'capacity_cut';
    rel.capacityFactor = CAPACITY_CUT_FACTOR;
    emit(core, 'capacity_cut', rel.id, `${rel.name} cuts 30% of its flights.`, 'bad');
    emit(core, 'letter', rel.id, composeLetter(rel, 'capacity_cut', topCauses(rel)).join(' '), 'bad');
    openSlotPool(core, rel, 'capacity cut');
    return;
  }

  if (rel.stage === 'capacity_cut') {
    if (idx >= bandIndex('cold')) {
      rel.stage = idx >= bandIndex('neutral') ? 'none' : 'cold_warning';
      rel.capacityFactor = 1;
      emit(core, 'capacity_restored', rel.id, `${rel.name} restores its flights.`, 'good');
      return;
    }
    const hostileFor = rel.hostileSinceDay === null ? 0 : state.day - rel.hostileSinceDay;
    const slotFree = airlinesInExitStage(core).length === 0;
    const underCap = exitsInCurrentYear(core) < state.config.maxExitsPerYear;
    if (hostileFor >= HOSTILE_TO_NOTICE_DAYS && slotFree && underCap) {
      rel.stage = 'exit_notice';
      rel.exitNoticeDay = state.day;
      rel.exitCounterUsed = false;
      emit(
        core,
        'exit_notice',
        rel.id,
        `${rel.name} gives ${EXIT_NOTICE_DAYS} days' notice. Causes: ${topCauses(rel)}.`,
        'bad',
        { noticeDay: state.day }
      );
      emit(core, 'letter', rel.id, composeLetter(rel, 'exit_notice', topCauses(rel)).join(' '), 'bad');
    }
    return;
  }

  if (rel.stage === 'exit_notice' && idx >= bandIndex('cold')) {
    rel.stage = idx >= bandIndex('neutral') ? 'none' : 'cold_warning';
    rel.capacityFactor = 1;
    rel.exitNoticeDay = null;
    emit(core, 'exit_rescued', rel.id, `${rel.name} withdraws its exit notice.`, 'good');
    return;
  }

  if (rel.stage === 'cold_warning' && idx >= bandIndex('neutral')) rel.stage = 'none';
}

/** Last-chance counter during an exit notice: 35% base, +20% if a Favour is spent. */
export function counterExitNotice(core: EngineCore, airlineId: string, useFavour: boolean): ActionResult {
  const rel = core.state.relations[airlineId];
  if (!rel || rel.stage !== 'exit_notice') return { ok: false, cost: 0, message: 'No exit notice to counter.' };
  if (rel.exitCounterUsed) return { ok: false, cost: 0, message: 'Already countered this notice.' };
  if (useFavour && rel.favours.length === 0) return { ok: false, cost: 0, message: 'No Favour available.' };
  const cost = exitCounterCost(rel);
  if (!spend(core, cost, 'diplomacy', `Exit-notice counter to ${rel.name}`)) {
    return { ok: false, cost: 0, message: 'Cannot afford the counter-offer.' };
  }
  rel.exitCounterUsed = true;
  const chance = 0.35 + (useFavour ? 0.2 : 0);
  if (useFavour) rel.favours.shift();
  if (nextFloat(core.state) < chance) {
    rel.stage = 'capacity_cut';
    rel.exitNoticeDay = null;
    addModifier(core, rel, 'rescue', 'Last-chance counter accepted', 'exit-counter', { value: 25, months: 6 });
    evaluate(core, rel, false);
    emit(core, 'exit_rescued', rel.id, `${rel.name} accepts the last-chance counter and stays.`, 'good');
    return { ok: true, cost, chance, message: 'They stay.' };
  }
  return { ok: false, cost, chance, message: `${rel.name} refuses the counter-offer.` };
}

export function exitCounterCost(rel: AirlineRelation): number {
  return Math.round(7500 * Math.pow(2.4, rel.tier - 3) * 0.6);
}

export function exitAirline(core: EngineCore, rel: AirlineRelation, reason: ExitReason): void {
  const state = core.state;
  rel.lastBandBeforeExit = rel.band;
  rel.status = 'former';
  rel.exitedDay = state.day;
  rel.exitReason = reason;
  rel.exits += 1;
  rel.stage = 'none';
  rel.exitNoticeDay = null;
  rel.pendingCancel = false;
  rel.capacityFactor = 1;
  rel.contract = null;
  rel.isBase = false;
  if (rel.isHub) {
    rel.isHub = false;
    if (state.hubAirlineId === rel.id) state.hubAirlineId = null;
    emit(core, 'hub_revoked', rel.id, `${rel.name} leaves, so the hub is vacant.`, 'warn');
  }
  rel.perks = [];
  rel.coldSinceDay = null;
  rel.hostileSinceDay = null;
  state.commitments = state.commitments.filter((c) => c.airlineId !== rel.id);
  state.proposals = state.proposals.filter((p) => p.airlineId !== rel.id);
  for (const spat of state.spats) {
    if (spat.airlineId === rel.id && !spat.resolved) {
      spat.resolved = true;
      spat.resolvedDay = state.day;
      spat.resolution = 'exited';
    }
  }
  for (const ally of alliesOf(core, rel)) {
    if (ally.status !== 'signed') continue;
    addModifier(core, ally, 'partner_left', `Alliance partner ${rel.name} left`, rel.id);
  }
  if (reason !== 'player_cancelled') state.exitLog.push({ day: state.day, airlineId: rel.id });
  emit(core, 'exit', rel.id, `${rel.name} has left (${reason.replace(/_/g, ' ')}).`, 'bad', { reason });
  emit(core, 'letter', rel.id, composeLetter(rel, 'exit').join(' '), 'bad');
  openSlotPool(core, rel, reason.replace(/_/g, ' '));
}

/** Player-initiated cancellation. Fee is charged now; flights end at season end. */
export function cancelContract(core: EngineCore, airlineId: string): ActionResult {
  const rel = core.state.relations[airlineId];
  if (!rel || rel.status !== 'signed' || !rel.contract) {
    return { ok: false, cost: 0, message: 'No active contract with that airline.' };
  }
  if (rel.pendingCancel) return { ok: false, cost: 0, message: 'Cancellation already scheduled.' };
  const contract = rel.contract;
  const remaining = Math.max(0, contract.termEndDay - core.state.day);
  const termLength = Math.max(1, contract.termEndDay - contract.signedDay);
  let fee = 0;
  if (remaining > NOTICE_WINDOW_DAYS) {
    fee = Math.round(contract.terms.penaltyPerCancellation * Math.min(12, Math.max(1, remaining / 30)));
    if (!spend(core, fee, 'diplomacy', `Early termination fee, ${rel.name}`)) {
      return { ok: false, cost: 0, message: `Cannot afford the ${fee} early-termination fee.` };
    }
    const credit = -Math.min(20, 8 + (12 * remaining) / termLength);
    addModifier(core, rel, 'cancelled_by_player', 'You ended our contract early', 'cancel', { value: credit, months: 24 });
    rel.favours = [];
    rel.leverage = 0;
  }
  rel.pendingCancel = true;
  const seasonDays = core.state.config.seasonDays;
  const endDay = Math.ceil((core.state.day + 1e-9) / seasonDays) * seasonDays;
  emit(core, 'contract_cancelled', rel.id, `You cancelled ${rel.name}; flights end on day ${endDay}.`, 'warn', { fee, endDay });
  return {
    ok: true,
    cost: fee,
    message: fee > 0 ? `Cancelled with a ${fee} fee, plus credit and Favour loss.` : 'Cancelled at term end; no fee.',
    data: { fee, endDay, remainingDays: remaining }
  };
}

/** Player-visible quote for cancelling, so the button can show the price first. */
export function cancellationQuote(core: EngineCore, airlineId: string): { fee: number; creditLoss: number; favoursLost: number; remainingDays: number } | null {
  const rel = core.state.relations[airlineId];
  if (!rel || rel.status !== 'signed' || !rel.contract) return null;
  const c = rel.contract;
  const remaining = Math.max(0, c.termEndDay - core.state.day);
  if (remaining <= NOTICE_WINDOW_DAYS) return { fee: 0, creditLoss: 0, favoursLost: 0, remainingDays: remaining };
  const termLength = Math.max(1, c.termEndDay - c.signedDay);
  return {
    fee: Math.round(c.terms.penaltyPerCancellation * Math.min(12, Math.max(1, remaining / 30))),
    creditLoss: Math.min(20, 8 + (12 * remaining) / termLength),
    favoursLost: rel.favours.length,
    remainingDays: remaining
  };
}

/** Optional 80% rule. Excused (force majeure) flights count as used. */
export function applySlotRule(core: EngineCore): void {
  for (const rel of signedRelations(core)) {
    const c = rel.contract;
    if (!c) continue;
    if (core.state.config.slotRule80 && c.peakSlotsPerWeek > 0) {
      const activeDays = Math.min(core.state.config.seasonDays, core.state.day - c.signedDay);
      const allocated = (c.terms.slotsPerWeek * rel.capacityFactor * activeDays) / 7;
      const used = c.seasonFlights + c.seasonExcused;
      if (activeDays >= 30 && allocated > 0 && used / allocated < SLOT_USE_THRESHOLD) {
        const returned = c.peakSlotsPerWeek;
        c.terms = { ...c.terms, slotsPerWeek: Math.max(1, c.terms.slotsPerWeek - returned) };
        c.peakSlotsPerWeek = 0;
        emit(
          core,
          'slot_series_reverted',
          rel.id,
          `${rel.name} used ${Math.round((used / allocated) * 100)}% of its slots; ${returned} peak slots a week return to you.`,
          'info',
          { returned }
        );
        openSlotPool(core, rel, 'slot series below 80%');
      }
    }
    c.seasonFlights = 0;
    c.seasonExcused = 0;
  }
}

export function executePendingExits(core: EngineCore): void {
  for (const rel of signedRelations(core)) {
    if (rel.pendingCancel) {
      exitAirline(core, rel, 'player_cancelled');
      continue;
    }
    if (rel.stage === 'exit_notice' && rel.exitNoticeDay !== null) {
      const elapsed = core.state.day - rel.exitNoticeDay;
      if (elapsed >= EXIT_NOTICE_DAYS && exitsInCurrentYear(core) < core.state.config.maxExitsPerYear) {
        exitAirline(core, rel, 'standing');
      }
    }
  }
}

export function spawnNewcomer(core: EngineCore, tier: AirlineRelation['tier'], kind: 'pax' | 'cargo', leaver?: AirlineRelation, gapLine?: string): AirlineRelation {
  const seed = generateNewcomerSeed(core.state, { tier, kind, leaver });
  const rel = createRelation(core.state, seed);
  rel.status = 'prospect';
  rel.metDay = null;
  core.state.relations[rel.id] = rel;
  core.state.order.push(rel.id);
  const terms = defaultTermsFor(rel);
  const discountPct = randInt(core.state, 10, 20);
  const proposal: Proposal = {
    id: newId(core, 'prop'),
    airlineId: rel.id,
    kind: 'newcomer_incentive',
    text: `${rel.name} asks a new-entrant discount of ${discountPct}% for up to 1 year.`,
    terms,
    discountPct,
    discountDays: core.state.config.yearDays,
    issuedDay: core.state.day,
    expiresDay: core.state.day + 21,
    counterUsed: false,
    supportCost: 0
  };
  core.state.proposals.push(proposal);
  const narrative = gapLine ?? (leaver ? `We hear ${leaver.name}'s slots are free.` : 'We hear there is room at your field.');
  emit(core, 'newcomer', rel.id, `${rel.name} (tier ${tier}) writes: ${narrative}`, 'info', { proposalId: proposal.id });
  emit(core, 'letter', rel.id, composeLetter(rel, 'newcomer', narrative).join(' '), 'info');
  return rel;
}

export function processSlotPools(core: EngineCore): void {
  for (const pool of core.state.slotPools) {
    if (pool.done || pool.spawnDay > core.state.day) continue;
    pool.done = true;
    const leaver = core.state.relations[pool.leaverId];
    const kind = leaver?.kind ?? 'pax';
    for (let i = 0; i < pool.newcomers; i++) {
      spawnNewcomer(core, pool.tier, kind, leaver);
    }
  }
  if (core.state.slotPools.length > 40) {
    core.state.slotPools = core.state.slotPools.filter((p) => !p.done).concat(core.state.slotPools.filter((p) => p.done).slice(-10));
  }
}

/** Always at least two prospects per unlocked tier, without letting a tier balloon past five airlines. */
export function ensureTierFloor(core: EngineCore): void {
  const state = core.state;
  for (let tier = 1; tier <= state.highestTier; tier++) {
    const inTier = allRelations(core).filter((r) => r.tier === tier && r.kind === 'pax');
    const prospects = inTier.filter((r) => r.status === 'prospect').length;
    const live = inTier.filter((r) => r.status === 'prospect' || r.status === 'signed').length;
    const last = state.tierFloorSpawnDay[String(tier)] ?? -Infinity;
    if (prospects < TIER_FLOOR_PROSPECTS && live < 5 && state.day - last >= 30) {
      state.tierFloorSpawnDay[String(tier)] = state.day;
      spawnNewcomer(core, tier as AirlineRelation['tier'], 'pax', undefined, 'We hear your field is looking for more airlines.');
    }
  }
}

/** Former airlines come back after at least two game-years, one band below where they left. */
export function processReentry(core: EngineCore): void {
  for (const rel of allRelations(core)) {
    if (rel.status !== 'former' || rel.exitedDay === null || rel.lastBandBeforeExit === null) continue;
    if (rel.tier > core.state.highestTier) continue;
    if (core.state.day - rel.exitedDay < REENTRY_MIN_DAYS) continue;
    if (nextFloat(core.state) > 1 / 60) continue;
    reenter(core, rel);
  }
}

export function reenterBand(rel: AirlineRelation): Band {
  const below = oneBandBelow(rel.lastBandBeforeExit ?? 'neutral');
  return bandIndex(below) < bandIndex('cold') ? 'cold' : below;
}

export function reenter(core: EngineCore, rel: AirlineRelation): void {
  const band = reenterBand(rel);
  rel.status = 'prospect';
  rel.modifiers = [];
  rel.performance = 0;
  rel.causeTally = {};
  rel.favours = [];
  rel.stage = 'none';
  rel.capacityFactor = 1;
  rel.band = band;
  addModifier(core, rel, 'reentry', `Returning after leaving (${band} start)`, 'reentry', {
    value: midpointOfBand(band),
    months: 24
  });
  evaluate(core, rel, false);
  const terms = defaultTermsFor(rel);
  core.state.proposals.push({
    id: newId(core, 'prop'),
    airlineId: rel.id,
    kind: 'contract',
    text: `${rel.name} would like to return on new terms.`,
    terms,
    discountPct: 0,
    discountDays: 0,
    issuedDay: core.state.day,
    expiresDay: core.state.day + 21,
    counterUsed: false,
    supportCost: 0
  });
  emit(core, 'letter', rel.id, composeLetter(rel, 'welcome', 'We would like to return.').join(' '), 'info');
}
