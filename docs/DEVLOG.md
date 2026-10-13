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

## Slice D — fuel, catering, and the ramp, 13 Oct 2026

Merged `grok/logistics` (the ground module: fuel farm, catering, service vehicles, and the full turnaround, including boarding and bags) and wired it into the apron.

The fuel farm was already a stamp. It is Field level 1. Two new stamps sit in Ops:

- **Catering kitchen**, Field level 2. Cooks the meals the galley trucks load.
- **Vehicle depot**, Field level 2. Stages the fleet. A second depot adds another set of trucks.

Both need a road, taxiway, or stand beside them. The starter kit still drops the farm, the snack bar, and the stands in one click, and it does not include a depot. Until you place a depot, the old fuel and catering trucks keep the first hour. Prefab halls are unchanged: a heavy bank still loses nobody.

Once the depot and the farm are both on the field, a blocked-in aircraft is a turnaround. Fuel trucks, galley trucks, bag tugs, loaders, a GPU, buses, and the pushback tug drive the service roads to the stand. They follow the pavement. Pushback waits until that turnaround is finished. If the ramp never clears, the aircraft eventually pushes and Standing dips, so one missing truck cannot freeze the airport.

Money from the module posts straight into cash and the hour book: fuel sales, catering fees, fuel purchases, meal production, and vehicle upkeep. The old fuel and catering payouts do not also fire on those turns.

The Design Advisor shows a low farm, a kitchen that is empty or missing, and a late turnaround with the reason in plain language: no truck, no loader, no fuel, no meals, no bridge, slow boarding, late passengers, late bags, or a bag pulled off. Clicking the note rings that apron tile.

**Bugs.** Still nine. Nothing new failed in the wiring. BUG-001 through BUG-009 stand.

**Tests.** 101 passing. The new ones cover the Field level gate, the starter kit staying on the old fuel truck, a connected service-road graph, a turnaround that pays fuel and catering and then releases the aircraft, trucks that stay on truck pavement, and the missing-kitchen alert. The three prefab overload waves still finish with zero lost passengers.

**New media**

- `docs/devlog/media/SLICE-D-tray.png` — Ops tray: fuel farm is open, kitchen and depot read Field 2
- `docs/devlog/media/SLICE-D-advisor.png` — "Catering kitchen running low" with the place-a-kitchen fix
- `docs/devlog/media/SLICE-D-ramp.png` — service trucks on the apron, chrome hidden
- `docs/devlog/media/SLICE-D-ramp.webm` — those trucks driving the service road, chrome hidden, about 6 s

### BUG-010 — Sandbox paid the city levy

**What you see:** Sandbox cash starts at $9,999,999. Every payroll tick (about every 30 seconds) the city levy takes 3% of everything above $140,000. After buying the city plot the pile is $9,904,999, and the levy is $292,950. The trial bank drains by about $293,000 a tick.

**Fix:** Sandbox is exempt. A normal game still pays. Easy cash after land and the starter kit is $77,000, and standard after land is $55,000, so both sit under the $140,000 floor and pay nothing. A grown field at $150,000 pays $300, at $220,000 pays $2,400, and at $500,000 pays $10,800. That is 3% of the surplus only, once per payroll tick.

Bug count is ten.

## Owner decisions — 13 Oct

Four rulings for the live sim. Bug count stays at ten.

**Fuel.** A departure that still needs fuel stays on the stand when the farm, the contract, or the bowser loads are empty. The headline says it is grounded, Standing drops once, and the slot slips. When a load comes back, pushback waits on the bowser. Catering, bags, a missing loader, and the other ramp gaps still delay the turn and hit Standing, and those aircraft can leave once the safety timer runs out. A type with no fuel uplift is free to go.

**Bottlenecks.** The starter kit no longer parks threats and emergency asks behind a long first-hour clock. A missing security lane, a thin security budget, an empty farm, or a thin fire crew is checked again in a few seconds. A staffed lane with fuel and a fire station keeps a calmer cadence. Queues, missed flights, and the prefab rule (nobody lost, even when the hall is over capacity) are unchanged.

**Empty shops.** Food and souvenir shelves are finite and restock slowly. An empty counter does not take the money. The passenger loses a little happiness (less than being broke), thinks "wish they had burgers" or "wish they had a souvenir", walks off toward the gate, and the unpaid price is added to lost spend. That total is in the Shops submenu.

**Info views.** Security, lost passengers, bags, shops, and the fuel farm are hotspot buttons, and the hall and apron draw the rings whether or not passenger flows are on. The counts open only after a click. Flow lines stay off until the player asks for them.

**Tests.** 107 passing. Five new ones cover the fuel hold, a non-fuel ramp release, the shorter gap cadence, the empty counter, and the click-to-open counts.

**Media**

- `docs/devlog/media/OCT13-info.png` — Security opened, "0 waiting at security", flow lines still off
- `docs/devlog/media/OCT13-wish.png` — empty food counter, thought "wish they had burgers"

## Passenger luggage — 13 Oct

Checked bags are a book per flight, not one agent per suitcase. The hall and the apron draw a short parade on top of that book: a belt, a hold-bag scanner, a baggage hall, a claim carousel, and a cart.

What you see:

- Departures roll in with a yellow checked bag and a blue carry-on. The checked bag stays with them until the desk, then it leaves them and the belt takes it.
- The belt runs from check-in through the scanner into the baggage hall. The scanner holds the drop for a little over a second, then the bags sort.
- A loaded cart sits on the apron. Bag trucks show the crate and the suitcases. Logistics tugs and belt loaders pull a small cart of bags. Suitcases also slide along the painted belt.
- Arrivals wait at the carousel until their flight's bags are on the belt. They pick the bag up ("Got my bag") and the yellow case is back on them. The carry-on never left.
- The Bags submenu includes how many bags were lost.

Prefab halls I, II, and III never lose a checked bag. Screening always passes. If a cart stage is skipped, the book still fills the later counters from what was dropped, and an inbound claim fills from the flight's units. A custom hall with no bag building and no belt can lose the unscreened drop. That is the same teaching rule as passengers: the prefab is flawless, a hall you redesign can have a hole.

Arrivals stay at the carousel until the bag is in their hand. They no longer walk off in the same moment the belt delivers.

The graphics agent's terminal-life render (`src/render/world` from that PR) was not on origin yet, so it is not wired. People, assets, airlines, and cargo stayed on their own branches.

**Bugs.** Still ten. Nothing new failed.

**Tests.** 115 passing. Eight new ones: the book (carry-on on every passenger, a checked bag on departures, prefab screening, a bare custom hall losing a drop, a skipped cart that still conserves units) and a stress pass on each prefab tier from the desk through the aircraft to the carousel with zero bags lost. The three overload waves still finish with zero lost passengers.

## Bag tags — 13 Oct

Each checked bag is now a lightweight record with the passenger's id and the flight's id. The book of units stays. Bags do not pathfind. Only the ones on screen get a mesh, and the lost-bag desk draws at most four.

What you see:

- At reclaim, each arrival waits until their own bags reach the carousel, picks them up, and walks to the exit. Two people on the same flight do not collect at the same moment.
- A transfer bag follows that passenger onto the connecting flight.
- A missed connection, or a bag that never reaches the belt, sends the passenger to the lost-bag desk beside claim. Happiness drops by 8, once. The thought reads "Lost-bag desk — my bag missed the connection" or "Lost-bag desk — my bag is late". After a short wait the desk hands the bag over. The mishandled count stays.
- The Bags submenu includes how many were mishandled.

Prefab halls I, II, and III show zero mishandled bags under a normal load. A slow carousel makes people wait. It does not mark the bag late. An overloaded hall, or one you redesigned, can miss a connection or run late. Prefab overload waves still lose no passengers.

**Bugs.** Still ten.

**Tests.** 121 passing. Six new ones cover the tag itself, staggered reclaim, a transfer that makes the connection, a missed connection at the desk, a prefab that waits out a slow carousel, and owner pairing on a live arrival wave. The overload waves use a fixed seed so a missed flight does not depend on which test ran first.

**Media**

- `docs/devlog/media/LUGGAGE-desk.png` — lost-bag desk, yellow bags on the counter, thought "Lost-bag desk — my bag missed the connection", chrome hidden

## Logistics from PR #5 — 13 Oct

The trunk already had an older copy of the ground-logistics module. The newer copy from the logistics branch is the one in the game now. The apron still calls it the same way: the depot and the fuel farm build the service-road graph, trucks drive that graph, and the books still post fuel, meals, and upkeep.

Balance, so a mid-size airport is not a fuel mint:

- Fuel pays the airport a throughput fee of $0.012 per litre on top of the $0.70 purchase price. The old 15% markup is gone.
- A meal costs $4.50 to make and earns a $6 fee.
- Belly cargo on a passenger flight is 30% of the hold.
- Vehicle stickers are about one tenth of the real price. The fleet that comes with a depot is free.

An empty farm still holds a departure. If that hold lasts past the departure slot (12 sim-seconds, a bit over an hour and a half of game time), the flight is cancelled and Standing drops. A short outage still only grounds the aircraft.

The shared clock and bank from the economy branch have not landed. That branch is still open, and taking it now would remove the luggage pairing, so it stays separate.

**Bugs.** Still ten.

**Tests.** 156 passing.

## Diplomacy, airlines, and the asset list — 13 Oct

Airline relations from Diplomacy V2 now sit on the same clock as the field. One sim day (180 seconds) is one diplomacy day. The adapter is built once, saved with the field, and ticked every step. A finished turnaround grades the carrier. A fuel cancellation, a scrubbed slot, or a hold that diverts counts as a missed flight. Weather on the slot is excused. A signed carrier's landing fee uses their fee discount, a capacity cut shortens the next bank of slots, and a hostile airline can slow the turnaround, refuse gates, or add delay. Letters and a short standing list sit in the corner chrome. Accepting a letter puts that carrier on the timetable. Northline, once signed in the usual way, is the same Northline inside diplomacy, so grades stick.

The airlines module is in the tree with the flight-event type imported from its logic file, which is what the airlines tests already expected. Turnaround grades are also written into that module's satisfaction, so a string of bad turns can end the parallel contract.

The asset pack v2 manifest and folder note are in the tree. The Drive zip is about 39 MB and private. The Drive connector stops at 10 MB, and a plain download hits a Google sign-in page, so the WebP and PNG files are not in this commit. The manifest test skips until `public/assets/v2/textures/` exists. If the pack is large when it lands, commit the WebP files and leave the PNG twins out.

**Bugs.** Still ten.

**Tests.** 301 passing, 1 skipped (the asset binaries).

**Media**

- `docs/devlog/media/OCT13-diplomacy.png` — airline standing list after one sim day: Northline, Puddle Air, Coastal Hop

## Catering trucks and the cargo terminal — 13 Oct

A parked passenger flight now books a galley. The truck loads at the kitchen, drives to the stand, the crew steps out, the scissor lift goes up, used carts come off, fresh carts go in, the lift comes down, and the crew drives back. The ramp does not also send its own catering truck. When the galley is done or short, boarding is allowed to start, and the $6 meal fee posts once into the same books as fuel.

An empty counter still takes no cash. The shop module supplies the wish and the mood hit: happiness drops by 3, the thought is "wish they had burgers" or "wish they had souvenirs", and the unpaid price ($12 or $18) is logged as lost spend.

The fuel check reads the farm's litres and reserves them in departure order. A flight that does not fit stays grounded and skips the fuel service. The empty-farm cancel after the departure slot is unchanged.

Cargo is on the same game-minute clock as the ramp. A freighter asks for a main-deck loader, and that truck is held so another stand cannot take it. The load is planned before the turnaround starts, so the hold is not counted twice. Inbound tug trips share one import shipment. Only the airport's share of cargo revenue, scaled to a tenth so a freighter does not swamp a landing fee, hits cash. The handler's share stays off the books. A missing loader is an advisor card. Cargo and ramp events play through the audio bindings. Passenger bag pairing is unchanged.

**Bugs.** Still ten.

**Tests.** 395 passing, 2 skipped (the asset binaries).

**Media**

- `docs/devlog/media/OCT13-catering.png` — scissor lift up at the stand, driver on the lift and helper at the galley, chrome hidden

## Playtest blockers from the QA bot — 13 Oct

**BUG-011.** A passenger flight could push with almost none of its checked bags and still be marked loaded. An A380 could leave 0 of 193, stage `inflight`, and the book treated that as a full load. A short cart now holds the departure through the boarding window. If the bags still are not there when the window ends, the flight is released, Standing takes a hit, and the missing count is stored as offloaded. The stage does not become "on board". Prefab halls under a normal load still mishandle nothing, and nobody is marked lost. A widebody that dumps more bags than the claim hall can hold records the overflow every time, instead of a coin-flip "claim jammed" line.

**BUG-012.** The hourly cash figure stayed at $0 whenever the last closed hour happened to book no landing, even if the open hour or the hours around it had earnings. The readout now uses recent hours that actually earned, including the hour still in progress. The city levy is still 3% of cash above $140,000, and sandbox is still exempt, but it is taken once per sim day. Charging it on every payroll tick was six times a day, about 18% of a large bank, which is what turned a $12 million field into a $1.3–1.8 million daily burn. A two-day bot run on that same fat non-sandbox pile now drops about $350,000 a day, which is one levy plus payroll.

The build tray no longer opens on Pavement by itself. The apron, including the southern stands, stays visible until a build category is clicked. Clicking that category again collapses the tray.

PR #5's logistics tip is an older engine. Laying it over this branch deletes heavy vehicle tiers, the breakdown and undersized-vehicle delay lines, `poses`, and `openTurnarounds`, and `tsc -b` reports those four errors. This branch already has the newer engine, and `tsc -b` here is clean. That older tip should not be merged over these files.

The HUD redesign's Starter kit button was visible, but the press scrolled the panel before the click finished, so prefab I never landed. The panel no longer focuses a button in a way that steals the click, and a sandbox pile is no longer shown a city-levy estimate (the sim does not charge it). New Game, the budget tab, and Close keep their test ids.

**Bugs.** Twelve.

**Tests.** 398 passing, 2 skipped (the asset binaries). The QA bot (`tests/e2e-bot`, mixed, 2 in-game days) reported no unrecorded short bag loads, no stuck flights, and no console errors. Missed flights under the overloaded prefab and the SwiftShader frame rate are unchanged.

**Media**

- `docs/devlog/media/OCT13-tray-closed.png` — apron with the build tray collapsed, starter field placed
- `docs/devlog/media/OCT13-tray-open.png` — Pavement tray after it is opened on purpose


**Media**

- `docs/devlog/media/LUGGAGE-hall.png` — check-in, baggage hall, carousel, carry-ons and checked bags, chrome hidden
- `docs/devlog/media/LUGGAGE-checkin.png` — closer on the desk, bags still on the passengers
- `docs/devlog/media/LUGGAGE-claim.png` — carousel with bags and people waiting
- `docs/devlog/media/LUGGAGE-apron.png` — suitcases on the belt and the bag cart, chrome hidden
- `docs/devlog/media/LUGGAGE-hall.webm` — the belt and carousel moving, about 3.5 s

## World render — 13 Oct

The apron now draws through the Slice E layer (`src/render/world/`, `docs/GRAPHICS.md`). `World` calls `initWorldRender` once, skips the grass, runway, taxi, stand, road, and terminal meshes that layer redraws, and calls `update` every frame. At 5× the layer switches to its light mode: shadows and the near grass ring drop, and a rebuild is not forced. Software GL picks the low preset on its own. The closest camera distance is 12, so the hall cutaway can open.

**BUG-013.** `resize` compared the canvas drawing buffer (device pixels) with the CSS size. Whenever the pixel ratio was not 1, `setSize` ran every frame and reallocated the buffer. The check is now CSS size times the pixel ratio. A half-second sample after the first frame called `setSize` zero times.

**BUG-014.** The horizon disc sat at the same height as the tiles (`y = 0.02`), so it z-fought the field and washed it blue. It now sits under the earth disc. The world layer hides both discs and draws the sky itself.

**BUG-015.** Rebuilding the apron called `tilesGroup.clear()` and dropped the per-tile geometries and materials. Every bulldoze or new building leaked that GPU memory. The group is disposed before it is cleared.

**BUG-016.** Leaving 5× wrote `shadowMap.enabled = true`, so a low quality preset could not keep shadows off. 5× now goes through `setLiteMode`. In the browser, medium turns shadows on, 5× turns them off, 1× on medium turns them back on, and low at 1× stays off.

**Bugs.** Sixteen.

**Tests.** 444 passing, 2 skipped (the asset binaries). The QA bot (`tests/e2e-bot`, mixed, 2 in-game days) after this wiring reported no unrecorded short bag loads, no stuck flights, and no console errors. Missed flights under the overloaded prefab and the SwiftShader frame rate are unchanged. Bank on that run: $12,830,714, then $12,455,341, then $12,087,724.

**Media**

- `docs/devlog/media/OCT13-world-mid.png` — starter hall, runway paint, taxi edges, and the tree line, low preset
- `docs/devlog/media/OCT13-world-close.png` — jet bridge, glazed terminal, and stand markings
- `docs/devlog/media/OCT13-world-wide.png` — the same field from the far camera

## Aircraft scale and jet bridges — 13 Oct

Aircraft draw at 0.45 world units per meter. A 1.75 m person is about 0.79 world units, the same height as the apron capsules. Service trucks stay the short boxes they already are. The people meshes on the other branch are modeled in meters; when those are wired they need the same 0.45 scale. Taxiways were left as they are: a jet is meant to cover about three tiles.

Stands are still S, M, and L. Assignment treats those as ICAO B, C, and F, and a helicopter still needs a helipad. A stand is also refused when its wingspan disc meets another parked jet or a terminal tile, with 0.4 world units of gap. On the starter kit both stands take a 737 and refuse an A380. A stand one cell from a parked 737 is refused. In the browser a parked 737 measured about 16 by 18 world units, clear of the hall, and the second starter stand's 737 did not overlap it.

An empty jetway shows a preview bridge: a regional jet on S, a 737 on M, an A380 set on L. The bridge's port side points at the nearest terminal. While a flight is parked the preview hides and the real bridges are parented on the aircraft root, so they are not scaled a second time. Those bridges sit outside the tile group, so a rebuild does not throw away the shared geometry. The world layer's rotunda bridge is unchanged. The camera opens closer (distance 54, pitch 0.68, field of view 34). The closest zoom stays 12 so the hall cutaway can open.

**Bugs.** Sixteen. No new defect.

**Tests.** 471 passing, 2 skipped. The QA bot (mixed, 2 in-game days) reported no unrecorded short bag loads, no stuck flights, no lost passengers, and no console errors. Four missed flights with the hall overloaded. Bank on that run: $12,830,714, then $12,435,720, then $12,085,386. Minimum frame rate 10 on SwiftShader. The bot still rewrites an airframe id after the stand is chosen, so a forced A380 can use a stand that was legal for the original type. The game's own assignment does not do that.

**Media**

- `docs/devlog/media/OCT13-aircraft-top.png` — 737 docked on the west stand, empty-gate bridge on the east stand, both aimed at the hall
- `docs/devlog/media/OCT13-aircraft-gate.png` — the same pair from the orbit camera

## One world scale — 13 Oct

Everything on the apron now shares one meter. `WORLD_PER_METER` stays 0.45. Aircraft are the only exception: `AIRCRAFT_VISUAL_SCALE` is 1.2, so a 737 is drawn at 0.54 world units per meter. The same 1.2 is in the wing disc, with a 4.5 m gap, so the bigger picture still clears the hall, the other stand, and the runway.

One cell is 22 m (9.9 world units). That is a code-E taxiway. Two cells is a code-4 runway width, three cells is about a code-F strip. Runway length stays in cells, so the strip is a short picture of a real runway rather than a 1,500 m pavement that cannot fit the map.

The starter stands stay at (12, 21) and (20, 21), eight cells apart. The through-taxi that used to run on the next two rows is gone, because a 737 wing covers that row. Each stand has its own lead-in. The runway starts on row 26, five cells south, which clears an A380 at the visual scale. A stand one cell away from a parked 737 is still refused. Trucks cross the stand row, and a curb road three cells north lets a mechanic leave a stand without driving through a wing.

People, trucks, the hall, the doors, and the furniture use the same 0.45. A mechanic is 1.85 m. A fuel truck is 8 m long. The hall roof is 3.9 m. Interior props were drawn as meters, so they shrink by 0.45 and the old furniture layout is stretched across the 22 m bay. Nav squares are one meter, so an eight-square opening is an eight-meter door.

In the browser the aircraft root stays at scale 1, the model and the bridges are at 0.54, and the bridges are parented on the aircraft. The two starter stands are 79.2 world units apart. The roof sits at 1.755. A fuel truck measures 3.6 × 1.35 × 1.125 world units, which is 8 × 3 × 2.5 m. No console errors.

**Bugs.** Sixteen. No new defect.

**Tests.** 471 passing, 2 skipped. The QA bot (mixed, 2 in-game days) reported no unrecorded short bag loads, no stuck flights, no lost passengers, and no console errors. Eleven missed flights with the hall overloaded. Bank on that run: $12,836,174, then $12,476,257, then $12,117,940. The SwiftShader frame rate is still under the bot's floor. The bot can still rewrite an airframe id after the stand is chosen; the game's own assignment does not.

**Media**

- `docs/devlog/media/OCT13-scale-top.png` — two 737s on the starter stands, lead-in taxi only, runway five cells south
- `docs/devlog/media/OCT13-scale-gate.png` — the same pair from the orbit camera, bridges on the hall side, truck and person at real size

## Playtest gate — 13 Oct

Outbound bags: a departure is not called loaded while the cart is short. The hold stays until the board window ends, then each missing bag is recorded as offloaded. A second check runs as the aircraft enters the taxi. Prefab halls under a normal load still show zero mishandled bags. The heavy bot and the mixed bot both finished with no unrecorded short carts.

Payroll and the city levy now close once per game day. The levy is half a percent of cash above $140,000. Sandbox still pays no levy. Early payroll is 75% of that day's operating income, or the old staff lines once, whichever is higher. After the first ten minutes it is 57.5%. On a first Northline day that landed about a 6% margin. The published mid-game case ($203k income, $35k other costs) lands inside 15–30%. A $12.5M bot field now loses about $60k a day, which is the daily levy, not the old $1.3–1.8M.

A helicopter that cannot get fuel uses the same slot limit as a jet, then the flight is cancelled instead of sitting in servicing.

**Logistics PR #5.** The vendored `src/logistics` is the source of truth. PR #5's tip is the older engine: it has no heavy vehicle tiers, no `DelayCause` labels, no `poses`, and no `openTurnarounds`. Overlaying it deletes those and brings back the 15% fuel markup. It can be closed as superseded.

**Modules.** Aircraft, world render, airlines, cargo, diplomacy, and catering were already on this branch. Audio picked up the newer ambience beds. Branding saves with the field and the top bar shows the airport name (still Hatchfield until a player rebrands). The flow audit measures the open hall and does not mark passengers or bags lost. The economy clock, bank, and tech-tree module are in the tree and the day close reads the bank. The features package (notifications, undo, reports, events, ratings, save, settings, camera) is in the tree. Those systems are not bolted onto the live news, weather, or save, because the sim already has each of those and a second copy would fight the first.

**HUD PR #4.** Not merged. The tip has no common history with this branch, no bag ledger, and no world scale. A merge would delete tens of thousands of lines, including the QA bot. It needs a rebase onto this branch before it can land.

**Gate.** `tsc -b` clean. `npm run build` clean (one large JS chunk). Vitest 631 passing, 2 skipped. Playwright is the QA bot. Mixed, 6 game days: no console errors, no NaN cash, no stuck flights or trucks, no lost passengers, no unrecorded short bags. Cash $12,842,859 down to $12,485,417. 21 missed flights with the hall overloaded. Heavy, 4 game days: same clean ledger, cash $12,842,859 down to $12,595,507, 31 missed flights with the hall overloaded, bag short 0, stuck 0. Frame rate on this VM was 10 fps mixed and 11 fps heavy, under the bot's floor of 12. That is SwiftShader, the same software renderer as the earlier runs. A 30-game-day headless playtest with one signed carrier and the starter kit stayed finite: zero lost passengers, zero bags lost, and the bank reached $0 after the timetable stalled and the staffing floor kept billing a quiet field. The bot's second prefab still reports one hall.

**Bugs.** Sixteen. No new defect.

**Media**

- `docs/devlog/media/OCT13-gate-a380.png` — heavy bot, A380 on the ground during day 1
- `docs/devlog/media/OCT13-gate-apron.png` — apron at the end of the heavy run

## Terminal doorways — 13 Oct

Hall guests now walk the same room plan the 3D terminal draws. Each graph edge becomes a `navPath` with `strict: true`. A blocked path is empty, and the guest is not marked lost. They wait where they stand instead of cutting through a counter.

Uncleared departures only get targets outside the sterile rooms (`airside`, `shops`, `gate`). The door graph already makes security the only bridge, so the polyline cannot step around it. A cleared walk from security to a gate crosses that bridge and comes out in a holdroom.

The airfield view draws those guests on the floor (`FLOOR_Y`) from `wx` / `wz`. Decorative walkers are off (`walkersPerCell` 0) so the two crowds do not stack. Seated figures at the gates stay. The abstract hall card still lerps the node graph; it is the thought and queue view, not the wall collision.

**Bugs.** Sixteen. No new defect.

**Tests.** `tsc -b` clean. Vitest 634 passing, 2 skipped. In the browser a departure routed toward the gate was given entrance → info → security, walked the polyline (still before security, not lost), and showed up as the red figure inside the cutaway hall.

**Media**

- `docs/devlog/media/OCT13-doorways.png` — roof off, red departure with a case in the check-in hall, security and a holdroom beyond

## Prefab security — 13 Oct

The starter hall was screening on one lane at three seconds, about 20 people a minute, with a comfort cap of 28. A worn lane doubled that time, and a crowd past the cap added 8% per body with no ceiling. A whole departure hit the doors in one tick. That jammed Prefab I on day two, before the player had added an airline.

Prefab I is now two lanes at 3.5 seconds, about 34 a minute, comfort cap 40. Each body past the cap adds 2%, and the slowdown stops at ×1.4. Wear is 0.7 per passenger. A fully worn lane is at most ×1.5. Departing passengers reach the doors across 45 seconds. An unstaffed lane stays ×1.35.

Prefab II is three lanes at 3.0 seconds, still 60 a minute, comfort cap 48. Prefab III is four lanes at 2.5 seconds, 96 a minute, comfort cap 80. Catalogue security items keep their own servers, times, and wear. Custom halls use the same overflow formula, so a line cannot run away. Crowd avoidance is not wired. Guests still walk the doorway graph.

The hall card on a fresh starter kit reads 40 passengers, security 34/min, bags 70. The upgrade line offers Prefab II at 48 passengers and 60/min.

**Bugs.** Sixteen. No new defect.

**Tests.** `tsc -b` clean. Vitest 636 passing, 2 skipped. In the browser the hall card showed those Prefab I numbers and the Prefab II upgrade.

**Media**

- `docs/devlog/media/OCT13-prefab-security.png` — hall card, Prefab I at 40 passengers and 34/min, upgrade to Prefab II at 48 and 60/min

## Security release — 13 Oct

The lane was screening people. A line of twelve at the checkpoint got two scanners working, and a one-airline field cleared 158 passengers over four days. They were not leaving the node.

Once a passenger was through, a later walk back to food or the gate was pathed through security again, because that node is the first neighbour of the gate. Stepping on it called the old instant-clear, which threw away the path and started a new route from security. Progress on the edge reset every couple of ticks. The daily count of bodies standing on that node climbed, check-in stayed near zero because that desk is a short dwell, and flights were missed by people who never stayed at the gate.

A cleared passenger who steps on security now keeps the path they already have. A trip that starts and ends after security takes the airside corridor when one exists. Uncleared departures still stop and wait for a scanner. Lane counts, service times, and the comfort cap are unchanged. The batch of departing passengers still arrives together at boarding, so missed flights under that spawn are still expected. A show-up curve is a separate piece of work.

Each departure now carries `bagsLoaded` and `bagsOffloaded`. The hall panel Close button is `panel-close`. The QA bot can sign one carrier with `--ramp 1`, and `--long` runs at least 12 days.

**Bugs.** Seventeen. BUG-017 is this stall.

**Tests.** A line at security is screened, leaves the node, and is on an airside room afterwards. A screened passenger walks to food without re-entering the checkpoint. One airline over four days keeps the waiting line under 16 while check-in is empty, and the end-of-day security node under 16. `tsc -b` clean. Vitest 639 passing, 2 skipped.

## QA gate — 13 Oct

Lane counts, service times, and caps stayed where the prefab tuning left them. The show-up curve is still a separate workstream.

The living hall is already in this build. A starter kit at noon, roof off, showed 25 staff figures, 33 seated passengers, and 78 people in the plan. After Northline's first turn, 23 passengers were walking the doorway graph and 23 of them had a case on the floor. Twenty-five checked-bag tags belonged to 21 owners, none unpaired. `bagsLost` 0, `bagsMishandled` 0, lost passengers 0 on that pass. The one hired desk body stands at check-in. Security desks are drawn with screeners and the lane still serves. People rendering and the asset pack (PRs #13 and #12) were left unmerged. Crowd avoidance and the mid-game PRs stay for the overnight pass.

`src/economy/balance.ts` is the live balance model. There is no `balance/model.py` in the tree. Against the payroll and levy constants now in the game, early margin is 10.0% on $20,000 income ($15,000 payroll, $3,000 other). Mid-game margin is 24.4% on $203,000 income after payroll, $35,000 other costs, and the $1,800 levy. Both sit in the requested bands.

A 30-game-day headless run (easy, sandbox off, starter kit, offers accepted as they arrived) finished with finite cash, lost passengers 0, bags lost 0, no unpaired tags, and no truck stuck longer than 240 seconds. Cash ended at $0 after a payroll short. Missed flights were 355 with the hall overloaded. Late bags (`bagsMishandled`) were 155 under that overload. The security waiting line peaked at 21 and did not ratchet the way the stall did.

| Gate | Result | Numbers |
| --- | --- | --- |
| Vitest | Pass | 639 passed, 2 skipped |
| Typecheck | Pass | `tsc -b` clean |
| Playwright bot, mixed 6 days | Pass on correctness | lost passengers 0, bag ledger short 0, stuck flights 0, stuck trucks 0, console errors 0, cash finite. Waiting 24 on day 2 with both scanners busy, then the node emptied. Missed flights 107, hall overloaded. 39 of 40 spawned flights left the field. |
| Playwright bot, mixed 12 days | Pass on correctness | lost passengers 0, bag short 0, stuck 0, console errors 0. Waiting climbed to 56 while a scanner was busy, then fell to 0 by day 8. Missed flights 270. 77 of 78 spawned flights left. |
| Playwright bot, heavy 4 days | Pass on correctness | lost passengers 0, bag short 0, stuck 0, console errors 0. End of day 5: 1 cleared passenger on security, waiting 0, check-in 0. Missed flights 96. 29 of 30 spawned flights left. |
| FPS floor 12 | Environment | SwiftShader minimum 11 (mixed, long) and 10 (heavy). Same software renderer as the last gate. |
| 30-day headless | Pass on correctness | lost passengers 0, bags lost 0, unpaired tags 0, stuck trucks 0, cash finite ($0 after payroll short). Missed 355. Late bags 155 while overloaded. |
| Early margin | Pass | 10.0% early, 24.4% mid-game |

**Bugs.** Seventeen. No new defect.

**Media**

- `docs/devlog/media/OCT13-living-interior.png` — roof off, starter hall, passengers on the floor
- `docs/devlog/media/OCT13-living-apron.png` — apron framed on a forced A380 at the stand
- `docs/devlog/media/OCT13-qa-heavy-apron.png` — heavy-jet bot, A380 on the ground during day 1

**QA.** One carrier, mixed, 6 days: security waiting stayed in the teens with both scanners busy, then the node was empty. Lost passengers 0. Missed flights 93 with the hall overloaded. That is the batch spawn, not a stuck scanner. The 12-day mixed run and the 4-day heavy run were the same shape: lost passengers 0, no short bag ledger, scanners still serving when a line was up. SwiftShader frame rate was 9–11 fps.

## Show-up — 13 Oct

Departing passengers no longer appear as one bank when boarding starts. A slot banks a plan in `src/pax/showup.ts`. Scheduled departure is the approach time plus a 20-second planned turn. Budget and family open 180 game-minutes before that (22.5 sim-seconds). Business and premium open 120 game-minutes before it. Nothing is earlier than 240 game-minutes, and no entrance releases more than three people in one sim-second. Check-in and bag drop close 45 game-minutes before departure on a wide-body and 30 on every other passenger flight. A deposit already at the desk finishes. A new one after the close walks on with a carry-on.

The plan is registered when the slot is written, so the first bodies are in the hall before the aircraft is on approach. When the jet appears, those passengers are bound to its flight id. Boarding does not seed a second wave. Patience does not drain until the aircraft is boarding, and the boarding call still stands after the jet has left the field so someone in the lounge can walk to the gate. Premium passengers take a fast-track place on the existing lanes at half the service time. Lane counts, service times, and caps are unchanged.

**Bugs.** Seventeen. No new defect.

**Tests.** `tsc -b` clean. Vitest 647 passing, 2 skipped. A seeded prefab run has departing passengers in the hall while the inbound is still on approach or landing. A six-day two-airline prefab run stays at or under 1% missed departures, with lost passengers 0 and bags lost 0. Check-in after the close does not start a bag drop.

**Media**

- `docs/devlog/media/OCT13-showup.mov` — HUD hidden, passengers in the starter hall before the inbound is on the ground

## Trunk merges — 13 Oct

Audio (#2), branding (#3), features (#7), flow (#8), and the economy tech tree (#11) are already on this branch and add no files of their own. Those pull requests are closed. Contracts (#19) merged as pure logic in `src/contracts`. Its own note says the sim and the HUD are wired later, so the live timetable is unchanged. Crowd (#18) is in `src/crowd` with its tests. The prefab lane numbers on that branch are the old one-lane figures, so `terminal.ts` was not taken from it, and the steering is not hooked into the hall walk. Timetable (#20), advisor (#21), people (#13), and assets (#12) are still red on CI. The HUD tip (#4) has no common history with this branch, so it stays open. Vitest after this pass: 723 passing, 2 skipped.

A payroll day that cannot pay even a dollar now says the payroll was missed, and it does not write a $0 shortfall line. The QA bot finishes the second premade hall's construction site before it counts halls, so that placement is a second hall. The advisor posts a Standing card while a signed airline is still on the field and at or under the warning line, before they walk. `src/pax`, `src/commercial`, `src/inbound`, and `src/progression` are not on the remote yet. Diplomacy is not extended.

## Run 22 gate — 13 Oct

Lane counts, service times, wear, and the unstaffed multiplier stayed where the prefab tuning left them. The show-up hook is what the miss-rate check uses now.

The QA bot's security check used to treat one poll of cleared passengers on the security node as a stall. After show-up, screened passengers walk back through that node to reach a landside bathroom, and a headless replay kept any one of them there for at most 2.5 seconds. The bot now flags the stall only when that crowd is still on the node at the next poll and nobody is being screened.

`src/economy/balance.ts` is unchanged. Early margin is 10.0% on $20,000 income. Mid-game margin is 24.4% on $203,000 income.

A 30-game-day headless run (easy, sandbox off, starter kit, offers accepted as they arrived) kept cash finite, lost passengers 0, and bags lost 0. Passengers were in the hall while an inbound was still on approach. The longest a truck sat still was about a second. Missed departures were 55 with the hall overloaded, and 90 bags were late. A freight slot the starter stands cannot take sits at the head of the bank and slides the flights behind it, so only a handful of turns finished. That is the existing stand-class delay, and the lane numbers were not retuned to clear it.

| Gate | Result | Numbers |
| --- | --- | --- |
| Vitest | Pass | 726 passed, 2 skipped |
| Typecheck | Pass | `tsc -b` clean |
| Prefab-normal mixed, 6 days | Pass | two airlines, starter hall, missed departures at or under 1%, lost passengers 0, bags lost 0, guests in the hall before landing |
| Playwright mixed, 6 days | Pass on correctness | lost passengers 0, bag short 0, stuck flights 0, stuck trucks 0, console errors 0. Second prefab counts as a hall (`fits` 2). Missed flights 2 with the hall overloaded. 43 departures left the field. |
| Playwright heavy, 4 days | Pass on correctness | lost passengers 0, missed flights 0, bag short 0, stuck 0, console errors 0. `fits` 2. 26 departures. |
| FPS floor 12 | Environment | SwiftShader minimum 10 (mixed) and 11 (heavy). |
| 30-day headless | Pass on correctness | lost passengers 0, bags lost 0, cash finite, truck dwell under 240s. Missed 55 and 90 late bags while overloaded. |
| Margins | Pass | 10.0% early, 24.4% mid-game |

**Bugs.** Seventeen. No new defect.

`grok/pax-showup`, `grok/commercial`, `grok/negotiation`, `grok/inbound`, and `grok/progression` are still absent on the remote. Diplomacy is not extended. Timetable (#20), advisor (#21), people (#13), and assets (#12) are still red. The HUD tip (#4) is green on its own branch and stays unmerged: it has no common history with this branch. Crowd steering stays unwired. The production bundle on `preview-dist` is unchanged, because contracts and crowd are not in the client graph (`index-fO-4b36H.js`, 1,577.34 kB).

## Multi-hall — 13 Oct

PR #34 shares history with this branch only back at `main`, so a merge would replay that whole gap onto the show-up work. The hall-scoped behavior is on this branch instead. A jetway stand resolves to its own terminal. Wear and a scrub stay on that hall, including the lane items. Claim load is counted inside the hall that owns the stand. When two jetway stands are free, the quieter hall is chosen before the belt link. Prefab I is still two lanes at 3.5 seconds with a cap of 40. Screened passengers still keep their path. A premade still counts as a hall once its construction site finishes.

**Tests.** `tsc -b` clean. Vitest 727 passed, 2 skipped. `oxlint` reports only the warnings already in the tree. The production bundle is `index-DNEZgQfm.js`, 1,578.20 kB.

## Terminal kit — 13 Oct

PR #47 brings the build-your-own kit onto this branch. A fresh passenger game, starter hall, then Hall, shows Food, Seating, and Decor above the dock. Fast food, a bench, and a planter go down on a legal cell. Bulldoze takes the planter back for $100. Prefab bundle pieces stay. The show-up boarding clock still waits until a departure is released.

**Tests.** `tsc -b` clean. Vitest 738 passed, 2 skipped. `oxlint` reports only the warnings already in the tree.

| Gate | Result | Numbers |
| --- | --- | --- |
| Vitest | Pass | 738 passed, 2 skipped |
| Playwright mixed, 6 days | Pass on correctness | lost passengers 0, missed flights 0, bag short 0, stuck 0. SwiftShader minimum 11. |
| Playwright heavy, 4 days | Pass on correctness | lost passengers 0, missed flights 0, bag short 0, stuck 0. SwiftShader minimum 9. |
| 30-day headless | Pass on correctness | lost passengers 0, bags lost 0, cash finite. Missed 30 while overloaded. |
| Margins | Pass | 10.0% early, 24.4% mid-game |

The production bundle is `index-CN6EN7lw.js`, 1,593.14 kB, with `index-jic0D8bj.css`.

## Land plots — 13 Oct

PR #40 is merged. Buying the city site grants the core plot. The next plot has to touch land you already own, and field level caps how many you can hold. A normal new game shows land holding at $236 a day. The loan button reads “Industrial plot 1-2 $27,216 · need Lv2”, and the click says the parcel is locked until Field Level 2. The maintenance contract toggles on at $1,250 a day. Sandbox does not pay the holding. Loan interest is still billed on the loan clock, not a second time here. The city levy is unchanged.

The published margins stay 10.0% early and 24.4% mid-game. With the new holding included, the early cash-flow margin is 8.8% and the mid-game margin is 23.5%. A 30-day bank grows 1.30× from day 20 to day 30.

**Tests.** `tsc -b` clean. Vitest 748 passed, 2 skipped. `oxlint` reports only the warnings already in the tree. The production bundle is `index-6q-0uGsg.js`, 1,601.17 kB.

| Gate | Result | Numbers |
| --- | --- | --- |
| Vitest | Pass | 748 passed, 2 skipped |
| Playwright mixed, 6 days | Pass on correctness | lost passengers 0, missed flights 0, bag short 0, stuck 0. SwiftShader minimum 4 while the other soak was running. |
| Playwright heavy, 4 days | Pass on correctness | lost passengers 0, missed flights 0, bag short 0, stuck 0. SwiftShader minimum 5 while the other soak was running. |
| 30-day headless | Pass on correctness | lost passengers 0, bags lost 0, cash finite. Missed 56 while overloaded. One plot, holding about $1,497 a day after the starter kit. |
| Margins | Pass | 10.0% early and 24.4% mid-game on the published model. 8.8% early and 23.5% mid-game once land holding is in the day. |

## Multi-hall history — 13 Oct

PR #34 is merged onto this branch. The hall-scoped capacity, rooms, wear, and claim behavior was already here, so the merge kept that tree and did not bring back the old instant security clear. `tsc -b` clean. Vitest 748 passed, 2 skipped. Lint warnings are the ones already in the tree.

## Standing advisor — 13 Oct

PR #38. A signed airline whose Standing trend points at a leave inside about 3 game days gets one Advisor Warning letter for that episode. The letter names Standing, the predicted days, and the top two causes with a fix. Dismiss clears it. It returns only after Standing recovers past 55, or the trend stretches past 4.5 days, and then drops again. The warning-line Standing card is still posted. Diplomacy internals are unchanged; the letter reads Standing through the adapter this pull request already had.

A fresh passenger game showed the Northline letter (Standing 32, about 0.1 game days, hall amenities and baggage) and Dismiss removed it.

**Tests.** `tsc -b` clean. Vitest 757 passed, 2 skipped. `oxlint` reports only the warnings already in the tree.

## Cancelled departures — 13 Oct

Cancelling a slot after the aircraft is bound now clears the walkers whose flight id was already rewritten off `slot:`. Arrivals on that flight, and departures on any other flight, stay. They are marked dead, not lost.

**Tests.** `tsc -b` clean. Vitest 758 passed, 2 skipped. `oxlint` reports only the warnings already in the tree.

| Gate | Result | Numbers |
| --- | --- | --- |
| Playwright mixed, 6 days | Pass on correctness | lost passengers 0, bag short 0, stuck 0. Missed 1 with the hall overloaded. SwiftShader minimum 9. |
| Playwright heavy, 4 days | Pass on correctness | lost passengers 0, bag short 0, stuck 0. Missed 2 with the hall overloaded. SwiftShader minimum 9. |

The production bundle is `index-DTVGkqMq.js`, 1,605.57 kB, with `index-jic0D8bj.css`.

## Contract negotiation — 13 Oct

PR #44 is on this branch. A contract letter opens a side sheet: the player can counter fees, freebies, term, and deposit, and the airline accepts, grudges, or walks. Standing changes go out through the existing diplomacy adapter (`over_ask`, `hard_bargain`, `walk`, `freebie`). `src/diplomacy` is unchanged. A walk puts the carrier on the Bellwater rival card. The sheet does not take clicks meant for the field.

**Tests.** `tsc -b` clean. Vitest 770 passed, 2 skipped. `oxlint` reports only the warnings already in the tree. The production bundle is `index-CmmzvVsS.js`, 1,636.12 kB, with `index-eP-pqaTd.css`.

## Payroll shortfall — 13 Oct

PR #45 is on this branch and closes #26. A covered payroll bill, including a remainder that prints as $0, does not post a shortfall line. A partial payment names due minus cash paid. An empty bank still says the payroll was missed entirely and does not write `paid $0`. Reputation and the maintenance and security sliders move only when that unpaid amount is a real dollar.

**Tests.** `tsc -b` clean. Vitest 771 passed, 2 skipped. `oxlint` reports only the warnings already in the tree.


