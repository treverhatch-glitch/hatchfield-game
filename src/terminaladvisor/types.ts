// Ground-up terminal builder: pure data model + validator. No DOM/Three/React.
// Player-facing labels follow trunk rule: say "Before/After security", never landside/airside.
export type Side = 'before' | 'after' | 'staff';
export type RoomId =
  | 'checkin' | 'security' | 'gates' | 'lounge' | 'shops' | 'food' | 'restrooms'
  | 'bagclaim' | 'baghall' | 'arrivals' | 'offices' | 'staffroom' | 'corridor' | 'immigration';
export type Flow = 'departures' | 'arrivals' | 'both' | 'none';

export interface Cell {
  floor: boolean;
  room: RoomId | null;
}
/** Wall or door edge. `floor` echoes the level index; omitted means that level (floor 0 when the piece is read alone). */
export interface Edge { x: number; y: number; dir: 'E' | 'S'; floor?: number }
export interface Door extends Edge { kind: 'public' | 'staff' | 'curb' | 'airside' }
export interface Stairs { x: number; y: number; from: number; to: number; kind: 'stairs' | 'escalator' | 'lift' }

export type EquipmentId =
  | 'desk' | 'kiosk' | 'bagdrop' | 'scanner' | 'bodyscanner' | 'belt' | 'carousel'
  | 'seat' | 'sign' | 'gate_desk' | 'jet_bridge' | 'toilet' | 'shop_unit' | 'passport_booth';
/** Furniture. `floor` is the story index. A starter plan only places floor 0. */
export interface Equipment { id: EquipmentId; x: number; y: number; floor: number }

export interface Level { cells: Cell[][]; walls: Edge[]; doors: Door[] }
export interface TerminalPlan {
  w: number; h: number;
  floors: Level[];
  stairs: Stairs[];
  equipment: Equipment[];
}

export interface RoomDef { id: RoomId; label: string; side: Side | 'either'; flow: Flow; color: string; needs: EquipmentId[] }

export interface Hint {
  id: string;
  severity: 'blocker' | 'warning' | 'tip';
  text: string;
  /** Cell to focus the camera on ("Show me"). */
  at?: { x: number; y: number; floor: number };
}

export interface ScheduleLoad { peakDepPaxPerHr: number; peakArrPaxPerHr: number; gatesNeeded: number }
