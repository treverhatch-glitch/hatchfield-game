import { ceoFor } from './ceo.ts'
import { contractShape, landingOffer } from './contracts.ts'
import { fleetIdsFor, fleetLabel, metalAllowed } from './fleet.ts'
import { labFrame } from './animation.ts'
import { buyNode, emptyResearch, techNode, TECH_NODES } from './research.ts'
import { emptyRelations, feeFactorFor, noteLetter, noteTurnaround, readRelation } from './relations.ts'
import type { CeoCard, LabFrame, RelationsState, ResearchState, RoomCounts, Wave3State } from './types.ts'

export function createWave3State(): Wave3State {
  return { relations: emptyRelations(), research: emptyResearch() }
}

export class Wave3Engine {
  state: Wave3State

  constructor(saved?: Wave3State) {
    this.state = saved ? cloneState(saved) : createWave3State()
  }

  /**
   * Lab animation only. Research points live on the Growth tree.
   * `operating` and `rooms` stay in the signature so callers do not change.
   */
  tick(seconds: number, _operating: boolean, _rooms: RoomCounts): void {
    const extra = Math.max(0, seconds)
    this.state = {
      ...this.state,
      research: { ...this.state.research, animSeconds: this.state.research.animSeconds + extra },
    }
  }

  noteLetter(airlineId: string, response: 'accept' | 'decline'): void {
    this.state = { ...this.state, relations: noteLetter(this.state.relations, airlineId, response) }
  }

  noteTurnaround(airlineId: string, kind: 'success' | 'delay' | 'cancel'): void {
    this.state = { ...this.state, relations: noteTurnaround(this.state.relations, airlineId, kind) }
  }

  points(): number {
    return this.state.research.points
  }

  /** Cheap key for the HUD snapshot. Score and tier changes must repaint the letter. */
  chromeKey(): string {
    const research = this.state.research
    const rows = this.state.relations.rows
    let rel = ''
    for (const id of Object.keys(rows).sort()) {
      const row = rows[id]
      if (!row) continue
      rel += `${id}:${row.score}:${row.band};`
    }
    return `${research.points}|${research.unlocked.join(',')}|${rel}`
  }

  relation(airlineId: string) {
    const row = readRelation(this.state.relations, airlineId)
    const shape = contractShape(airlineId, undefined, this.state.relations)
    return { ...row, ...shape, ceo: this.ceo(airlineId), fleetLabel: fleetLabel(shape.airframes) }
  }

  ceo(airlineId: string): CeoCard {
    return ceoFor(airlineId)
  }

  feeFactor(airlineId: string): number {
    return feeFactorFor(this.state.relations, airlineId)
  }

  landingOffer(airlineId: string, published: number): number {
    return landingOffer(published, this.state.relations, airlineId)
  }

  /** Closed fleet. Passing an explicit list wins over the catalog. */
  allowsMetal(airlineId: string, airframeId: string, listed?: readonly string[]): boolean {
    return metalAllowed(fleetIdsFor(airlineId, listed), airframeId)
  }

  fleetOf(airlineId: string, listed?: readonly string[]): readonly string[] {
    return fleetIdsFor(airlineId, listed)
  }

  frame(rooms: RoomCounts): LabFrame {
    return labFrame(this.state.research.animSeconds, rooms)
  }

  buy(id: string, fieldLevel: number): { ok: boolean; why: string } {
    const result = buyNode(this.state.research, id, fieldLevel)
    if (result.ok) this.state = { ...this.state, research: result.state }
    return { ok: result.ok, why: result.why }
  }

  nodes() {
    return TECH_NODES
  }

  node(id: string) {
    return techNode(id)
  }

  save(): Wave3State {
    return cloneState(this.state)
  }

  load(saved: Wave3State | undefined): void {
    this.state = saved ? cloneState(saved) : createWave3State()
  }
}

function cloneState(state: Wave3State): Wave3State {
  return {
    relations: { rows: { ...state.relations.rows } },
    research: {
      points: state.research.points,
      carry: state.research.carry,
      unlocked: [...state.research.unlocked],
      animSeconds: state.research.animSeconds,
    },
  }
}

export type { RelationsState, ResearchState }
