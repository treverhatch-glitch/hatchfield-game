import type { TechNode } from './types.ts';
// Late-tree branches (tiers 3-5). Earlier tiers live in the economy engine (#11).
export const LATE_TECH: TechNode[] = [
  { id: 'con_apm', branch: 'Connectivity', name: 'Automated people mover', tier: 3, rp: 14, unlockFL: 7, requires: [], effect: 'Build people movers' },
  { id: 'con_apm2', branch: 'Connectivity', name: 'Driverless headways', tier: 4, rp: 20, unlockFL: 9, requires: ['con_apm'], effect: 'APM capacity +50%' },
  { id: 'hub_mct', branch: 'Hub', name: 'Minimum connection time', tier: 3, rp: 12, unlockFL: 7, requires: [], effect: 'Connecting pax and transfer centre' },
  { id: 'hub_banks', branch: 'Hub', name: 'Wave/bank scheduling', tier: 4, rp: 18, unlockFL: 8, requires: ['hub_mct'], effect: 'Timetable auto-builds connection banks' },
  { id: 'hub_alliance', branch: 'Hub', name: 'Alliance hub status', tier: 5, rp: 30, unlockFL: 10, requires: ['hub_banks'], effect: 'Alliance lounges, +transfer demand' },
  { id: 'bag_rfid', branch: 'Baggage', name: 'RFID tracking', tier: 4, rp: 16, unlockFL: 9, requires: ['hub_mct'], effect: 'Transfer bag line, mishandled -60%' },
  { id: 'com_lcc', branch: 'Commercial', name: 'Low-cost terminal model', tier: 3, rp: 10, unlockFL: 6, requires: [], effect: 'LCC fit-out' },
  { id: 'com_premium', branch: 'Commercial', name: 'Premium terminal model', tier: 4, rp: 18, unlockFL: 8, requires: [], effect: 'Premium fit-out' },
  { id: 'std_codef', branch: 'Stands', name: 'Code F operations', tier: 4, rp: 16, unlockFL: 8, requires: [], effect: 'A380 stands' },
  { id: 'std_mars', branch: 'Stands', name: 'MARS stands', tier: 5, rp: 22, unlockFL: 10, requires: ['std_codef'], effect: 'Swing stands' },
  { id: 'crg_integrator', branch: 'Cargo', name: 'Integrator hub', tier: 4, rp: 18, unlockFL: 8, requires: [], effect: 'Express cargo hub' },
  { id: 'crg_cold', branch: 'Cargo', name: 'Cold chain', tier: 4, rp: 14, unlockFL: 9, requires: ['crg_integrator'], effect: 'Pharma cargo' },
  { id: 'mx_heavy', branch: 'Maintenance', name: 'Heavy checks', tier: 4, rp: 20, unlockFL: 9, requires: [], effect: 'MRO hangar' },
  { id: 'gt_rail', branch: 'Ground transport', name: 'Rail link', tier: 4, rp: 20, unlockFL: 9, requires: [], effect: 'Rail station' },
  { id: 'atc_asmgcs', branch: 'ATC', name: 'A-SMGCS', tier: 4, rp: 18, unlockFL: 8, requires: [], effect: 'Tower III' },
  { id: 'atc_indep', branch: 'ATC', name: 'Independent parallel ops', tier: 5, rp: 26, unlockFL: 9, requires: ['atc_asmgcs'], effect: 'Third runway' },
  { id: 'fuel_hydrant', branch: 'Fuel', name: 'Hydrant network', tier: 3, rp: 12, unlockFL: 7, requires: [], effect: 'Hydrant fuel' },
  { id: 'grn_saf', branch: 'Sustainability', name: 'SAF blending', tier: 4, rp: 16, unlockFL: 8, requires: [], effect: 'SAF facility' },
  { id: 'grn_netzero', branch: 'Sustainability', name: 'Net-zero ground ops', tier: 5, rp: 28, unlockFL: 10, requires: ['grn_saf'], effect: 'Green badge goal' },
  { id: 'mil_contracts', branch: 'Military', name: 'Military host agreements', tier: 3, rp: 14, unlockFL: 7, requires: [], effect: 'Military apron and contracts' },
];

export function canResearch(id: string, done: ReadonlySet<string>, fl: number, rpAvail: number): boolean {
  const n = LATE_TECH.find((t) => t.id === id);
  if (!n || done.has(id)) return false;
  return fl >= n.unlockFL && rpAvail >= n.rp && n.requires.every((r) => done.has(r));
}

export function totalLateRP(): number {
  return LATE_TECH.reduce((s, t) => s + t.rp, 0);
}
