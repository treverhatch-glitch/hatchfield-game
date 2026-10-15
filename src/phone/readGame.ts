/**
 * Read the live sim into the phone snapshot.
 * Hints, tip chips, the alert stack, threats, and emergencies are not copied.
 */
import { AIRFRAMES } from '../game/airframes.ts'
import {
  HEAT_ABANDON_THRESHOLD,
  HEAT_WARN_THRESHOLD,
  money,
  personaBlurb,
  rewardBlurb,
} from '../game/catalog.ts'
import type { Game } from '../game/sim.ts'
import { SPOT_OFFER, termBandLitres } from '../fuel/offerData.ts'
import { PIPELINE } from '../fuel/pipeline.ts'
import { GAME_MINUTES_PER_SECOND } from '../scale/data.ts'
import { contractById } from '../scale/logic.ts'
import { buildPhoneFeed } from './feed.ts'
import type { PhoneCard } from './types.ts'
import { HUB_TIER_LABEL } from '../hubprogress/config.ts'
import type { PhoneWorld } from './feed.ts'

function hubPhoneOffer(game: Game, airlineName: string): NonNullable<PhoneWorld['hubOffer']> | null {
  const offer = game.hubOffer
  if (!offer) return null
  const tier = offer.tier ?? 'hub'
  const list = game.hubChecklistFor(offer.airline)
  const anger = game.hubAngerPreview(offer.airline)
  const lines = list.lines.map((line) => ({
    label: line.detail && line.detail !== line.label ? `${line.label} · ${line.detail}` : line.label,
    met: line.status === 'ok',
  }))
  if (anger.spared) lines.push({ label: anger.spared, met: true })
  if (anger.anger) lines.push({ label: anger.anger, met: true })
  return {
    airlineName,
    tierLabel: HUB_TIER_LABEL[tier],
    feeText: money(offer.fee),
    secondsLeft: Math.ceil(offer.deadline),
    body: list.rewards[0] ?? 'The next step on their ladder.',
    lines,
    acceptDisabled: !(list.eligible && list.next === tier),
    anger: anger.anger,
    spared: anger.spared,
  }
}

function signedRow(game: Game, id: string) {
  return { id, name: game.airline(id).name, standing: Math.round(game.standingOf(id)) }
}

export function readPhoneWorld(game: Game): PhoneWorld {
  const offer = game.offer
  const offerAirline = offer ? game.airline(offer.airline) : null
  const layoverAirline = game.layoverOffer ? game.airline(game.layoverOffer.airline) : null
  const liveAirline = game.layover ? game.airline(game.layover.airline) : null
  const hubAirline = game.hubOffer ? game.airline(game.hubOffer.airline) : null
  const mxAirline = game.mxOffer ? game.airline(game.mxOffer.airline) : null
  const field = game.fieldTask
  const fieldAirline = field ? game.airline(field.airline) : null
  const cargo = game.cargoVolume
  const cargoAirline = cargo ? game.airline(cargo.airline) : null
  const warned = game.warnedAirlines()
  const warnKey = `warn:${warned.slice().sort().join(',')}`

  const world: PhoneWorld = {
    contract:
      offer && offerAirline
        ? {
            airlineId: offer.airline,
            airlineName: offerAirline.name,
            persona: personaBlurb(offerAirline.persona),
            blurb: offerAirline.blurb,
            procedural: Boolean(offerAirline.procedural),
            secondsLeft: Math.ceil(offer.deadline),
            verdict: game.letterVerdict(offer.airline).label,
            verdictMet: game.letterVerdict(offer.airline).met,
            requirements: game.reqReport(offer.airline).map((row) => ({
              label: `${row.met ? 'Met' : 'Missing'} · ${row.label}`,
              met: row.met,
            })),
            terms: `Terms · landing ${money(game.wave3.landingOffer(offer.airline, offerAirline.landing))} · bags ${money(offerAirline.bags)}${
              offerAirline.catering ? ` · catering ${money(offerAirline.catering)}` : ''
            } · ${game.wave3.feeLine(offer.airline)} · ${game.wave3.slotLine(offer.airline)}`,
            feeLine: game.wave3.feeLine(offer.airline),
            slotLine: game.wave3.slotLine(offer.airline),
            capacity: game.letterCapacity(offer.airline),
          }
        : null,
    signed: game.signed.map((id) => signedRow(game, id)),
    fuelSpot: game.spotOffer
      ? {
          flightNo: game.spotOffer.flightNo,
          supplier: game.spotOffer.supplier ?? SPOT_OFFER.supplier,
          litres: SPOT_OFFER.tankerLitres,
          perLitre: game.spotOffer.perLitre ?? SPOT_OFFER.perLitre,
          bill: Math.round(SPOT_OFFER.tankerLitres * (game.spotOffer.perLitre ?? SPOT_OFFER.perLitre)),
          leadMinutes: SPOT_OFFER.leadMinutes,
          secondsLeft: Math.max(0, Math.ceil(game.spotOffer.expiresAt - game.clock)),
        }
      : null,
    pipelineHold:
      game.pipelineHoldMinutes > 0
        ? {
            secondsLeft: Math.max(0, Math.ceil(game.pipelineHoldMinutes / GAME_MINUTES_PER_SECOND)),
            body: PIPELINE.card,
          }
        : null,
    fuelSigned: (() => {
      const def = contractById(game.contractId)
      if (!def) return null
      return {
        id: def.id,
        name: def.name,
        perLitre: game.termUnitPrice(def.id),
        bandLitres: termBandLitres(def.id),
        drawnLitres: Math.round(game.termUpliftLitres),
      }
    })(),
    mxSigned: game.mxSigned.map((id) => signedRow(game, id)),
    hubs: game.hubAirlines.map((id) => signedRow(game, id)),
    layoverOffer:
      game.layoverOffer && layoverAirline
        ? {
            airlineName: layoverAirline.name,
            feeText: money(game.layoverOffer.fee),
            transferPax: game.layoverOffer.transferPax,
            duration: game.layoverOffer.duration,
            secondsLeft: Math.ceil(game.layoverOffer.deadline),
          }
        : null,
    layoverLive:
      !game.layoverOffer && game.layover && liveAirline && !game.letterAcked(`layover-live:${game.layover.airline}`)
        ? {
            airlineId: game.layover.airline,
            airlineName: liveAirline.name,
            spawned: game.layover.spawned,
            transferPax: game.layover.transferPax,
            remaining: game.layover.remaining,
            standing: Math.round(game.standingOf(game.layover.airline)),
            happy: game.layover.samples ? String(Math.round(game.layover.happySum / game.layover.samples)) : null,
          }
        : null,
    hubOffer:
      game.hubOffer && hubAirline
        ? hubPhoneOffer(game, hubAirline.name)
        : null,
    mxOffer:
      game.mxOffer && mxAirline
        ? {
            airlineName: mxAirline.name,
            payoutText: money(game.mxOffer.payout),
            secondsLeft: Math.ceil(game.mxOffer.deadline),
          }
        : null,
    parking: game.parkingOffer
      ? {
          callsign: game.parkingOffer.callsign,
          craft: AIRFRAMES[game.parkingOffer.airframeId]?.name ?? 'Aircraft',
          feeText: money(game.parkingOffer.fee),
          staySec: game.parkingOffer.staySec,
          secondsLeft: Math.ceil(game.parkingOffer.deadline),
        }
      : null,
    field:
      field && fieldAirline && !game.letterAcked(`field:${field.id}`)
        ? {
            id: field.id,
            airlineName: fieldAirline.name,
            title: field.title,
            blurb: field.blurb,
            bonusText: money(field.bonus),
            secondsLeft: Math.ceil(game.fieldTaskLeft()),
            clockLine: game.fieldAskClockLine(),
            buildLabel: game.fieldAskOffer()?.text ?? null,
            buildEnabled: game.fieldAskOffer()?.enabled ?? false,
          }
        : null,
    cargo:
      cargo && cargoAirline && !game.letterAcked(`cargo:${cargo.id}`)
        ? {
            id: cargo.id,
            airlineName: cargoAirline.name,
            delivered: cargo.delivered,
            target: cargo.targetUnits,
            feeText: money(cargo.fee),
            secondsLeft: Math.ceil(game.cargoVolumeLeft()),
          }
        : null,
    warn:
      warned.length && !game.letterAcked(warnKey)
        ? {
            key: warnKey,
            blurb: `${warned
              .map((id) => {
                const airline = game.airline(id)
                const perk = game.rewardOf(id)
                const standing = Math.round(game.standingOf(id))
                return perk
                  ? `${airline.name} Standing ${standing} — ${rewardBlurb(perk)} at risk`
                  : `${airline.name} Standing ${standing} — walk at ${HEAT_ABANDON_THRESHOLD}`
              })
              .join(' · ')}. Standing ≤${HEAT_WARN_THRESHOLD} warns; ≤${HEAT_ABANDON_THRESHOLD} and they abandon.`,
          }
        : null,
    rivalNotes: game.hubRivalPhone.filter((note) => !game.letterAcked(`rival:${note.id}`)),
    advisor: game.standingAdvisor.activeCards.map((note) => ({
      id: note.id,
      airlineName: game.airline(note.airlineId).name,
      standing: note.standing,
      daysToLeave: note.daysToLeave,
      causes: note.topCauses.map((cause, i) => `${i + 1}. ${cause.label} (Fix: ${cause.fix})`).join(' · '),
    })),
  }
  return world
}

export function readPhoneCards(game: Game): PhoneCard[] {
  const cards = buildPhoneFeed(readPhoneWorld(game))
  const offer = game.offer
  const layover = game.layoverOffer
  const hub = game.hubOffer
  const mx = game.mxOffer
  const parking = game.parkingOffer
  for (const item of cards) {
    if ((item.id === 'contract' || item.id === 'contract-file') && offer) {
      item.left = () => Math.ceil(game.offer?.deadline ?? 0)
    }
    else if (item.id === 'layover' && layover) item.left = () => Math.ceil(game.layoverOffer?.deadline ?? 0)
    else if (item.id === 'hub' && hub) item.left = () => Math.ceil(game.hubOffer?.deadline ?? 0)
    else if (item.id === 'mx' && mx) item.left = () => Math.ceil(game.mxOffer?.deadline ?? 0)
    else if (item.id === 'parking' && parking) item.left = () => Math.ceil(game.parkingOffer?.deadline ?? 0)
    else if (item.id === 'field') item.left = () => Math.ceil(game.fieldTaskLeft())
    else if (item.id === 'cargo-vol') item.left = () => Math.ceil(game.cargoVolumeLeft())
    else if (item.id === 'layover-live') item.left = () => Math.ceil(game.layover?.remaining ?? 0)
    else if (item.id === 'fuel-spot') item.left = () => Math.max(0, Math.ceil((game.spotOffer?.expiresAt ?? game.clock) - game.clock))
  }
  return cards
}
