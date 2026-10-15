/**
 * Phone shell: peek, flash, open, close, and swipe. Pure. The view only paints this.
 */
import {
  PHONE_EXCLUDED_KINDS,
  type PhoneCard,
  type PhoneExcludedKind,
  type PhoneShell,
  type PhoneTab,
} from './types.ts'

export const PHONE_PREVIEW_MAX = 72

const TABS: PhoneTab[] = ['contracts', 'messages']

const MESSAGE_KINDS = new Set([
  'layover',
  'layover-live',
  'hub',
  'mx',
  'parking',
  'field',
  'cargo',
  'warn',
  'advisor',
  'message',
  'rival',
])

/** Letter-stack ids that move onto the phone on desktop. Emergencies and threats stay off it. */
const OWNED_LETTER_IDS = new Set([
  'contract',
  'layover',
  'layover-live',
  'hub',
  'mx',
  'parking',
  'field',
  'cargo-vol',
  'warn',
])

export function createPhoneShell(): PhoneShell {
  return { open: false, tab: 'contracts', tabOpen: true, flashKey: null, seen: [] }
}

export function phonePreview(text: string, max = PHONE_PREVIEW_MAX): string {
  const raw = text.replace(/\s+/g, ' ').trim()
  if (raw.length <= max) return raw
  return `${raw.slice(0, max - 1).trimEnd()}…`
}

export function isPhoneExcluded(kind: string): kind is PhoneExcludedKind {
  return (PHONE_EXCLUDED_KINDS as readonly string[]).includes(kind)
}

/**
 * Where a kind sits. A contract letter is a message: its card carries Sign and Decline.
 * Signed deals sit on the Contracts tab. Hints, tips, alerts, and emergencies return null.
 */
export function classifyPhoneKind(kind: string): PhoneTab | null {
  if (isPhoneExcluded(kind)) return null
  if (kind === 'offer' || kind === 'signed' || kind === 'mx-signed' || kind === 'hub-signed' || kind === 'fuel-signed') {
    return 'contracts'
  }
  if (kind === 'fuel-spot' || kind === 'pipeline-hold') return 'messages'
  if (kind === 'contract' || kind === 'message' || MESSAGE_KINDS.has(kind)) return 'messages'
  return null
}

export function phoneOwnsLetter(id: string): boolean {
  return OWNED_LETTER_IDS.has(id) || id.startsWith('advisor-standing-')
}

/**
 * Desktop reads phone-owned letters on the handset. The contract letter stays
 * on the stack as well, and the phone still flashes its preview.
 */
export function letterOnStack(id: string, desktopPhone: boolean): boolean {
  if (!desktopPhone) return true
  if (id === 'contract') return true
  return !phoneOwnsLetter(id)
}

export function arrivalKeys(cards: readonly Pick<PhoneCard, 'key' | 'arrives'>[]): string[] {
  const keys: string[] = []
  for (const card of cards) if (card.arrives && !keys.includes(card.key)) keys.push(card.key)
  return keys
}

/**
 * Remember which arrivals the player has already been shown.
 * A key that left and comes back flashes again. Signed rows are not keys.
 */
export function phoneSync(shell: PhoneShell, keys: readonly string[]): PhoneShell {
  const seen = new Set(shell.seen)
  const fresh = keys.filter((key) => !seen.has(key))
  const flashKey = fresh.length
    ? fresh[fresh.length - 1]!
    : shell.flashKey && keys.includes(shell.flashKey)
      ? shell.flashKey
      : null
  return { ...shell, seen: [...keys], flashKey }
}

export function phoneDismissFlash(shell: PhoneShell): PhoneShell {
  if (!shell.flashKey) return shell
  return { ...shell, flashKey: null }
}

export function phoneOpen(shell: PhoneShell, tab?: PhoneTab): PhoneShell {
  return { ...shell, open: true, tabOpen: true, flashKey: null, tab: tab ?? shell.tab }
}

export function phoneClose(shell: PhoneShell): PhoneShell {
  return { ...shell, open: false }
}

/** Clicking the open tab closes its page. Clicking the other tab opens that page. */
export function phoneSetTab(shell: PhoneShell, tab: PhoneTab): PhoneShell {
  if (shell.tab === tab) return { ...shell, tabOpen: !shell.tabOpen }
  return { ...shell, tab, tabOpen: true }
}

export function phoneSwipe(shell: PhoneShell, direction: 'next' | 'prev'): PhoneShell {
  const index = TABS.indexOf(shell.tab)
  const step = direction === 'next' ? 1 : -1
  const next = Math.min(TABS.length - 1, Math.max(0, index + step))
  return { ...shell, tab: TABS[next]!, tabOpen: true }
}

export function flashPreview(cards: readonly PhoneCard[], flashKey: string | null): string | null {
  if (!flashKey) return null
  return cards.find((card) => card.key === flashKey)?.preview ?? null
}

export function flashTab(cards: readonly PhoneCard[], flashKey: string | null): PhoneTab | null {
  if (!flashKey) return null
  return cards.find((card) => card.key === flashKey)?.tab ?? null
}

/** Countdowns pause only for the page the player is actually reading. */
export function lettersToHold(shell: PhoneShell, cards: readonly Pick<PhoneCard, 'tab' | 'holdId'>[]): string[] {
  if (!shell.open || !shell.tabOpen) return []
  const ids: string[] = []
  for (const card of cards) {
    if (card.tab === shell.tab && card.holdId && !ids.includes(card.holdId)) ids.push(card.holdId)
  }
  return ids
}
