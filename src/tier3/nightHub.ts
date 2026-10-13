import { airframeCargoProfile, CARGO_PRODUCTS, starterCargoTerminal } from '../cargo/catalog.ts'
import { CargoSim } from '../cargo/engine.ts'
import type { CargoTerminalConfig, HandlingUnitKind } from '../cargo/types.ts'
import {
  NIGHT_BANK_SLOTS,
  NIGHT_HANDLING_TONNES,
  NIGHT_HUB_STORAGE_SCALE,
  NIGHT_PREMIUM,
  NOISE_PER_TONNE,
  type NightSlotDef,
} from './config.ts'
import { finiteNumber } from './mro.ts'

export interface PlannedSlot {
  id: string
  airframeId: string
  tonnes: number
}

/**
 * Fill the wave in slot order. Storage and ground-handling both cap the
 * tonnes. A later jumbo slot is dropped when the earlier freighters ate the room.
 */
export function planNightBank(
  slots: readonly NightSlotDef[],
  storageTonnes: number,
  handlingTonnes: number,
): PlannedSlot[] {
  let room = Math.max(0, finiteNumber(Math.min(storageTonnes, handlingTonnes)))
  const planned: PlannedSlot[] = []
  for (const slot of slots) {
    if (room <= 1e-6) break
    const profile = airframeCargoProfile(slot.airframeId)
    const tonnes = Math.min(finiteNumber(slot.tonnes), finiteNumber(profile.capacityTonnes), room)
    if (tonnes <= 1e-6) continue
    planned.push({ id: slot.id, airframeId: slot.airframeId, tonnes })
    room -= tonnes
  }
  return planned
}

/** Starter cargo terminal, grown for a mid/late freighter wave. */
export function nightHubTerminal(): CargoTerminalConfig {
  const base = starterCargoTerminal()
  return {
    facilities: base.facilities.map((facility) => ({
      ...facility,
      inputCapacityTonnes: facility.inputCapacityTonnes * NIGHT_HUB_STORAGE_SCALE,
      outputCapacityTonnes: facility.outputCapacityTonnes * NIGHT_HUB_STORAGE_SCALE,
    })),
    trucks: { ...base.trucks },
    revenueShare: { ...base.revenueShare },
    advisorSampleMinutes: base.advisorSampleMinutes,
  }
}

export function nightHubStorageTonnes(): number {
  const warehouse = nightHubTerminal().facilities.find((facility) => facility.id === 'warehouse')
  return warehouse?.inputCapacityTonnes ?? 0
}

export interface NightBankResult {
  shippedTonnes: number
  flights: number
  /** Airport share from the cargo slice, before the player-cash rounding. */
  airportRevenue: number
  cash: number
  noise: number
}

function unitFor(supported: readonly HandlingUnitKind[]): HandlingUnitKind {
  if (supported.includes('loose')) return 'loose'
  return supported[0] ?? 'loose'
}

/**
 * Stage the wave on the cargo ready rack and depart it. Revenue, share, and
 * unit fit all come from the cargo slice — this does not invent a tariff.
 */
export function runNightBank(
  hubId: string,
  nightIndex: number,
  slots: readonly PlannedSlot[],
  terminal: CargoTerminalConfig = nightHubTerminal(),
): NightBankResult {
  const sim = new CargoSim(terminal)
  const rate = CARGO_PRODUCTS.express.revenuePerTonne * NIGHT_PREMIUM
  const share = terminal.revenueShare.airport
  let shippedTonnes = 0
  let airportRevenue = 0
  let flights = 0
  for (const slot of slots) {
    const profile = airframeCargoProfile(slot.airframeId)
    const tonnes = finiteNumber(slot.tonnes)
    if (tonnes <= 0) continue
    const contractId = `${hubId}-n${nightIndex}-${slot.id}`
    sim.seedLegacyReadyCargo({
      id: contractId,
      kind: 'express',
      tonnes,
      deadline: sim.time + 24 * 60,
      revenuePerTonne: rate,
      unitKind: unitFor(profile.supportedUnits),
      allowedModes: ['freighter'],
    })
    const flightId = `${contractId}-flt`
    const load = sim.planFlight({
      id: flightId,
      airframeId: slot.airframeId,
      mode: 'freighter',
      capacityTonnes: profile.capacityTonnes,
      supportedUnits: profile.supportedUnits,
      mainDeckLoaderAvailable: true,
    })
    if (load.tonnes <= 0) {
      sim.cancelFlight(flightId)
      continue
    }
    sim.confirmFlightDeparted(flightId)
    shippedTonnes += load.tonnes
    airportRevenue += load.tonnes * rate * share
    flights += 1
  }
  shippedTonnes = finiteNumber(shippedTonnes)
  airportRevenue = finiteNumber(airportRevenue)
  const cash = Math.round(airportRevenue)
  return {
    shippedTonnes,
    flights,
    airportRevenue,
    cash: Number.isFinite(cash) ? cash : 0,
    noise: finiteNumber(shippedTonnes * NOISE_PER_TONNE),
  }
}

export function nightHandlingTonnes(staffThroughput: number, powerThroughput: number): number {
  const staff = Math.max(0, finiteNumber(staffThroughput))
  const power = Math.max(0, finiteNumber(powerThroughput))
  return NIGHT_HANDLING_TONNES * staff * power
}

export function defaultNightSlots(): readonly NightSlotDef[] {
  return NIGHT_BANK_SLOTS
}
