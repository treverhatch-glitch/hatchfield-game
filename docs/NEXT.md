# Hatchfield — Next steps / development

Ordered plan. Ship top-down — the numbers below are the one priority order (re-ranked Oct 18 2026 after the full playtest). **Active build board:** [BUILD.md](./BUILD.md) · [EXECUTION.md](./EXECUTION.md).

**North star:** [VISION.md](./VISION.md) · Ops: [REAL_OPS.md](./REAL_OPS.md) · Progression: [PROGRESSION.md](./PROGRESSION.md).

## Priority 1: Playtest bug fixes (Oct 18 2026)

Full playtest of `main` a5df0c17 on Oct 18 2026: **104 bugs** — 12 P0 play-breaking · 35 P1 major · 49 P2 visual/moderate · 8 P3 polish. Full list with repro, cause, files, fix, size and screenshots: **[playtest/PLAYTEST_2026-10-18.md](./playtest/PLAYTEST_2026-10-18.md)**. Fix P0 first, then P1; P2/P3 follow in the order of the playtest doc. Each fix PR names its bug ID (for example `P0-03`) and attaches before/after screenshots. Trever's seed list maps as: #1 → P0-11, #2–3 → P0-12, #4 → P0-01/P0-02/P1-06, #6 → P1-01–P1-03, #7 → P0-08/P0-09/P1-09; #5 (PR #27) and #8 (PR #26) were already fixed.

Timing note: P1-04 (apron walk speed / deboard window) and P1-05 (5× is not 5× below 20 fps → fixed-tick clock) change sim timing and **need Trever's sign-off** before coding. P0-03 is the planned **Slice 4** (fuel bowser capacity / farm refill).

### P0 — play-breaking
- **P0-01** [Functional · Terminal build] Hall items are charged and announced "placed" but never appear (Trever #4) — fix: Make v2 layout the single source of truth: place a Fitting at the clicked tile (footprint check against layout.fittings + rooms), and refuse with a reason if it does not fit (L)
- **P0-02** [Functional · Terminal build] Hall fills up after ~35 items: "Cell is full" everywhere in a mostly empty hall (Trever #4) — fix: Retire the 8×5 zone grid for v2 halls; validate on layout tiles (1 m) with fittingTiles(); keep zones as room rects (L)
- **P0-03** [Functional · Fuel] Starter kit runs the fuel farm dry; departures cancelled for days — fix: Ship Slice 4: auto spot refill truck when farm < 25 % (charged at spot), plus a pinned alert card with "Sign fuel term" that does not expire (M)
- **P0-04** [Functional · Timetable] Timetable backlog: ~1 flight/day served, 25+ flights stuck "scheduled" by Day 8 — fix: After the fuel fix, add a seeded 8-day soak test asserting ≥15 movements/day and no growing backlog; cap new bookings to stand-hours available (M)
- **P0-05** [Functional · Airlines / Phone] Contract letters are hidden in the closed Phone and expire unread — fix: Keep contract/fuel/emergency letters on the stack (or auto-open the Phone with a badge), fix the copy, and pause-or-extend the deadline while unseen (S)
- **P0-06** [Functional · Airlines] Offers expire in under 30 sim-seconds at 3x/5x — fix: Express deadlines in real seconds (or ×speed), and auto-pause on a new contract when hints are on (S)
- **P0-07** [Functional · Events] Emergency asks fail and fine the player with no visible card — fix: Pin emergency cards on screen with sound; auto-pause option; longer deadline (S)
- **P0-08** [Functional · Airfield / Runway] Runway placement: red ghost with no reason, then "Need a clear plot" (Trever #7) — fix: Run the same checks in placementGhostReason for runway tools and print the reason in the tray line; highlight offending cells (S)
- **P0-09** [Functional · Airfield / Runway] No way to extend or upgrade an existing runway (Trever #7) — fix: Add runway card actions: Extend +2 cells (either end, clearance-aware) and Upgrade class; reuse enqueueBuild with the delta cells (M)
- **P0-10** [Functional · Economy] Starter economy is broke by Day 3 ("Payroll missed entirely") — fix: Retune starter payroll/upkeep (or a grace week), and show runway-of-cash days in the HUD. Needs Trever sign-off if it touches sim timing (M)
- **P0-11** [Visual · Terminal / Passengers] Passengers walk in place (Trever #1) — fix: Drive animation from per-guest velocity (distance since last frame > ε) with a short hysteresis; keep thought text for bubbles only (S)
- **P0-12** [Visual · Terminal / Security] Security lanes overlap each other and spill into the toilets (Trever #2, #3) — fix: Rebuild securityLane() to 4×10 m (or footprint to the real size and re-space sockets); call fitScale() as a safety net; add the size-contract vitest from NEXT workflow #3 (M)

### P1 — major
- **P1-01** [Functional · Turnaround] Flight card shows "Deboard · 11 still moving" and "Board · 11 still moving" together (Trever #6) — fix: countProgress: if phase is past the step, show Done (n still walking) (S)
- **P1-02** [Functional · Turnaround] Aircraft pushes back with outbound bags never loaded; card stuck on "Bags out · Waiting" — fix: Gate pushback on bagsLoad (with timeout → offload news), clear flags on pushback (S)
- **P1-03** [Functional · Turnaround] Previous rotation's walkers decrement the next rotation's counters — fix: Tag walkers with a rotation id (scheduleId) and only decrement when it matches (S)
- **P1-04** [Functional · Turnaround / Apron pax] Apron walkers take >60 sim-s for ~7 cells; deboard always times out — fix: Tune walk speed/route or extend the window via rampPace (timing → Trever sign-off); fix labels (M)
- **P1-05** [Functional · Performance / Sim] Below 20 fps game time slows down (5x is not 5x) — fix: Fixed-tick accumulator (already in NEXT "After playthrough — Fixed-tick clock"); needs Trever timing sign-off (M)
- **P1-06** [Functional · Terminal build] Security/kit items ignore the clicked spot and jump to the next free socket — fix: Place at the hovered tile; sockets become suggestions/snap points only (M)
- **P1-07** [Functional · Terminal build] Hall hover/pick uses legacy 48×32 m bounds on an 88×44 m hall — fix: Use layout.w/h (shellBounds) for the pick plane (S)
- **P1-08** [Functional · Save / Load] Loading a save empties the hall and apron of people — fix: Serialize hallGuests/people (or re-seed them from flights on load) and persist the rolling income window (M)
- **P1-09** [Functional · Airfield / Runway] Clearance shoulder leaves only narrow bands for a 2nd runway — fix: Show the clearance zone as an overlay while the runway tool is active; review spacing so two parallels fit (S)
- **P1-10** [Functional · Airfield] Locked tools show a clean ghost; the lock only appears after clicking — fix: Add lock checks to the ghost reason and disable the card (S)
- **P1-11** [Functional · Bags] Belt tool silently does nothing — fix: Return a reason (needs bag room / hall edge) and show it in the ghost (S)
- **P1-12** [Functional · Tower] Kit stamps a tower the player can bulldoze but can never rebuild — fix: Unlock tower if one exists/was owned, or block bulldoze with a confirm (S)
- **P1-13** [Functional · Airfield / Runway] Bulldozing one runway tile leaves a broken strip that still works — fix: Bulldoze runway = whole strip, confirm dialog, re-derive strips (S)
- **P1-14** [Functional · Bulldoze] Bulldoze has no confirm and no news for any building — fix: Add confirm above $5k and a "Bulldozed X · refund $" news line (S)
- **P1-15** [Functional · Passengers] Guests stall at claim/exit ("Heading to exit" not moving) — fix: Add a stuck watchdog for hall guests (repath / teleport after N s) and log it (M)
- **P1-16** [Functional · Passengers] Hall goes empty while a flight is deboarding — fix: Spawn hall guests when apron walkers reach the hall door (M)
- **P1-17** [Functional · Stats] flightsDone = 1 while 6 flights are done; paxPerDay = 0 after 233 pax — fix: Increment on takeoff/done; add a soak-test assertion (S)
- **P1-18** [Functional · Alerts] Apron jam alert spams with ≤2 aircraft — fix: Base it on aircraft taxi wait; round; cool-down (S)
- **P1-19** [Functional · Timetable] Flights booked into the night curfew then held — fix: Filter slots by curfew at booking (S)
- **P1-20** [Functional · Bags] Claim jams on the kit hall — fix: Raise kit claim capacity or stagger offload (S)
- **P1-21** [Functional · Alerts] "Runway overbooked" warning on Day 2 with one airline — fix: Count only feasible requests (S)
- **P1-22** [Functional · Economy UI] Daily net figure swings wildly (−$5,527 → +$89,696/day) — fix: Use a 24 h rolling window excluding bonuses (S)
- **P1-23** [Functional · Economy] Upkeep starts on Day 1 before anything is built — fix: Show breakdown; trim empty-plot upkeep (S)
- **P1-24** [Functional · Staff] A third of crew no-show on Day 1 — fix: Kit stamps a road to the city edge, or commute model treats plot road as city link (S)
- **P1-25** [Functional · UI / Panels] Airlines → "Letters" tab shows the tier list, not letters — fix: Point tab to the letter inbox (S)
- **P1-26** [Functional · UI / Panels] People → Staff/Commute/Morale all show "STAFF HOUSING"; no staff hire screen — fix: Give each tab its own header/content; add roster/hire to Staff (S)
- **P1-27** [Functional · Info views] Most info views show only a legend, no map tint — fix: Implement per-view tile tints and a "frame airport" camera move (M)
- **P1-28** [Functional · Terminal render] fitScale() exists but nothing calls it — fix: Call it in buildFittingMeshes with fittingSize(); add the size-contract test (S)
- **P1-29** [Functional · UI / Panels] Manage panels are tiny right-edge cards — fix: Resize, allow expand/maximise (S)
- **P1-30** [Visual · Terminal render] Hall fittings never cast or receive sun shadows — fix: Pass shadows:true; measure fps (S)
- **P1-31** [Visual · Terminal render] Upper-floor fittings are never drawn — fix: Render per floor with slab height (M)
- **P1-32** [Visual · Terminal render] Check-in row prop is 11.2×8.0 m on a 2×2.6 m desk footprint — fix: Build a single-desk prop or call fitScale() (S)
- **P1-33** [Visual · Terminal render] Seat row and bench props are ~1.7× longer than their footprints — fix: Separate bench prop; fitScale() (S)
- **P1-34** [Visual · Terminal render] FIDS board prop wider/deeper than footprint (3.6×0.6 vs 3.0×0.3) — fix: fitScale() or resize (S)
- **P1-35** [Visual · Airfield / Landing] Planes land on the side of the runway, not the middle (Trever, Oct 18) — fix: Offset the approach/rollout line by half a cell to the strip's true middle for 2-wide runways. (S)

### P2 / P3
56 more items (visual/moderate and polish) in the [playtest doc](./playtest/PLAYTEST_2026-10-18.md#p2--visual--moderate).

## Ranked order after Priority 1

One numbered order. Item 1 is the bug list above; ship top-down after it.

### 1. Playtest bug fixes — see Priority 1 above

**Approved systems (start now).** Most items below wait until plane graphics and the current playthrough are done. **Exception (Trever Oct 17 ~16:40): the three “start now” tasks may begin immediately** as Jules/sys PRs. Specs live in the agent queue (`sys_16` / `sys_17` / `sys_18`).

### 2. Seeded RNG (no fixed-tick yet) — `sys_16`
- Add one seeded RNG with named substreams (`sim`, `passengers`, `events`, `weather`, `cosmetic`); replace unseeded `Math.random` in sim/gameplay (~116 in `sim.ts` alone).
- Every **new** game rolls a **fresh random seed** (playthroughs differ). Persist the seed on the save; honor optional `?seed=` for repros.
- **Do not** change frame/step timing or the `App.tsx` dt cap — the fixed-tick clock stays after the playthrough.
- **Multiplayer groundwork:** same seed + same command stream → lockstep-ready determinism later.
- Jules: `sys_16_brief.txt`.
- Playtest note: main still has no `?seed=`, so the Oct 18 repros are default-seed. Land this first so bug repros are exact.

### 3. Time-slicing of heavy work — `sys_17` ✅ merged #34 (a5df0c17)
- Frame-budgeted job scheduler (a few ms/frame) for route rebuilds after layout edits, demand recalcs, and autosave serialization.
- Goal: no hitch when placing buildings so graphics can stay maxed. Results must match non-sliced versions in tests.
- Jules: `sys_17_brief.txt`.

### 4. Pathfinder (heap + route cache + crowd feel) — `sys_18`
- Binary-heap A* + route cache keyed on start/goal; **invalidate on any layout change** so new check-in / security is used immediately.
- Passengers still pick the **shortest live queue**; needs-driven detours (food, shops, getting lost) request a **fresh route**.
- **Path variation (Trever):** share exact paths **only** in queues and at interaction points (check-in desks, security scanners/x-ray, gates, anything they interact with). Everywhere else: per-agent lateral offset, spacing and speed variation so crowds look alive.
- Jules: `sys_18_brief.txt`. Absorbs sys_14 (truck path cache) and the heap half of borrow PB-04/PB-22 ([cross-ref](./plans/permissive-borrow.md#11-cross-reference-with-existing-plans-17-oct-2026)).
- Playtest link: P1-15 (guests stall at claim/exit) and P0-11 (walk in place) touch the same crowd code.

### 5. Multi-side plane service points — needs Trever's timing sign-off
- Let ground-service vehicles use service points on more than one side of the aircraft instead of a single side.
- Changes turnaround timing, so **no code until Trever signs off the timing**. Write the spec and timing table first.

### 6. Workflow upgrades from "AI Built This Space Game From Scratch" (Can It Code?, reviewed Oct 17 2026, approved by Trever to add)
Lessons from the Can It Code? video (a one-week Godot space game). Their workflow matches ours (build → review → test with numbers and screenshots), but their game is a short story loop and Hatchfield is a full sim. Borrow these process upgrades; do not switch engines.

1. **Blender headless asset pipeline.** Agents write `bpy` Python scripts, run `blender -b --python`, and export glTF/GLB into the repo (Blender 4.2 LTS is being installed at `/opt/blender` on the box; Blender is free/GPL, and its output belongs to us). Use it for things with no good free model: the jet bridge first, then terminal pieces and custom vehicles. Assets must cast and receive the sun-tracking shadows, and keep full-res originals in Drive. Every new model gets an in-game film before merge. glTF carries over to a future engine port.

2. **Colour and material bible.** Write one locked palette and PBR material list in `docs/art/material-bible.md`, covering concrete, asphalt, glass, metal, liveries and signage. Every new model and texture must use it, and a test flags off-bible materials.

3. **Size and grid contracts with automatic gates.** Terminal pieces, stands and buildings snap to the tile grid, and each model has a declared footprint and origin. Add a vitest that checks every placeable item's bounding box against its declared footprint and that no two placed items' footprints overlap. Link this to BUGLIST #2 (security overlaps the bathroom) and #3 (x-ray units clash).

4. **Test rooms.** Small isolated scenes or URL modes, for example `?lab=docking`, `?lab=queue` and `?lab=vehicles`. Use them for plane taxi and docking, passenger queues, and service vehicles, so new animation and pathing can be tuned and filmed without the full sim.

5. **Automated screenshot reviewer.** A headless script plays a seeded game, runs scripted actions (build, place, zoom, day/night), and saves screenshots plus numbers. A vision-capable agent then reviews the screenshots for visual bugs, and the findings feed `/workspace/playtest/BUGLIST.md`. This builds on the seeded RNG (`sys_16`) and the existing playtest commands.

6. **Shadow cost lesson.** If lag ever shows up, the first move is to limit shadow casting to key lights, not to lower texture quality. This follows the max-graphics rule: optimize only when Trever's playtest shows real lag.

7. **Warning.** Automated checks miss weird bugs; in the video, an enemy got stuck floating in the final playthrough. Real hands-on playtests stay mandatory.

Playtest Oct 18: the size contract (#3) would have caught P0-12 and P1-28/P1-32–P1-34 (checked by hand with `rig/propfit.mts`); the screenshot reviewer (#5) was run by hand for this playtest.

**Later features (after the playthrough, approved Oct 17 2026).**

### 7. After playthrough — Fixed-tick clock (pairs with seeded RNG)
- Run the clock in equal, fixed ticks so 5× plays out exactly like 1× on any machine (replays and bug repros match).
- Slightly shifts timings → **after the playthrough only** (Trever OK given Oct 17, but still gated on playthrough end).
- Playtest link: fixes P1-05 (5× is not 5× below 20 fps).

### 8. Per-airline service rating + airport growth
- Rating per airline from how well you treat them; airlines grow or leave.
- Tied to airport growth: as the airport levels up, airlines send **newer and bigger aircraft** (and stock / standing rise with it).
- Borrow tasks folded in: PB-23 (market → offers/growth/exit) and PB-08 (load factor as a rating input). Builds on the unwired `src/features/ratings`; aircraft picks stay inside the sys_03 tier ladder + Field Level; exits via `diplomacy/departure.ts`.

### 9. Breakdowns and inspections
- Wire up the existing uncalled `breakdownChance()` in `maintenance/wear.ts`.
- Breakdowns, inspections and mechanics become real gameplay.
- Borrow PB-10/PB-25 folded in: reliability functions live in `maintenance/wear.ts`; reconcile with the live `logistics/maintenance.ts` breakdowns (one roll per vehicle).
- **After the next playthrough.**

### 10. Staff patrol zones
- Draw zones for security, police and janitors (RCT handyman-style).
- Janitors get optional specific maintain zones; security/police patrol.

### 11. Explainable airport rating ↔ airport levels
- One airport rating that shows what is dragging the score down.
- Feeds, and is fed by, the airport level / Field Level system.
- One task with borrow PB-24 + PB-09 (shared eased-rating helper) + PB-02 tower score as a component; Airport Council happiness (sys_02) uses the same components.

### 12. Happiness easing + value-for-money
- Passenger happiness eases toward a target instead of jumping.
- Prices carry a value-for-money feel.
- Same pass as the airport rating (PB-09 `easeToward`).

### 13. Commands → undo / replay (+ hardcore)
- Every player action recorded as a command (undo, replays, easier bug fix).
- Optional **hardcore mode** with no undo (Ctrl-Z off) for the shipped game.
- Builds on the unwired `src/features/undo` (keep it out of the sys_11 dead-code deletion) plus the OpenLoco estimate/apply pattern.

### 14. Destination demand (Cargodist-style)
- Smarter cargo / passenger demand by destination, run in a **Web Worker** so it doesn't stall the main thread.
- Borrow PB-06 (Airline Club fare + city-pair demand) is the kernel; extend `src/fids/cities.ts`. Domestic only until international progression opens.

### 15. Smaller approved items
- News by category.
- IndexedDB saves (browser localStorage currently tops out around ~5 MB).
- Research funding sliders.
- Marketing campaigns.

### 16. Buses (city + apron) — after playthrough / full launch
- **City buses** bring passengers from the city to the airport.
- At stands **without a jet bridge**: starter airport has passengers **walk** to/from the plane (real small-airport feel).
- Bought **apron buses**: passengers queue at the gate and wait for a bus for boarding and deboarding.
- Worth applying toward the full game / next playthroughs; not immediate.

### 17. International progression
- Wave E6 (mega-hub · intl · franchises · scenarios) in the wave map below; passport / international zone in [TERMINAL_ITEMS.md](./TERMINAL_ITEMS.md) and P8 in [DESIGN_PASS.md](./DESIGN_PASS.md).
- Destination demand (above) stays domestic until this opens.

### 18. Before Steam
- Rename real aircraft model names shown to players (`src/game/airframes.ts` — Boeing / Airbus / Embraer / ATR etc.) to **fictional** models, then a quick lawyer review.
- Fab (Epic asset store): free/standard OK now; paid professional tier once revenue > $100k/year.
- AI-made textures need Steam disclosure.

### 19. CC0 asset adoption (trialled Oct 17)
- Bring in: animated **people**, oak/palm **trees**, **warehouse**.
- **Innerscene realistic airliner** as a base (Trever likes it): needs **livery UV mapping**, a **lighter LOD** (~5× heavier than ours today), and **door rules** (no doors on wings or engines; hatch/wing clip rules apply).
- Search for more free CC0 airframes for every type we host (A380 etc.) once the current plane run finishes (avoid memory pressure on the box).
- Trial only behind a test flag today — live game unchanged until adoption PRs.

### 20. Data and reference (licenses)
- **OurAirports** (public domain): destinations, distances, runway headings/lengths. No terminals/check-in/security logic — not a ready-made airport insert. Can later seed real-airport starting maps with player-built terminals.
- **MIT / Apache** (borrow OK, keep license notice in credits — normal for Steam): openScope & BlueSky (ATC spacing, go-arounds, approaches), OpenTaxi (taxiway / hold-short), Airline Club (airline route/price/demand), OpenLoco (building/vehicle systems, code only).
- **GPL = ideas only** (OpenRCT2, OpenTTD, etc.): never copy code.
- Look-don't-copy ideas: FlightGear (ground handling, landing, lighting / touchdown smoke+bounce), OpenATDeluxe (fun airline events), Simutrans (network route choice). Write code fresh.

## Gate
- **Workflow (docs approved Oct 17):** Blender headless · material bible · size/grid contracts · test rooms · screenshot reviewer · shadow-cost lesson — implement after graphics + playtest bug list.
- **May code now:** Seeded RNG (`sys_16`), time-slicing (`sys_17`), pathfinder + crowd path variation (`sys_18`) — Jules briefs queued 16:40 Asia/Bangkok Oct 17.
- **Still docs-only until** plane graphics pass merged + current playthrough finished: fixed-tick clock, airline service ratings, breakdowns, patrol zones, airport rating↔levels, happiness easing, command/undo+hardcore, OD demand, buses, smaller items, Steam rename, CC0 adoption PRs.
- Then pull remaining items into [BUILD.md](./BUILD.md) / [EXECUTION.md](./EXECUTION.md) in priority order.
- **Borrow plan cross-reference:** [permissive-borrow.md §11](./plans/permissive-borrow.md#11-cross-reference-with-existing-plans-17-oct-2026), with layers, folded tasks and the consolidated order. Borrow PB-20 (type-based runway separation), PB-22 (turn-penalty taxi) and PB-26 (arrival metering) change sim timing and each need Trever's sign-off. PB-26 also waits for the fixed-tick clock.

## Reference (unranked)

### Now — implementing (not just vision)

- [x] Jetway / remote / bus · CS2 chrome · 5x · docs · T1–T5 · Field XP · loans  
- [x] Belt lite (E1) · Jam / stolen-slot (E2) · Standing vocabulary (E2b)  
- [x] Living logistics + real-ops + bags/cargo economy design locked  
- [x] **Slice 1 (BUILD):** bag units + premade ceilings + layover through-bags  
- [x] **Slice 1b:** full bag journey + claim scheduling  
- [x] **Slice 2:** guard post + city cargo trucks → shed + warehouse stock  
- [x] **Slice 3:** cargo start focus + volume letters + warehouse HUD  
- [ ] **Slice 4:** fuel bowser capacity / farm refill — **NEXT TO CODE**  
- [ ] Coach / Economy discoverability — Starter kit harder to miss  
- [ ] **Workflow upgrades (Can It Code?):** Blender headless pipeline · material bible · size/grid vitest · test rooms · screenshot reviewer — see section below

### Wave map (summary)

| Wave | Goal |
| --- | --- |
| E1–E2b | Done — belts, readability, Standing |
| **E3** | Cargo equality + bag depth ([BUILD](./BUILD.md) slices 1–3) |
| E4 | Budget leash / expense clarity |
| E5 | Emergency + mil letter seasons |
| E6 | Mega-hub · intl · franchises · scenarios |
| Parked | Freeflow P2.5 · spaceport expansion · full ACEO construction BOM |

### Quality bar

1. Money posts with a picture.  
2. Sawyer cap on hall BFS.  
3. Smoke: `npx tsx scripts/playthrough-wake.mts`  
4. Docs: pillars → DESIGN; ops → REAL_OPS; sequencing → BUILD / NEXT / EXECUTION.  

### Definition of done (beyond first landing)

1. Boot → kit → Northline money (~2 min).  
2. Jetway vs remote feels different.  
3. Break belt / jam / thin claim → Standing or money hurts → fix → recover.  
4. Cargo start can earn without a pax hall.  
5. Still want the next Field Level unlock — not “I’m done.”  
