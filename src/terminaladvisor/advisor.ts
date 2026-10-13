import type { TerminalPlan, Hint, RoomId, ScheduleLoad, EquipmentId } from './types.ts';
import { roomDef, EQUIP_RATE } from './rooms.ts';
import { isBlocked } from './plan.ts';

type Node = { x: number; y: number; f: number };
const key = (n: Node) => `${n.f}:${n.x}:${n.y}`;

function neighbours(p: TerminalPlan, n: Node, allowStaff: boolean, crossSecurity: boolean): Node[] {
  const L = p.floors[n.f]; const out: Node[] = [];
  const steps: [number, number, 'E' | 'S', number, number][] = [[1, 0, 'E', n.x, n.y], [-1, 0, 'E', n.x - 1, n.y], [0, 1, 'S', n.x, n.y], [0, -1, 'S', n.x, n.y - 1]];
  for (const [dx, dy, dir, ex, ey] of steps) {
    const x = n.x + dx, y = n.y + dy;
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
    const c = L.cells[y][x]; if (!c.floor) continue;
    if (isBlocked(L, { x: ex, y: ey, dir })) continue;
    const door = L.doors.find((d) => d.x === ex && d.y === ey && d.dir === dir);
    if (door?.kind === 'staff' && !allowStaff) continue;
    const def = c.room ? roomDef(c.room) : undefined;
    if (!allowStaff && def?.side === 'staff') continue;
    const from = L.cells[n.y][n.x].room;
    // Before -> After transitions are only legal through a security room (unless crossSecurity).
    if (!crossSecurity && def?.side === 'after' && from !== 'security' && sideOf(from) !== 'after') continue;
    out.push({ x, y, f: n.f });
  }
  for (const s of p.stairs) if (s.x === n.x && s.y === n.y) {
    const to = s.from === n.f ? s.to : s.to === n.f ? s.from : -1;
    if (to >= 0 && p.floors[to].cells[n.y][n.x].floor) out.push({ x: n.x, y: n.y, f: to });
  }
  return out;
}
function sideOf(r: RoomId | null): string { return r ? (roomDef(r)?.side ?? 'either') : 'either'; }

function reach(p: TerminalPlan, starts: Node[], allowStaff: boolean, crossSecurity = false): Set<string> {
  const seen = new Set(starts.map(key)); const q = [...starts];
  while (q.length) { const n = q.shift()!; for (const m of neighbours(p, n, allowStaff, crossSecurity)) if (!seen.has(key(m))) { seen.add(key(m)); q.push(m); } }
  return seen;
}
function cellsOf(p: TerminalPlan, room: RoomId): Node[] {
  const out: Node[] = [];
  p.floors.forEach((L, f) => L.cells.forEach((row, y) => row.forEach((c, x) => { if (c.room === room) out.push({ x, y, f }); })));
  return out;
}
function curbCells(p: TerminalPlan): Node[] {
  const out: Node[] = [];
  p.floors.forEach((L, f) => L.doors.filter((d) => d.kind === 'curb').forEach((d) => out.push({ x: d.x, y: d.y, f })));
  return out;
}
const count = (p: TerminalPlan, ids: EquipmentId[]) => p.equipment.filter((e) => ids.includes(e.id)).length;
const at = (n?: Node) => (n ? { x: n.x, y: n.y, floor: n.f } : undefined);

/** Prison Architect / Two Point-style checklist. Pure; call on every edit. */
export function adviseTerminal(p: TerminalPlan, load?: ScheduleLoad): Hint[] {
  const H: Hint[] = [];
  const has = (r: RoomId) => cellsOf(p, r).length > 0;
  const curb = curbCells(p);
  if (!curb.length) H.push({ id: 'no_curb', severity: 'blocker', text: 'No entrance from the curb. Add curb doors so passengers can get in.' });
  for (const r of ['checkin', 'security', 'gates', 'bagclaim', 'restrooms'] as RoomId[])
    if (!has(r)) H.push({ id: `missing_${r}`, severity: r === 'restrooms' ? 'warning' : 'blocker', text: `No ${roomDef(r)!.label.toLowerCase()} yet.` });

  if (curb.length) {
    const pub = reach(p, curb, false);
    // Leak: can someone walk from the curb to gates without passing security?
    const leak = reach(p, curb.filter(() => true), false, true);
    const noSecPath = reachAvoiding(p, curb, 'security');
    const gateCells = cellsOf(p, 'gates');
    const leaked = gateCells.find((g) => noSecPath.has(key(g)));
    if (leaked) H.push({ id: 'security_bypass', severity: 'blocker', text: 'Passengers can reach the gates without going through security.', at: at(leaked) });
    if (gateCells.length && !gateCells.some((g) => pub.has(key(g)))) H.push({ id: 'gates_unreachable', severity: 'blocker', text: 'Gates cannot be reached from the entrance through security.', at: at(gateCells[0]) });
    const claim = cellsOf(p, 'bagclaim');
    if (claim.length && !claim.some((c) => leak.has(key(c)))) H.push({ id: 'claim_unreachable', severity: 'blocker', text: 'Baggage claim has no route to the exit.', at: at(claim[0]) });
    // Dead ends: painted public rooms the public cannot reach at all.
    p.floors.forEach((L, f) => L.cells.forEach((row, y) => row.forEach((c, x) => {
      if (c.room && roomDef(c.room)?.side !== 'staff' && !leak.has(key({ x, y, f })) && !H.some((h) => h.id === `dead_${c.room}`))
        H.push({ id: `dead_${c.room}`, severity: 'warning', text: `${roomDef(c.room)!.label} is sealed off (dead end). Add a door.`, at: { x, y, floor: f } });
    })));
  }
  // Rooms without their key equipment.
  for (const r of ['checkin', 'security', 'gates', 'bagclaim', 'restrooms', 'baghall'] as RoomId[]) {
    if (!has(r)) continue;
    const def = roomDef(r)!;
    const cells = new Set(cellsOf(p, r).map(key));
    for (const need of def.needs) if (!p.equipment.some((e) => e.id === need && cells.has(key({ x: e.x, y: e.y, f: e.floor }))))
      H.push({ id: `equip_${r}_${need}`, severity: 'warning', text: `${def.label} has no ${need.replace('_', ' ')}.` });
  }
  if (has('gates') && !has('baghall')) H.push({ id: 'no_baghall', severity: 'warning', text: 'No baggage hall: checked bags have nowhere to be sorted.' });
  if (count(p, ['jet_bridge']) === 0 && has('gates')) H.push({ id: 'no_bridges', severity: 'tip', text: 'No jet bridges: gates will use stairs and buses.' });

  if (load) {
    const rate = (ids: EquipmentId[]) => p.equipment.filter((e) => ids.includes(e.id)).reduce((s, e) => s + (EQUIP_RATE[e.id] ?? 0), 0);
    const ci = rate(['desk', 'kiosk', 'bagdrop']);
    if (ci < load.peakDepPaxPerHr) H.push({ id: 'checkin_short', severity: 'warning', text: `Check-in handles ${ci} pax/hr, but the peak hour needs ${load.peakDepPaxPerHr}. Add about ${Math.ceil((load.peakDepPaxPerHr - ci) / 60)} desks.` });
    const sec = rate(['scanner', 'bodyscanner']);
    if (sec < load.peakDepPaxPerHr) H.push({ id: 'security_short', severity: 'warning', text: `Security handles ${sec} pax/hr; peak needs ${load.peakDepPaxPerHr}.` });
    const car = rate(['carousel']);
    if (car < load.peakArrPaxPerHr) H.push({ id: 'claim_short', severity: 'warning', text: `Bag claim handles ${car} pax/hr; peak arrivals need ${load.peakArrPaxPerHr}.` });
    const gd = count(p, ['gate_desk']);
    if (gd < load.gatesNeeded) H.push({ id: 'gates_short', severity: 'warning', text: `${gd} gates built, schedule needs ${load.gatesNeeded}.` });
    const wc = rate(['toilet']);
    if (wc < (load.peakDepPaxPerHr + load.peakArrPaxPerHr) * 0.25) H.push({ id: 'restrooms_short', severity: 'tip', text: 'Restrooms will have queues at peak.' });
  }
  const order = { blocker: 0, warning: 1, tip: 2 } as const;
  return H.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Reach from starts treating the given room as solid (for bypass detection). */
function reachAvoiding(p: TerminalPlan, starts: Node[], avoid: RoomId): Set<string> {
  const ok = (n: Node) => p.floors[n.f].cells[n.y][n.x].room !== avoid;
  const s0 = starts.filter(ok); const seen = new Set(s0.map(key)); const q = [...s0];
  while (q.length) { const n = q.shift()!; for (const m of neighbours(p, n, false, true)) if (ok(m) && !seen.has(key(m))) { seen.add(key(m)); q.push(m); } }
  return seen;
}
