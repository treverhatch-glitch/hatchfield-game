import { useState } from 'react'
import { AIRFRAMES } from '../../game/airframes'
import { moneyAbbrev } from '../moneyFormat'
import {
  HEAT_ABANDON_THRESHOLD,
  HEAT_WARN_THRESHOLD,
  personaBlurb,
  rewardBlurb,
} from '../../game/catalog'
import type { Game } from '../../game/sim'

type Letter = {
  id: string
  kind: string
  from: string
  title: string
  blurb: string
  tone: 'ok' | 'good' | 'bad' | 'warn'
  left: number | null
  live?: boolean
}

export function letterCount(game: Game, dismissedWarn: boolean): number {
  return collect(game, dismissedWarn).length
}

export function coachLine(game: Game): string | null {
  if (!game.showCoach()) return null
  const steps = game.coachSteps()
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  return `First hour ${done}/${steps.length}${next ? ` · ${next.label}` : ''}`
}

export function Notifications({ game }: { game: Game }) {
  const [openLetter, setOpenLetter] = useState<string | null>(null)
  const [dismissedWarn, setDismissedWarn] = useState(false)
  const letters = collect(game, dismissedWarn)
  const offerAirline = game.offer ? game.airline(game.offer.airline) : null

  return (
    <div className="hf-letters" data-testid="letter-stack">
      {game.showCoach() ? (
        <section data-testid="coach">
          <div className="coach-head">
            <strong>First hour</strong>
            <button type="button" className="ghost" onClick={() => game.dismissCoach()}>
              Got it
            </button>
          </div>
          <ol>
            {game.coachSteps().map((s) => (
              <li key={s.id} data-done={s.done ? '1' : '0'}>
                <span className="mark">{s.done ? '✓' : '·'}</span>
                {s.label}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {letters.length === 0 ? <p className="muted">No letters. The field is quiet.</p> : null}
      {letters.map((letter) => {
        const open = openLetter === letter.id
        return (
          <article
            key={letter.id}
            className={`letter${open ? ' open' : ''} tone-${letter.tone}${letter.live ? ' live' : ''}`}
            data-testid={
              letter.id === 'field' ? 'field-task' : letter.id === 'contract' ? 'contract-letter' : undefined
            }
          >
            <button
              type="button"
              className="letter-tab"
              onClick={() => setOpenLetter((cur) => (cur === letter.id ? null : letter.id))}
            >
              <span className="letter-kind">{letter.kind}</span>
              <span className="letter-from">{letter.from}</span>
              <span className="letter-timer">{letter.left != null ? `${letter.left}s` : 'info'}</span>
            </button>
            {open ? (
              <div className="letter-body">
                <strong>{letter.title}</strong>
                <p>{letter.blurb}</p>
                {letter.id === 'contract' && offerAirline ? (
                  <ul className="req-list">
                    {game.reqReport(offerAirline.id).map((row) => (
                      <li key={row.label} data-met={row.met ? '1' : '0'}>
                        {row.met ? 'Met' : 'Missing'} · {row.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="row letter-actions">
                  {letter.id === 'contract' ? (
                    <>
                      <button type="button" className="on" onClick={() => game.acceptOffer()}>
                        Accept
                      </button>
                      <button type="button" onClick={() => game.declineOffer()}>
                        Decline
                      </button>
                      <button type="button" onClick={() => game.snoozeOffer()}>
                        Later
                      </button>
                    </>
                  ) : null}
                  {letter.id === 'layover' ? (
                    <>
                      <button type="button" className="on" onClick={() => game.acceptLayover()}>
                        Host layover
                      </button>
                      <button type="button" onClick={() => game.declineLayover()}>
                        Decline
                      </button>
                    </>
                  ) : null}
                  {letter.id === 'hub' ? (
                    <>
                      <button type="button" className="on" onClick={() => game.acceptHub()}>
                        Take Hub
                      </button>
                      <button type="button" onClick={() => game.declineHub()}>
                        Decline
                      </button>
                    </>
                  ) : null}
                  {letter.id === 'mx' ? (
                    <>
                      <button type="button" className="on" onClick={() => game.acceptMxOffer()}>
                        Sign MX
                      </button>
                      <button type="button" onClick={() => game.declineMxOffer()}>
                        Decline
                      </button>
                    </>
                  ) : null}
                  {letter.id === 'threat' ? (
                    <>
                      <button type="button" className="on" onClick={() => game.resolveThreat('scramble')}>
                        Scramble
                      </button>
                      <button type="button" onClick={() => game.resolveThreat('ignore')}>
                        Ignore
                      </button>
                    </>
                  ) : null}
                  {letter.id === 'emergency' ? (
                    <>
                      <button type="button" className="on" onClick={() => game.resolveEmergency('accept')}>
                        Host landing
                      </button>
                      <button type="button" onClick={() => game.resolveEmergency('refuse')}>
                        Refuse
                      </button>
                    </>
                  ) : null}
                  {letter.id === 'parking' ? (
                    <>
                      <button type="button" className="on" onClick={() => game.acceptParking()}>
                        Host parking
                      </button>
                      <button type="button" onClick={() => game.declineParking()}>
                        Wave off
                      </button>
                    </>
                  ) : null}
                  {letter.id === 'warn' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedWarn(true)
                        setOpenLetter(null)
                      }}
                    >
                      Dismiss
                    </button>
                  ) : null}
                  {letter.id === 'field' || letter.id === 'cargo-vol' || letter.id === 'layover-live' ? (
                    <button type="button" onClick={() => setOpenLetter(null)}>
                      Fold
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

function collect(game: Game, dismissedWarn: boolean): Letter[] {
  const letters: Letter[] = []
  const offerAirline = game.offer ? game.airline(game.offer.airline) : null
  const mxAirline = game.mxOffer ? game.airline(game.mxOffer.airline) : null
  const layoverAirline = game.layoverOffer
    ? game.airline(game.layoverOffer.airline)
    : game.layover
      ? game.airline(game.layover.airline)
      : null
  const hubAirline = game.hubOffer ? game.airline(game.hubOffer.airline) : null
  if (game.offer && offerAirline) {
    letters.push({
      id: 'contract',
      kind: 'Contract',
      from: offerAirline.name,
      title: `${offerAirline.name} wants a contract`,
      blurb: `${personaBlurb(offerAirline.persona)} · ${offerAirline.blurb}`,
      tone: 'good',
      left: Math.ceil(game.offer.deadline),
    })
  }
  if (game.fieldTask) {
    const a = game.airline(game.fieldTask.airline)
    letters.push({
      id: 'field',
      kind: 'Field ask',
      from: a.name,
      title: game.fieldTask.title,
      blurb: `${game.fieldTask.blurb} · ${moneyAbbrev(game.fieldTask.bonus)} if done`,
      tone: 'ok',
      left: Math.ceil(game.fieldTaskLeft()),
    })
  }
  if (game.cargoVolume) {
    const v = game.cargoVolume
    const a = game.airline(v.airline)
    letters.push({
      id: 'cargo-vol',
      kind: 'Volume',
      from: a.name,
      title: `${a.name} volume window`,
      blurb: `Stage ${v.delivered}/${v.targetUnits}u · ${moneyAbbrev(v.fee)}`,
      tone: 'ok',
      left: Math.ceil(game.cargoVolumeLeft()),
      live: true,
    })
  }
  if (game.layoverOffer && layoverAirline) {
    letters.push({
      id: 'layover',
      kind: 'Layover',
      from: layoverAirline.name,
      title: `${layoverAirline.name} layover bank`,
      blurb: `${moneyAbbrev(game.layoverOffer.fee)} up front · ${game.layoverOffer.transferPax} transfers`,
      tone: 'good',
      left: Math.ceil(game.layoverOffer.deadline),
    })
  } else if (game.layover && layoverAirline) {
    letters.push({
      id: 'layover-live',
      kind: 'Layover live',
      from: layoverAirline.name,
      title: `${layoverAirline.name} layover live`,
      blurb: `${game.layover.spawned}/${game.layover.transferPax} transfers · ${Math.ceil(game.layover.remaining)}s`,
      tone: 'ok',
      left: Math.ceil(game.layover.remaining),
      live: true,
    })
  }
  if (game.hubOffer && hubAirline) {
    letters.push({
      id: 'hub',
      kind: 'Hub',
      from: hubAirline.name,
      title: `${hubAirline.name} Hub plaque`,
      blurb: `${moneyAbbrev(game.hubOffer.fee)} · denser slots if you keep Standing up`,
      tone: 'good',
      left: Math.ceil(game.hubOffer.deadline),
    })
  }
  if (game.mxOffer && mxAirline) {
    letters.push({
      id: 'mx',
      kind: 'Line MX',
      from: mxAirline.name,
      title: `${mxAirline.name} wants line MX`,
      blurb: `Hangar turnaround ${moneyAbbrev(game.mxOffer.payout)} per visit`,
      tone: 'good',
      left: Math.ceil(game.mxOffer.deadline),
    })
  }
  if (game.pendingThreat) {
    letters.push({
      id: 'threat',
      kind: 'Security',
      from: 'Tower',
      title: game.pendingThreat.severity === 'hard' ? 'HARD THREAT' : 'Security alert',
      blurb: game.pendingThreat.blurb,
      tone: 'bad',
      left: Math.ceil(game.pendingThreat.deadline),
    })
  }
  if (game.pendingEmergency) {
    const e = game.pendingEmergency
    letters.push({
      id: 'emergency',
      kind: 'Emergency',
      from: 'Ops',
      title: e.kind === 'tanker' ? 'Firefighting plane' : e.kind === 'tanker_mx' ? 'Tanker MX' : 'Weather divert',
      blurb: `${e.blurb} · ${moneyAbbrev(e.fee)}`,
      tone: 'warn',
      left: Math.ceil(e.deadline),
    })
  }
  if (game.parkingOffer) {
    letters.push({
      id: 'parking',
      kind: 'GA parking',
      from: game.parkingOffer.callsign,
      title: `Parking · ${game.parkingOffer.callsign}`,
      blurb: `${AIRFRAMES[game.parkingOffer.airframeId]?.name ?? 'Aircraft'} · ${moneyAbbrev(game.parkingOffer.fee)}`,
      tone: 'ok',
      left: Math.ceil(game.parkingOffer.deadline),
    })
  }
  if (!dismissedWarn && game.warnedAirlines().length) {
    letters.push({
      id: 'warn',
      kind: 'Relations',
      from: 'Desk',
      title: 'Relations cooling',
      blurb: game
        .warnedAirlines()
        .map((id) => {
          const a = game.airline(id)
          const perk = game.rewardOf(id)
          return perk
            ? `${a.name} Standing ${Math.round(game.standingOf(id))} — ${rewardBlurb(perk)} at risk`
            : `${a.name} walks at ${HEAT_ABANDON_THRESHOLD}`
        })
        .join(' · ') + `. Warn line is Standing ${HEAT_WARN_THRESHOLD}.`,
      tone: 'warn',
      left: null,
    })
  }
  return letters
}
