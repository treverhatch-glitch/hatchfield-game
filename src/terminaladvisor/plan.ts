// Minimal reference layout model for the advisor. The real build tools land in #35
// (claude/terminal-build-kit); wire adviseTerminal to that model via an adapter.
import type { TerminalPlan, Level, RoomId, Edge } from './types.ts';
export function blankPlan(w: number, h: number, floors = 1): TerminalPlan {
  const lvl = (): Level => ({ cells: Array.from({ length: h }, () => Array.from({ length: w }, () => ({ floor: false, room: null }))), walls: [], doors: [] });
  return { w, h, floors: Array.from({ length: floors }, lvl), stairs: [], equipment: [] };
}
export function paintFloor(p: TerminalPlan, f: number, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p.floors[f].cells[y][x].floor = true;
}
export function paintRoom(p: TerminalPlan, f: number, x0: number, y0: number, x1: number, y1: number, room: RoomId): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = p.floors[f].cells[y][x];
    c.floor = true; c.room = room;
  }
}
const same = (a: Edge, b: Edge) => a.x === b.x && a.y === b.y && a.dir === b.dir;
export function isBlocked(lvl: Level, e: Edge): boolean {
  return lvl.walls.some((w) => same(w, e)) && !lvl.doors.some((d) => same(d, e));
}
/** Auto-walls: put a wall on every edge between different rooms or floor/void. */
export function autoWalls(p: TerminalPlan, f: number): void {
  const L = p.floors[f]; L.walls = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = L.cells[y][x]; if (!c.floor) continue;
    const e = x + 1 < p.w ? L.cells[y][x + 1] : null;
    const s = y + 1 < p.h ? L.cells[y + 1][x] : null;
    if (e && e.floor && e.room !== c.room && c.room !== 'corridor' && e.room !== 'corridor') L.walls.push({ x, y, dir: 'E' });
    if (s && s.floor && s.room !== c.room && c.room !== 'corridor' && s.room !== 'corridor') L.walls.push({ x, y, dir: 'S' });
  }
}
