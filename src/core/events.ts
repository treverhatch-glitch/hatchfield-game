/** Typed pub/sub. Handlers run synchronously, in subscription order. */
export class EventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<(payload: Events[keyof Events]) => void>>()

  on<K extends keyof Events>(type: K, handler: (event: Events[K]) => void): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    const wrapped = handler as (payload: Events[keyof Events]) => void
    set.add(wrapped)
    return () => {
      set!.delete(wrapped)
    }
  }

  emit<K extends keyof Events>(type: K, event: Events[K]): void {
    const set = this.handlers.get(type)
    if (!set) return
    for (const handler of [...set]) handler(event)
  }
}
