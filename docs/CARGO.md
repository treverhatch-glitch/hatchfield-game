# Cargo slice

Status: self-contained replacement for the trunk `cargoWarehouse` / cargo-volume shed simulation. It lives in `src/cargo/` and does not import `sim.ts`, `src/logistics`, `src/flow`, UI, or rendering code. The terminal owner should remove the parallel trunk authority when wiring this module.

## Player model

The two chains are intentionally Manor Lords-like:

- export: `landside truck → acceptance → customs → screening → warehouse → [cold store] → ULD build-up → ready rack → aircraft`;
- import: `aircraft → airside dock → ULD break-down → screening → customs release → warehouse → [cold store] → collection dock → landside truck`.

Every processing facility has:

- an input buffer in tonnes;
- an output-buffer limit;
- a base tonnes/minute rate;
- required and assigned staff;
- effective rate = base rate × `min(assigned / required, 1)`.

A full downstream buffer blocks the upstream facility. Missing staff reduces throughput to zero rather than silently deleting freight. The final ready rack is passive storage; build-up staff place completed units there. `snapshot()` exposes queue, staffing, utilization, processed tonnes, and blocked minutes per facility.

The starter has one shared fleet of four 20 t landside trucks, staggered across export contracts and import collections, 120 t warehouses, 30 t cold stores, and an 80 t airside ready rack. Truck status is visible as `inbound`, `queued`, `unloading`, `loading`, or `departed`. Perishables alone route through staffed cold storage; ambient cargo bypasses it.

## Units and aircraft

Cargo stays aggregated for performance, but every contract has a physical handling-unit type and flight plans return both tonnes and unit count.

| Unit | Game payload | Structural source |
|---|---:|---|
| LD-3 / AKE | 1.506 t payload (1.588 t gross − 0.082 t tare) | Boeing ULD guide |
| PMC / P6P | 4.5 t typical playable payload; 6.8 t maximum gross, 0.12 t tare | DSV / Boeing |
| Loose pallet | 1 t | Game abstraction |
| Oversize piece | 20 t | AN-124 internal-crane single-lift figure |

PMC and oversize pieces are main-deck-only in the game. Their flight plan requests a main-deck loader when one is available. The logistics branch remains authoritative: it already models `main_deck_loader`, `uld_loader`, `heavy_baggage_tug`, and the slower standard-ULD-loader compatibility fallback for a 747-8F/AN-124.

Default profiles:

- ordinary passenger aircraft: 12 t belly allocation, AKE or loose freight;
- 757-200F: 32 t;
- 767-300F: 52.7 t;
- 747-8F: 133.9 t;
- AN-124-100: 120 t and oversize capability.

Route payload and belly allocation vary in reality, so `prepareFlight` accepts overrides. On belly flights, effective cargo capacity is `min(commercial cargo allocation, physical hold − baggage tonnes)`. Pass `holdCapacityTonnes` and `baggageTonnes`; `estimateBaggageTonnes(bagUnits)` provides an 18 kg/bag planning default. Freighter capacity is unaffected.

## Contracts and economics

Contracts keep their identity through all buffers. Earliest deadlines load first.

| Product | Default gross revenue/t | Deadline suggestion | Penalty/t | Flight rule |
|---|---:|---:|---:|---|
| General | $2,470 | 18 h | $900 | Belly or freighter |
| Express | $3,350 | 6 h | $2,100 | Belly or freighter |
| Perishables | $3,100 | 10 h | $2,600 | Belly or freighter |
| Oversize | $5,500 | 24 h | $3,500 | Freighter; heavy loader preferred |

The $2,470/t general baseline is the 2025 worldwide air-cargo average of $2.47/kg. Express uses roughly a 35% premium, inside the cited 20–40% range. Perishable, oversize, deadline, and penalty values are gameplay balancing assumptions, not tariffs.

`confirmFlightDeparted` posts revenue. Cargo and its loader committed to a turnaround before cutoff remain reserved through departure, so a late ground turn cannot desynchronize the cargo and logistics manifests. Otherwise, missing a deadline posts the penalty on every unshipped tonne exactly once, cancels unarrived trucks, and returns freight to the shipper. `cancelFlight` returns a reservation to the ready rack; if it is already late, the next tick expires it normally.

The rates above are gross shipper rates. `CargoTerminalConfig.revenueShare` defaults to **10% airport / 90% handler** and must total 1. Departure emits separate `cargo_airport_revenue` and `cargo_handler_revenue` ledger entries while retaining gross revenue on the contract and snapshot. Only the airport share enters player cash.

## Terminal integration

```ts
import { createCargoAdapter } from '../cargo'

const cargo = createCargoAdapter({
  postMoney: (posting) => bank.post(posting),
  addHandlerMoney: (amount, contractId) => {
    // Separate handler ledger; do not add this to airport cash.
  },
  onBottlenecks: (items) => {
    // Translate items into src/game/advisor Advice cards.
  },
  onFlow: (stage, direction, tonnes) => {
    // Feed an external-boundary telemetry bridge when src/flow provides one.
  },
  loaderReservations: {
    reserve: ({ flightId, preferred, allowUldFallback }) => {
      // Reserve this exact logistics vehicle until cancel/departure.
      return logisticsLoaderBridge.reserve(flightId, preferred, allowUldFallback)
    },
    release: (reservationId) => logisticsLoaderBridge.release(reservationId),
  },
})

cargo.tick(dtGameMinutes)
```

Do not tick with wall-clock seconds. Logistics and cargo both use game minutes.

Every `CargoEvent`, including money, truck/contract/import status, flow and bottleneck events, carries `time` in absolute sim minutes. This lets audio, replay, reports and the bank order cargo beside logistics events without translating timestamps.

### Money bus (planned `src/core/bank.ts`, PR #11)

`CargoHost.postMoney` is the preferred integration. Its `{ time, amount, category, referenceId }` shape is intentionally structural so the terminal agent can forward it to `bank.post()` without cargo importing core. `addMoney` remains a temporary compatibility callback while the bank is absent from this base branch. Handler revenue uses `addHandlerMoney`; it is reported but must not increase airport cash.

### Logistics handoff

When a flight parks:

```ts
const plan = cargo.prepareFlight(flight.id, flight.airframeId, {
  holdCapacityTonnes: flight.cargoHoldTonnes,
  baggageTonnes: estimateBaggageTonnes(flight.bagUnits ?? 0),
})

logistics.onAircraftParked(standId, flight.airframeId, scheduledMinutes, {
  kind: flight.cargo ? 'turn' : 'inbound',
  outboundCargoKg: plan.tonnes * 1000,
  inboundCargoKg: inboundManifestKg,
})
```

- Call `cargo.flightDeparted(flight.id)` only after logistics says the turnaround is ready and the aircraft actually departs.
- Call `cargo.cancelFlight(flight.id)` for cancellation, stand failure, or despawn.
- Wire every `LogisticsHost.onCargoToArea(standId, kg)` tug delivery to `cargo.cargoUnloadedFromAircraft(standId, kg, manifest)`. Reuse one `manifest.shipmentId` for every delivery from the same aircraft and set `complete: true` on the last. Chunks aggregate into one import shipment, wait outside a full airside dock, then run to a collecting landside truck.
- Pass `plan.loaderReservationId` through the terminal's logistics bridge. `CargoLoaderReservationPort` must reserve the same real `main_deck_loader`/`uld_loader` vehicle logistics dispatch will use. Cargo holds that reservation through turnaround and releases it on cancellation or departure. If no compatible loader can be reserved, `prepareFlight` returns zero tonnes plus a rejection reason.
- Logistics' slower standard-ULD-loader fallback is preserved: a reservation provider may return `uld_loader` when `allowUldFallback` is true.

### Flow handoff

The flow branch is structural and pure TS. Register this chain after constructing its `FlowGraph`:

```ts
registerCargoFlow(flowGraph, cargoConfig)
```

`CargoFlowRegistrar` deliberately matches only `addNode` and `addLink`; cargo does not import `src/flow`. Cargo remains authoritative for contract-labelled inventory.

The current `grok/flow` branch has autonomous `inject`/`withdraw` processing but no external-boundary telemetry method. Do **not** replay `onFlow` into that autonomous graph while ticking it; that would create a second cargo simulation. The terminal integration should add a small flow adapter that records these boundary events as metrics without moving inventory, then pass those events to it. Until that method exists, use `CargoSim.detectBottlenecks()` for cargo advisor/info data and use `registerCargoFlow` only for topology. Departure emits `ready/out`, so the eventual bridge will measure aircraft throughput.

Flow IDs are stable and include both directions:

- export nodes run from `cargo:landside` through `cargo:ready` to `cargo:flight`;
- import nodes run from `cargo:flight_arrival` through `cargo:import_*` to `cargo:landside_import`;
- cold-store branches are `cargo:cold_storage` and `cargo:import_cold_storage`;
- links: `cargo:<from>><to>`.

The cargo info view can therefore use the flow branch's standard `infoView('cargo')`, `audit()`, and route tracing without special cargo UI types.

## Replacing the trunk cargo shed

PR #10 is the new cargo authority, not an optional second warehouse. Terminal migration order:

1. Construct one `CargoAdapter` and tick it in **sim minutes** from the shared clock.
2. Replace `Game.cargoWarehouse`, `cargoWarehouseFill()`, `tickCityCargo()`, `finishCityCargo()`, `creditCargoVolume()`, `considerCargoVolume()` and `tickCargoVolume()` with adapter calls/snapshot selectors.
3. Retire `CARGO_INTAKE_FEE`, `CARGO_WAREHOUSE_CAP`, `CARGO_VOLUME_FEE_MIN/MAX`, `CARGO_VOLUME_COOL` and `CARGO_VOLUME_FAIL_FINE` after call sites move. Do not keep charging the old intake fee: new revenue posts at aircraft departure.
4. Replace the trunk freighter block that subtracts `cargoWarehouse` and spawns a baggage tug with `prepareFlight()` plus logistics `outboundCargoKg`. Logistics owns apron tug/loader motion; cargo owns inventory and contracts.
5. Replace HUD reads of `game.cargoWarehouse` / `cargoVolume` with `CargoSnapshot.facilities`, contracts and bottlenecks.
6. Add a terminal-owned save codec for contracts, imports, buffers, trucks and reservations before deleting the old save fields. `CargoSnapshot` is a read model, not yet a restore API.

### Existing-save compatibility

- Treat one legacy warehouse unit as one tonne for the first migration pass; keep the ratio as a terminal constant if playtest balance changes it.
- Call `seedLegacyReadyCargo()` once with ID `legacy-shed-stock`, `tonnes: save.cargoWarehouse`, a long migration deadline, and zero revenue/penalty. This places already accepted stock on the ready rack without spawning duplicate city trucks or granting a windfall.
- For an active `CargoVolumeJob`, create one new general contract for `max(0, targetUnits - delivered)` tonnes. Convert its remaining trunk seconds to sim minutes through the shared clock; do not assume seconds equal sim minutes. Preserve airline ownership in the terminal bridge because cargo contracts intentionally use string IDs rather than importing trunk airline types.
- After a successful migrated save, omit `cargoWarehouse` and `cargoVolume` on the next save. Loading them again would duplicate stock.
- Saves with no cargo fields start empty. A built trunk cargo tile should instantiate the starter terminal configuration until building tiers are mapped.

## Design-advisor hooks

`detectBottlenecks()` and the periodic `onBottlenecks` callback report:

- `understaffed`;
- `input_full` at 85%+ fill;
- `output_blocked` when the next buffer is full;
- `saturated` at 90%+ utilization with a queue.

Each record includes stable ID, stage, severity, queue/capacity, utilization, and three concrete fixes: build capacity, upgrade rate, or assign staff. This maps directly to an advisor card without importing `src/game/advisor.ts`.

## Real-world references and balance notes

Accessed 13 October 2026:

1. Boeing, [Cargo Pallets and Containers](https://www.boeing.com/content/dam/boeing/v2/company/startupboeing/CargoPalletsContainers.pdf): LD-3/AKE 1,588 kg maximum gross and 82 kg tare; PMC/P6P 120 kg tare.
2. DSV, [P6P/PMC pallet dimensions](https://www.dsv.com/en/our-solutions/modes-of-transport/air-freight/unit-load-devices/p6p-pmc-pallet): 6,800 kg main-deck maximum gross and 120 kg tare.
3. Boeing, [First 747-8 Freighter delivery](https://boeing.mediaroom.com/2011-10-12-Boeing-Delivers-First-747-8-Freighter-to-Cargolux): 133.9 t maximum structural payload.
4. Antonov Airlines, [AN-124 cargo guide](https://antonov.com/en/file/V5hQc2hGrJGRs?inline=1): 120 t standard payload, 150 t modified payload, and internal cranes for single pieces up to 20 t.
5. Airport World, [Tunnel vision](https://airport-world.com/tunnel-vision/): a whole-ULD CT system at Shenzhen processes 20–25 ULD/hour. The starter's 1.25 t/min screening rate is conservative and preserves an early-game bottleneck.
6. Lödige Industries, [AAT Hong Kong terminal](https://www.lodige.com/en-asia/products/airport-logistics/references/aat-asia-airfreight-terminal/): 4,000 t peak day, 2,500 pallet positions, 1,850 ULD positions, and six landside truck docks. These figures anchor the scale gap between Hatchfield's starter and a future mega-terminal.
7. WorldACD summary, [2025 global air-cargo trends](https://starconcord.com.sg/worldacd-market-data-global-air-cargo-trends-december-2025/): 2025 average worldwide rate about $2.47/kg.
8. EXF Freight, [Air freight guide](https://www.exfreight.com/air-freight-complete-guide-to-fast-global-shipping-solutions/): express service commonly carries a 20–40% premium over standard air freight.

Real terminals quote annual tonnes and shipment/ULD operations, while gameplay needs short, visible queues. Facility rates are therefore conservative abstractions, not claims about a specific airport.

## Tests

- `cargo.test.ts`: units, export and reverse-import chains, perishable cold stores, split revenue, deadline penalties, baggage competition, belly/freighter restrictions, shared loader reservation lifecycle, staffing bottlenecks, host adapter, and flow registration.
- `cargo.stress.test.ts`: 300 simultaneous contracts / 600 t, thousands of headless game-minutes, repeated 747-8F turns, mass conservation, fulfillment, and finite revenue.

## Remaining integration questions

1. The revenue split now follows the integration review at 10/90; rerun the shared balance model after trunk payroll and fuel changes land.
2. Cold storage protects routing and capacity, but progressive temperature excursions/spoilage remain a possible later simulation layer.
3. The current `grok/logistics` adapter exposes no reserve/release API or turnaround reservation field. The terminal owner must add a bridge implementing `CargoLoaderReservationPort` over its vehicle dispatcher; the cargo adapter rejects loader-served freight when that bridge is absent or cannot reserve a compatible vehicle.
