# Cargo slice

Status: self-contained implementation in `src/cargo/`. It does not import `sim.ts`, `src/logistics`, `src/flow`, UI, or rendering code. The terminal owner can wire it after the logistics and flow branches merge.

## Player model

The chain is intentionally Manor Lords-like:

`landside truck → truck dock → customs acceptance → cargo screening → warehouse → ULD build-up → ready rack → aircraft`

Every processing facility has:

- an input buffer in tonnes;
- an output-buffer limit;
- a base tonnes/minute rate;
- required and assigned staff;
- effective rate = base rate × `min(assigned / required, 1)`.

A full downstream buffer blocks the upstream facility. Missing staff reduces throughput to zero rather than silently deleting freight. The final ready rack is passive storage; build-up staff place completed units there. `snapshot()` exposes queue, staffing, utilization, processed tonnes, and blocked minutes per facility.

The starter has one shared fleet of four 20 t landside trucks, staggered across all contracts, a 120 t warehouse, and an 80 t airside ready rack. Truck status is visible as `inbound`, `queued`, `unloading`, or `departed`.

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

Route payload and belly allocation vary in reality, so `prepareFlight` accepts overrides. The terminal owner should use the route/airframe payload already selected by the main simulation rather than treating these defaults as dispatch limits.

## Contracts and economics

Contracts keep their identity through all buffers. Earliest deadlines load first.

| Product | Default gross revenue/t | Deadline suggestion | Penalty/t | Flight rule |
|---|---:|---:|---:|---|
| General | $2,470 | 18 h | $900 | Belly or freighter |
| Express | $3,350 | 6 h | $2,100 | Belly or freighter |
| Perishables | $3,100 | 10 h | $2,600 | Belly or freighter |
| Oversize | $5,500 | 24 h | $3,500 | Freighter; heavy loader preferred |

The $2,470/t general baseline is the 2025 worldwide air-cargo average of $2.47/kg. Express uses roughly a 35% premium, inside the cited 20–40% range. Perishable, oversize, deadline, and penalty values are gameplay balancing assumptions, not tariffs.

`confirmFlightDeparted` posts revenue. Missing a deadline posts the penalty on every unshipped tonne exactly once, cancels its unarrived trucks, and returns remaining freight to the shipper so stale cargo cannot deadlock the warehouse. `planFlight` only reserves cargo; `cancelFlight` returns it to the ready rack. This prevents a cancelled turnaround from creating revenue or deleting inventory.

The rates above are gross shipper rates. If Hatchfield's finance model represents airport handling income rather than airline freight revenue, apply a configurable handling share in `CargoHost.addMoney`.

## Terminal integration

```ts
import { createCargoAdapter } from '../cargo'

const cargo = createCargoAdapter({
  addMoney: (amount, category, contractId) => {
    // cash += amount; ledger.push(...)
  },
  onBottlenecks: (items) => {
    // Translate items into src/game/advisor Advice cards.
  },
  onFlow: (stage, direction, tonnes) => {
    // Feed an external-boundary telemetry bridge when src/flow provides one.
  },
  onImportedCargo: (standId, tonnes) => {
    // v1 import handoff; see open questions.
  },
})

cargo.tick(dtGameMinutes)
```

Do not tick with wall-clock seconds. Logistics and cargo both use game minutes.

### Logistics handoff

When a flight parks:

```ts
const plan = cargo.prepareFlight(flight.id, flight.airframeId, {
  mainDeckLoaderAvailable: hasMainDeckLoader,
})

logistics.onAircraftParked(standId, flight.airframeId, scheduledMinutes, {
  kind: flight.cargo ? 'turn' : 'inbound',
  outboundCargoKg: plan.tonnes * 1000,
  inboundCargoKg: inboundManifestKg,
})
```

- Call `cargo.flightDeparted(flight.id)` only after logistics says the turnaround is ready and the aircraft actually departs.
- Call `cargo.cancelFlight(flight.id)` for cancellation, stand failure, or despawn.
- Wire `LogisticsHost.onCargoToArea(standId, kg)` to `cargo.cargoUnloadedFromAircraft(standId, kg)`.
- `plan.requiredLoader` is a dispatch request (`main_deck_loader` preferred, otherwise `uld_loader`). Do not reject a contract merely because the heavy loader is busy: logistics deliberately supports a slower standard-loader fallback and remains authoritative for travel, allocation, and turnaround delay.

### Flow handoff

The flow branch is structural and pure TS. Register this chain after constructing its `FlowGraph`:

```ts
registerCargoFlow(flowGraph, cargoConfig)
```

`CargoFlowRegistrar` deliberately matches only `addNode` and `addLink`; cargo does not import `src/flow`. Cargo remains authoritative for contract-labelled inventory.

The current `grok/flow` branch has autonomous `inject`/`withdraw` processing but no external-boundary telemetry method. Do **not** replay `onFlow` into that autonomous graph while ticking it; that would create a second cargo simulation. The terminal integration should add a small flow adapter that records these boundary events as metrics without moving inventory, then pass those events to it. Until that method exists, use `CargoSim.detectBottlenecks()` for cargo advisor/info data and use `registerCargoFlow` only for topology. Departure emits `ready/out`, so the eventual bridge will measure aircraft throughput.

Flow IDs are stable:

- nodes: `cargo:landside`, `cargo:truck_dock`, `cargo:customs`, `cargo:screening`, `cargo:warehouse`, `cargo:build_up`, `cargo:ready`, `cargo:flight`;
- links: `cargo:<from>><to>`.

The cargo info view can therefore use the flow branch's standard `infoView('cargo')`, `audit()`, and route tracing without special cargo UI types.

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

- `cargo.test.ts`: units, complete terminal chain, revenue, deadline penalties, belly/freighter restrictions, loader requirement, staffing bottleneck, host adapter, and flow registration.
- `cargo.stress.test.ts`: 300 simultaneous contracts / 600 t, thousands of headless game-minutes, repeated 747-8F turns, mass conservation, fulfillment, and finite revenue.

## Open questions

1. Imports currently hand off through `CargoHost.onImportedCargo`; should the full import chain run in reverse (aircraft → break-down → customs → truck), or can v1 treat imports as warehouse income?
2. What fraction of gross freight revenue belongs to the airport economy?
3. Should perishables require a separate cold-store buffer and spoil progressively, instead of only paying a deadline penalty?
4. Does a main-deck loader need to be merely owned, or reserved at the assigned stand before `prepareFlight` can load PMC/oversize cargo?
5. Should belly allocation consume passenger baggage capacity dynamically?
