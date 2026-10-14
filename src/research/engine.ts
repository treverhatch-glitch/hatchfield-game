import { accrue, blockReason, buyNode, claimLevels, emptyResearchState, researchRate } from './logic.ts'
import { linkFor, type BuildLink } from './links.ts'
import type { ResearchState, RoomCounts } from './types.ts'

export class ResearchEngine {
  state: ResearchState

  constructor(saved?: ResearchState) {
    this.state = saved ? cloneState(saved) : emptyResearchState()
  }

  /** Operations trickle from the first tick. Rooms add the larger share. Staff raise the room share. */
  tick(seconds: number, operating: boolean, rooms: RoomCounts, staff = 0): void {
    this.state = accrue(this.state, seconds, rooms, operating, staff)
  }

  rate(rooms: RoomCounts, operating: boolean, staff = 0): number {
    return researchRate(rooms, operating, staff)
  }

  points(): number {
    return this.state.points
  }

  owns(id: string): boolean {
    return this.state.unlocked.includes(id)
  }

  linkFor(buildId: string): BuildLink | null {
    return linkFor(buildId)
  }

  blockReason(buildId: string): string | null {
    return blockReason(this.state, buildId)
  }

  buy(id: string, fieldLevel: number): { ok: boolean; why: string } {
    const result = buyNode(this.state, id, fieldLevel)
    if (result.ok) this.state = result.state
    return { ok: result.ok, why: result.why }
  }

  /** Cash is applied by the caller. Research points stay in this engine. */
  claimNewLevels(reached: number): { level: number; cash: number; rp: number }[] {
    const result = claimLevels(this.state, reached)
    this.state = result.state
    return result.payouts
  }

  chromeKey(): string {
    return `${this.state.points}|${this.state.unlocked.join(',')}|${this.state.rewardedThrough}|${this.state.primarySpec ?? ''}`
  }

  save(): ResearchState {
    return cloneState(this.state)
  }

  load(saved: ResearchState | undefined, fieldLevel: number): void {
    if (!saved) {
      const fresh = emptyResearchState()
      fresh.rewardedThrough = Math.max(1, fieldLevel)
      this.state = fresh
      return
    }
    this.state = cloneState(saved)
  }
}

function cloneState(state: ResearchState): ResearchState {
  return {
    points: state.points,
    carry: state.carry,
    unlocked: [...state.unlocked],
    rewardedThrough: state.rewardedThrough,
    primarySpec: state.primarySpec,
  }
}
