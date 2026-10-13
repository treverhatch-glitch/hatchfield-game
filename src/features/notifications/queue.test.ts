import { describe, expect, it } from 'vitest'
import { NotificationQueue } from './queue.ts'

const base = { kind: 'info' as const, title: 't', summary: 's', payload: null }

describe('NotificationQueue', () => {
  it('orders by priority then age and caps visible cards', () => {
    const q = new NotificationQueue({ maxVisible: 2 })
    q.push({ ...base, priority: 'low' }, 0)
    const h = q.push({ ...base, priority: 'high' }, 5)
    q.push({ ...base, priority: 'normal' }, 1)
    expect(q.active()[0].id).toBe(h.id)
    expect(q.visible()).toHaveLength(2)
    expect(q.unreadCount()).toBe(3)
  })
  it('resolves choices, rejects unknown choices and fires listeners', () => {
    const q = new NotificationQueue()
    const seen: string[] = []
    q.onResolve((r) => seen.push(`${r.reason}:${r.choiceId}`))
    const n = q.push({ ...base, priority: 'normal', choices: [{ id: 'a', label: 'A' }] }, 0)
    expect(q.choose(n.id, 'zzz')).toBe(false)
    expect(q.choose(n.id, 'a')).toBe(true)
    expect(q.choose(n.id, 'a')).toBe(false)
    expect(seen).toEqual(['chosen:a'])
  })
  it('applies default on dismiss and on expiry, without blocking', () => {
    const q = new NotificationQueue()
    const a = q.push({ ...base, priority: 'normal', defaultChoiceId: 'd', expiresAt: 10 }, 0)
    const b = q.push({ ...base, priority: 'normal', defaultChoiceId: 'd' }, 0)
    q.dismiss(b.id)
    expect(q.tick(9)).toHaveLength(0)
    expect(q.tick(10).map((i) => i.id)).toEqual([a.id])
    expect(q.get(a.id)?.resolvedChoiceId).toBe('d')
    expect(q.get(b.id)?.status).toBe('dismissed')
    expect(q.active()).toHaveLength(0)
  })
  it('trims resolved history but keeps active items', () => {
    const q = new NotificationQueue({ maxHistory: 3 })
    const keep = q.push({ ...base, priority: 'normal' }, 0)
    for (let i = 0; i < 5; i++) q.dismiss(q.push({ ...base, priority: 'low' }, i).id)
    expect(q.history().length).toBeLessThanOrEqual(4)
    expect(q.get(keep.id)).toBeDefined()
  })
})
