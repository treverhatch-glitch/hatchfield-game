# Bot rerun — 15 Oct 2026, after the batch on `16e6ab33`

Headless measurement on `16e6ab33` (latest `main` when the run started; `cf303f97` is an ancestor). Node v22.14.0. No gameplay numbers were changed. After the tables were measured, `origin/main` moved to `7ba545f5` (interior editor, art landing, turnaround crew visuals). The `src/game/sim.ts` diff on that range adds interior-edit methods. It does not change `goAround`, the check-in sign gate, field XP, fuel fees, or the persona policies, so the numbers below are the sim those commits sit on. The full gate is `npm run gate -- --full`. The persona tables are a separate driver on the same sim: live policy for 150 game days (Careful, Greedy, Chaotic), tip policy for 90 days (Apex term, no second strip, no researcher), and the spot probe for 90 days (accept every card, ignore every card). Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. Standard difficulty, passenger focus, sandbox off. One day is 180 sim seconds. Tick dt is 0.25s at 5×, and the persona looks at the board every 12 sim seconds.

Live policy is what `PERSONAS` ship: sign Apex Local, stamp a second strip and extra stands when the field is over, hire one researcher. Tip policy is the 09:30 comparison set. Field level days are the first day-open sample at that level.

## Gate

`npm run gate -- --full` on `16e6ab33beafdb77a6f96881460c15ecd2f85053`. **PASS.** Wall 1255s. Record: `docs/devlog/gate/16e6ab33beafdb77a6f96881460c15ecd2f85053.md`.

| Step | Result | Seconds | Detail |
| --- | --- | ---: | --- |
| node | pass | 0 | v22.14.0 (>= 22.12) |
| npm ci | pass | 3 |  |
| unpack-art | pass | 0 |  |
| tsc | pass | 15.3 |  |
| oxlint | pass | 0.6 |  |
| vitest | pass | 525.5 | 2949 passed, 0 failed, 9 skipped (452 files) |
| vite build | pass | 3.1 |  |
| soak | pass | 278 | 150 days, end cash $3,491,856, stuck 0, recoveries 122 |
| draw budgets | pass | 0.8 | 26 passed, 0 failed, 0 skipped (6 files) |
| playtest bots | pass | 428.7 | 1 passed, 0 failed, 0 skipped (1 files) |

Tests: 452 files (446 passed). 2949 passed, 0 failed, 9 skipped (2958 total).

The bundled bot step is the shorter live run (Careful 45, Greedy 60, Chaotic 30) plus the browser smoke. The smoke reached the first landing at 19.8s, clock 226s, cash about $34,557, no console errors, nothing still stuck. The 90-day and 150-day tables below are the longer measurement.

## Soak verdict

150 days requested and reached. End cash $3,491,856. Still stuck: **0**. Recoveries: **122**. Heap growth after warmup: 0.1285 (cap 0.15). Errors 0. Coordinate jumps 0. Taxi-out recoveries cleared 7 stalls. Completed flights in the soak harness: 347.

**The recovery rate is still elevated.** 122 in 150 days is 0.81 a day. `bc048fbc` was 23 in a 30-day soak, 0.77 a day. The earlier quick gates in the 9–16 band were 0.30–0.53 a day. This run sits with `bc048fbc`, about one and a half to two and a half times that earlier band. Quick gates on the commits since that note already scattered from 9 to 42 recoveries per 30 days, so the count moves, and 24 per 30 days (this 150-day run, scaled) stays in the high cluster.

Cause, from the soak log (`recoveriesByState` / `recoveriesByStep`):

| State | Count | Step | Count |
| --- | ---: | --- | ---: |
| aircraft landing | 62 | repath | 76 |
| aircraft pushback | 42 | release | 21 |
| aircraft taxi-in | 11 | hold short | 15 |
| aircraft taxi-out | 7 | cancel | 10 |

Landing and pushback are 104 of the 122. The first ladder step (repath) is 76. Ten reach a cancel. Nothing is still outstanding, and nothing was teleported.

The stall limit for those moving phases is 0.8 sim minutes in `src/game/stuckWatchdogData.ts` (`limits.landing` and `limits.pushback`). One field second is 8 sim minutes, so 0.8 sim minutes is a tenth of a field second. The soak ticks at dt 0.1 and speed 5, so each tick advances 0.5 field seconds, which is 4 sim minutes. One tick with an unchanged position is already past the limit. `atcFollow` holds an aircraft on the cell at the edge of its clearance, and pushback is only excused for 8.2 field seconds (`pushbackGraceSec`). A hold that the authorised-wait check does not swallow becomes a recovery on the next tick. That is the elevated count: brief approach and pushback holds, mostly repaths, on a limit shorter than the soak's own tick.

## Live personas, 150 days

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Cash day 30 / 60 / 90 | $146,893 / $190,318 / $250,260 | $7,097 / $71,389 / $36,212 | $110,176 / $46,922 / $1,037 |
| Cash day 150 (min / max) | $254,432 ($2,423 / $299,286) | −$18,324 (−$18,324 / $340,295) | $4,497 (−$4,787 / $118,000) |
| Flights (per day) | 457 (3.0) | 626 (4.2) | 438 (2.9) |
| Flight diverts | 172 | 340 | 28 |
| Go-arounds | 237 | 211 | 0 |
| Missed-connection $ | −$96,720 | −$208,320 | $0 |
| Refunds | −$390,908 | −$395,744 | −$253,032 |
| Fuel groundings | 0 | 0 | 0 |
| Field level | FL9 on day 148 (FL8 on day 109) | FL9 on day 104 (FL8 on day 77) | FL9 on day 139 (FL8 on day 91) |
| Field XP / stars | 3,250 / 0 | 4,277 / 0 | 3,342 / 0 |
| Carriers at day 150 | 1 (Puddle Jumper) | 0 | 1 (Zoomjet) |
| Standing | −99 hostile, blocked on go-arounds | three cold/hostile scores, none still signed | Zoomjet 97 partner, blocked “Stand class short” |
| Preferred / Trusted | — / — | — / — | day 118 / day 129 |
| Stands / runways | 6 / 2 (strip 2 on day 26) | 8 / 2 (strip 2 on day 118) | 23 / 1 |
| Tree complete | day 71 | day 54 | day 53 |
| Tower III | no | no | no |
| Landmark / cargo hub II / spotters | no / no / no | no / no / no | no / no / no |
| Council | unlocked, 0 votes, standing 50 | unlocked, 0 votes, standing 50 | unlocked, 0 votes, standing 50 |
| Carbon | 556 t tracked, 0 offsets, no Green Pioneer | 516 t, 0 offsets, no pioneer | 1,181 t, 0 offsets, no pioneer |
| Curb peak | 2.7 | 13.7 | 7.1 |

Careful's cash rises through day 120 ($290,847) and is flat by day 150. Greedy peaks at $340,295, opens the second strip on day 118, and finishes broke. Chaotic spends the opening till down and lives near zero after day 90. No curve runs away upward.

The 09:30 note's ceiling was one carrier for about 90 days and FL8 around day 150. The carrier ceiling is still there. The field-level ceiling moved: every live persona reaches FL9 inside 150 days, and none reaches FL10 (4,500 XP; Greedy ends at 4,277). FL9 on Careful is the day-148 sample, with $254,432 in the till.

## Tip policy, 90 days

Same seeds, Apex term, one strip, no researcher. This is the set the 09:30 note used.

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Cash day 30 / 60 / 90 | $70,285 / $134,887 / $199,373 | $6,970 / $8,896 / $17,569 | $175,447 / $4,378 / −$4,049 |
| Flights (per day) | 226 (2.5) | 396 (4.4) | 302 (3.4) |
| Flight diverts / go-arounds | 3 / 11 | 194 / 348 | 39 / 0 |
| Missed-connection $ | −$29,760 | −$139,500 | $0 |
| Fuel groundings | 0 | 0 | 0 |
| Field level | FL6 on day 65 | FL8 on day 79 | FL6 on day 48 |
| Carriers at day 90 | 1 (Puddle Jumper, −99, storm) | 1 (Puddle Jumper, −99, runway sequence) | signed list empty |
| Preferred / Trusted | — / — | — / — | day 46 / day 61 |
| Tower III / landmark / cargo hub II / spotters | no | no | no |
| Council | locked (FL6) | unlocked, 0 votes | locked (FL6) |
| Carbon | 293 t, no pioneer | 338 t, no pioneer | 472 t, no pioneer |

Against the 09:30 tip table (Careful 306 flights, $1,197,497, one divert, FL7, Preferred on day 18): Careful now finishes 226 flights and $199,373, still on one carrier, with the carrier hostile. Preferred does not return. The new large books are refunds (−$298,532 on tip Careful) and missed connections. Fuel still grounds nobody who signed the term ($31,616 over 90 days, $351 a day).

## Frozen-ramp verdict

Same Careful seed and the same decisions, 90 days. Term is the tip Careful row. Accept orders every spot card. Ignore orders none.

| | Term (flying) | Spot accept (flying) | Spot ignore (grounded) |
| --- | ---: | ---: | ---: |
| Flights | 226 | 373 | 1 |
| Fuel groundings | 0 | 0 | 367, first on day 0 |
| Fuel $ | $31,616 term | $16,236 spot | $0 |
| Cash day 30 | $70,285 | $203,795 | −$20,622 |
| Cash day 60 | $134,887 | $364,743 | −$20,947 |
| Cash day 90 | $199,373 | $523,848 | −$20,413 |
| Field level | FL6 | FL8 | FL6 |
| Penalty total | −$166,059 | −$152,026 | −$1,448,771 |

**A grounded ramp finishes below both flying airports.** Ignore is about $220,000 under the term and about $544,000 under accept at day 90, on one completed turn. The spot card is up before the first hold (`Spot card for LIF104`). The 09:30 unfixed ignore airport, measured before the slot-fee refund, was $1,283,871 on day 90 with one flight. That inversion is gone. Cash on the ignore field is already negative on day 30 and stays near −$20,000 through day 90.

Accept and the term both fly and both ground nobody. Accept's till is higher on this seed ($523,848 vs $199,373) and it completes more flights. The sim still draws `Math.random`, so that gap is one seed, not a second frozen-ramp failure. The ignore column is the check, and it loses.

## Flags

No NaN on any persona. No headless tick or decision exceptions. The browser smoke in the gate logged no console errors.

Softlocks:

- **Greedy, live, day 150.** Still stuck at the end: LIF761 taxi-out for 1,128s, LIF749 taxi-out for 530s, LIF792 taxi-out for 659s, LIF867 in the hold. The 180s softlock line fired and the flights were still there when the run stopped. Curb pressure finished at 13.7. Cash −$18,324.
- **Chaotic, live and tip.** “No security lane — stuck before security” stayed past 180s during the run. The end snapshot was clear, so the guest stall released. Chaotic's signed carrier on the live run is blocked with “Stand class short” even at partner standing.

Dead ends and features with no path:

- **Second carrier.** The letter is on the desk and the accept command fails. Careful live logged 408 accepts that died on grass plus dozens of “needs 28 passengers a minute at check-in. Desks and kiosks clear 22.” Zoomjet, SkyCheap, SkyPenny Max, Budgie Ultra, Alpine Swift, and Harbor Heli all hit that line. Two staffed starter desks at 8 passengers a minute plus the starter kiosk at 6 clear 22. A second small carrier adds another 14, and 14+14 is 28. The personas hire three desk agents and then stop buying desks, so the staffed capacity stays 22 for Careful and Greedy. Chaotic furnishes many check-in rooms and still ends on one operating carrier.
- **Tower III.** Needs field level 9, the `atc_approach` commission, and $900,000 (`src/airside/data.ts`). Live personas do reach FL9. `progressionBuilt` is empty on every run, so the approach centre never exists, and `towerIII` stays empty. Careful's peak cash is $299,286, under the $900,000 sticker and under the approach centre's $900,000.
- **Cargo hub II, spotters deck, landmarks.** `lateSites` is empty on every persona. Cargo hub II is $640,000 at FL8. The observation tower is $600,000 at FL8. The spotters deck is $145,000 at FL8, which Careful can afford from day 120 ($290,847, already FL8). The player command API has no late-building stamp, so the personas never place one.
- **Council.** It unlocks at FL8. Every persona who gets there has standing stuck at 50 and zero votes. A request is sitting open at the end (“Regional access compact”). Nothing in the command API calls `answerCouncilRequest`.
- **Carbon.** Tracking runs on its own: 293–1,181 tonnes, offsets 0. Green Pioneer never starts. Nothing in the command API calls `startGreenPioneer` or `buyCarbonOffsets`.
- **Field tasks.** Careful's most common failed command is `buildFieldAsk` ×1,223, “Needs grass.” Greedy's is ×655, “That hangar overlaps a taxiway.” The ask is up and the stamp has nowhere legal to land.

## Proposals

No sim numbers were changed.

1. **Staff the check-in so a second small carrier fits.** Today two starter desks and the kiosk clear 22 passengers a minute (`src/scale/data.ts` `PAX_UNITS.desk.perMin` 8, `PAX_UNITS.kiosk.perMin` 6, `src/game/openingData.ts` `STARTER_CAPACITY.desks` 2). The refusal is a combined peak of 28. Raise `STARTER_CAPACITY.desks` from 2 to 3. Careful and Greedy already hire three desk agents, so the extra desk has a body, and staffed capacity becomes 3×8+6 = 30. Expected effect: the letter that now fails at 28 versus 22 signs. A second carrier joins in the first month, and Careful's completed-flight pace can leave the 2.5–3.0 a day band that has held since the one-carrier book.

2. **Stop three blocked finals from deleting the only carrier.** `ATC_MAX_GO_AROUNDS` is 3 and each go-around calls `adjustHeat(..., -0.6)` in `goAround` in `src/game/sim.ts`. Live Careful logs 237 go-arounds and 172 diverts, refunds −$390,908, and Standing −99 with the block reason “Go-around: runway not clear.” Preferred never arrives. Tip Greedy on one strip logs 348 go-arounds. The second strip does not clear it: Careful opens strip 2 on day 26 and still logs 237. Move the two numbers next to `HEAT_ABANDON_THRESHOLD` in `src/game/catalog.ts`. Set the divert cap from 3 to 6 and the Standing hit from −0.6 to −0.15. Expected effect: a blocked final stays a delay through the first few passes, the signed carrier stays above the walk-away line at 20, and Preferred is reachable again inside 90 days (it was day 18 on the 09:30 tip). Fewer 3-strike diverts shrink the refund book, so the day-90 till can rise off the $250,000 plateau. Greedy's day-150 taxi-out softlock is the same runway pile-up left unresolved; this is the number to change before adding strip capacity.

3. **Price Tower III and cargo hub II against the till an FL9 field actually has.** Live Careful reaches FL9 on day 148 with $254,432, peak $299,286. Tower III is $900,000 and wants the approach centre at another $900,000. Cargo hub II is $640,000 at FL8. In `src/airside/data.ts`, set `TOWER_III_UPGRADE.cost` from 900,000 to 140,000 (leave upkeep at $12,000 a day). In `src/content/buildings_tier3.ts`, set the approach centre from 900,000 to 160,000 and cargo hub II from 640,000 to 220,000. Expected effect: approach centre plus Tower III is $300,000, a till-emptying choice on the day FL9 arrives, and cargo hub II is affordable once FL8 is up (Careful, day 109, cash already above $270,000). The spotters deck at $145,000 already fits that till and needs no price cut. These stickers do not create a path. The command API still cannot place a late site, vote a council request, or start Green Pioneer, so a persona will keep reporting zero purchases until those commands exist. A human who opens the build bar on an FL9 field would be the one who can spend the new prices.
