# Pre-playtest review — Oct 15

This review covers everything merged to `main` in the 36 hours before Trever's playtest: hub progression and the Airlines tab, stand upgrades and attachments, the fire bell, check-in theming and desk capacity, fuel contracts and hydrants, cart sockets, helipad contracts, runway capacity, interiors and starter kits, and the gate tooling.

Every fix below landed in its own commit with a test that fails on the old code. Judgment calls are listed under open risks and were left unchanged.

## Bugs found and fixed

### Softlocks and UI that leads nowhere

| Area | Bug | Fix |
|---|---|---|
| Stand, fire and hangar cards | No attachment row did anything when clicked. The HUD sent only `rung:` and `fit:` ids to the stand action, but the rows are `fitbuy:`, `fitdrop:` and `pit:`. With the airfield jet-bridge toggle gone, no new stand could ever get a jet bridge. The alarm bell and line office could not be bought either. | `Game.buildingCardAction` routes every card row. The HUD calls it. |
| Hub ladder | Overnight parking, the dedicated ramp and the pier counted only `hubDedicated`, which nothing in normal play writes. Leased stands did not count, so those tiers could never be met. The fuel hook ignored leased fuel trucks and pitted stands. | The hub view counts gate leases, leased fuel trucks and leased stands with a hydrant pit. The checklist labels say what to lease. |
| Hub ladder | Carriers signed through diplomacy or a court win had no tenure date, so the tenure line never ticked. Old saves had the same gap. | Tenure is stamped on every signing path and backfilled on load. |
| Hub ladder | The hub letter's deadline ran out while letters were held. | The deadline pauses while the letter is held. |
| Hub ladder | The Airlines tab's "request next tier" did nothing visible when a gate line or a rival refusal blocked it. | It posts news naming the blocking line. |
| Hub ladder | A carrier that walked out or was lost to a rival kept its stand, lounge and vehicle leases and its tier. | `releaseHubCarrier` clears all of them. |
| Desk labels | The desk line named a kiosk archetype that the desk gate does not read. | It reads "Preferred desk" or "Dedicated desks". |
| Cart yard | Bulldozing a cart socket while a shipment was waiting left the shipment open forever, so the turn could never leave. | Shipments with no possible trip are dropped. The sim treats a closed shipment as clear. |
| Grass light stand | Rung 0 accepted only code A aircraft, so of the four grass airframes only the BN-2 could park. The DHC-6, PC-12 and AT-802 are code B. | The light stand letter is B on every rung. The grass list still does the narrowing. |

### Money

| Area | Bug | Fix |
|---|---|---|
| Contracts | Accept on a letter ran the negotiation desk first and the check-in and helipad gates second. Every refused click booked a phantom deal, charged marketing, stacked standing changes and, for a low-cost carrier, paid daily retail income for a carrier that never signed. | Accept runs the desk and pad gates before the negotiation desk books anything. |
| Fuel term | Litres drawn by depot trucks were not counted as term uplift, so the band and shortfall settled against the wrong figure. | Every litre drawn from the tank under a contract counts as uplift. |
| Fuel tank | Rebuilding the ground sim, which happens on any map edit, refilled an empty tank for free whenever loads were on the books. | The free refill is gone. |
| Fuel supply | A rail or pipeline contract with the line not yet laid delivered nothing, so the tank ran dry while the term still billed. | The term falls back to road tankers until the line flows. |
| Hub lounge | The lounge share ignored the small-field upkeep factor and the upkeep relief every other bill uses. | The share uses both. |
| Check-in kiosks | The desk gate took the larger of the hall's kiosks and the bought kiosks. The starter hall already has one, so the first $1,800 kiosk added no capacity but still billed upkeep. | Bought kiosks add to the hall's kiosks. |
| Bulldoze refund | Every stand without a wide or jumbo scale refunded the small-stand price. A rung-0 Heavy stand ($9,000) refunded $1,920 instead of $3,600. Bought fittings on stands, fire stations and hangars were deleted with no refund. | The refund is 40% of the stamp, the rungs, any hydrant pit and the bought fittings. Granted legacy bridges stay free. |
| Schedule fuel line | The schedule footer showed "Bank uplift" as the litres already drawn today, so it turned red after a busy morning even with a full tank. | It shows the litres still owed to today's unfuelled departures. |

### Save and load

| Area | Bug | Fix |
|---|---|---|
| Desk locks | The save dropped each lock's mode, so a Preferred desk came back as Dedicated. That counted toward hub tiers the player had not paid for. | The mode is saved and restored. |
| Stand migration | Old saves migrated without `standAccess`, so the legacy proximity rule kept applying. A migrated remote stand later got a free jetway when a hall was built nearby. | Migration pins `jetway` or `remote`. |

I also probed old saves (schema 1 to 5, missing fields, stray NaN) and found no crash or NaN after load.

### Performance traps (RTX 4070 Super desktop)

| Area | Bug | Fix |
|---|---|---|
| Aircraft pool | The per-aircraft merged geometry for bay doors and doorways was never disposed on release. It leaked on every flight. | Meshes that own their geometry are flagged and disposed. |
| Pack signs | Rebuilding pack signs leaked their canvas textures and materials. | Disposed on rebuild. Sprite geometry is shared, so it is left alone. |
| Terminal rebuilds | Each terminal rebuild leaked brand logo materials and prefab trim geometry. Five map edits grew the logo list five times. | Released on dispose. |
| Hall overlay | The hall flow overlay was rebuilt every frame. Walkway slats leaked geometry and materials. | The overlay redraws only when its inputs change. Slats are disposed. |

### Gate tooling

| Bug | Fix |
|---|---|
| The bot playtest exited 0 on persona softlocks, console errors, NaN flags, short runs or a skipped browser smoke, so the gate step could never fail. | `botFailures` fails the run on any of these. |
| The quick bot run overwrote the committed `docs/playtest/bots` report, dirtying the tree on every gate. | Quick reports go to the temp directory. |
| `SOAK_150` and `PLAYTEST_QUICK` leaked in from the shell. | The gate clears both at start. |
| A missing draw-budget test file was skipped silently. | Missing files fail the step. |
| The gate accepted Node 22.0 to 22.11, which Vite 8 and TypeScript 6 do not support. | It requires Node 22.12 or later. |
| A dirty tree went unrecorded. | The summary records uncommitted files. |

## Open risks and judgment calls (not changed)

1. **The fire bell does nothing.** `scrambleSec()` is read only by news text and the card note. `tickFireRisk` never uses it. The bell costs $3,500 plus $15/day. It is also one global flag, and 45 s, 0.8 and the line office's 0.9 are hard-coded in logic. The line office does work.
2. **Extra jet bridges, the flag and the apron light buy nothing.** No sim or render code reads `fittings` beyond the bridge cap. Bridges 2 and 3 on a heavy slab cost $8,000 plus $70/day each. Every stand already draws an apron mast, which contradicts the card's "Unlit" note.
3. **Heavy stands are treated as code F outside the size/rung path.** `stand_heavy` stores class `L` with no scale. The ghost draws a 5×5 F box while placement checks D. The building spec uses the jumbo tier. The timetable maps `L` to F, so an A380 can be pinned to a D stand and the sim quietly ignores the pin. The timetable also allows a 737 on asphalt narrow or a Citation on grass. This lives in the stands, render and schedule areas other agents are changing.
4. **A hub gate lease doesn't stop other airlines.** `assignStand` never reads `hubLeases`. Only the timetable drag refuses, and `swapStands` skips both the lease check and the size check.
5. **Old saves bill new stand upkeep without warning.** After migration, every stand bills rung upkeep and every jetway stand bills a legacy bridge, even when the hall is gone. A 12-gate save loses about $1k/day on first load, with no news line.
6. **Desk capacity doesn't match what the player sees.** A bought desk lifts the gate but puts no desk in the hall, so passengers still queue at the hall's desks. The gate reads only the selected terminal, so its answer depends on which hall is open.
7. **Some signing paths skip the desk gate.** Diplomacy adoption and the paid rival court push straight into `signed`. A counter-offer that the carrier accepts still books the negotiation deal before the desk gate refuses. It can't be gated up front, because counters must still be able to make a carrier walk to the rival.
8. **The check-in ghost on the schedule is wrong for future slots.** It reads `flight.kind`, but scheduled slots have no flight yet, so widebody turns always show the domestic close. Helicopter and GA turns get a ghost they never use. The ghost uses the passenger show-up window, not the desk allocator's open and close times.
9. **Hub lease scoring and letter timing (suspected, not traced end to end).** A lease scores toward its tier as soon as it is signed, with no cost beyond the lease. How often the next hub letter arrives depends on `hubOffered`. `rosterOffers` looks unused.
10. **Fuel edge cases (suspected).**
    - Heli fuel needs may not match the jet path.
    - Fuel holds may outlive the flight state that caused them.
    - Hydrant upkeep may double up with legacy pits on old saves.
    - The farm card's supplier name is hard-coded rather than read from the contract.
11. **Cart timing units (suspected).** The cart yard's timing constants and the sim's clock may not use the same units. No softlock was seen.
12. **Perf (judgment).**
    - The HUD re-renders on every emit.
    - Several per-frame scene walks allocate vectors. `buildMovingTrays` makes new vectors per tray every render.
    - The check-in allocation cache is keyed on the clock, so it never hits between ticks.
    - `ensureGround` scans the whole grid through `powerReport` on every call, and it is called from per-frame paths.
    - The interior plates load 11 textures at 2048² (about 245 MB of VRAM on High). Switching texture quality keeps the old set alive.
13. **Bot playtest.** If the second-strip stamp fails, the Careful and Greedy personas retry it every decision and stop building anything else that day.
14. **Flaky tests on `main`.** `src/rival/hook.test.ts` ("keeps walked airlines and a hold inside the 25% walk-in cap") and `src/negotiation/panel.e2e.test.ts` (30 s timeout) each fail about half the time when run alongside the negotiation suites. Both also fail on `main` without this branch. A red gate on either should be re-run before anyone digs in.
15. **Gate tooling.**
    - The soak writes under `/tmp`, which doesn't exist on Windows.
    - The scripted playthrough isn't part of the gate.
    - `--no-install` shows npm ci as passed.
    - `--full` now fails if Playwright chromium isn't installed, because a skipped smoke counts as a failure.

## Top 5 things Trever is likely to hit

1. **"I bought the alarm bell and nothing changed."** It's the most visible dead system. The card shows a shorter scramble time that the fire model never reads. Extra jet bridges and the flag are the same.
2. **Other airlines parking on a stand he leased to a hub carrier.** The lease shows on the Airlines tab, but stand assignment ignores it.
3. **A cash drop when loading a pre-Oct-14 save.** Stand rung upkeep and legacy bridge upkeep start billing silently.
4. **"Add check-in desks" refusals after buying a desk.** The gate lifts, but the hall still queues at its own desks. The answer also changes with whichever terminal is selected.
5. **Heavy stands showing an F-size ghost, and A380 pins on a Heavy stand being silently ignored by the schedule.**

## Gate

`npm run gate` on the final code commit is pasted into the PR body, from `docs/devlog/gate/<sha>.md`.
