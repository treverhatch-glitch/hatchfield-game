# Airline Contracts & Scheduling (`src/contracts/`)

Pure-logic module implementing the design doc *Hatchfield – Airline Contracts & Scheduling (DRAFT)*.
No React, no sim imports, no side effects; everything is plain data in / data out so it can be unit-tested and
wired into the sim and HUD later. `erasableSyntaxOnly`-safe (string unions, no enums).

## Files

| File | What |
|---|---|
| `types.ts` | `Season`, `ServiceKind`, `SizeClass`, `TimeWindow`, `FlightLine`, `SlaKpis`, `Money`, `Contract`, `SlotInstance`, `ScheduleState`, `Infrastructure` (stands + runways) |
| `airframes.ts` | default airframe table (size class, MTOW, seats), MTT by class, bridges by class (1/1/2/3), `standFits` |
| `seasons.ts` | 364-day game year; Summer = weeks 12–42 (IATA last-Sun-Mar → last-Sat-Oct), Winter = rest; `seasonOfDay`, `nextSeason`, `seasonRun` |
| `contracts.ts` | `makeOffer` (defaults; hub = 4 seasons + stricter KPIs), `validateContract`, `signContract` (one hub, never capacity-blocked), `advanceSeason` (active → expiring → ended), `airlineRequestsExit` (season end only), `renewalOffer`, `cancelEarly` (fee + standing + favour), `clampStanding` (−100…+100) |
| `scheduler.ts` | `expandContracts` (lines → slot instances for the season), `declaredCapacity`, `autoSchedule`, `evaluateFlags`, `slotRound`, `rerun` |
| `preview.ts` | `previewOffer` — green/amber/red per hour + "this line exceeds declared stand capacity 07:00–09:00" warnings for the offer card |
| `adjust.ts` | `dragSlot`, `pullSlot` (earlier) / `bumpSlot` (later), `setCancelled`, `pinStand`/`unpinStand`, `unpinTime`, `swapStands`, `setAuto`, `weeklyOffWindowCost` |
| `sla.ts` | `auditWeek` (revenue, penalties, standing delta, lawsuit trigger, ledger entries), `seasonBonuses`, `cancelFeeEntry` |
| `slotRule.ts` | optional 80/20 rule (off by default): `seriesUsage`, `historicPrecedence`, `setSlotRule80` |
| `index.ts` | barrel |

## Rules as implemented

* **Time base**: absolute game minutes = `day * 1440 + minuteOfDay`; day 0 = Monday. `FlightLine.days` are 0=Mon…6=Sun.
* **Windows**: default ±20 min soft, ±60 min hard (doc §9 proposal — owner to confirm). On-block = arrival; off-block = on-block + `turnaroundTargetMin`.
* **Auto-scheduler**: fixed slots first (pinned, cancelled, or airline with auto off) reserve capacity; then hub, then
  series with historic precedence, then by preferred time. Each flight tries preferred, ±5, ±10 … within the soft window
  until a runway (per-hour movements, least-loaded runway) and a stand (smallest fitting class → contact → id; hub at home
  pier; 10-min buffer) are free. Otherwise it goes to the least-bad window edge, still gets the least-clashing stand,
  and is flagged `over_capacity` with human-readable `issues`. **Signed lines are never dropped or suppressed.**
* **Flags** (`evaluateFlags`, single source of truth, re-run after every edit): `over_capacity` (runway hour over
  declared → every move in that hour; stand clash → the later arrival; stand too small / not built; no runway) beats
  `off_window` (outside soft; issue text says when outside the hard band).
* **Player edits**: drag within window free; hard band allowed at 1 standing / line / week (`weeklyOffWindowCost`);
  beyond hard refused. Drags pin the time so re-runs keep them. Stand pin refuses too-small stands; clashes allowed (red).
  Swap only if both stands fit.
* **Audit** (weekly): on time = off-block ≤ planned + 15. Late penalty per minute of turnaround over target; lost-bag and
  grounding penalties. Fuel grounding is a breach only if fuel service was bought; weather never. Catering shortage
  counts only if catering bought. Standing: +2 clean week, −3 on-time miss, −2 lost-bag miss, −2/fuel grounding,
  −1/catering short, − off-window cost; weekly delta clamped −10…+5 and standing −100…+100. Lawsuit when standing ≤ −50
  and 3 consecutive breach weeks. De-icing is only in the Winter annex.
* **80/20**: `slotRule80` defaults `false`; then every series keeps precedence. When on, series < 80 % used
  (cancelled / grounded = unused) lose precedence and are placed after others in the next Slot Round.

## Wiring notes (not done in this PR)

### Planner (`src/ui/Hud.tsx` on trunk; `src/ui/hud/panels.tsx` after PR #4)
* Trunk keeps `game.schedule`, `scheduleAuto`, ETA ±10 nudges, `setSlotStandPref`, Pull/Bump, runway filter.
  Re-base them on `ScheduleState.slots` in **game minutes**, not seconds-from-now:
  * `game.pullSlot(id)` / `bumpSlot(id)` → `pullSlot` / `bumpSlot(state, id, minutes, ctx)`.
  * `setSlotStandPref(id, stand)` → `pinStand` (stand ids instead of `Vec`; map tile → stand id in the sim).
  * `scheduleAuto` → `setAuto(state, airlineId, on)` (per airline instead of global).
* The Timetable dock (stand Gantt, runway lane, flight board) should live in `src/ui/hud/` and read via `uiStore`
  selectors. Bar colour from `flag`; tooltip/card from `issues`. Shaded band = `arrival.softMin`, outer = `hardMin`.
* Call `rerun(state, contracts, infra)` when stands/runways are built or removed (build tool hook in the sim).
* Sim spawns arrivals from slots of the current day at `plannedOnBlock` and writes `slot.actual` at off-block.

### PR #9 (airlines)
* "Meet their checklist, then answer the phone" produces `makeOffer(...)`. Airline tier → line count, term (1/2/4) and
  `sla` overrides. Show `previewOffer` on the offer card; call `signContract` on accept.
* Season-end exits: `airlineRequestsExit` then `advanceSeason` at the boundary (status `expiring` → `ended`).
* Map airframe ids to the game `AIRFRAMES` table and pass it as `options.airframes` (the default table is a stand-in).

### PR #14 (diplomacy)
* Weekly audit: for each live contract call `auditWeek` with the airline's current standing, prior breach weeks and
  `weeklyOffWindowCost(...)[airlineId]`; apply `standingDelta`; on `lawsuit` start the lawsuit flow.
* Early cancel: `cancelEarly` returns fee / standingDelta / favourDelta → reuse the existing fee + favour path.
* Cash actions (buy a better slot = pin + waive standing cost, waive a penalty = drop the ledger entry, renewal
  sweetener = `renewalOffer(c, id, sweetener)`) are money-only, no Clout.

### PR #11 (economy / bank)
* Post `WeekAudit.ledger`, `seasonBonuses(...)` and `cancelFeeEntry(...)` to the single cash ledger. `LedgerEntry.day`
  uses the sim's game day. Replace `contract.money.services` prices from the economy price table when making offers.

### Stands (PR #6)
* `StandDef.sizeClass` must match the jet-bridge class: regional/narrow 1 bridge, wide 2, super (A380) 3
  (`BRIDGES_BY_CLASS`).

## Open questions carried from the doc
Slot Round as a scene or panel; standing vs cash for off-window moves (currently standing); default window widths;
live vs audit-only SLA display.
