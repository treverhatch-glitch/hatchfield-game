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
