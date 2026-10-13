export type AircraftClass = 'small' | 'regional' | 'narrowbody' | 'widebody' | 'jumbo';

export interface Departure {
  flightId: string;
  cls: AircraftClass;
  readyAt: number;
}

export interface Pad {
  id: string;
  maxCls: AircraftClass;
  busyUntil: number;
}

export interface WeatherState {
  tempC: number;
  precip: 'none' | 'snow' | 'freezing_rain';
  visibilityM: number;
}

export interface LedgerEntry {
  kind: string;
  amount: number;
  time: number;
}

export interface DeicingAssignment {
  flightId: string;
  padId: string;
  start: number;
  end: number;
}

export interface ScheduleDeicingResult {
  assignments: DeicingAssignment[];
  waiting: string[];
  glycolUsed: number;
}
