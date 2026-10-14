/**
 * Read the strings `servicePointLines` already returns.
 * The service-point sim is not imported here.
 */

export interface ParsedPoint {
  kind: 'checkin' | 'security'
  index: number
  name: string
  queue: number
  waitLabel: string
  waitSec: number
  state: string
}

export interface ParsedServiceLines {
  points: ParsedPoint[]
  bottleneck: string | null
  /** Hall count when the walk has no desks yet. */
  waiting: number | null
}

const POINT_LINE = /^(Desk|Lane) (\d+) · queue (\d+) · wait (.+?) · (.+)$/
const WAITING_LINE = /^(\d+) waiting at /

export function waitSeconds(label: string): number {
  const minutes = /(\d+)\s*min/.exec(label)
  if (minutes) return Number(minutes[1]) * 60
  const seconds = /(\d+)\s*s/.exec(label)
  if (seconds) return Number(seconds[1])
  return 0
}

export function parseServicePointLines(kind: 'checkin' | 'security', lines: readonly string[]): ParsedServiceLines {
  const points: ParsedPoint[] = []
  let bottleneck: string | null = null
  let waiting: number | null = null
  for (const line of lines) {
    if (line.startsWith('Bottleneck')) bottleneck = line
    const waitingMatch = WAITING_LINE.exec(line)
    if (waitingMatch) waiting = Number(waitingMatch[1])
    const point = POINT_LINE.exec(line)
    if (!point) continue
    const index = Number(point[2])
    points.push({
      kind,
      index,
      name: `${kind === 'checkin' ? 'Check-in' : 'Security'} ${point[1].toLowerCase()} ${index}`,
      queue: Number(point[3]),
      waitLabel: point[4].trim(),
      waitSec: waitSeconds(point[4]),
      state: point[5].trim(),
    })
  }
  return { points, bottleneck, waiting }
}
