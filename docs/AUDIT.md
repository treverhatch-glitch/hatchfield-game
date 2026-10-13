# Hatchfield audit — 13 Oct 2026

Phase 1 only: install, play, review, and small fixes. No new features.

The owner-facing summary is the bug list and the dev plan. The code notes are for the next developer. Bug evidence (stills, the one overlap clip, and the playthrough) is in [DEVLOG.md](./DEVLOG.md).

## Tooling

| Check | Result |
| --- | --- |
| `npm install` | 62 packages, clean |
| `npx tsc -b --pretty false` | Clean, before and after the fixes |
| `npm run lint` (`oxlint`) | Exit 0. Warnings only: unused vars in three soak scripts, a prop-mutation warning in `LandScreen`, a setState-in-effect warning in `App` |
| `npm run build` | Clean. Client JS about 1.05 MB (290 KB gzip). Vite warns that the chunk is over 500 KB |

Play was headless Chrome (Playwright) against `npm run dev` on port 45217, plus a direct sim run of `Game` with no browser. Screenshots: `docs/playtest/`. There were **no game console errors**. The long playtest script died later on its own FPS sampler (`__name is not defined` inside `page.evaluate`), after the passenger loop, the hall, the loan, and every tab.

Frame rate on this machine was about **8 FPS** at 5x with SwiftShader (software WebGL). That number is the VM, not a desktop GPU. The sim itself is cheap: a passenger turnaround through takeoff was 401 ticks in 178 ms of CPU. Peak counts in that run: **2 jets, 5 trucks, 1 apron walker, 61 hall guests**.

## Prompt 1 — verified

| Check | Result |
| --- | --- |
| One click = one placed item | Pass. A double `clickTile` on the same grass cell added exactly one taxi tile. Drag-paint is off on purpose |
| WASD / arrows | Pass. With the clock **paused**, holding W changed the apron picture. Q/E are wired in both views |
| Loan does not break the game | Pass. Bridge loan raised cash and the owed line. The clock kept moving at 5x. Headless sim: balance 47,800 → 50,300 over a long run with sandbox off (interest, capped, not a wipe) |
| Economy tabs | Pass. Economy, Budget, Research, Airlines, Planner, Services each opened with a real body |
| Title + Passenger / Cargo | Pass. Sandbox defaults **on**. Route cards list the kit each start needs. Cargo kit: focus `cargo`, **0 halls, 1 guard, 1 shed** |
| Sandbox money toggle | Pass. Checkbox on the title. Off and on both stick into New Game |
| Debug autoplay | Present: `npm run autoplay` → `scripts/autoplay-stabilize.mts` |

## Feature inventory

**Works** — a new player can do this without a wiki.

- Title, sandbox toggle, Passenger / Cargo / Hybrid route pick.
- Starter kit for both starts (passenger kit includes a hall and jetway stands; cargo kit does not).
- Sign a contract letter. Northline called on the passenger kit.
- A jet approaches, lands, turns (deboard, servicing, trucks on the stand), pushes, and departs. Headless sim recorded `approach → landing → taxi_in → deboard → servicing → board → pushback → taxi_out → takeoff` and two completed turns.
- Hall view: room blocks, walking guests, security called out in the chrome. Apron keeps simulating.
- Bridge loan, and the six info tabs.
- Build categories: Pavement, Stands, Terminal, Ops, Landside, Bulldoze. Select tool, not the old Move tool.
- Speeds Pause / 1x / 3x / 5x. 5x turns the hover card off.
- Cargo sim: one UPPS turnaround, warehouse stock moved, no passenger hall required.
- Save/load of the field, signed airlines, and (after this audit) the cargo volume letter.

**Partly works**

- **Chrome.** Bottom bar, ticker, and cash are real, and menus open on click. The tool tray is designed to stay collapsed until hover or focus (`dock-extend` max-height 42px). Letters sit on the **right**, not the left. Economy is a button list, not charts.
- **Hall.** Guests walk a fixed room graph. There is no zone paint, no item catalog from `TERMINAL_ITEMS.md`, and the people are capsules. The guest card used to show raw numbers and the word “landside” (BUG-005, fixed).
- **Cargo path.** Guard post, city trucks, warehouse percent, and a volume letter exist (BUILD slices 2–3). There is no screen building, no loader GSE, and no cargo ladder screen. Fuel trucks still do not have a farm tank limit (BUILD slice 4, not started).
- **Airline tiers.** T1–T5 names, Standing, Field Level, and letters exist. The tier mix, rival carriers, and Standing 82+ perks from `DESIGN_PASS.md` §5 are not the live contract.
- **Construction.** Stamps appear at once. No contractor van, no build timer.
- **Save.** The field, contracts, research, and loan survive. Live jets, trucks, and hall guests are cleared on load (“Field restored. Clock paused.”). That is intentional. Offers in flight are not in the snapshot.

**Broken before this audit — fixed here**

See DEVLOG. Short version: the first-hour checklist covered the jet card; a saved game skipped the title; a cargo volume letter vanished on refresh; the renderer allocated a truck box every frame; the hall spoke in code words; the README named the wrong save key.

**Not in the game (do not treat the docs as shipped)**

Zone painting, functional terminal items, contractor vans, fuel-farm capacity, pricing, tenants, objectives, scenarios, franchise brands, the international zone. `docs/PROBLEMS.md` is older than `docs/GROK_HANDOFF.md` and still talks about cargo slices 2–3 as unbuilt. Trust GROK_HANDOFF and BUILD for what is live.

## Bug list

Six bugs. Detail, repro, and media: [DEVLOG.md](./DEVLOG.md).

| ID | Severity | What the player hits | Status |
| --- | --- | --- | --- |
| BUG-001 | High | First-hour checklist sat on top of the aircraft card, same corner, so the jet’s fuel and status could not be read | Fixed. Card moved to the right of the checklist |
| BUG-002 | High (long session) | Every frame allocated a new truck `BoxGeometry` and never freed departed aircraft, trucks, people, or hover ghosts | Fixed in `world.ts`. Nothing to photograph |
| BUG-003 | Medium | Refresh deleted an active cargo volume letter | Fixed. The job is in the save |
| BUG-004 | High | A saved game skipped the title, so New Game, Continue, and the sandbox toggle could not be reached. New Game also left the old save on disk | Fixed. A new visit shows the title. Same-tab refresh mid-play still resumes |
| BUG-005 | Low | Hall card and hints said `landside`, `airside`, and raw preference numbers | Fixed. Room names and “Before security” |
| BUG-006 | Low | README and PROBLEMS said save key `apron-save-v24`. Code is `apron-save-v25` | Fixed those two lines |

Not bugs: the playtest missing the word “takeoff” in a 400 ms poll (the sim and the 5x frame both show a departure); loan interest moving 47,800 → 50,300 when cash runs dry (the cap from the last stabilise commit).

## Code health

`src/game/sim.ts` is one `Game` class, about **9,500 lines** and **300 methods**. It owns the clock, economy, airlines, hall guests, trucks, combat-free emergencies, the stock market, and save/load. `src/ui/Hud.tsx` is about 1,600 lines and draws every panel. `src/render/world.ts` is about 1,400 lines. That is the main structural risk: a safe-looking edit in the clock can break letters or trucks.

Duplication worth knowing about, not worth a drive-by split:

- Apron `World` and hall `HallWorld` each own a camera, WASD, and a render loop.
- `heatOf` / `standingOf` are the same meter. The UI says Standing. Some news and code still say heat.
- Soak scripts (`scripts/soak-*.mts`, about 40) repeat a localStorage stub and a “tick until” loop. There is **no unit-test runner** and no `npm test`. Nothing in CI runs them. `npm run playthrough` and `npm run autoplay` are the closest thing to a smoke test.

Save/load: `GameSnapshot` in `types.ts`, key `apron-save-v25`. `load()` is defensive (`??` defaults, a few migrations for hotels and stands). It does not validate tile size or unknown tools. A corrupt JSON returns false and the title stays up. Live traffic is dropped on purpose. `cargoVolume` was the hole (BUG-003). `beginNew` now deletes the key so a half-finished New Game cannot resurrect the previous airport.

Dead weight: `LOAN_PRINCIPAL` / `LOAN_FEE` are marked deprecated and still used as fallbacks. The old `.side` CSS is `display: none`. No `TODO`/`FIXME` comments in `src/`.

Dev-only: in Vite dev, `window.__hatch` is the live `Game`. Production builds strip it. The playtest scripts use it.

## Dev plan

Small slices, in the order the owner asked for. Each one should leave the morning path working: title → kit → sign → a jet earns money. Design sources now in this folder: `DESIGN_PASS.md`, `TERMINAL_ITEMS.md`, `LOGISTICS_VISUALS.md`, `PLAYER_FEEDBACK.md`, `DOC_UPDATES.md`.

Do not start freeflow roads, a Godot port, per-suitcase agents, or a construction-materials spreadsheet. Those stay parked.

### Slice 1 — Stabilise (this audit)

**Goal:** The current loop does not lie, trap, or leak.

**Scope:** The six bugs above. No new buttons.

**Done when:** Typecheck is clean. A saved game opens on the title with Continue. The jet card is readable while the first-hour list is open. A cargo volume letter is still there after refresh. One click still places one tile.

### Slice 2 — Bottom bar and left-hand letters

**Goal:** The screen reads like Cities: Skylines: tools along the bottom, news of the world arriving from the left.

**Scope:** Keep the tile grid. Make the category row and the tool tray visible without hunting a hover. Move the letter stack from the right edge to a slide-in from the left. Top bar keeps cash, clock, Field Rating, Standing. Do not add charts in this slice.

**Done when:** A first-time player can stamp a taxiway without hovering the dock. A contract letter enters from the left and Sign still works. Apron and hall both usable at 1280×720.

### Slice 3 — Economy panel with a chart

**Goal:** The player can see why the cash moved.

**Scope:** One Economy panel: cash, today’s fees, payroll, loan interest, and a simple line of cash over the last few minutes. Reuse numbers the sim already has (`landsideIncome`, `landsideUpkeep`, `payrollPreview`). No new currencies.

**Done when:** After a starter kit and one turnaround, the chart moves when a fee posts, and the loan interest tick shows up as its own line.

### Slice 4 — Terminal zones and the first real items

**Goal:** The hall is a place you furnish, not a fixed diorama.

**Scope:** Paint three floor zones from `TERMINAL_ITEMS.md`: Entrance (landside), Security (the only crossing), Departures (airside). Place entrance doors, one check-in desk, and one small security lane. Passengers already walk; they must queue and wait the service time on those items. Capsule people are fine. No passport, retail, or lounges yet.

**Done when:** A passenger cannot reach a gate without passing the security lane. Removing the lane makes an alert (no silent loop). The morning kit still drops a working premade hall.

### Slice 5 — Visible construction

**Goal:** A stamp is a short job you can see, not a pop.

**Scope:** From `DESIGN_PASS.md` §2 and `LOGISTICS_VISUALS.md`: planning can stay instant; committing a **small** stamp (stand, desk, guard post) plays a contractor van from off the map, through the guard post, to the site. Build time under about 10 seconds at 1x. The timer starts at commit, so a stuck van warns and delays, it does not freeze the build. The first-hour starter kit stays instant.

**Done when:** Placing one stand shows a van, then the stand. The starter kit does not wait on a van.

### Slice 6 — Guard post, fuel, and catering limits

**Goal:** Trucks carry a finite load. The guard post is a capacity, not a decoration.

**Scope:** This is BUILD slice 4 plus the capacities in `DESIGN_PASS.md` §3 and `LOGISTICS_VISUALS.md`. Bowser tank, farm stock, a refill warning around 25%. Catering truck stock. Guard post: a short dwell per truck; a queue when two arrive together. Vans from slice 5 use the same gate. Do not add a pipeline or a rail tank car yet.

**Done when:** An empty bowser drives to the farm before the next refuel. A missing guard post still hurts (that rule is already live). Two trucks at one post visibly wait.

### Slice 7 — Cargo start, one step deeper

**Goal:** The cargo route stays a real game after the first freighter.

**Scope:** Cargo kit already exists. Add the volume letter’s progress to the cargo HUD in a way that survives save (the save part is done) and one screen building **or** a visible loader at the freighter — pick one, not both. Follow `LOGISTICS_VISUALS.md`: batches, not per-box agents.

**Done when:** `scripts/soak-cargo-start.mts` still passes, and a cargo-only field earns a fee with the new picture on screen.

### Slice 8 — Airline tiers you can feel

**Goal:** Bushline and Summit want different buildings.

**Scope:** From `DESIGN_PASS.md` §5: a tier row in the Airlines panel (who is locked, and why). One Standing 82+ perk that changes the hall (a lounge flag is enough). Do not add five new airlines.

**Done when:** With Field Level 1, a higher tier’s letter explains the lock. At Standing 82+ the perk is visible on that carrier’s row.

### Slice 9 — Tycoon hooks

**Goal:** Money has a decision in it.

**Scope:** One of: a passenger fee slider, a single tenant slot on a shop, or one objective letter (“serve 200 passengers”). Not all three. From `DESIGN_PASS.md` and `PLAYER_FEEDBACK.md`: the economy has to be able to pinch, and the goal has to be readable.

**Done when:** Changing the one new lever changes cash or Standing on the next turnaround, and the objective letter expires if ignored.

## Suggested next three

1. **Slice 2** — bottom toolbar and letters from the left. Every session feels this.
2. **Slice 3** — economy chart. The owner asked for it in the same UI pass, and the numbers already exist.
3. **Slice 4** — three zones and check-in / security that passengers actually wait at. That is the terminal game. Construction vans (slice 5) should follow, because they need a gate picture the player already understands.
