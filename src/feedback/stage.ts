import type { ThoughtIcon } from './types.ts'

export interface LiveBubbleIcon {
  passengerId: string
  icon: ThoughtIcon
}

let bubbles: readonly LiveBubbleIcon[] = []

/** Icons the instanced renderer should draw this frame. The sim decides who speaks. */
export function setLiveBubbles(next: readonly LiveBubbleIcon[]): void {
  bubbles = next
}

export function liveBubbles(): readonly LiveBubbleIcon[] {
  return bubbles
}
