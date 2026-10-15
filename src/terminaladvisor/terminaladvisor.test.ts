import { describe, it, expect } from 'vitest';
import { blankPlan, paintRoom, autoWalls, adviseTerminal, roomDef, EQUIP_PLATE, type TerminalPlan } from './index.ts';

// Layout (one floor, 10x4): row 0 curb-side. checkin | security | gates, claim + restrooms + baghall.
function good(): TerminalPlan {
  const p = blankPlan(10, 4);
  paintRoom(p, 0, 0, 0, 2, 1, 'checkin');
  paintRoom(p, 0, 3, 0, 3, 1, 'security');
  paintRoom(p, 0, 4, 0, 9, 1, 'gates');
  paintRoom(p, 0, 0, 2, 2, 3, 'bagclaim');
  paintRoom(p, 0, 3, 2, 3, 3, 'restrooms');
  paintRoom(p, 0, 4, 2, 9, 3, 'baghall');
  autoWalls(p, 0);
  const L = p.floors[0];
  L.doors.push({ x: 0, y: 1, dir: 'S', kind: 'curb' }); // curb door between check-in and claim
  L.doors.push({ x: 2, y: 0, dir: 'E', kind: 'public' }); // checkin -> security
  L.doors.push({ x: 3, y: 0, dir: 'E', kind: 'public' }); // security -> gates
  L.doors.push({ x: 2, y: 2, dir: 'E', kind: 'public' }); // claim -> restrooms
  L.doors.push({ x: 4, y: 1, dir: 'S', kind: 'staff' }); // gates -> baghall (staff)
  p.equipment.push(
    ...[0, 1, 2].map((x) => ({ id: 'desk' as const, x, y: 0, floor: 0 })),
    { id: 'scanner', x: 3, y: 0, floor: 0 }, { id: 'scanner', x: 3, y: 1, floor: 0 },
    { id: 'gate_desk', x: 5, y: 0, floor: 0 }, { id: 'gate_desk', x: 8, y: 0, floor: 0 }, { id: 'seat', x: 6, y: 1, floor: 0 },
    { id: 'jet_bridge', x: 5, y: 0, floor: 0 },
    { id: 'carousel', x: 1, y: 3, floor: 0 }, { id: 'toilet', x: 3, y: 3, floor: 0 }, { id: 'toilet', x: 3, y: 2, floor: 0 },
    { id: 'belt', x: 6, y: 3, floor: 0 },
  );
  return p;
}
const ids = (p: TerminalPlan, load?: Parameters<typeof adviseTerminal>[1]) => adviseTerminal(p, load).map((h) => h.id);

describe('terminal advisor', () => {
  it('pins the immigration and claim plates to the concept art', () => {
    expect(roomDef('immigration')?.plate).toBe('passport_control')
    expect(roomDef('bagclaim')?.plate).toBe('baggage_claim')
    expect(EQUIP_PLATE.passport_booth).toBe('passport_control')
    expect(EQUIP_PLATE.carousel).toBe('baggage_claim')
    expect(EQUIP_PLATE.bagdrop).toBe('bag_drop_kiosk')
  })

  it('a sound layout has no blockers or warnings', () => {
    expect(adviseTerminal(good()).filter((h) => h.severity !== 'tip')).toEqual([]);
  });
  it('empty plan lists the basics', () => {
    const r = ids(blankPlan(4, 4));
    expect(r).toContain('no_curb');
    expect(r).toContain('missing_security');
    expect(r).toContain('missing_bagclaim');
  });
  it('detects a security bypass', () => {
    const p = good();
    p.floors[0].doors.push({ x: 2, y: 1, dir: 'E', kind: 'public' }); // still into security - fine
    p.floors[0].walls = p.floors[0].walls.filter((w) => !(w.x === 3 && w.y === 1 && w.dir === 'S'));
    paintRoom(p, 0, 3, 2, 3, 2, 'corridor'); // corridor links claim side to gates side
    p.floors[0].doors.push({ x: 2, y: 2, dir: 'E', kind: 'public' });
    p.floors[0].doors.push({ x: 3, y: 2, dir: 'E', kind: 'public' });
    paintRoom(p, 0, 4, 2, 4, 2, 'gates');
    expect(ids(p)).toContain('security_bypass');
  });
  it('detects unreachable gates (no door out of security)', () => {
    const p = good();
    p.floors[0].doors = p.floors[0].doors.filter((d) => !(d.x === 3 && d.y === 0));
    expect(ids(p)).toContain('gates_unreachable');
  });
  it('flags sealed rooms as dead ends', () => {
    const p = good();
    p.floors[0].doors = p.floors[0].doors.filter((d) => !(d.x === 2 && d.y === 2));
    expect(ids(p)).toContain('dead_restrooms');
  });
  it('staff rooms are not public dead ends', () => {
    expect(ids(good())).not.toContain('dead_baghall');
  });
  it('missing restrooms is a warning', () => {
    const p = good();
    paintRoom(p, 0, 3, 2, 3, 3, 'bagclaim');
    const h = adviseTerminal(p).find((x) => x.id === 'missing_restrooms');
    expect(h?.severity).toBe('warning');
  });
  it('capacity checks against the schedule', () => {
    const r = ids(good(), { peakDepPaxPerHr: 600, peakArrPaxPerHr: 300, gatesNeeded: 4 });
    expect(r).toContain('checkin_short');
    expect(r).toContain('security_short');
    expect(r).toContain('gates_short');
    expect(r).not.toContain('claim_short');
  });
  it('multi-floor: stairs connect floors', () => {
    const p = blankPlan(3, 1, 2);
    paintRoom(p, 0, 0, 0, 2, 0, 'checkin');
    paintRoom(p, 1, 0, 0, 2, 0, 'restrooms');
    p.floors[0].doors.push({ x: 0, y: 0, dir: 'E', kind: 'curb' });
    expect(ids(p)).toContain('dead_restrooms');
    p.stairs.push({ x: 2, y: 0, from: 0, to: 1, kind: 'escalator' });
    expect(ids(p)).not.toContain('dead_restrooms');
  });
});
