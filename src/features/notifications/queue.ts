/**
 * Non-blocking notification queue shared by reports, events and ratings.
 * Nothing here pauses the sim: items pop in, the player may open, act on,
 * or dismiss them, and they expire on their own if ignored.
 */
export type NotificationKind = 'report' | 'event' | 'rating' | 'contract' | 'info'
export type NotificationPriority = 'low' | 'normal' | 'high'
export type NotificationStatus = 'new' | 'seen' | 'opened' | 'resolved' | 'dismissed' | 'expired'

export interface NotificationChoice {
  id: string
  label: string
  /** Short preview of the consequence, shown on the card. */
  hint?: string
}

export interface NotificationItem<P = unknown> {
  id: string
  kind: NotificationKind
  title: string
  summary: string
  priority: NotificationPriority
  createdAt: number
  /** Game time after which the item auto-expires (and a default choice applies). */
  expiresAt?: number
  choices?: NotificationChoice[]
  /** Choice applied automatically if the item expires unanswered. */
  defaultChoiceId?: string
  status: NotificationStatus
  resolvedChoiceId?: string
  payload: P
}

export type NewNotification<P = unknown> = Omit<NotificationItem<P>, 'id' | 'status' | 'createdAt'> & {
  id?: string
}

export interface NotificationResolution {
  item: NotificationItem
  choiceId: string | undefined
  reason: 'chosen' | 'expired' | 'dismissed'
}

export type NotificationListener = (r: NotificationResolution) => void

const PRIORITY_RANK: Record<NotificationPriority, number> = { high: 0, normal: 1, low: 2 }

export class NotificationQueue {
  private items: NotificationItem[] = []
  private listeners: NotificationListener[] = []
  private seq = 0
  readonly maxVisible: number
  readonly maxHistory: number

  constructor(opts: { maxVisible?: number; maxHistory?: number } = {}) {
    this.maxVisible = opts.maxVisible ?? 3
    this.maxHistory = opts.maxHistory ?? 100
  }

  push<P>(n: NewNotification<P>, now: number): NotificationItem<P> {
    const item: NotificationItem<P> = { ...n, id: n.id ?? `n${++this.seq}`, status: 'new', createdAt: now }
    this.items.push(item as NotificationItem)
    this.trimHistory()
    return item
  }

  onResolve(fn: NotificationListener): () => void {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn)
    }
  }

  get(id: string): NotificationItem | undefined {
    return this.items.find((i) => i.id === id)
  }

  /** Items still awaiting the player, sorted high priority first, then oldest. */
  active(): NotificationItem[] {
    return this.items
      .filter((i) => i.status === 'new' || i.status === 'seen' || i.status === 'opened')
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt)
  }

  /** The compact stack the HUD shows (never more than maxVisible cards). */
  visible(): NotificationItem[] {
    return this.active().slice(0, this.maxVisible)
  }

  unreadCount(): number {
    return this.items.filter((i) => i.status === 'new').length
  }

  history(): NotificationItem[] {
    return this.items.slice()
  }

  markSeen(id: string): void {
    const i = this.get(id)
    if (i && i.status === 'new') i.status = 'seen'
  }

  open(id: string): NotificationItem | undefined {
    const i = this.get(id)
    if (i && (i.status === 'new' || i.status === 'seen')) i.status = 'opened'
    return i
  }

  choose(id: string, choiceId: string): boolean {
    const i = this.get(id)
    if (!i || !this.isActive(i)) return false
    if (i.choices && !i.choices.some((c) => c.id === choiceId)) return false
    i.status = 'resolved'
    i.resolvedChoiceId = choiceId
    this.emit({ item: i, choiceId, reason: 'chosen' })
    return true
  }

  /** Dismissing an item with choices applies its default choice (if any). */
  dismiss(id: string): boolean {
    const i = this.get(id)
    if (!i || !this.isActive(i)) return false
    i.status = 'dismissed'
    i.resolvedChoiceId = i.defaultChoiceId
    this.emit({ item: i, choiceId: i.defaultChoiceId, reason: 'dismissed' })
    return true
  }

  /** Call once per sim tick with game time; expires stale items. Never blocks. */
  tick(now: number): NotificationItem[] {
    const expired: NotificationItem[] = []
    for (const i of this.items) {
      if (this.isActive(i) && i.expiresAt !== undefined && now >= i.expiresAt) {
        i.status = 'expired'
        i.resolvedChoiceId = i.defaultChoiceId
        expired.push(i)
        this.emit({ item: i, choiceId: i.defaultChoiceId, reason: 'expired' })
      }
    }
    return expired
  }

  private isActive(i: NotificationItem): boolean {
    return i.status === 'new' || i.status === 'seen' || i.status === 'opened'
  }

  private emit(r: NotificationResolution): void {
    for (const l of this.listeners) l(r)
  }

  private trimHistory(): void {
    if (this.items.length <= this.maxHistory) return
    const removable = this.items.filter((i) => !this.isActive(i))
    let excess = this.items.length - this.maxHistory
    const drop = new Set<NotificationItem>()
    for (const i of removable) {
      if (excess-- <= 0) break
      drop.add(i)
    }
    this.items = this.items.filter((i) => !drop.has(i))
  }
}
