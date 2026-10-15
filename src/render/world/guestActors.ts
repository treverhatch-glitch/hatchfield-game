/**
 * Sim hall guests as people-renderer agents. Positions stay on the doorway
 * polyline the sim already stored (`wx` / `wz`).
 */
import type { Role } from '../people/roles'
import { THOUGHT_BUBBLES } from '../../assets/manifest'
import { SIZE } from '../../game/types'
import { CELL } from '../aircraft/specs'

/** Half the apron plus one cell. Guests past this are off the field, not in the air. */
const MAP_REACH = ((SIZE - 1) / 2) * CELL + CELL

export function onField(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= MAP_REACH && Math.abs(z) <= MAP_REACH
}

export interface GuestActor {
  id: string
  role: Role
  x: number
  z: number
  yaw: number
  state: string
  queued: boolean
  bagsDropped: boolean
  hasChecked: boolean
  thought: string
  /** Existing fare tag, when the sim guest has one. */
  purpose?: string
}

interface RawGuest {
  id: string
  dead?: boolean
  wx?: number
  wz?: number
  wyaw?: number
  thought?: string
  seated?: boolean
  bagsDropped?: boolean
  hasChecked?: boolean
  serviceLeft?: number
  node?: string
  tag?: string
}

const QUEUE = /queue|waiting|lane|scanner|carousel|stuck before|no security/i
const MOVING = /heading|walking|way to|on the way|rolling a bag|bags accepted/i

export function isQueued(thought: string, seated: boolean, serviceLeft: number, node: string): boolean {
  if (seated) return false
  if (serviceLeft > 0 && node === 'security') return true
  if (!thought || MOVING.test(thought)) return false
  return QUEUE.test(thought)
}

export function actorsFrom(view: object): GuestActor[] {
  const guests = (view as { hallGuests?: readonly RawGuest[] }).hallGuests
  const out: GuestActor[] = []
  for (const g of guests ?? []) {
    if (g.dead || g.wx == null || g.wz == null || !onField(g.wx, g.wz)) continue
    const thought = g.thought ?? ''
    const seated = Boolean(g.seated)
    const queued = isQueued(thought, seated, g.serviceLeft ?? 0, g.node ?? '')
    const state = seated ? 'seated' : queued ? 'queue' : 'walk'
    out.push({
      id: g.id,
      role: 'passenger',
      x: g.wx,
      z: g.wz,
      yaw: g.wyaw ?? 0,
      state,
      queued,
      bagsDropped: Boolean(g.bagsDropped),
      hasChecked: Boolean(g.hasChecked),
      thought,
      purpose: g.tag,
    })
  }
  return out
}

export interface Bubble {
  icon: string
  text: string
  /** Asset path. Drawn once the SVG has decoded. */
  image?: string
  /** Lower sorts first when the sprite cap is full. */
  rank: number
}

/** Only the thoughts that read at a glance get a bubble. Generic walking lines stay quiet. */
export function bubbleFor(thought: string): Bubble | null {
  const t = thought.toLowerCase()
  if (!t) return null
  if (t.startsWith('wish they') || t.includes('burger') || t.includes('hungry') || t.includes('meal') || t.includes('food')) {
    return { icon: '🍔', text: thought, image: THOUGHT_BUBBLES.burger, rank: 0 }
  }
  if (t.includes('coffee') || t.includes('drink') || t.includes('snack')) {
    return { icon: '☕', text: thought, image: THOUGHT_BUBBLES.coffee, rank: 2 }
  }
  if (t.includes('bag')) return { icon: '🧳', text: thought, image: THOUGHT_BUBBLES.bag, rank: 1 }
  if (t.includes('lost') || t.includes('stuck') || t.includes('closed') || t.includes('jam') || t.includes('angry')) {
    return { icon: '😠', text: thought, image: THOUGHT_BUBBLES.angry, rank: 0 }
  }
  if (t.includes('cleared') || t.includes('got my') || t.includes('open')) {
    return { icon: '😊', text: thought, image: THOUGHT_BUBBLES.happy, rank: 3 }
  }
  return null
}
