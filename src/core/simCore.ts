import { Game } from '../game/sim.ts'
import { EventBus } from './events.ts'
import type { CoreSnapshot } from './snapshot.ts'

export interface SimTick {
  /** Real seconds passed by the caller, before `timeScale`. */
  dt: number
  timeScale: number
  clock: number
}

export interface SimNews {
  id: string
  text: string
  tone: string
}

export interface SimEvents {
  tick: SimTick
  news: SimNews
  /** Fired after every tick, including paused frames that did not advance. */
  changed: { clock: number }
  loaded: { version: number }
}

export interface SimCoreOptions {
  /** Wrap an existing field instead of constructing one. */
  game?: Game
  /** Mulberry32 seed. Omit to keep the unseeded `Math.random` stream. */
  seed?: number
}

/**
 * Headless face of the airport sim. `tick` is the only clock. `snapshot`
 * and `load` round-trip as JSON. Render, React, and audio subscribe to
 * `events` instead of reaching into the frame loop.
 *
 * `timeScale` multiplies `dt` before it reaches `Game`. The game's own
 * `speed` (0 / 1 / 3 / 5) still applies, so a 50× headless run sets
 * `timeScale = 50` and leaves `speed` at 1.
 */
export class SimCore {
  readonly game: Game
  readonly events = new EventBus<SimEvents>()
  timeScale = 1

  constructor(options: SimCoreOptions = {}) {
    this.game = options.game ?? new Game()
    if (options.seed !== undefined) this.game.useSeed(options.seed)
  }

  tick(dt: number): void {
    const scale = this.timeScale > 0 ? this.timeScale : 1
    const newsId = this.game.news[0]?.id
    this.game.tick(dt * scale)
    const clock = this.game.clock
    this.events.emit('tick', { dt, timeScale: scale, clock })
    const head = this.game.news[0]
    if (head && head.id !== newsId) {
      this.events.emit('news', { id: head.id, text: head.text, tone: head.tone })
    }
    this.events.emit('changed', { clock })
  }

  snapshot(): CoreSnapshot {
    return this.game.coreSnapshot()
  }

  load(snapshot: CoreSnapshot): void {
    this.game.coreLoad(snapshot)
    this.events.emit('loaded', { version: snapshot.v })
  }

  /** JSON text of `snapshot()`. */
  toJSON(): string {
    return JSON.stringify(this.snapshot())
  }

  static fromJSON(text: string): SimCore {
    const core = new SimCore()
    core.load(JSON.parse(text) as CoreSnapshot)
    return core
  }
}
