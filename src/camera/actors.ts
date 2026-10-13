import { travelHeading } from './space.ts'
import type { Trackable } from './types.ts'

const PAX_JOBS = new Set(['arrive', 'board'])

const VEHICLE_LABEL: Record<string, string> = {
  fuel: 'Fuel truck',
  bags: 'Bag tug',
  catering: 'Catering truck',
  fire: 'Fire truck',
  police: 'Police',
  deice: 'De-ice truck',
  termbus: 'Terminal bus',
  citycargo: 'Cargo truck',
  contractor: 'Contractor van',
  delivery: 'Delivery truck',
  fuel_truck: 'Fuel truck',
  catering_truck: 'Catering truck',
  baggage_tug: 'Bag tug',
  heavy_baggage_tug: 'Heavy bag tug',
  pushback_tug: 'Pushback tug',
  gpu: 'Ground power',
  pax_bus: 'Passenger bus',
  belt_loader: 'Belt loader',
  uld_loader: 'Container loader',
  main_deck_loader: 'Main-deck loader',
}

export function vehicleLabel(kind: string): string {
  return VEHICLE_LABEL[kind] ?? kind.replace(/_/g, ' ')
}

/** Mesh altitude for a flight, matching the apron aircraft sync. */
export function planeAltitude(z: number): number {
  return 0.04 + Math.max(0, z - 0.1)
}

export interface FieldSnapshot {
  flights: readonly {
    id: string
    flightNo: string
    phase: string
    x: number
    y: number
    z: number
    heading: number
  }[]
  trucks: readonly {
    id: string
    kind: string
    x: number
    y: number
    path: readonly { c: number; r: number }[]
    seg: number
  }[]
  people: readonly {
    id: string
    job: string
    label: string
    x: number
    y: number
    path: readonly { c: number; r: number }[]
    seg: number
  }[]
  service: readonly { id: string; type: string; x: number; y: number; heading: number }[]
  catering: readonly { id: string; x: number; y: number; heading: number }[]
}

/** Narrow view of the sim. The camera module never imports diplomacy. */
export interface FieldSource {
  flights: FieldSnapshot['flights']
  trucks: FieldSnapshot['trucks']
  people: FieldSnapshot['people']
  servicePoses: () => FieldSnapshot['service']
  cateringPoses: () => FieldSnapshot['catering']
}

export function snapshotFrom(game: FieldSource): FieldSnapshot {
  return {
    flights: game.flights,
    trucks: game.trucks,
    people: game.people,
    service: game.servicePoses(),
    catering: game.cateringPoses(),
  }
}

/** Planes, apron vehicles, and walking passengers. Staff and departed jets are left out. */
export function tracksFrom(field: FieldSnapshot): Trackable[] {
  const tracks: Trackable[] = []
  for (const f of field.flights) {
    if (f.phase === 'gone') continue
    tracks.push({
      id: `plane:${f.id}`,
      kind: 'plane',
      label: f.flightNo || 'Aircraft',
      c: f.x,
      r: f.y,
      altitude: planeAltitude(f.z),
      heading: f.heading,
    })
  }
  for (const t of field.trucks) {
    tracks.push({
      id: `truck:${t.id}`,
      kind: 'vehicle',
      label: vehicleLabel(t.kind),
      c: t.x,
      r: t.y,
      altitude: 0,
      heading: travelHeading(t.x, t.y, t.path, t.seg),
    })
  }
  for (const s of field.service) {
    tracks.push({
      id: `service:${s.id}`,
      kind: 'vehicle',
      label: vehicleLabel(s.type),
      c: s.x,
      r: s.y,
      altitude: 0,
      heading: s.heading,
    })
  }
  for (const c of field.catering) {
    tracks.push({
      id: `cater:${c.id}`,
      kind: 'vehicle',
      label: 'Catering truck',
      c: c.x,
      r: c.y,
      altitude: 0,
      heading: c.heading,
    })
  }
  for (const p of field.people) {
    if (!PAX_JOBS.has(p.job)) continue
    tracks.push({
      id: `pax:${p.id}`,
      kind: 'passenger',
      label: p.label ? `Passenger ${p.label}` : 'Passenger',
      c: p.x,
      r: p.y,
      altitude: 0,
      heading: travelHeading(p.x, p.y, p.path, p.seg),
    })
  }
  return tracks
}
