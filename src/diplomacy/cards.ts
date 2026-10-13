import { DEFAULT_AIRLINES } from '../airlines/index.ts';
import type { AirportCapabilities } from '../airlines/index.ts';
import { TIER_BASE_TYPE } from './constants.ts';
import { AGENDAS, TRAITS } from './data.ts';
import { openCommitmentOf } from './demands.ts';
import { poachRisk } from './drama.ts';
import type { EngineCore } from './core.ts';
import { bandChip, buildPortraitCard } from './portrait.ts';
import { contractLadder } from './ladder.ts';
import { alliesOf, breakdownFor, rivalsOf } from './relations.ts';
import type { AirlineCard, AirlineRelation, NeedLine } from './types.ts';

export function needsFor(rel: AirlineRelation, airport: AirportCapabilities | undefined): NeedLine[] {
  if (!airport) return [];
  const base = rel.kind === 'cargo' ? 'cargo' : TIER_BASE_TYPE[rel.tier];
  const template = DEFAULT_AIRLINES.find((a) => a.tier === base);
  if (!template) return [];
  const r = template.requirements;
  const lines: NeedLine[] = [
    { label: `Runway at least ${r.minRunwayLengthMeters} m`, ok: airport.runwayLengthMeters >= r.minRunwayLengthMeters, showMe: 'runway' },
    { label: `Terminal rating ${r.minTerminalRating}+`, ok: airport.terminalRating >= r.minTerminalRating, showMe: 'terminal' },
    { label: `On-time at least ${r.minOnTimePercentage}%`, ok: airport.onTimePercentage >= r.minOnTimePercentage, showMe: 'punctuality' }
  ];
  if (r.requiresSmallStands) lines.push({ label: 'Small stands', ok: airport.hasSmallStands, showMe: 'stands' });
  if (r.requiresMediumStands) lines.push({ label: 'Medium stands', ok: airport.hasMediumStands, showMe: 'stands' });
  if (r.requiresHeavyStands) lines.push({ label: 'Heavy stands', ok: airport.hasHeavyStands, showMe: 'stands' });
  if (r.requiresFuel) lines.push({ label: 'Fuel service', ok: airport.hasFuelService, showMe: 'fuel' });
  if (r.requiresCatering) lines.push({ label: 'Catering service', ok: airport.hasCateringService, showMe: 'catering' });
  if (r.requiresMaintenance) lines.push({ label: 'Maintenance service', ok: airport.hasMaintenanceService, showMe: 'maintenance' });
  if (r.requiresHeavyVehicles) lines.push({ label: 'Heavy vehicles', ok: airport.hasHeavyVehicles, showMe: 'vehicles' });
  return lines;
}

export function buildCard(core: EngineCore, rel: AirlineRelation): AirlineCard {
  const breakdown = rel.status === 'locked' ? null : breakdownFor(core, rel);
  const kf = rel.keyFigure;
  const delta = rel.standing - rel.prevStanding;
  const negatives = breakdown ? breakdown.lines.filter((l) => l.value < 0).sort((a, b) => a.value - b.value).slice(0, 2) : [];
  return {
    id: rel.id,
    name: rel.name,
    tier: rel.tier,
    baseTier: rel.kind === 'cargo' ? 'cargo' : TIER_BASE_TYPE[rel.tier],
    status: rel.status,
    portrait: buildPortraitCard({
      seed: rel.portraitSeed,
      tier: rel.tier,
      hasKeyFigure: !!kf,
      livery: rel.livery
    }),
    figure: kf
      ? {
          name: kf.name,
          title: kf.title,
          traits: kf.traits.map((t) => TRAITS[t].label),
          agenda: AGENDAS[kf.agenda].label,
          voice: kf.voice,
          memory: [...kf.memory]
        }
      : null,
    livery: rel.livery,
    glyph: rel.glyph,
    band: bandChip(rel.band),
    standing: Math.round(rel.standing * 10) / 10,
    trend: delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'flat',
    sharePct: Math.round(rel.sharePct * 10) / 10,
    shareClass: rel.shareClass,
    breakdown,
    needs: needsFor(rel, core.ctx.airport),
    interests: [...rel.interests],
    openCommitment: openCommitmentOf(core, rel.id),
    rivals: rivalsOf(core, rel).map((r) => r.id),
    allies: alliesOf(core, rel).map((r) => r.id),
    stage: rel.stage,
    perks: [...rel.perks],
    isBase: rel.isBase,
    isHub: rel.isHub,
    favours: rel.favours.length,
    leverage: rel.leverage,
    topCauses: negatives,
    history: [...rel.history],
    contractTermEndDay: rel.contract?.termEndDay ?? null,
    poachRisk: poachRisk(core, rel),
    ladder: contractLadder(core, rel)
  };
}
