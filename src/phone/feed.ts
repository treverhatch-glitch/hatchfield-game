/**
 * Turn a plain snapshot of offers into phone cards.
 * The snapshot has no hints, tips, alerts, or emergencies — those never reach this function.
 */
import { classifyPhoneKind, phonePreview } from './logic.ts'
import type { PhoneButton, PhoneCard, PhoneLine } from './types.ts'

export interface PhoneContractOffer {
  airlineId: string
  airlineName: string
  persona: string
  blurb: string
  procedural: boolean
  secondsLeft: number
  verdict: string
  verdictMet: boolean
  requirements: PhoneLine[]
  terms: string
  /** Stand or pad capacity. A warning, not a requirement. */
  capacity?: string
  /** Wave 3 relationship fee. The only carrier multiplier on the landing bill. */
  feeLine?: string
  /** Timetable rows this tier adds once. Zero at Published. */
  slotLine?: string
}

export interface PhoneSignedRow {
  id: string
  name: string
  standing: number
  note?: string
}

export interface PhoneFuelSpot {
  flightNo: string
  supplier: string
  litres: number
  perLitre: number
  bill: number
  leadMinutes: number
  secondsLeft: number
}

export interface PhonePipelineHold {
  secondsLeft: number
  body: string
}

export interface PhoneFuelSigned {
  id: string
  name: string
  perLitre: number
  bandLitres: number
  drawnLitres: number
}

export interface PhoneWorld {
  contract: PhoneContractOffer | null
  signed: PhoneSignedRow[]
  fuelSpot: PhoneFuelSpot | null
  fuelSigned: PhoneFuelSigned | null
  pipelineHold: PhonePipelineHold | null
  mxSigned: PhoneSignedRow[]
  hubs: PhoneSignedRow[]
  layoverOffer: {
    airlineName: string
    feeText: string
    transferPax: number
    duration: number
    secondsLeft: number
  } | null
  layoverLive: {
    airlineId: string
    airlineName: string
    spawned: number
    transferPax: number
    remaining: number
    standing: number
    happy: string | null
  } | null
  hubOffer: {
    airlineName: string
    tierLabel: string
    feeText: string
    secondsLeft: number
    body: string
    lines: PhoneLine[]
    acceptDisabled: boolean
    /** Shown above Accept. Empty when this rung has no rivals on the field. */
    anger?: string
    spared?: string
  } | null
  mxOffer: { airlineName: string; payoutText: string; secondsLeft: number } | null
  parking: {
    callsign: string
    craft: string
    feeText: string
    staySec: number
    secondsLeft: number
  } | null
  field: {
    id: string
    airlineName: string
    title: string
    blurb: string
    bonusText: string
    secondsLeft: number
    /** Deadline and the fine if the ask is left to expire. */
    clockLine: string
    buildLabel: string | null
    buildEnabled: boolean
  } | null
  cargo: {
    id: string
    airlineName: string
    delivered: number
    target: number
    feeText: string
    secondsLeft: number
  } | null
  warn: { key: string; blurb: string } | null
  advisor: {
    id: string
    airlineName: string
    standing: number
    daysToLeave: number
    causes: string
  }[]
  rivalNotes: { id: string; name: string; text: string }[]
}

function card(partial: PhoneCard): PhoneCard | null {
  if (classifyPhoneKind(partial.kind) !== partial.tab) return null
  return partial
}

function btn(
  id: string,
  label: string,
  action: PhoneButton['action'],
  extra?: Pick<PhoneButton, 'primary' | 'disabled'>,
): PhoneButton {
  return { id, label, action, ...extra }
}

export function emptyPhoneWorld(): PhoneWorld {
  return {
    contract: null,
    signed: [],
    fuelSpot: null,
    fuelSigned: null,
    pipelineHold: null,
    mxSigned: [],
    hubs: [],
    layoverOffer: null,
    layoverLive: null,
    hubOffer: null,
    mxOffer: null,
    parking: null,
    field: null,
    cargo: null,
    warn: null,
    advisor: [],
    rivalNotes: [],
  }
}

function contractLines(offer: PhoneContractOffer): PhoneLine[] {
  const lines: PhoneLine[] = [{ label: offer.verdict, met: offer.verdictMet }]
  if (offer.feeLine) lines.push({ label: offer.feeLine })
  if (offer.slotLine) lines.push({ label: offer.slotLine })
  if (offer.capacity) lines.push({ label: offer.capacity })
  lines.push(...offer.requirements)
  return lines
}

/** Cards for the two tabs. Order is the order they render. */
export function buildPhoneFeed(world: PhoneWorld): PhoneCard[] {
  const cards: PhoneCard[] = []
  const offer = world.contract
  if (offer) {
    const title = `${offer.airlineName} wants a contract${offer.procedural ? ' · regional' : ''}`
    const built = card({
      id: 'contract',
      key: `contract:${offer.airlineId}`,
      tab: 'messages',
      kind: 'contract',
      from: offer.airlineName,
      title,
      preview: phonePreview(title),
      body: `${offer.persona} · ${offer.blurb}\n${offer.terms}`,
      tone: 'good',
      holdId: 'contract',
      arrives: true,
      secondsLeft: offer.secondsLeft,
      lines: contractLines(offer),
      actions: [
        btn('sign', 'Sign', { type: 'sign-contract' }, { primary: true }),
        btn('decline', 'Decline', { type: 'decline-contract' }),
        btn('negotiate', 'Negotiate', { type: 'negotiate-contract' }),
        btn('later', 'Later', { type: 'later-contract' }),
      ],
    })
    if (built) cards.push(built)
    const filed = card({
      id: 'contract-file',
      key: `offer:${offer.airlineId}`,
      tab: 'contracts',
      kind: 'offer',
      from: offer.airlineName,
      title,
      preview: phonePreview(title),
      body: `${offer.persona} · ${offer.blurb}\n${offer.terms}`,
      tone: 'good',
      holdId: 'contract',
      arrives: false,
      secondsLeft: offer.secondsLeft,
      lines: contractLines(offer),
      actions: [
        btn('sign', 'Sign', { type: 'sign-contract' }, { primary: true }),
        btn('decline', 'Decline', { type: 'decline-contract' }),
        btn('negotiate', 'Negotiate', { type: 'negotiate-contract' }),
        btn('later', 'Later', { type: 'later-contract' }),
      ],
    })
    if (filed) cards.push(filed)
  }

  const fuelSigned = world.fuelSigned
  if (fuelSigned) {
    const title = `${fuelSigned.name} · fuel term`
    const body = `$${fuelSigned.perLitre.toFixed(3)}/L · band ${fuelSigned.drawnLitres.toLocaleString('en-US')} / ${fuelSigned.bandLitres.toLocaleString('en-US')} L today.`
    const built = card({
      id: `fuel-signed:${fuelSigned.id}`,
      key: `fuel-signed:${fuelSigned.id}`,
      tab: 'contracts',
      kind: 'fuel-signed',
      from: fuelSigned.name,
      title,
      preview: phonePreview(title),
      body,
      tone: 'ok',
      arrives: false,
      secondsLeft: null,
      actions: [btn('drop-term', 'Drop back to spot', { type: 'drop-fuel-term' })],
    })
    if (built) cards.push(built)
  }

  const spot = world.fuelSpot
  if (spot) {
    const title = `${spot.supplier} · ${spot.flightNo}`
    const body = `${spot.litres.toLocaleString('en-US')} L at $${spot.perLitre.toFixed(3)}/L · $${spot.bill.toLocaleString('en-US')} · on the road in ${spot.leadMinutes} game minutes. ${spot.flightNo} stays grounded if this offer is ignored.`
    const built = card({
      id: 'fuel-spot',
      key: `fuel-spot:${spot.flightNo}`,
      tab: 'messages',
      kind: 'fuel-spot',
      from: spot.supplier,
      title,
      preview: phonePreview(`${spot.supplier} tanker for ${spot.flightNo}`),
      body,
      tone: 'warn',
      arrives: true,
      secondsLeft: spot.secondsLeft,
      actions: [
        btn('accept-spot', 'Order tanker', { type: 'accept-fuel-spot' }, { primary: true }),
        btn('decline-spot', 'Decline', { type: 'decline-fuel-spot' }),
      ],
    })
    if (built) cards.push(built)
  }

  const hold = world.pipelineHold
  if (hold) {
    const title = 'Pipeline batch held'
    const built = card({
      id: 'pipeline-hold',
      key: 'pipeline-hold',
      tab: 'messages',
      kind: 'pipeline-hold',
      from: 'Fuel farm',
      title,
      preview: phonePreview(title),
      body: hold.body,
      tone: 'warn',
      arrives: true,
      secondsLeft: hold.secondsLeft,
      actions: [btn('pipeline-spot', 'Buy one spot truck', { type: 'order-pipeline-spot' }, { primary: true })],
    })
    if (built) cards.push(built)
  }

  for (const row of world.signed) {
    const built = card({
      id: `signed:${row.id}`,
      key: `signed:${row.id}`,
      tab: 'contracts',
      kind: 'signed',
      from: row.name,
      title: row.name,
      preview: phonePreview(row.name),
      body: row.note ?? `Standing ${row.standing}. On the books.`,
      tone: 'ok',
      arrives: false,
      secondsLeft: null,
      actions: [],
    })
    if (built) cards.push(built)
  }
  for (const row of world.mxSigned) {
    const built = card({
      id: `mx-signed:${row.id}`,
      key: `mx-signed:${row.id}`,
      tab: 'contracts',
      kind: 'mx-signed',
      from: row.name,
      title: `${row.name} · line MX`,
      preview: phonePreview(`${row.name} line MX`),
      body: 'Hangar line maintenance is signed.',
      tone: 'ok',
      arrives: false,
      secondsLeft: null,
      actions: [],
    })
    if (built) cards.push(built)
  }
  for (const row of world.hubs) {
    const built = card({
      id: `hub-signed:${row.id}`,
      key: `hub-signed:${row.id}`,
      tab: 'contracts',
      kind: 'hub-signed',
      from: row.name,
      title: `${row.name} · hub`,
      preview: phonePreview(`${row.name} hub`),
      body: 'Hub plaque is on the terminal.',
      tone: 'ok',
      arrives: false,
      secondsLeft: null,
      actions: [],
    })
    if (built) cards.push(built)
  }

  const lay = world.layoverOffer
  if (lay) {
    const title = `${lay.airlineName} layover bank`
    const built = card({
      id: 'layover',
      key: `layover:${lay.airlineName}`,
      tab: 'messages',
      kind: 'layover',
      from: lay.airlineName,
      title,
      preview: phonePreview(title),
      body: `${lay.feeText} up front · ${lay.transferPax} transfers · ~${lay.duration}s.`,
      tone: 'good',
      holdId: 'layover',
      arrives: true,
      secondsLeft: lay.secondsLeft,
      actions: [
        btn('host', 'Host layover', { type: 'accept-layover' }, { primary: true }),
        btn('decline', 'Decline', { type: 'decline-layover' }),
      ],
    })
    if (built) cards.push(built)
  }

  const live = world.layoverLive
  if (live) {
    const title = `${live.airlineName} layover live`
    const happy = live.happy ? ` · avg happy ${live.happy}` : ''
    const built = card({
      id: 'layover-live',
      key: `layover-live:${live.airlineId}`,
      tab: 'messages',
      kind: 'layover-live',
      from: live.airlineName,
      title,
      preview: phonePreview(title),
      body: `${live.spawned}/${live.transferPax} transfers · ${Math.ceil(live.remaining)}s left · Standing ${live.standing}${happy}`,
      tone: 'ok',
      arrives: true,
      secondsLeft: Math.ceil(live.remaining),
      actions: [btn('dismiss', 'Dismiss', { type: 'ack', key: `layover-live:${live.airlineId}` })],
    })
    if (built) cards.push(built)
  }

  const hub = world.hubOffer
  if (hub) {
    const title = `${hub.airlineName} · ${hub.tierLabel} offer`
    const built = card({
      id: 'hub',
      key: `hub:${hub.airlineName}:${hub.tierLabel}`,
      tab: 'messages',
      kind: 'hub',
      from: hub.airlineName,
      title,
      preview: phonePreview(title),
      body: [hub.anger, hub.spared, `${hub.feeText}. ${hub.body}`].filter((line) => line).join('\n'),
      tone: 'good',
      arrives: true,
      secondsLeft: hub.secondsLeft,
      lines: hub.lines,
      actions: [
        btn('sign', 'Accept', { type: 'accept-hub' }, { primary: true, disabled: hub.acceptDisabled }),
        btn('decline', 'Decline', { type: 'decline-hub' }),
      ],
    })
    if (built) cards.push(built)
  }

  for (const note of world.rivalNotes) {
    const title = `${note.name} left for Bellwater`
    const built = card({
      id: `rival-${note.id}`,
      key: `rival:${note.id}`,
      tab: 'messages',
      kind: 'rival',
      from: note.name,
      title,
      preview: phonePreview(note.text),
      body: note.text,
      tone: 'bad',
      arrives: true,
      secondsLeft: null,
      actions: [btn('dismiss', 'Dismiss', { type: 'ack', key: `rival:${note.id}` })],
    })
    if (built) cards.push(built)
  }

  const mx = world.mxOffer
  if (mx) {
    const title = `${mx.airlineName} wants line MX`
    const built = card({
      id: 'mx',
      key: `mx:${mx.airlineName}`,
      tab: 'messages',
      kind: 'mx',
      from: mx.airlineName,
      title,
      preview: phonePreview(title),
      body: `Hangar turnaround fee ${mx.payoutText} per visit. Needs funded mechanics.`,
      tone: 'good',
      holdId: 'mx',
      arrives: true,
      secondsLeft: mx.secondsLeft,
      actions: [
        btn('sign', 'Sign MX', { type: 'sign-mx' }, { primary: true }),
        btn('decline', 'Decline', { type: 'decline-mx' }),
      ],
    })
    if (built) cards.push(built)
  }

  const park = world.parking
  if (park) {
    const title = `Independent parking · ${park.callsign}`
    const built = card({
      id: 'parking',
      key: `parking:${park.callsign}`,
      tab: 'messages',
      kind: 'parking',
      from: park.callsign,
      title,
      preview: phonePreview(title),
      body: `${park.craft} · fee ${park.feeText} · ~${park.staySec}s then leave request`,
      tone: 'ok',
      holdId: 'parking',
      arrives: true,
      secondsLeft: park.secondsLeft,
      actions: [
        btn('host', 'Host parking', { type: 'accept-parking' }, { primary: true }),
        btn('decline', 'Wave off', { type: 'decline-parking' }),
      ],
    })
    if (built) cards.push(built)
  }

  const field = world.field
  if (field) {
    const title = `${field.airlineName} · ${field.title}`
    const actions: PhoneButton[] = []
    if (field.buildLabel) {
      actions.push(
        btn('build', field.buildLabel, { type: 'build-field' }, { primary: true, disabled: !field.buildEnabled }),
      )
    }
    actions.push(btn('decline', 'Decline', { type: 'decline-field' }))
    actions.push(btn('later', 'Later', { type: 'ack', key: `field:${field.id}` }))
    const built = card({
      id: 'field',
      key: `field:${field.id}`,
      tab: 'messages',
      kind: 'field',
      from: field.airlineName,
      title,
      preview: phonePreview(title),
      body: `${field.blurb} · ${field.bonusText} if done\n${field.clockLine}`,
      tone: 'ok',
      holdId: 'field',
      arrives: true,
      secondsLeft: field.secondsLeft,
      actions,
    })
    if (built) cards.push(built)
  }

  const cargo = world.cargo
  if (cargo) {
    const title = `${cargo.airlineName} volume window`
    const built = card({
      id: 'cargo-vol',
      key: `cargo:${cargo.id}`,
      tab: 'messages',
      kind: 'cargo',
      from: cargo.airlineName,
      title,
      preview: phonePreview(title),
      body: `Stage ${cargo.delivered}/${cargo.target}u through the shed · ${cargo.feeText}`,
      tone: 'ok',
      arrives: true,
      secondsLeft: cargo.secondsLeft,
      actions: [btn('dismiss', 'Dismiss', { type: 'ack', key: `cargo:${cargo.id}` })],
    })
    if (built) cards.push(built)
  }

  const warn = world.warn
  if (warn) {
    const built = card({
      id: 'warn',
      key: warn.key,
      tab: 'messages',
      kind: 'warn',
      from: 'Desk',
      title: 'Relations cooling',
      preview: phonePreview('Relations cooling'),
      body: warn.blurb,
      tone: 'warn',
      arrives: true,
      secondsLeft: null,
      actions: [btn('dismiss', 'Dismiss', { type: 'ack', key: warn.key })],
    })
    if (built) cards.push(built)
  }

  for (const note of world.advisor) {
    const title = `Standing collapse risk · ${note.airlineName}`
    const built = card({
      id: note.id,
      key: note.id,
      tab: 'messages',
      kind: 'advisor',
      from: note.airlineName,
      title,
      preview: phonePreview(title),
      body: `Standing ${note.standing} · predicted departure in ~${note.daysToLeave} game days. ${note.causes}`,
      tone: 'warn',
      arrives: true,
      secondsLeft: null,
      actions: [btn('dismiss', 'Dismiss', { type: 'dismiss-advisor', cardId: note.id })],
    })
    if (built) cards.push(built)
  }

  return cards
}
