# Engine readiness

Hatchfield's rules still live in `Game` (`src/game/sim.ts`). This note is the map for lifting that rules engine out of the browser without changing play. A port reads `SimCore`, not Three.js, React, or the DOM.

Unseeded games still roll `Math.random`, so today's tests and the live field keep the same stream. `SimCore` constructed with a seed uses mulberry32. The same seed replays the same sim snapshot.

## What is portable today

| Piece | Where | Role |
|---|---|---|
| Clock | `src/core/clock.ts` | Sim minutes. One game day is 180 real seconds at 1×, 1,440 sim minutes. |
| Bank | `src/core/bank.ts` | Signed money journal. |
| RNG | `src/core/rng.ts` | `simRandom()` reads the active stream. `createRng(seed)` is mulberry32. |
| Events | `src/core/events.ts` | Synchronous typed bus. |
| Facade | `src/core/simCore.ts` | `tick(dt)`, `timeScale`, `snapshot()` / `load()` / `toJSON()`, `events`. |
| Snapshot | `src/core/snapshot.ts` | Version 1 JSON document. |

`SimCore.tick(dt)` multiplies `dt` by `timeScale`, then calls `Game.tick`. `Game.speed` (0, 1, 3, or 5) still applies. A 50× headless run sets `timeScale = 50` and `speed = 1`.

`snapshot()` is already `JSON.parse(JSON.stringify(...))`. `load()` restores that document onto a `Game`. Version 1 includes the world fields, bag books and tags, bank, sim clock, economy state, diplomacy save string, and the RNG word. It does **not** include in-progress ground-logistics, catering, or cargo adapter memory. Those adapters are dropped on load and built again on the next tick from the restored field. Turnaround progress inside those adapters does not survive a load yet.

Wall-clock stamps stay out of the snapshot: the 120 ms click dedupe in `clickTile`, `lastPlaceAt`, and audio voices.

## Coupling map

"Sim" means a module that decides outcomes. "Presentation" means a module that draws, speaks, or stores UI.

### DOM and browser storage

| File | What it touches |
|---|---|
| `src/main.tsx` | `document.getElementById('root')`, React root. |
| `src/App.tsx` | `sessionStorage` for the title / land / play screen and the pending new-game choice. `requestAnimationFrame` drives `game.tick`. |
| `src/ui/Field.tsx` | `window` key listeners, `requestAnimationFrame`. |
| `src/ui/TerminalView.tsx` | `window` key listeners, `requestAnimationFrame`. |
| `src/ui/isolated/OwnerChrome.tsx` | `window` key listener for the flow overlay. |
| `src/ui/Hud.tsx` | React only. Reads `Game` fields directly. |
| `src/game/sim.ts` | `localStorage` key `apron-save-v25` in `persist`, `hasSave`, `load`, and `beginNew`. `sessionStorage` key `hatchfield-pending` in `beginNew`. |
| `src/render/world.ts` | `HTMLCanvasElement`, `window.devicePixelRatio`, `localStorage` key `hatchfield-gfx`. |
| `src/render/world/render.ts` | `window.devicePixelRatio`. |
| `src/render/world/textures.ts` | `document.createElement('canvas')` for procedural textures. |
| `src/render/hallWorld.ts` | `HTMLCanvasElement`, offscreen canvases for signage. |
| `src/render/aircraft/lod.ts` | `localStorage` aircraft quality. |
| `src/features/settings/settings.ts` | `localStorage` when the browser has it. |
| `src/features/save/save.ts` | Storage is an injected `KeyValueStore`. The comment mentions `localStorage`; the module does not touch it. |
| `src/branding/texture.ts`, `src/branding/props.ts` | Canvas textures for the logo. |
| `src/test/setup.ts` | In-memory `localStorage` / `sessionStorage` for Vitest. |

`Game.tick` does not read the DOM. The autosave inside the tick writes `localStorage` every 8 sim seconds once a plot is owned. A headless port should pass a `KeyValueStore` into that write. It is still a direct `localStorage` call today.

### Three.js

Imported from `three` and used as a scene graph. None of these decide passenger, bag, or cash outcomes.

| Area | Files |
|---|---|
| Apron world | `src/render/world.ts`, `src/render/world/render.ts`, `environment.ts`, `airfield.ts`, `terminal.ts`, `surfaces.ts`, `kit.ts`, `textures.ts`, `hallCrowd.ts`, `quality.ts`, `index.ts` |
| Hall camera | `src/render/hallWorld.ts` |
| Aircraft | `src/render/aircraft/build.ts`, `factory.ts`, `geom.ts`, `merge.ts`, `pool.ts`, `batch.ts`, `bridges.ts`, `branding.ts`, `lod.ts` |
| Logo meshes | `src/branding/props.ts`, `src/branding/texture.ts` |
| Camera helper | `src/features/camera/camera.ts` (type import) |

`src/render/world/view.ts` already defines `WorldView`, the slice of `Game` the textured world reads (`tiles`, `mapRev`, `clock`, `weather`, `speed`, stands, `fits`, `deskStaff`). `Game` satisfies it structurally. `src/render/world.ts` still walks `game.flights`, `game.trucks`, and `game.tiles` itself. That file is the remaining apron coupling.

`src/render/world/daylight.ts` and `src/render/world/hallCrowd.ts` (`posesFrom`) already take plain data.

`src/game/sim.ts` imports `getAircraftSpec` and stand helpers from `src/render/aircraft/` and terminal plan helpers from `src/render/world/plan.ts` and `layout.ts`. Those imports are data and geometry queries used by the rules (stand fit, runway length, hall plan). They pull the render folder onto the sim's module graph even when nothing is drawn. A port should move specs and stand limits next to the catalog so `sim.ts` does not import `src/render`.

### React

| File | Role |
|---|---|
| `src/main.tsx` | Mount. |
| `src/App.tsx` | Screen state, frame loop, HUD subscription via `game.subscribe`. |
| `src/ui/Hud.tsx` | Panels. Reads `Game` on each subscription flush. |
| `src/ui/Field.tsx` | Apron canvas host. |
| `src/ui/TerminalView.tsx` | Hall canvas host. |
| `src/ui/isolated/OwnerChrome.tsx` | Flow overlay, advisor, diplomacy letters. |
| `src/ui/LandScreen.tsx`, `src/ui/TitleScreen.tsx`, `src/ui/LineChart.tsx` | Menus and charts. |
| `src/branding/AirportBrandingScreen.tsx`, `Finance.tsx`, `LogoBadge.tsx`, `texture.ts` | Branding UI. |

The frame loop caps `dt` at 0.05 s before `game.tick`. React does not run inside the tick. `Game.emit` is throttled (`uiAcc`) so the HUD is not on the sim hot path.

### Wall clock

| File | Use | Sim or presentation |
|---|---|---|
| `src/App.tsx`, `src/ui/Field.tsx`, `src/ui/TerminalView.tsx` | `performance.now` + `requestAnimationFrame` to turn frames into a `dt`. | Presentation. Headless callers pass `dt` themselves. |
| `src/game/sim.ts` `clickTile` | `performance.now` rejects a second stamp inside 120 ms. | Input debounce, not a rule. Not in the snapshot. |
| `src/render/world.ts`, `src/render/hallWorld.ts` | `performance.now` for frame delta and belt spin. | Presentation. |
| `src/render/aircraft/lod.ts` | `performance.now` for a visual pulse. | Presentation. |
| `src/airlines/logic.ts` | `Date.now()` inside offer ids. | Sim-adjacent module. Not called by `Game.tick`. Ids would change if this moves to the sim RNG. |
| `src/branding/random.ts` | `Date.now()` default logo seed. | Presentation. |
| `src/flow/flow.test.ts` | `performance.now` around a benchmark. | Test only. |

`Game.tick` advances `this.clock` by `dt * speed` and the shared `SimClock` by the same real-seconds step. No `Date` call on that path.

### Math.random

Sim rolls go through `simRandom()` in `src/core/rng.ts`. With no seed, that function calls `Math.random` at the moment of the roll, so a test that replaces `Math.random` still owns the stream.

| File | Rolls | Stream |
|---|---|---|
| `src/game/sim.ts` | Ids, offers, weather, delays, spawns, market, threats, passengers on the apron. | `simRandom` via the active `Game.rng`. `tick` binds that game's RNG first. |
| `src/game/guests.ts` | Need picks, wallets, guest ids. | `simRandom` |
| `src/game/pax.ts` | Itinerary and pawn ids. | `simRandom` |
| `src/game/catalog.ts` | `createProcAirline` only. | `simRandom` |
| `src/game/airframes.ts` | `paxForAirframe`, `cargoUnitsForAirframe` (default argument), `pickAirframe`. | `simRandom` unless the caller passes a function. |
| `src/airlines/logic.ts` | Contract-offer chance. | `simRandom`. Offer ids still use `Date.now()`. |

These stay on `Math.random` on purpose. They are presentation, and they must not consume the sim seed.

| File | Use |
|---|---|
| `src/render/world/render.ts` | Lightning flash. |
| `src/audio/engine.ts` | Sample variant when the caller did not pass one. |
| `src/audio/ambience.ts` | Default random source for the mixer. |
| `src/audio/synth.ts` | Noise bursts. |

Already seeded, separate streams (do not merge them into `Game.rng` or replays of those modules shift):

| File | Stream |
|---|---|
| `src/features/shared/rng.ts` | mulberry32 for the feature-event scheduler. |
| `src/logistics/rng.ts` | mulberry32. Maintenance breakdowns use `config.seed` (default 1). |
| `src/diplomacy/rng.ts` | mulberry32 held on diplomacy state. `Game.diplomacySeed` defaults to 1. |
| `src/audio/rng.ts` | mulberry32 for synth jitter. |

Tests in `src/game/*.test.ts`, `src/airlines/*.test.ts`, and `src/diplomacy/standing.test.ts` still stub `Math.random`. That keeps working while the default stream is `kind: 'math'`.

## Hard-coded tunables

Named knobs below are the balance surface. They live in `src/data/costs.json`, `src/data/airlines.json`, `src/data/buildings.json`, and `src/data/terminal.json`. `loadCatalog` in `src/game/catalogData.ts` checks the shape (start cash, land, six XP steps, `northline`, and the non-empty building / room / research / loan / task lists). `src/game/catalog.ts` re-exports the same names and keeps the helpers (`fieldLevelFromXp`, `createProcAirline`, labels, `money`). Callers still import `./catalog`.

### Cash, land, construction (`src/data/costs.json`)

| Name | Value |
|---|---|
| `START_CASH` | easy 220,000 · standard 150,000 |
| `LAND.city` | cost 95,000 · pax ×1.35 · cargo ×0.7 |
| `LAND.factory` | cost 62,000 · pax ×0.75 · cargo ×1.4 |
| `SHORT_RUNWAY_*` | cost 22,000 · 10×2 |
| `RUNWAY_PREFAB_*` | cost 38,000 · 14×2 |
| `HEAVY_RUNWAY_*` | cost 72,000 · 20×3 |
| `HELIPAD_COST` / `HELO_LANDING` | 9,000 / 2,400 |
| `PREMADE_TERMINAL_COST` | 52,000 |
| `JETWAY_RANGE` / `MIL_RAMP_RANGE` | 8 / 10 cells |
| `TAXI_COST` | 700 |
| `STAND_S_COST` / `STAND_COST` / `STAND_L_COST` | 4,800 / 6,200 / 9,800 |
| `STAND_JETWAY_MULT` | 1.85 |
| `TERMBUS_COST` | 12,500 |
| `TERMINAL_COST` | 14,800 |
| `SNACK_COST` / `BAGS_COST` / `BELT_COST` | 3,600 / 4,800 / 900 |
| `FUEL_COST` / `KITCHEN_COST` / `DEPOT_COST` | 5,600 / 7,200 / 9,800 |
| `FIRE_COST` / `POLICE_COST` / `CARGO_COST` / `GUARD_COST` | 12,000 / 11,000 / 16,000 / 9,500 |
| `ROAD_COST` / `TOWER_COST` / `HANGAR_COST` | 450 / 18,000 / 14,000 |
| `DEICE_PAD_COST` / `DEICE_FEE` / `CLEANING_FEE` | 11,500 / 1,400 / 900 |
| `HALL_SCRUB_COST` | 2,800 |
| `BULLDOZE_REFUND` | 0.4 |
| `STARTER_KIT_COST` | 48,000 |
| `PARCEL_COST` / `RAIL_CITY_COST` | 28,000 / 22,000 |
| `MIN_RUNWAY` | 6 |

### Landside, staffing, research points (`src/data/costs.json`)

| Name | Value |
|---|---|
| `HOTEL_COST` / `HOTEL_COST_L2` | 28,000 / 48,000 |
| `HOTEL_INN_COST` / `HOTEL_BIZ_COST` / `HOTEL_RESORT_COST` | 18,000 / 28,000 / 42,000 |
| `CARPARK_SHORT_COST` / `CARPARK_LONG_COST` | 11,000 / 16,500 |
| `PARK_S_COST` / `PARK_L_COST` / `PARK_G_COST` / `PARK_U_COST` | 8,500 / 14,000 / 22,000 / 18,000 |
| `BUS_CURB_COST` / `RAIL_STATION_COST` | 8,500 / 16,000 |
| `PARK_SHORT_FEE` / `PARK_LONG_FEE` | 28 / 58 |
| `HOTEL_NIGHT_FEE` | 95 |
| `BUS_FARE` / `RAIL_FARE` | 12 / 22 |
| `JANITOR_HIRE` / `JANITOR_WAGE` | 3,200 / 260 |
| `RESEARCHER_HIRE` / `RESEARCHER_WAGE` | 4,800 / 340 |
| `DESK_STAFF_HIRE` / `DESK_STAFF_WAGE` | 3,600 / 280 |
| `MECHANIC_HIRE` / `MECHANIC_WAGE` | 4,500 / 380 |
| `RP_RATE_DESK` / `RP_RATE_BOARD` / `RP_RATE_MACHINE` / `RP_RATE_BARE` | 0.09 / 0.05 / 0.12 / 0.015 |
| `RP_PER_FLIGHT` / `RP_PER_50_PAX` | 3 / 1 |
| `FIELD_LEVEL_XP` | 0, 0, 90, 220, 420, 700 |

Daily upkeep tables in the same file: `PARK_EXPENSE`, `HOTEL_CLASS_EXPENSE`, `HOTEL_META_EXPENSE` (0, 360, 620), `CARPARK_META_EXPENSE_SHORT` 180, `CARPARK_META_EXPENSE_LONG` 240, `BUS_EXPENSE` 160, `RAIL_EXPENSE` 260, `HALL_AMENITY_EXPENSE`, `PARK_USE_FEE`, `HOTEL_CLASS_FEE`.

### Loans, market, carriers (`src/data/costs.json`, `src/data/airlines.json`, `src/data/terminal.json`)

| Name | Value |
|---|---|
| `LOAN_PRINCIPAL` / `LOAN_FEE` | 45,000 / 2,800 |
| `LOAN_INTEREST` / `LOAN_INTEREST_EVERY` | 1,250 / 55 s |
| `LOAN_PRODUCTS` | micro, bridge, and larger books. Each has principal, fee, rate, period, field level, reputation. |
| `IPO_MIN_CASH` / `IPO_MIN_REP` / `IPO_MIN_FLIGHTS` | 40,000 / 55 / 3 |
| `IPO_SHARES` / `IPO_FOUNDER_SHARES` / `IPO_LISTING_FEE` | 1,000 / 550 / 12,000 |
| `BUDGET_BASE` / `DEFAULT_BUDGETS` | maintenance, security, cleaning, fire, ambulance |
| `MIL_AGREE_COST` / `MIL_LANDING` | 18,000 / 7,800 |
| `AIR_AMBULANCE_FEE` / `THREAT_SCRAMBLE_COST` | 3,200 / 2,200 |
| `LAYOVER_FEE_MIN` / `LAYOVER_FEE_MAX` | 6,000 / 14,000 |
| `LAYOVER_BAN_SECONDS` / `LAYOVER_BAN_FINE` | 90 / 8,000 |
| `HEAT_BAN_THRESHOLD` / `HEAT_REWARD_THRESHOLD` / `HEAT_WARN_THRESHOLD` / `HEAT_ABANDON_THRESHOLD` | 28 / 82 / 36 / 20 |
| `ABANDON_ACC_SECONDS` / `ABANDON_FINE` | 26 / 12,000 |
| `CARGO_INTAKE_FEE` / `CARGO_WAREHOUSE_CAP` | 420 / 140 |
| `CARGO_VOLUME_FEE_MIN` / `MAX` / `COOL` / `FAIL_FINE` | 4,200 / 9,500 / 70 / 1,800 |
| `BAG_DROP_PAY` / `LOADS_PER_BUY` | 180 / 4 |
| `DIVERT_FEE_MIN` / `MAX` | 4,500 / 9,000 |
| `TANKER_FEE` / `TANKER_MX_FEE` | 6,800 / 9,200 |
| `EMERGENCY_REFUSE_FINE` / `EMERGENCY_FAIL_FINE` | 2,500 / 4,500 |
| `HUB_FEE_MIN` / `MAX` | 14,000 / 22,000 |
| `HUB_LAYOVER_WINS` / `HUB_HEAT_NEED` / `HUB_BAN_THRESHOLD` | 1 / 75 / 34 |
| `GA_PARK_FEE_MIN` / `MAX` | 2,800 / 6,500 |
| `GA_PARK_STAY_MIN` / `MAX` | 40 / 75 |
| `GA_LEAVE_WINDOW` / `GA_OVERSTAY_FINE` | 150 / 5,000 |
| `GA_PARK_DAY_RATE` / `GA_PARK_RATE_COOL` | 380 / 32 |
| `FIELD_TASK_DEADLINE` / `COOL` / `FAIL_FINE` | 95 / 52 / 1,600 |
| `FIELD_TASK_HEAT_OK` / `HEAT_FAIL` | 4.5 / −5.5 |

`FUEL` and `CATER` contracts (price, quality, upkeep) sit next to those scalars. `AIRLINES` holds each carrier's fees, pax band, reputation gate, and building requirements.

### Other data files (not catalog, still hard-coded)

| File | Knobs |
|---|---|
| `src/game/types.ts` | `SIZE` 32. `SANDBOX_CASH` 9,999,999. Save key `apron-save-v25`. |
| `src/game/terminal.ts` | Hall grid 8×5, hall 48×32 m, `JUNCTION_CAP` 5, `DEPARTURE_SPREAD_SEC` 45, `UNSTAFFED_LANE` 1.35, `WORN_LANE_DIVISOR` 200, `OVER_CAP_PER_BODY` 0.02, `OVER_CAP_MAX` 1.4, `PREFAB_WEAR_PER_PAX` 0.7. `ZONES`, `ITEMS`, `PREFAB_TIERS` are the hall catalog. |
| `src/game/economy.ts` | `CITY_LEVY_FLOOR` 140,000. `CITY_LEVY_RATE` 0.005. |
| `src/game/luggage.ts` | `CLAIM_LATE_SEC` 22. |
| `src/game/logisticsBridge.ts` | `FUEL_OUTAGE_SLOT_SEC` 12. `METRES_PER_CELL` 900. |
| `src/game/cargoBridge.ts` | `CARGO_CASH_SCALE` 0.1. |
| `src/game/diplomacyBridge.ts` | `GAME_MINUTES_PER_SIM_SECOND` 8. |
| `src/game/airframes.ts` | `AIRFRAMES`: seats, pax band, hold, fuel load, min runway, research gate per type. |
| `src/game/guests.ts` | `HALL_EDGES`, `NODE_POS`, airside / landside sets. Wallet bands are literals inside `rollWallet`. |
| `src/logistics/defaults.ts` | Vehicle speeds, upkeep, capacities, `VEHICLE_CATALOG` costs. |
| `src/economy/balance.ts`, `techTree.ts`, `staff.ts`, `power.ts`, `seasons.ts` | Economy-module rates. The live field's payroll still reads `catalog.ts` wages. |
| `src/core/clock.ts` | `SIM_MINUTES_PER_GAME_DAY` 1440. `REAL_SECONDS_PER_GAME_DAY` 180. |
| `src/core/bank.ts` | `DAILY_PAYROLL_SHARE` and the category list. |

Unnamed literals remain inside `Game` methods: offer cooldowns, weather odds, delay lengths, spawn chances, heat bumps. They sit next to `simRandom()` calls. Naming them is a follow-up. Moving them in the same edit as the RNG would have mixed a balance pass with the port.

## How to run headless

```ts
import { snapshotHash } from './src/core/hash.ts'
import { SimCore } from './src/core/simCore.ts'

const core = new SimCore({ seed: 20261013 })
const game = core.game
game.sandbox = false
game.beginNew('easy')
game.buyLand('city')
game.buildStarterKit()
game.offer = { airline: 'northline', age: 0, deadline: 36 }
game.acceptOffer()
game.speed = 1
core.timeScale = 50
// 0.5 sim-seconds per step → 5 game days (180 s each) at 50×.
for (let i = 0; i < (5 * 180) / 0.5; i++) core.tick(0.5 / 50)
snapshotHash(core.snapshot())
```

Vitest covers that path in `src/core/simCore.test.ts`: JSON round-trip, identical 3-day hash for one seed, 5 days at 50×, and 30 days at 50×. The long runs assert finite cash, `lostPaxCount() === 0`, `bagsLost === 0`, and no service truck sitting still for more than 240 sim seconds outside a dwell or a patrol.

Importing `SimCore` still loads `Game`, and `Game` still imports render modules for specs and plans. The test does not construct a canvas, a WebGL renderer, or a React tree.

## Suggested port order

1. Done in this pass: coupling map, sim RNG, `SimCore` skeleton, headless soak.
2. Done next: audio one-shots and ambience subscribe to `Game.events`. `OwnerChrome` paints `readChrome()`. The textured world update takes `worldViewFrom(game)` (shallow, no tile copy). Entity meshes in `src/render/world.ts` still walk `game.flights` and `game.trucks`.
3. Done: catalog tables live in `src/data/{costs,airlines,buildings,terminal}.json`. `loadCatalog` checks the shape. `src/game/catalog.ts` re-exports the same names and keeps the helpers.
4. Stop `sim.ts` importing `src/render/**` and `src/audio/**`. Specs move to data. Sounds become events only.
5. Extend snapshot v2 with logistics, catering, and cargo adapter state so a load continues a turnaround, not just the field.
