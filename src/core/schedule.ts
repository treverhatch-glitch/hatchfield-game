export type JobWork = (budgetMs: number) => 'done' | 'more'

export interface Job {
  id: string
  work: JobWork
}

class Scheduler {
  private queue: Job[] = []

  /** 
   * Enqueue a job. If a job with the same id exists, it is replaced and 
   * moved to the end of the queue.
   */
  enqueue(id: string, work: JobWork): void {
    this.queue = this.queue.filter(j => j.id !== id)
    this.queue.push({ id, work })
  }

  /**
   * Run jobs from the queue until the budget is exhausted.
   * A budget of Infinity means run until the queue is empty.
   */
  drain(budgetMs: number): void {
    const start = performance.now()
    while (this.queue.length > 0) {
      const job = this.queue[0]
      const remainingMs = budgetMs === Infinity ? Infinity : budgetMs - (performance.now() - start)
      if (remainingMs <= 0) return

      try {
        const status = job.work(remainingMs)
        if (status === 'done') {
          this.queue.shift()
        } else {
          // Job needs more time, stop processing the queue for this drain call.
          // The current job remains at the front of the queue.
          return
        }
      } catch (err) {
        console.error(`Job ${job.id} failed`, err)
        this.queue.shift()
      }
    }
  }

  /** Removes all jobs from the queue. */
  clear(): void {
    this.queue = []
  }

  /** How many jobs are in the queue. */
  get size(): number {
    return this.queue.length
  }
}

export const scheduler = new Scheduler()
