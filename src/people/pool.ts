/**
 * Slot allocator for instanced batches. Each batch (one InstancedMesh) has a
 * fixed capacity; `take` hands out the next free slot or -1 when full and
 * counts the overflow so callers can report it instead of failing silently.
 * Slots are reset every frame, so pooled meshes never grow or reallocate.
 */
export class InstancePool {
  private readonly counts = new Map<string, number>()
  private readonly over = new Map<string, number>()

  readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
  }

  /** Start a new frame: every batch is empty again. */
  reset(): void {
    this.counts.clear()
    this.over.clear()
  }

  take(batch: string): number {
    const used = this.counts.get(batch) ?? 0
    if (used >= this.capacity) {
      this.over.set(batch, (this.over.get(batch) ?? 0) + 1)
      return -1
    }
    this.counts.set(batch, used + 1)
    return used
  }

  count(batch: string): number {
    return this.counts.get(batch) ?? 0
  }

  overflow(batch?: string): number {
    if (batch) return this.over.get(batch) ?? 0
    let total = 0
    for (const n of this.over.values()) total += n
    return total
  }

  batches(): string[] {
    return [...this.counts.keys()]
  }
}
