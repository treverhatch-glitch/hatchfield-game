# Hatchfield devlog — 13 Oct 2026

Audit session. The owner does not need the code; this file is the timestamped record for the YouTube devlog. Times are UTC.

Media lives in `docs/devlog/media/`. Playtest stills live in `docs/playtest/`.

## What happened

**08:51** — Read `README.md`, `ADDITIONS.md`, `DESIGN.md`, and `docs/` (`GROK_HANDOFF`, `VISION`, `BUILD`, `HAND_OFFS`, `PROBLEMS`, `NEXT`, `EXECUTION`). The live game is past BUILD slices 1–3 (bags, guard post, cargo start). Slice 4 is fuel capacity, and it is not started.

**08:55** — `npm install`, `tsc -b`, `oxlint`, `npm run build`. Typecheck clean. Lint exit 0 with warnings only. Build clean, one large JS chunk (~1.05 MB).

**09:00–09:02** — Headless playtest (`scripts/playtest-audit.mts`) plus a direct sim run.

- Sim: one click placed one taxi. Loan did not wipe the field (47,800 → 50,300 over a long unpaid stretch). Passenger phases ran through takeoff (2 turns, peak 2 jets / 5 trucks / 61 hall guests) in 178 ms of CPU. Cargo kit has a guard and a shed and no hall; one UPPS turnaround completed.
- Browser: title, sandbox on/off, Passenger and the route cards, starter kit, Northline letter, approach / landing / servicing, hall (29 guests), bridge loan, all six tabs, every build category, WASD while paused. No page errors.
- The script then crashed in its own FPS helper (`__name is not defined` in `page.evaluate`), so it never wrote the cargo screenshots or the 90-second FPS series. That is a test-harness bug, fixed in the script afterwards. Cargo screenshots were taken in a later short pass.

**09:08** — Filmed BUG-001 before the fix (5.4 s) and shot the other bugs. Confirmed: a fresh visit with a save does **not** show the title (`fresh visit on title false`). A cargo volume job is **null** after reload. Paused WASD does move the camera.

**09:10–09:13** — Fixes, then after stills and a 12 s clip of the jet card sitting clear of the checklist.

**09:13–09:15** — Full playthrough recording, 139 s, 11 MB.

**09:16** — Cargo browser check: kit reports `fits: 0`, `guard: 1`, `shed: 1`. Frame rate on this VM at 5x with SwiftShader: about 8 FPS. Treat that as software GL, not a desktop figure.

## Bugs

Six. Videos only for BUG-001 (the one a player sees as a broken layout). The rest are stills.

### BUG-001 — Checklist covers the jet card

**Severity:** High.

**What you see:** The First hour list and the aircraft card are both anchored at the top-left. The list is opaque and paints on top, so during the whole first turn you cannot read the jet (model, destination, fuel, catering).

**Repro:** New Game → Passenger → Starter kit → sign the airline → wait until a jet exists → hover it (or let the hover card open) while First hour is still up.

**Before:** `BUG-001-before.png`, `BUG-001-before.webm` (5.4 s). The clip hovers the jet, then dismisses the list so the card pops out of the same corner.

**Fix:** `.inspect-card` now sits to the right of the checklist (`left: 312px` in `src/index.css`).

**After:** `BUG-001-after.png`, `BUG-001-after.webm` (12 s). Both panels are readable at once.

### BUG-002 — A new truck box every frame

**Severity:** High for a long session. Invisible.

**What you see:** Nothing, until the tab gets heavier. `World.syncEntities` built `new THREE.BoxGeometry(1.1, 0.55, 0.7)` on every rendered frame, even when no truck was new. Departed jets, trucks, and people were removed from the scene and never disposed. Hover ghosts were cleared the same way.

**Repro:** Read `src/render/world.ts` around the old `truckGeo` line. No screenshot — there is no on-screen symptom in a short session.

**Fix:** Geometry is created only when a truck mesh is created. Removed aircraft, trucks, people, and ghost meshes dispose their geometry and materials.

**After:** No clip. Typecheck clean. Worth a desktop FPS pass later; this VM’s 8 FPS is SwiftShader.

### BUG-003 — Cargo volume letter dies on refresh

**Severity:** Medium.

**What you see:** An active “volume window” letter (stage N units through the shed) is gone after reload. The headless check logged `volume after reload null`. The save JSON did not contain the job. `fieldTask` was saved; this one was not.

**Repro:** Have a save, set or receive a cargo volume job, note the letter, reload.

**Before:** `BUG-003-before.png` (letter up), `BUG-003-before-reload.png` (letter gone).

**Fix:** `cargoVolume` is on `GameSnapshot`, written in `persist()`, restored in `load()`.

**After:** `BUG-003-after.png` (12/40u still on the letter after reload). Node check: id `vol-devlog` round-trips.

### BUG-004 — A save skips the title

**Severity:** High.

**What you see:** Open the game in a new visit while a save exists and you are already on the apron. Continue, New Game, and the sandbox toggle never appear. Separately, New Game did not delete the previous save, and a refresh on the route cards rebuilt a default `Game` (sandbox cash and the difficulty choice dropped). `bootScreen` loaded any save before it looked at the title.

**Repro:** Play until a save exists (autosave is about every 8 sim seconds). Close the tab. Open the game again.

**Before:** `BUG-004-before.png` (straight into the field). `BUG-004-land-cash.png` is the route screen before that class of refresh (sandbox cash showing).

**Fix:** A new visit with an empty session stays on the title. A same-tab refresh mid-play (`sessionStorage` screen `play`) still resumes. New Game deletes the save key and stores sandbox + difficulty for a refresh on the route cards.

**After:** `BUG-004-after.png` — title, Hatchfield heading, Continue visible. The script asserted both.

### BUG-005 — Hall speaks in code

**Severity:** Low.

**What you see:** The guest card said `At entrance`, listed `landside 0.55` style prefs, and the hall hint said “landside → security choke → airside”. The vocabulary rule is that players see Before security / gates, not those words.

**Repro:** Enter the hall with guests and select one. Also read the line under the hall view.

**Before:** `BUG-005-before.png` (hint line), `BUG-005-card-before.png` (card from the playtest, `docs/playtest/11-hall.png`).

**Fix:** Room labels from `NODE_POS` (“At Gate”, “At Doors”). The pref dump is gone. Copy says “Before security” and “doors → security → gates”, including the enter-hall news line.

**After:** `BUG-005-after.png` — “At Gate”, “Before security”, security choke still announced, no `landside` figure.

### BUG-006 — Docs name the wrong save key

**Severity:** Low.

**What you see:** `README.md` and `docs/PROBLEMS.md` said `apron-save-v24`. The code constant is `apron-save-v25`.

**Repro:** Search the repo for `apron-save-v24`.

**Before / after:** No media. Both lines now say `v25`. README also says a new visit shows the title and a same-tab refresh resumes.

## Playthrough

`playthrough.webm` — **139 seconds**, about 11 MB, 1280×720.

Title (sandbox on) → New Game → Passenger → Economy → Starter kit → 3x → sign the contract → watch the field → Hall → back to the apron → Bridge loan → Airlines → 5x → Pause.

## Camera check (not a bug)

`BUG-cam-paused.png` — apron after a paused W press. The picture hash changed, so WASD is moving the camera and not only the jets.

## Every media file

Devlog:

- `docs/devlog/media/BUG-001-before.png`
- `docs/devlog/media/BUG-001-before.webm`
- `docs/devlog/media/BUG-001-after.png`
- `docs/devlog/media/BUG-001-after.webm`
- `docs/devlog/media/BUG-003-before.png`
- `docs/devlog/media/BUG-003-before-reload.png`
- `docs/devlog/media/BUG-003-after.png`
- `docs/devlog/media/BUG-004-land-cash.png`
- `docs/devlog/media/BUG-004-before.png`
- `docs/devlog/media/BUG-004-after.png`
- `docs/devlog/media/BUG-005-before.png`
- `docs/devlog/media/BUG-005-card-before.png`
- `docs/devlog/media/BUG-005-after.png`
- `docs/devlog/media/BUG-cam-paused.png`
- `docs/devlog/media/playthrough.webm`

Playtest stills:

- `docs/playtest/01-title.png`
- `docs/playtest/02-title-sandbox-off.png`
- `docs/playtest/03-title-sandbox-on.png`
- `docs/playtest/04-choose-start.png`
- `docs/playtest/05-pax-empty.png`
- `docs/playtest/06-economy-before-kit.png`
- `docs/playtest/07-pax-starter.png`
- `docs/playtest/08-pax-letter.png`
- `docs/playtest/09-pax-signed.png`
- `docs/playtest/10-flight-approach.png`
- `docs/playtest/10-flight-landing.png`
- `docs/playtest/10-flight-servicing.png`
- `docs/playtest/11-hall.png`
- `docs/playtest/12-loan.png`
- `docs/playtest/13-one-taxi.png`
- `docs/playtest/14-cam-before.png`
- `docs/playtest/15-cam-after-wasd.png`
- `docs/playtest/16-5x-start.png`
- `docs/playtest/19-cargo-empty.png`
- `docs/playtest/20-cargo-starter.png`
- `docs/playtest/22-cargo-5x.png`
- `docs/playtest/99-crash.png` (playtest script failure, not a game crash)
- `docs/playtest/tab-economy.png`
- `docs/playtest/tab-budget.png`
- `docs/playtest/tab-research.png`
- `docs/playtest/tab-airlines.png`
- `docs/playtest/tab-planner.png`
- `docs/playtest/tab-services.png`
- `docs/playtest/build-pavement.png`
- `docs/playtest/build-stands.png`
- `docs/playtest/build-terminal.png`
- `docs/playtest/build-ops.png`
- `docs/playtest/build-landside.png`
- `docs/playtest/build-bulldoze.png`
- `docs/playtest/report.json`

## Slice A — 13 Oct 2026, after the audit

Same branch. Three commits: a test safety net, the Cities-style UI, and aircraft that use real-ish loads and fly on and off the map.

**Safety net.** Vitest (14 tests). Bag math and payroll/loan math live in their own modules; the sim calls them and plays the same. GitHub Actions runs typecheck, lint, tests, and build.

**UI.** Bottom categories keep an item tray open (icon, name, price, tooltip). Top bar shows cash, income per hour, day and time, speed, Field Level and XP, average Standing, and alerts. Contract letters slide in from the left; open one for terms, what is met and missing, and Accept / Decline / Later. Extra letters sit in an inbox. Economy has Overview, Income, Expenses, Loans, and Charts (cash, income vs expenses, passengers per day, cargo per day).

**Aircraft.** Each type has seats, a bag cap, a cargo hold, and a fuel load, taken from rounded public figures. Passenger, bag, and cargo counts and the turnaround follow the type. Jets spawn off the map, fly a descent onto the runway, and after takeoff climb out past the map edge before they disappear.

**Bugs.** No new ones. The count stays at six (BUG-001 through BUG-006).

**Tests.** 14 passing.

**New media**

- `docs/devlog/media/SLICE-A-toolbar.png` — category bar and item tray
- `docs/devlog/media/SLICE-A-letter.png` — contract card from the left, requirements, Accept / Decline / Later
- `docs/devlog/media/SLICE-A-charts.png` — economy charts on the field
- `docs/devlog/media/SLICE-A-charts-panel.png` — the four line charts
- `docs/devlog/media/SLICE-A-approach.png` — jet on the approach, still outside the map
- `docs/devlog/media/SLICE-A-departure.png` — same jet rotating for departure
- `docs/devlog/media/SLICE-A-ui.webm` — short UI pass (about 6 s)
- `docs/devlog/media/SLICE-A-departure.webm` — approach through departure (about 26 s)

## Slice B — terminal interior, 13 Oct 2026

Same branch. The morning kit is still one click. It drops a prefab hall that already works, with ceilings you can read: 28 passengers, security 20 per minute, bags 70, upkeep $90 a day. A bigger bank queues at the one scanner. Upgrade the prefab (tier II and III, more throughput, more upkeep) or paint the floor and place items, which drops the bundle discount.

**Zones.** Check-in, Security, Gates, Arrivals, Shops / Food, Toilets. Pick a zone and the menu only lists what fits there. The hall is a walled shell with the roof cut away, coloured floors, and door gaps in the security wall.

**Items.** The twelve starters (doors, queue rail, check-in desk, kiosk, small security lane, secure exit, seats, boarding desk, bag claim, bag hall, toilets, café) plus a wayfinding sign. Bigger lanes, a twin desk, family toilets, and a restaurant unlock with Field Level. They are faster or richer and cost more to run. Nothing is free. Wear slows the lane until you scrub.

**Passengers.** They walk curb → check-in → security → whatever they need → gate → board. Arrivals come off the jet to claim and the doors. Pathfinding looks five junctions ahead; each sign adds two. A missed path, or a full security queue, pins them as lost and raises an alert. They cannot reach a gate without clearing security. Click a person for mood, thought, and needs.

**Bugs.** No new ones. The count stays at six (BUG-001 through BUG-006).

**Tests.** 24 passing. Ten new ones cover lane throughput (20 per minute, one-at-a-time service, overflow turned away), wear slowing service, the security choke, the five-junction cap and signs, prefab upgrade cost and upkeep, the Field Level lock, and a live departure wave that queues and stays off the gate.

**New media**

- `docs/devlog/media/SLICE-B-prefab.png` — prefab shell, 28 passengers, security 20/min, bags 70
- `docs/devlog/media/SLICE-B-zones.png` — painted shop floor, custom hall, prefab discount off
- `docs/devlog/media/SLICE-B-item-menu.png` — security zone menu, bigger lanes locked to Field Level
- `docs/devlog/media/SLICE-B-bottleneck.png` — twelve waiting, two lost, alert pins
- `docs/devlog/media/SLICE-B-upgrade.png` — Prefab II, 48 passengers, security 60/min, higher upkeep
- `docs/devlog/media/SLICE-B-bottleneck-fixed.png` — same wave after the upgrade, queue gone
- `docs/devlog/media/SLICE-B-journey.png` — passengers mid-hall on the way to the gate
- `docs/devlog/media/SLICE-B-journey.webm` — full walk, about 21 s
- `docs/devlog/media/SLICE-B-bottleneck.webm` — queue forms, then the upgrade clears it, about 18 s

## Slice C — schemes, overload, construction, 13 Oct 2026

Same branch. Prefabs are the teaching loop and the first hour, not the finished airport.

### Reference schemes

Flow on every tier, in order: curb, check-in hall, one central security checkpoint, an airside concourse with gates and shops / food / toilets, and a separate arrivals path with bag claim and a way back out to the curb. Departures do not skip security. Arrivals do not walk the departure pier to leave.

**Prefab I · Linear.** A small regional terminal with one pier. Reference: London City. One curb, a check-in hall, a single security row, then one concourse. Arrivals sit beside the checkpoint and exit on the curb side. Signs: 2. Ceilings stay 28 passengers, security 20 per minute, bags 70.

**Prefab II · Pier.** A mid-size finger. Reference: the classic finger pier (FAA AC 150/5360-13), the kind of concourse Baltimore runs. The processor holds check-in, one security line, and arrivals. A finger sticks out with gates along it and shops and toilets on the pier. Signs: 3. Ceilings: 48 passengers, security 60 per minute, bags 140.

**Prefab III · Satellites.** A large processor feeding two satellites. Reference: Tampa, the landside building that sends people out to airside satellites (the same family as Atlanta’s central terminal and concourses). Curb and check-in are in the processor, one checkpoint, a bridge, then a north satellite and a south satellite. Claim and the exit stay in the processor. Signs: 4. Ceilings: 80 passengers, security about 129 per minute, bags 260.

### Overload

Paths do not drop passengers, at any load. When the bank is bigger than the prefab, the line gets longer, screening slows, happiness falls, flights slip, some people miss the gate, and Standing drops. Nobody is marked lost and nobody is thrown away for being the 81st person in the hall. The Design Advisor then says to upgrade the tier, expand the checkpoint, or design your own terminal. A custom hall can still be flawed. The advisor checks an unreachable gate or zone, a path that skips security, a dead end, a walk past the five-junction cap, a checkpoint or check-in that cannot clear the bank, bag claim too far, and toilets out of range.

Passenger routes, flow lines, junction and sign reach, and congestion heat are a separate overlay. It is off until you tick **Show passenger flows** or press **F**. Advisor highlights reuse that layer and do not turn the whole overlay on.

### Construction

Placing a building spends the money and leaves grass plus scaffolding until a short timer finishes. The timer scales with size and caps at 12 seconds. A contractor van drives in from off the map through the guard post, and a delivery truck follows: travel, unload, travel. If the van is late the build warns and slips a moment; it does not freeze. Cancelling refunds 40 percent. The starter kit is still instant. Progress shows on the site and in a small tooltip.

### Bugs

Nine. BUG-001 through BUG-006 stand. Three more:

### BUG-007 — A finished flight’s payment vanished before the test could see it

The integration test “starter kit → signed airline → flight completes and cash posts” failed sometimes on the ledger check. Revenue had risen, but the aircraft was already removed from the field in the same tick it departed, so no remaining flight showed a payment line. The run also depended on `Math.random`.

**Fix:** positive payment lines are kept when the turn leaves. The test uses a fixed seed and reads those lines in the tick the flight completes.

No still. Nothing on screen was wrong; the book just closed the page too soon.

### BUG-008 — A full security queue marked people lost and never screened them

Past the comfort cap, the lane set them lost and returned without serving. They could sit there forever. The hall also deleted anyone past 80 people.

**Fix:** the cap is comfort, not a locked door. Everyone waits in order and gets screened. Over the cap the line is slower, people are unhappy, the flight slips, and some miss the gate. The advisor asks for an upgrade. The silent delete is gone.

### BUG-009 — A need could point at a closed room

Hunger, energy, or play could send someone to the spa, pool, golf, or gaming when that room was not open. They stood there, got angry, and eventually left.

**Fix:** a need only routes to a room that is open. If the favourite is closed, they use food, a shop, the lounge, the gate, or the exit.

**Tests.** 42 passing. New ones cover each advisor check, a clean report for all three schemes, an overload wave per tier (zero lost, a queue past the comfort cap, a missed flight, and the upgrade prompt), construction time, the instant starter kit, progress without the van, the 40 percent cancel refund, and the van’s path through the guard.

**New media**

- `docs/devlog/media/SLICE-C-linear.png` — Prefab I, linear pier, 28 passengers
- `docs/devlog/media/SLICE-C-advisor.png` — over-capacity note: upgrade, expand, or design your own
- `docs/devlog/media/SLICE-C-build.webm` — a stand from placement to open, chrome hidden, about 7 s
