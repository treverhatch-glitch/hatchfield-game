/**
 * Adapter: registers logistics (PR #5, src/logistics) entities as flow nodes.
 * Structural types only, so this compiles without importing src/logistics.
 * Logistics stays the authority for vehicle dispatch; it reports deliveries via
 * graph.inject / graph.withdraw and the flow layer measures them.
 */
import { FlowGraph } from '../graph.ts';
import { vehicleLinkCapacity } from '../types.ts';
import type { Vec2 } from '../types.ts';

export interface LogisticsLayout {
  fuelFarm?: { id: string; capacityL: number; pumpLPerMin: number; staff?: number; staffRequired?: number; position?: Vec2 };
  tankerSupplyLPerMin?: number;
  kitchen?: { id: string; storeCapacity: number; mealsPerSupply: number; supplyPerMin: number; staff?: number; staffRequired?: number; position?: Vec2 };
  supplierPerMin?: number;
  stands: { id: string; hydrant?: boolean; distance: number; position?: Vec2 }[];
  fuelTrucks?: { count: number; payloadL: number; speedPerMin: number; serviceMin: number };
  cateringTrucks?: { count: number; payloadMeals: number; speedPerMin: number; serviceMin: number };
  hydrantLPerMin?: number;
}

export function registerLogistics(g: FlowGraph, layout: LogisticsLayout): void {
  const ff = layout.fuelFarm;
  if (ff) {
    g.addNode({ id: 'fuel:tanker', kind: 'source', chain: 'fuel', accepts: {}, ratePerMin: 0, generates: { fuel: layout.tankerSupplyLPerMin ?? 0 }, outCapacity: (layout.tankerSupplyLPerMin ?? 0) * 2 + 1 });
    g.addNode({ id: ff.id, kind: 'fuelFarm', label: 'Fuel Farm', chain: 'fuel', position: ff.position, accepts: { fuel: ff.capacityL }, ratePerMin: ff.pumpLPerMin, staffRequired: ff.staffRequired, staffAssigned: ff.staff, targetWaitMin: 1e9 });
    g.addLink({ from: 'fuel:tanker', to: ff.id, unit: 'fuel', capacityPerMin: (layout.tankerSupplyLPerMin ?? 0) * 2 + 1, mode: 'vehicle' });
  }
  const k = layout.kitchen;
  if (k) {
    g.addNode({ id: 'catering:supplier', kind: 'source', chain: 'catering', accepts: {}, ratePerMin: 0, generates: { supply: layout.supplierPerMin ?? 0 }, outCapacity: (layout.supplierPerMin ?? 0) * 2 + 1 });
    g.addNode({ id: k.id, kind: 'kitchen', label: 'Catering Kitchen', chain: 'catering', position: k.position, accepts: { supply: k.storeCapacity }, ratePerMin: k.supplyPerMin, recipes: [{ input: 'supply', output: 'meal', ratio: k.mealsPerSupply }], staffRequired: k.staffRequired, staffAssigned: k.staff, targetWaitMin: 1e9 });
    g.addLink({ from: 'catering:supplier', to: k.id, unit: 'supply', capacityPerMin: (layout.supplierPerMin ?? 0) * 2 + 1, mode: 'vehicle' });
  }
  for (const s of layout.stands) {
    const sid = `stand:${s.id}`;
    if (!g.nodes.has(sid)) {
      g.addNode({ id: sid, kind: 'stand', chain: 'ground', position: s.position, accepts: { fuel: 1e9, meal: 1e9 }, ratePerMin: 1e9, sink: true });
    }
    if (ff) {
      if (s.hydrant) {
        g.addLink({ from: ff.id, to: sid, unit: 'fuel', capacityPerMin: layout.hydrantLPerMin ?? 1000, mode: 'pipe', distance: s.distance });
      } else if (layout.fuelTrucks) {
        const t = layout.fuelTrucks;
        g.addLink({ from: ff.id, to: sid, unit: 'fuel', mode: 'vehicle', distance: s.distance, travelTimeMin: s.distance / t.speedPerMin, capacityPerMin: vehicleLinkCapacity(t.count, t.payloadL, s.distance, t.speedPerMin, t.serviceMin) / layout.stands.length });
      }
    }
    if (k && layout.cateringTrucks) {
      const t = layout.cateringTrucks;
      g.addLink({ from: k.id, to: sid, unit: 'meal', mode: 'vehicle', distance: s.distance, travelTimeMin: s.distance / t.speedPerMin, capacityPerMin: vehicleLinkCapacity(t.count, t.payloadMeals, s.distance, t.speedPerMin, t.serviceMin) / layout.stands.length });
    }
  }
}
