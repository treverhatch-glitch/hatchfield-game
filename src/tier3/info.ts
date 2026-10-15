import type { Tier3Snapshot } from './types.ts'

function dollars(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0
  return `$${n.toLocaleString('en-US')}`
}

/** Counts stay off the hotspot button. These lines are the click-open submenu. */
export function mroInfoLines(snap: Tier3Snapshot): string[] {
  const mro = snap.mro
  const lines = [
    `${mro.occupied} of ${mro.bays} bays occupied`,
    `${mro.standsTied} stand${mro.standsTied === 1 ? '' : 's'} tied up`,
    `${mro.taxiwaysTied} taxiway${mro.taxiwaysTied === 1 ? '' : 's'} tied up`,
    `Techs ${mro.techsAssigned} / ${mro.techsRequired}`,
    `Power demand ${mro.powerDemand} of ${Math.round(mro.powerCapacity)}`,
    `Heavy-check revenue ${dollars(mro.revenue)}`,
    `Upkeep ${dollars(mro.upkeepPerDay)} / day`,
  ]
  for (const job of mro.jobs) {
    lines.push(`${job.airframeId} in ${job.bayId} · ${job.phase.replaceAll('_', ' ')} · ${Math.ceil(job.remainingMinutes)} min`)
  }
  return lines
}

export function nightHubInfoLines(snap: Tier3Snapshot): string[] {
  const hub = snap.nightHub
  return [
    `${hub.built} night hub${hub.built === 1 ? '' : 's'}`,
    `Storage ${hub.storageTonnes.toFixed(0)} t`,
    `Handling ${hub.handlingTonnes.toFixed(0)} t this wave`,
    `Last wave ${hub.bankTonnes.toFixed(0)} t on ${hub.flights} freighters`,
    `Ground crew ${hub.groundCrewAssigned} / ${hub.groundCrewRequired}`,
    `Night revenue ${dollars(hub.revenue)}`,
    `Noise ${hub.noise.toFixed(0)} · curfew ${hub.curfewRelaxed ? 'open' : 'tight'}`,
    `Upkeep ${dollars(hub.upkeepPerDay)} / day`,
  ]
}

/** Click-open lines for the two cargo late buildings, read from the live night-wave state. */
export function cargoLateInfoLines(id: 'cargo_hub_ii' | 'cold_store', snap: Tier3Snapshot): string[] {
  if (id === 'cargo_hub_ii') {
    const hub = snap.hubII
    return [
      `Crew ${hub.groundCrewAssigned} / ${hub.groundCrewRequired} after the night hub is staffed`,
      `Boost ${Math.round(hub.effect * 100)}% of full: handling, storage and three more freighter slots`,
      `Last wave ${snap.nightHub.bankTonnes.toFixed(0)} t on ${snap.nightHub.flights} freighters`,
    ]
  }
  const cold = snap.coldChain
  return [
    `${cold.rooms} chilled ${cold.rooms === 1 ? 'room' : 'rooms'}`,
    `Night wave pays +${Math.round(cold.premium * 100)}% at full power`,
    `Premium earned ${dollars(cold.revenue)}`,
  ]
}
