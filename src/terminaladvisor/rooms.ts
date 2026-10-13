import type { RoomDef, EquipmentId } from './types.ts';
export const ROOMS: RoomDef[] = [
  { id: 'checkin', label: 'Check-in hall', side: 'before', flow: 'departures', color: '#7eb6e0', needs: ['desk'] },
  { id: 'security', label: 'Security', side: 'before', flow: 'departures', color: '#c45c5c', needs: ['scanner'] },
  { id: 'gates', label: 'Gate lounge', side: 'after', flow: 'departures', color: '#2f5f9a', needs: ['gate_desk', 'seat'] },
  { id: 'lounge', label: 'Premium lounge', side: 'after', flow: 'departures', color: '#8a6fc0', needs: ['seat'] },
  { id: 'shops', label: 'Shops', side: 'either', flow: 'both', color: '#e0c04a', needs: ['shop_unit'] },
  { id: 'food', label: 'Food court', side: 'either', flow: 'both', color: '#e0a04a', needs: ['shop_unit', 'seat'] },
  { id: 'restrooms', label: 'Restrooms', side: 'either', flow: 'both', color: '#3a9a8a', needs: ['toilet'] },
  { id: 'immigration', label: 'Passport control', side: 'after', flow: 'arrivals', color: '#b05a8a', needs: ['passport_booth'] },
  { id: 'bagclaim', label: 'Baggage claim', side: 'before', flow: 'arrivals', color: '#e08a3c', needs: ['carousel'] },
  { id: 'arrivals', label: 'Arrivals hall', side: 'before', flow: 'arrivals', color: '#f0b070', needs: ['sign'] },
  { id: 'baghall', label: 'Baggage hall (staff)', side: 'staff', flow: 'none', color: '#6b6b6b', needs: ['belt'] },
  { id: 'offices', label: 'Offices', side: 'staff', flow: 'none', color: '#8c8c8c', needs: ['desk'] },
  { id: 'staffroom', label: 'Staff room', side: 'staff', flow: 'none', color: '#9a9a9a', needs: ['seat'] },
  { id: 'corridor', label: 'Walkway', side: 'either', flow: 'both', color: '#d0d0d0', needs: [] },
];
export function roomDef(id: string): RoomDef | undefined { return ROOMS.find((r) => r.id === id); }

/** Equipment throughput (pax/hr per unit) used by the "too few desks" checks. */
export const EQUIP_RATE: Partial<Record<EquipmentId, number>> = {
  desk: 60, kiosk: 90, bagdrop: 120, scanner: 150, bodyscanner: 180, passport_booth: 120, carousel: 400, toilet: 40,
};
