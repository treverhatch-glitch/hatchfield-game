# Bot playtest — 15 Oct 2026, `e06b38be`

Read-only pass on `e06b38be` (“Record the quick gate for the schedule timeline rebase”). That tip is the four merges on top of terminal rounds 4 and 5: staff, bag-drop scales, x-ray and the real-size check-in bank (#105), the Ops wallet folded into the Growth tree (#109), passenger wiring (#111: throughput forecast, names and hover, walker mood onto fares, full-detail crowds), and the schedule timeline (#113). No gameplay numbers were changed for this note.

Commands, all on this commit, Node v22.14.0:

- `npm run playtest:bots` — Careful 45 days, Greedy 60, Chaotic 30, then the production-build smoke and the opening check. Seeds Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. Standard difficulty, passenger focus, sandbox off. One day is 180 sim seconds. Tick 0.25s at 5×. The personas look at the board every 12 sim seconds. Headless finished clean. The vitest command failed on the browser opening check.
- `node scripts/soak-150.mjs --days 30` — passed in 38.5s.
- `node tests/scripted-playthrough/playthrough.mjs --days 30` — reached day 30 with Chrome. The script exits 1 when it records findings. Console errors: 0.
- Unit tests on the four surfaces: `opsWallet.game.test.ts`, `opsFold.test.ts`, `hallCapacity.test.ts`, `hallPathing.test.ts`, `guestGlance.test.ts`, `timetable.test.ts`. 73 passed, 0 failed.

A separate headless read, not part of the persona table, loaded old Ops saves and ran a hands-off starter (one airline, no extra desks, 21 days) plus shorter Careful and Greedy loops to sample the forecast, the mood log, and the schedule board. Those loops are cited only for the forecast, the mood counts, and clash counts. Persona cash and flights below are the `playtest:bots` table.

The last published persona table is `docs/playtest/bots/rerun_oct15_0930.md` at `17ac92b`. Careful there, live policy, was 153 flights in 45 days (3.4/day), cash $494,514, 13 go-arounds, missed-connection $0, refunds $0. This tip is not that sim. Terminal rounds 4 and 5 sit between the two.

## Soak, 30 days

The soak starts with $5,000,000, signs whoever already meets the letter, and runs with no rendering. It passed.

| | |
| --- | ---: |
| Days reached | 30 of 30 |
| Flights completed | 68 |
| End cash | $4,608,430 |
| Cash change from the injected $5,000,000 | −$391,570 |
| Still stuck | 0 |
| Recoveries | 21 (16 repath, 2 release, 2 holdshort, 1 cancel) |
| Errors | 0 |
| Heap growth after warmup | 9.86% (limit 15%) |
| Tick p50 / p95 | 2.9 ms / 5.6 ms |

State size roughly doubled (hall walk, bank ledger, show-ups). The soak does not fail on that. No unrecovered stall.

## Personas

No softlocks, no NaN, no console errors. Nothing was still stuck at the end. The taxi-out watchdog cleared stalls (Careful 16 recovered rows, Greedy 51, Chaotic 18).

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Days | 45 | 60 | 30 |
| Flights (per day) | 394 (8.8) | 524 (8.7) | 92 (3.1) |
| First landing | 43.8s, day 0, PDJ101 | 43.8s, day 0, PDJ101 | 80s, day 0 |
| Cash start (new game) | $168,000 | $168,000 | $168,000 |
| Cash low / high | $2,423 / $307,807 | −$817 / $339,354 | $414 / $217,398 |
| Cash day 30 / end | $158,463 / $307,807 | $27,069 / $8,136 | $217,398 / $217,398 |
| Mean happiness | 34.8 | 17.4 | 39.3 |
| Happiness peak / worst day | 78.1 day 10 / 1.4 day 37 | 73.8 day 2 / 0.5 day 34 | 75.6 day 6 / 5.1 day 17 |
| Flight diverts | 1 | 10 | 1 |
| Connection diverts | 0 | 6 | 0 |
| Go-arounds | 30 | 303 | 86 |
| Missed-connection cash | $0 | −$20,460 | −$700 |
| Go-around delay cash | −$12,359 | −$114,930 | −$38,993 |
| Penalties category (net) | −$16,659 | −$159,119 | −$40,793 |
| Penalty total (fine categories) | −$50,659 | −$239,879 | −$60,693 |
| Cancel-refund lines (gross) | 399 lines, −$923,996 | 501 lines, −$1,139,619 | 94 lines, −$222,646 |
| Curb crossed 1 | day 12, peak 2.3 | day 9, peak 11.5 | day 17, peak 1.6 |
| Fuel groundings | 0 | 0 | 0 |
| Preferred / Trusted | day 12 / day 16 | day 17 / day 22 | — / — |
| Hub checklist | Station from day 1 | Station from day 1 | Station from day 2 |
| Tree | 45 nodes, not finished | complete day 52 | 45 nodes, not finished |
| Runway / stands | 1 / 6 | 1 / 8 | 1 / 8 |
| Signed | Puddle Jumper, Zoomjet, Harbor Heli, Island Heli | Puddle Jumper, Zoomjet, Alpine Swift, Harbor Heli | Zoomjet, Puddle Jumper, Harbor Heli |
| Check-in / security queue peak (day-open) | 2 / 0 | 3 / 3 | 1 / 3 |
| Passenger fees | $89,970 | $100,069 | $84,476 |
| Retail sales | $114,582 | $175,427 | $94,227 |
| Landing fees | $258,011 | $438,341 | $173,236 |
| Contract fees | $261,670 | $557,389 | $159,043 |
| Landside fees | $720,000 | $907,200 | $57,600 |
| Payroll | −$582,500 | −$762,326 | −$214,446 |
| Construction | −$322,300 | −$1,111,560 | −$456,050 |
| Loan proceeds | $25,000 | $365,000 | $225,000 |

Standing at the end: Careful has Harbor Heli at 100 (Flagship), Puddle Jumper 61.3 (Trusted), Island Heli 55.9 (Trusted), Zoomjet −22.4 (Published, on-time 0%). Greedy has Harbor Heli at 100, Puddle Jumper 54.4, Alpine Swift −13.4, Zoomjet −22.4. Chaotic’s three carriers are all Published, scores 13.3, −3.8 and −8.8.

Careful tried to stamp a second strip 19 times. Every stamp came back “That strip sits inside runway clearance. Leave the shoulder empty.” Strip 2 was not built. The same run tried the field-ask hangar 277 times and got “That hangar overlaps the police post.” Greedy’s hangar ask failed 163 times on a taxiway and 27 times on the police post. Strip 2 was not built there either.

Careful’s first extra check-in desk is day 1. Chaotic was refused once with “Puddle Jumper Airlines needs 28 passengers a minute at check-in. Desks and kiosks clear 30.” By then Chaotic had already added desks (first extra desk day 7, first extra lane day 4).

## Old Ops saves

`foldOpsWallet` plus the load path in `src/game/sim.ts` were exercised with the unit tests and with six hand-built snapshots on a real starter save.

| Snapshot | Result |
| --- | --- |
| 7 points + 0.4 progress, `cargo.t4` owned | Growth wallet 7.4, owns `spec-cargo-2`, `hasOpsTech('cargo.t4')`, Ops sheet points 0. Second load stays 7.4. |
| 40 points and all five live techs | 40 points land once. Owns `spec-green-3`, `spec-green-5`, `safety-4`, `spec-cargo-2`, `airside-5`. Ops points 0. |
| Negative points and NaN progress | Points stay finite. Ops points 0. No throw. |
| Economy block missing | Loads. Cash finite. |
| Economy block is a string | Loads. Ops points 0. |
| Points and tech id stored as strings | Dropped (the restore only accepts numbers and arrays). No throw. Second load does not invent points. |

No double-fold. No crash. No one-line save fix.

The headless personas agree with the fold in a fresh game: the report text is “One research pool. The Growth tree is the only wallet.” Wave 3 balance stays 0. Ops points are not a second wallet.

## Mood and revenue

Walker thoughts are copied onto the fare’s happiness with `HALL_MOOD_LINK` in `src/game/hallNavData.ts`. Crowded, lost, no seats, no amenity and an empty shelf take 0.6 of the thought. Hunger, thirst, toilet, bored, tired and anxious take 0.3. Queue thoughts, “that was quick”, shop lines and the missed-flight thought (−25) stay at weight 0, so a wait is not charged twice.

On the 30-day Careful sample the thought log was 8,779 thoughts, raw satisfaction −15,440, and −8,096 after the weights. Crowded was 4,020 thoughts and −4,820 of that weighted total. Nowhere to sit was 1,046 thoughts and −1,869. The fare meter in the persona table follows that shape: Careful is 78 on day 10 and 1.4 on day 37, with a check-in queue peak of 2. Greedy is 0.5 on day 34. The walker satisfaction meter on the hands-off starter stayed in the 70s while the fare meter dipped to 10.

Cash does not follow the fare meter. Careful’s passenger fees are $89,970 on 394 flights, about $228 a flight, while mean happiness is 34.8 and the worst day is 1.4. Greedy is less happy (17.4) and the passenger-fee line is $100,069 on 524 flights, about $191 a flight. Greedy retail is $2,924 a day against Careful’s $2,546. The fee tables are not what zeroed the meter. Standing for the regional carrier stays Trusted. Zoomjet’s −22 lines up with on-time 0% and the go-arounds, not with a fare formula.

## Hall forecast against the queues

Starter walk, measured on the hands-off field: 2 check-in desks, 2 security lanes, 1 gate desk, 2 shop counters. The red line in `HALL_QUEUE_TUNING` is 900 nav seconds at check-in (15 minutes) and 600 at security (10 minutes).

Hands-off, one airline, 21 days, 316 samples: check-in queue peak 5, security 3, longest staffed wait 3.2 min and 1.8 min. The hall never painted red. The forecast never said bottleneck. Where a line existed, forecast wait versus actual wait differed by 0.8 min at check-in (36 samples) and 0.7 min at security (55).

Careful sample, 451 looks: mean absolute error 4.1 min check-in and 1.4 min security on the looks that had a line. 11 looks said “clear” while more than two people were in a queue. Greedy: 8 looks of the same kind, errors 3.4 and 1.1 min. Neither side raised the bottleneck flag, because the forecast’s own flag is 85% load or 15 minutes (`src/throughput/checkin.ts`, `src/throughput/security.ts`) and the live waits stayed under the hall’s 15/10 minute paint.

`hallForecast` asks `checkinMix` for desks only (`kiosks: 0`, `bagDrops: 0` in `src/game/hallCapacity.ts`). The hourly rate treats everyone committed to a desk as spread over `planWindowNavSec` 1200 (20 nav minutes). Five people become 15 passengers an hour, and the card says clear.

Day-open queues in the persona table never got past check-in 3 and security 3. The curb did. Greedy ended at curb pressure 11.5, queue 64, delay 248 seconds, and Greedy does not build a curb bay.

## Schedule board

`buildGantt` on the live schedule, one day behind the clock and one day ahead, across the hands-off run (316 samples), the Careful sample (451) and the Greedy sample (301): 0 overlapping bars, 0 tight buffers, 0 stands too small. The timetable unit tests still flag a synthetic overlap as red. Nothing in these runs put two turns on one stand at once.

## Scripted playthrough, 30 days

`tests/scripted-playthrough/playthrough.mjs --days 30`, sandbox off, passenger start. Wall clock about a minute. Console errors 0. Pax lost 0. Bags lost 0. Vehicles stuck 0.

| Day | Cash | Flights done |
| --- | ---: | ---: |
| 5 | $67,963 | 2 |
| 10 | $55,558 | 2 |
| 15 | $40,639 | 3 |
| 20 | $38,404 | 5 |
| 25 | $25,508 | 5 |
| 30 | $41,111 | 5 |

Zoomjet was refused before day 1: “Zoomjet needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks.” Bushline signed. A bridge loan posted +$45,000 (balance $47,800). Research through the script’s old `canBuyResearch` list never became affordable. The Growth tree itself is buyable: the personas bought dozens of nodes.

The Economy tab and the `starter-kit` button inside it did not take a click, so the script called `buildStarterKit()` on the sim. The coach button `starter-kit-coach` did stamp the kit in the browser smoke (screenshot `docs/playtest/bots/smoke/04-kit.png`).

Flights sat in a phase for more than 2 game hours, repeatedly: 19 in deboard on day 4, 62 in board on day 19 (worst 8.3 game hours), 88 in landing on day 23 (worst 5.7), plus taxi-out, servicing and hold. That is why 30 days produced 5 completions.

The money auditor counted 437 cash moves with no earn/spend/charge line, net −$94,523. One of them is the loan (+$45,000). The rest are unlabeled residuals.

## Browser smoke and opening check

The smoke signed Puddle Jumper from the phone card (Sign, then the card read Signed, 2 of 6,000 points). It then failed to click `view-airport`: the button was visible, enabled and stable, and the click still timed out at 3 seconds. The opening check, a second browser pass, never saw `phone-action-contract-sign` and timed out at 4 seconds. Headless play did not depend on either click.

## When the starter terminal bottlenecks

Two different clocks, and they disagree.

The live queue is late. One airline for 21 days never painted a desk or a lane red. Peaks were 5 and 3 people, waits 3.2 and 1.8 minutes, against a 15 and 10 minute line. The persona day-open peaks stay at 2–3 people even after four carriers. The hall the player walks does not jam at the start, and it also does not jam a week in.

The letter is immediate. Starter clearance measured in the scripted game is 22 passengers a minute. Zoomjet’s peak is 28, so the second passenger carrier is illegal on day 0, before anyone has queued. Careful’s first extra desk is day 1. `PAX_UNITS.desk.perMin` is 8 and a kiosk is 6 (`src/scale/data.ts`). Two desks and one kiosk are 22, which matches the sentence. `checkinSignReport` adds the new carrier’s peak on top of whoever is already signed (`src/game/sim.ts`).

The owner asked for the jam a little way into play. The queue paint is past that. The letter is before it.

## Fix first

1. **Flights sit in a phase for hours when the field is not being expanded.** Scripted Bushline: 62 board holds and 88 landing holds over 2 game hours, worst 8.3 and 5.7 game hours, 5 completions in 30 days. The persona watchdog clears taxi-out (0 still stuck at the end) and still counts 303 go-arounds for Greedy, 86 for Chaotic, 30 for Careful. Delay cash from those go-arounds is −$114,930 / −$38,993 / −$12,359. Look at landing, board and taxi-out in `src/game/sim.ts`, and at the recovery steps already logging `repath`.
2. **The second strip cannot be stamped from the expansion rule.** Careful was refused 19 times: “That strip sits inside runway clearance. Leave the shoulder empty.” (`src/game/worldRules.ts`, shoulder in `RUNWAY_CLEARANCE_SIDE` = 2 cells / 44 m, `src/game/catalog.ts`). Strip 2 was 0 for every persona. The field-ask hangar is the same shape of failure: 277 Careful tries overlap the police post, 163 Greedy tries overlap a taxiway. The offered cell has to be one the clearance allows.
3. **Cancel-refund is posted about once per flight and then mostly reversed.** Careful 399 lines totaling −$923,996 against 394 completions; the `penalties` category nets to −$16,659. Greedy 501 lines, −$1,139,619, category net −$159,119 (that net includes −$114,930 of real go-around delay). A flight that leaves should not grow a refund line that a later entry has to cancel. The player-facing category is the net. The gross is what makes the ledger look like a million-dollar hole.
4. **Clicks on a visible control time out.** Smoke could not click `view-airport` after the phone signed. The opening check could not see `phone-action-contract-sign`. The scripted opener could not click `tab-economy` or `starter-kit` (both still exist in `src/ui/Hud.tsx`; the coach id `starter-kit-coach` did work). Same symptom: the control is in the DOM and the pointer does not land. Not a sim crash. No one-line fix was applied.

## Rebalance

Numbers to change, in this order. Fees per flight did not track the happiness crash, so the fee tables stay.

1. **Let the second passenger carrier sign. Block the third.** Measured starter clearance is 22 pax/min. Zoomjet needs 28. `PAX_UNITS.desk.perMin` in `src/scale/data.ts` is 8; a kiosk is 6. Two desks and one kiosk are 22. Set the desk rate to **12**. Clearance becomes 30. Zoomjet’s 28 fits. The next small carrier adds 14 (`SIZE_TIERS.small.paxPerMin`) and the sum is 42, which is the wall. That is the “a little way in” the letter should be. Today the wall is day 0.
2. **Do not retune fares off the mood link.** Passenger fees stayed about $228 a flight (Careful) and $191 (Greedy) while fare happiness sat under 2. Retail per day was higher on the less happy airport. The meter is what overshoots. In `HALL_MOOD_LINK.weight` (`src/game/hallNavData.ts`) set **crowded from 0.6 to 0.2** and **no_seats from 0.6 to 0.2**. On the Careful thought log those two keys were −4,820 and −1,869 of the −8,096 weighted points. At 0.2 they would be about −1,607 and −623. Leave missed-flight, queue, and shop thoughts at weight 0 so they are not charged twice.
3. **Make the forecast name a short line.** `HALL_CAPACITY_TUNING.planWindowNavSec` is 1200 (`src/game/hallNavData.ts`). Five people committed to a desk are read as 15 an hour, and the card says clear. 11 of 451 Careful looks did that with more than two people waiting. Set the window to **400** nav seconds. The same five people read as 45 an hour, which is the load a 2-desk starter can actually be in. Mean absolute error on a live line was 4.1 minutes at check-in; this is the knob that produced the “clear” sentence. `hallForecast` should also stop passing `bagDrops: 0` once a bag drop is on the walk (`src/game/hallCapacity.ts`). Bag drop is bags per minute in `PAX_UNITS`, so it still should not be added to the 22-passenger sign sentence.
4. **Leave the 15/10 minute red paint until the letter is fixed.** `HALL_QUEUE_TUNING.bottleneckSec` check-in 900 and security 600 never fired in 21 days of one airline (peak staffed waits 3.2 and 1.8 minutes) and the persona day-open queues stayed at 2–3. Dropping those numbers now would light the hall on the first bank, which is the outcome to avoid. After the desk rate in item 1, if a two-airline week still never goes red, bring check-in down to **360** nav seconds (6 minutes) and security to **240** (4 minutes). Not before.
5. **Greedy’s cash saw is construction and the curb, not a money printer.** Low −$817, high $339,354, end $8,136 on day 60. Construction −$1,111,560, payroll −$762,326, landside income $907,200. Careful, who builds less, ends at $307,807 and never goes negative (low $2,423). Chaotic’s day-30 cash of $217,398 includes $225,000 of loan proceeds and a low of $414. No runaway balance. The curb at pressure 11.5 and a 64-person queue is the bottleneck Greedy actually hits, because that persona does not answer the curb. Leave payroll and landside rates. The go-arounds in the fix-first list are the cash leak worth removing before any upkeep change.

No sim number was edited in this pass.
