import { DisruptionEngine } from '../disruptions/engine.ts'
import type { DisruptionHost, DisruptionId, DisruptionWorld, StaffPoolId } from '../disruptions/types.ts'

/**
 * Holds the disruption engine next to the sim.
 * Player cards are the alert stack. This bridge does not draw its own feed.
 */
export class DisruptionBridge {
  readonly engine: DisruptionEngine

  constructor(seed = 1) {
    this.engine = new DisruptionEngine(seed)
  }

  static restore(seed: number, raw: string | undefined): DisruptionBridge {
    const bridge = new DisruptionBridge(seed)
    if (raw) bridge.engine.load(raw, seed)
    return bridge
  }

  save(): string {
    return this.engine.save()
  }

  active() {
    return this.engine.activeDisruption()
  }

  advance(world: DisruptionWorld, host: DisruptionHost) {
    return this.engine.advance(world, host)
  }

  trigger(kind: DisruptionId, world: DisruptionWorld, host: DisruptionHost) {
    return this.engine.trigger(kind, world, host)
  }

  recover(id: string, host: DisruptionHost) {
    return this.engine.recover(id, host)
  }

  checkInMultiplier(): number {
    return this.engine.checkInMultiplier()
  }

  screeningMultiplier(): number {
    return this.engine.screeningMultiplier()
  }

  feeMultiplier(): number {
    return this.engine.feeMultiplier()
  }

  secureZone(): boolean {
    return this.engine.secureZone()
  }

  runwayClosed(clock: number): boolean {
    return this.engine.runwayClosed(clock)
  }

  staffScale(pool: StaffPoolId): number {
    return this.engine.staffScale(pool)
  }
}
