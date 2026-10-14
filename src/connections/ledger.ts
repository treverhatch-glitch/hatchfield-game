import { ALERT_LIMIT, HISTORY_DAYS } from './config.ts'
import type { ConnectionsAlert, ConnectionsDay } from './types.ts'

export type ConnectionsCounter = Exclude<keyof ConnectionsDay, 'day'>

export function emptyDay(day: number): ConnectionsDay {
  return {
    day,
    transfers: 0,
    made: 0,
    missed: 0,
    missedMct: 0,
    screened: 0,
    landsideRecheck: 0,
    transferBags: 0,
    misconnectedBags: 0,
    stranded: 0,
    rebooked: 0,
    overnight: 0,
    voucherAirport: 0,
    voucherAirline: 0,
    layoverShort: 0,
    layoverLong: 0,
  }
}

interface LedgerSave {
  today: ConnectionsDay
  history: ConnectionsDay[]
  alerts: ConnectionsAlert[]
  seq: number
}

/** Today's transfer counters, a short history, and pan-to alerts. */
export class ConnectionsLedger {
  today: ConnectionsDay = emptyDay(0)
  history: ConnectionsDay[] = []
  alerts: ConnectionsAlert[] = []
  private seq = 0

  reset() {
    this.today = emptyDay(0)
    this.history = []
    this.alerts = []
    this.seq = 0
  }

  add(counter: ConnectionsCounter, n = 1) {
    if (!Number.isFinite(n) || n === 0) return
    this.today[counter] += n
  }

  alert(alert: Omit<ConnectionsAlert, 'id' | 'day'>): ConnectionsAlert {
    this.seq += 1
    const full: ConnectionsAlert = { ...alert, id: `conn-${this.seq}`, day: this.today.day }
    // One live alert per kind: the newest replaces the old one.
    this.alerts = [full, ...this.alerts.filter((a) => a.kind !== alert.kind)].slice(0, ALERT_LIMIT)
    return full
  }

  dismiss(id: string) {
    this.alerts = this.alerts.filter((a) => a.id !== id)
  }

  /** Close the day into history and open the next one. */
  closeDay(nextDay: number): ConnectionsDay {
    const done = this.today
    this.history = [...this.history, done].slice(-HISTORY_DAYS)
    this.today = emptyDay(nextDay)
    return done
  }

  /** Totals across the kept history plus today. */
  totals(): ConnectionsDay {
    const sum = emptyDay(this.today.day)
    for (const day of [...this.history, this.today]) {
      for (const key of Object.keys(sum) as (keyof ConnectionsDay)[]) {
        if (key === 'day') continue
        sum[key] += day[key]
      }
    }
    return sum
  }

  save(): LedgerSave {
    return { today: { ...this.today }, history: this.history.map((d) => ({ ...d })), alerts: [...this.alerts], seq: this.seq }
  }

  load(raw: unknown) {
    this.reset()
    if (!raw || typeof raw !== 'object') return
    const s = raw as Partial<LedgerSave>
    if (s.today && typeof s.today === 'object') this.today = { ...emptyDay(0), ...s.today }
    if (Array.isArray(s.history)) this.history = s.history.map((d) => ({ ...emptyDay(0), ...d })).slice(-HISTORY_DAYS)
    if (Array.isArray(s.alerts)) this.alerts = s.alerts.slice(0, ALERT_LIMIT)
    if (Number.isFinite(s.seq)) this.seq = s.seq ?? 0
  }
}
