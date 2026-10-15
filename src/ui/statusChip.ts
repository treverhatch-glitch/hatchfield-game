import type { Game } from '../game/sim.ts'

export type StatusLetter = 'threat' | 'emergency'

export interface StatusPhrase {
  text: string
  /** Threat and emergency are letters on the left stack. The dock does not raise them. */
  letter?: StatusLetter
}

export interface StatusDockRow {
  severity: string
  title: string
  key: string
}

export interface StatusChipInput {
  threat: 'hard' | 'soft' | null
  emergency: boolean
  standingLow: boolean
  holding: number
  apronJam: boolean
  securityQueue: boolean
  lostPax: boolean
  power: boolean
  loanShort: boolean
  disruptionTitles: string[]
  dock: StatusDockRow[]
}

export type StatusChipTarget = { kind: 'letter'; id: StatusLetter } | { kind: 'dock' }

/** Critical and warning rows are the dock. Info never covers a chip phrase. */
function dockRowsCovering(dock: readonly StatusDockRow[]): StatusDockRow[] {
  return dock.filter((row) => row.severity === 'critical' || row.severity === 'warning')
}

function dockCoversPhrase(text: string, dock: readonly StatusDockRow[]): boolean {
  const rows = dockRowsCovering(dock)
  if (text === 'Security queue') {
    return rows.some((row) => /queue/i.test(row.key) || /queue/i.test(row.title))
  }
  if (text === 'Power') {
    return rows.some((row) => /power|brown-?out/i.test(`${row.key} ${row.title}`))
  }
  return rows.some((row) => {
    if (row.title === text) return true
    if (!/fuel/i.test(text)) return false
    return /fuel/i.test(row.key) || /fuel/i.test(row.title)
  })
}

/**
 * Top-bar phrases. Drop one when a critical or warning dock row already names
 * that condition (power brown-out, a disruption title, security when a queue
 * alert is up, a fuel line). Holding, standing, the emergency letter, and the
 * threat stay — the dock does not raise them.
 */
export function statusChipPhrases(input: StatusChipInput): StatusPhrase[] {
  const phrases: StatusPhrase[] = []
  if (input.threat) phrases.push({ text: input.threat === 'hard' ? 'Hard threat' : 'Security', letter: 'threat' })
  if (input.emergency) phrases.push({ text: 'Emergency', letter: 'emergency' })
  if (input.standingLow) phrases.push({ text: 'Standing low' })
  if (input.holding) phrases.push({ text: `${input.holding} holding` })
  if (input.apronJam) phrases.push({ text: 'Apron jam' })
  if (input.securityQueue) phrases.push({ text: 'Security queue' })
  if (input.lostPax) phrases.push({ text: 'Lost pax' })
  if (input.power) phrases.push({ text: 'Power' })
  if (input.loanShort) phrases.push({ text: 'Loan short' })
  for (const title of input.disruptionTitles) phrases.push({ text: title })
  return phrases.filter((phrase) => !dockCoversPhrase(phrase.text, input.dock))
}

export function statusChipFromGame(game: Game): StatusPhrase[] {
  return statusChipPhrases({
    threat: game.pendingThreat ? game.pendingThreat.severity : null,
    emergency: game.pendingEmergency != null,
    standingLow: game.warnedAirlines().length > 0,
    holding: game.holdingCount(),
    apronJam: game.apronJamLine() != null,
    securityQueue: game.securityQueueCount() >= 3,
    lostPax: game.lostPaxCount() > 0,
    power: game.powerReport().brownout,
    loanShort: game.loanBalance > game.loanOpened && game.loanOpened > 0,
    disruptionTitles: game.disruptionFeed().map((item) => item.title),
    dock: game.alerts.ranked().map((row) => ({ severity: row.severity, title: row.title, key: row.key })),
  })
}

export function dockHasRows(game: Game): boolean {
  return game.alerts.ranked().some((row) => row.severity === 'critical' || row.severity === 'warning')
}

/** A letter names the stack id. On desktop the HUD opens that card on the phone instead. */
export function statusChipTarget(phrases: readonly StatusPhrase[], dockOpen: boolean): StatusChipTarget | null {
  const letter = phrases[0]?.letter
  if (letter) return { kind: 'letter', id: letter }
  if (dockOpen) return { kind: 'dock' }
  return null
}

/** Desktop threat and divert cards live on the phone. The chip must not open a covering letter. */
export function statusChipOpensPhone(desktopPhone: boolean, target: StatusChipTarget): boolean {
  return desktopPhone && target.kind === 'letter'
}

export function runStatusChipAction(
  target: StatusChipTarget,
  act: {
    openLetter: (id: StatusLetter) => void
    scrollLetter: (id: StatusLetter) => void
    expandDock: () => void
  },
) {
  if (target.kind === 'letter') {
    act.openLetter(target.id)
    act.scrollLetter(target.id)
    return
  }
  act.expandDock()
}
