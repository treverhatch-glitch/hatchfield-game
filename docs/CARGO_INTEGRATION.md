# Cargo PR #10 — integration note (prepared Oct 13, 2026)

## Conflict check
- PR #10 adds only new files: `docs/CARGO.md`, `src/cargo/{adapter,catalog,engine,index,types}.ts`, `src/cargo/cargo.test.ts`, `src/cargo/cargo.stress.test.ts`.
- Base `cursor/audit-playtest-562d` has no `src/cargo/` or `docs/CARGO.md`, so there are **no file-level conflicts with base**.
- Trunk PR #1 touches `src/game/*`, `src/logistics/*`, `src/render/*`, `src/ui/*`, `vite.config.ts`, docs and CI, but not `src/cargo/` or `docs/CARGO.md`. So there are **no file-level conflicts with #1 either**.
- `src/cargo` imports nothing outside itself (only `vitest` in tests). On a local copy of base + `src/cargo`, `tsc -p tsconfig.app.json` is clean and all vitest suites pass. Caveat: the local cargo copy may be a few commits behind the PR head, so re-run CI after merging.
- The real work is **semantic wiring**, listed below. Merge order: #1 (trunk) → #10 (cargo, file-only) → wiring commit by the terminal owner.

## Semantic gaps to close in the wiring commit
1. **Loader vehicle type.** Cargo uses `CargoLoaderType = 'uld_loader' | 'main_deck_loader'`. Base logistics `VehicleType` has `belt_loader | uld_loader` and **no `main_deck_loader`**. Fix one of two ways:
   - (a) add `'main_deck_loader'` to `VehicleType` / `VEHICLE_TYPES`, `defaults.ts` fleet and costs, and `needs.ts` (freighters get `loader: 'main_deck_loader'`);
   - (b) map `main_deck_loader` to `uld_loader` in the bridge. With `allowUldFallback`, keep the heavy slow fallback (⅓ speed) consistent with the pushback rule.
2. **Loader reservations.** Logistics has no reserve/release API. Add `reserveLoader(flightId, preferred, allowUldFallback)` and `releaseLoader(id)` on `LogisticsEngine`, implemented as a flag on the vehicle so the dispatcher skips reserved vehicles for other stands. Wrap them as `CargoLoaderReservationPort` in `src/game/logisticsBridge.ts`. Without this, `prepareFlight` rejects loader-served freight (zero tonnes plus a reason). That is correct behaviour, but it means cargo is invisible in play.
3. **Parking hand-off.** In `sim.ts`, where flights park and `logistics.onAircraftParked(...)` is called, call `cargo.prepareFlight(flight.id, airframeId, { holdCapacityTonnes, baggageTonnes: estimateBaggageTonnes(bags) })` first. Pass `outboundCargoKg: plan.tonnes*1000` in `TurnaroundOptions`. Base `needs.ts` currently defaults `cargoKg` from `af.cargoHold * factor`, so always pass an explicit `outboundCargoKg` or cargo is double-counted.
4. **Inbound.** Route `LogisticsHost.onCargoToArea(standId, kg)` (adapter.ts `cargo_to_area`) to `cargo.cargoUnloadedFromAircraft(standId, kg, { shipmentId: \`imp_${flightId}\`, complete })`, with `complete` true on the last tug run. The bridge must track the stand→flight mapping.
5. **Departure and cancel.** Call `cargo.flightDeparted(id)` only after `turnaround_complete` plus actual pushback. Call `cargo.cancelFlight(id)` on cancel, despawn or stand failure.
6. **Money.** Route `addMoney` (categories `cargo_airport_revenue`, `cargo_penalty`) into the **single** `economy.ts` ledger. This was integration-review problem #3 (four ledgers). Do NOT add `addHandlerMoney` to airport cash. Check scale: cargo uses real $/kg (~$2.47/kg, 35/65 split). Run it through the same game-dollar scaling the economy fix used (the 81% margin issue), or cargo will swamp pax revenue.
7. **Time base.** `cargo.tick(dtGameMinutes)` must use game minutes from the same clock as `logistics.tick` (mismatched time bases was review problem #4). Never use wall-clock seconds.
8. **Advisor.** Map `onBottlenecks` → `src/game/advisor.ts` cards. These are bottlenecks from player choices (staffing, capacity), so never suppress them (owner decision #8).
9. **Flow.** Use `registerCargoFlow` for topology only. Do not replay `onFlow` into an autonomous FlowGraph. Until a boundary-telemetry method exists, cargo info-view numbers (submenus, decision #10) come from `CargoSim.detectBottlenecks()` and snapshots.
10. **Events and audio.** Cargo event names need entries in `src/audio/bindings.ts` (PR #2), and the aliases should be checked for name drift.
11. **Map.** `logisticsBridge.ts` already resolves `cargoNode` from a `'cargo'` tile and falls back to the depot. Cargo's landside truck docks should attach to the same tile.

## Suggested tests for the wiring commit
- Parking a 747-8F gives `prepareFlight` > 0 t, a reserved `main_deck_loader`, and `cargo_load` enabled. Departure releases the loader and posts revenue once into economy.
- No loader in the fleet gives zero tonnes plus a rejection reason, and an advisor card appears (player-choice bottleneck).
- Inbound tug deliveries aggregate into one import shipment.
- Cash conservation: the economy ledger total equals pax + logistics + cargo airport revenue minus penalties.
