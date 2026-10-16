/**
 * Print the S1 starter as a 2 m character grid, from the layout data.
 * npx tsx scripts/terminal-layout-dump.mts
 *
 * One character is 2 m. Row labels are the north edge of that band.
 * stacked2f is not stamped; it waits for WP6.
 */
import { writeFileSync } from 'node:fs'
import { fittingSize } from '../src/terminalbuild/fittings.ts'
import { split1f } from '../src/terminalbuild/starter/split1f.ts'
import type { DoorKind, FittingKind } from '../src/terminalbuild/types.ts'

const STEP = 2
const layout = split1f()
const cols = layout.w / STEP + 1
const rows = layout.h / STEP + 1
const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '))

function rowOfY(y: number): number {
  return Math.floor(y / STEP)
}
function colOfX(x: number): number {
  return Math.floor(x / STEP)
}

function paint(c: number, r: number, ch: string) {
  if (r < 0 || c < 0 || r >= rows || c >= cols) return
  const cur = grid[r][c]
  if (cur === '+' && (ch === '-' || ch === '|')) return
  if ((cur === '-' || cur === '|') && (ch === '-' || ch === '|') && cur !== ch) {
    grid[r][c] = '+'
    return
  }
  grid[r][c] = ch
}

const DOOR_CH: Partial<Record<DoorKind, string>> = {
  curb: 'D',
  apron: 'A',
  gate_apron: 'A',
  gate_bridge: 'B',
  arrivals_in: 'a',
  exit: 'X',
  public: 'd',
  staff: 'd',
  service: 'd',
}

for (const wall of layout.walls) {
  if (wall.dir === 'S') paint(colOfX(wall.x), rowOfY(wall.y + 1), '-')
  else paint(colOfX(wall.x + 1), rowOfY(wall.y), '|')
}
for (const door of layout.doors) {
  const ch = DOOR_CH[door.kind] ?? 'd'
  if (door.dir === 'S') paint(colOfX(door.x), rowOfY(door.y + 1), ch)
  else paint(colOfX(door.x + 1), rowOfY(door.y), ch)
}
for (const port of layout.ports ?? []) {
  const ch = port.kind === 'bag_out' ? 'o' : 'i'
  const e = port.edge
  if (e.dir === 'S') paint(colOfX(e.x), rowOfY(e.y + 1), ch)
  else paint(colOfX(e.x + 1), rowOfY(e.y), ch)
}

const GLYPH: Partial<Record<FittingKind, string>> = {
  checkin_desk: 'C',
  bag_drop: 'b',
  checkin_kiosk: 'k',
  queue_rail: 'q',
  security_lane: 'S',
  bp_podium: 'p',
  gate_desk: 'G',
  seat_row: 'h',
  claim_carousel: 'O',
  passport_booth: 'P',
  shop_counter: 'R',
  wc_block: 'W',
  fids: 'F',
  wayfinding: 'Y',
  bench: 'n',
  belt: '=',
}

function fillFoot(kind: FittingKind): boolean {
  return kind === 'security_lane' || kind === 'queue_rail' || kind === 'claim_carousel' || kind === 'seat_row'
}

for (const belt of layout.belts ?? []) {
  for (const t of belt.tiles) paint(colOfX(t.x), rowOfY(t.y), '=')
}
for (const f of layout.fittings ?? []) {
  const ch = GLYPH[f.kind]
  if (!ch) continue
  if (!fillFoot(f.kind)) {
    paint(colOfX(f.x), rowOfY(f.y), ch)
    continue
  }
  const size = fittingSize(f.kind, f.rot)
  const x1 = f.x + size.w
  const y1 = f.y + size.d
  for (let y = f.y; y < y1; y += STEP) {
    for (let x = f.x; x < x1; x += STEP) paint(colOfX(x), rowOfY(y), ch)
  }
}
const SOCKET_CH: Partial<Record<FittingKind, string>> = {
  security_lane: 's',
  checkin_desk: ':',
  passport_booth: 'P',
  claim_carousel: ':',
  checkin_kiosk: ':',
}
for (const s of layout.sockets ?? []) {
  const ch = SOCKET_CH[s.kind] ?? ':'
  const size = s.kind === 'security_lane' ? fittingSize(s.kind, s.rot) : { w: STEP, d: STEP }
  for (let y = s.y; y < s.y + size.d; y += STEP) {
    for (let x = s.x; x < s.x + size.w; x += STEP) {
      const r = rowOfY(y)
      const c = colOfX(x)
      const cur = grid[r]?.[c]
      if (cur && cur !== ' ' && cur !== '-' && cur !== '|') continue
      paint(c, r, ch)
    }
  }
}

const lines: string[] = []
lines.push('S1 ground floor (the only floor), 88 m x 44 m, 2 m per character')
lines.push('stacked2f waits for WP6')
lines.push('      0    1    2    3    4    5    6    7    8')
for (let r = 0; r < rows; r++) {
  const label = `${r * STEP}m`.padStart(4, ' ')
  lines.push(`${label}  ${grid[r].join('')}`)
}
lines.push('')
lines.push('Rooms')
for (const room of layout.rooms) {
  lines.push(`  ${room.id} ${room.kind} x ${room.x}–${room.x + room.w} y ${room.y}–${room.y + room.h}`)
}
lines.push('Doors')
for (const door of layout.doors) lines.push(`  ${door.kind} x ${door.x} y ${door.y} ${door.dir}`)
lines.push('Fittings')
for (const f of layout.fittings ?? []) lines.push(`  ${f.id} ${f.kind} x ${f.x} y ${f.y} staffed ${f.staffed === true}`)
lines.push('Sockets')
for (const s of layout.sockets ?? []) lines.push(`  ${s.id} ${s.kind} x ${s.x} y ${s.y}`)
lines.push(`tileM ${layout.tileM} stories ${layout.stories} version ${layout.version}`)

const text = `${lines.join('\n')}\n`
const out = 'docs/devlog/media/terminal-rebuild/wp2-layout-dump.txt'
writeFileSync(out, text)
process.stdout.write(text)
console.error(`wrote ${out}`)
