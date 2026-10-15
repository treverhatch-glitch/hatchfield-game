# Economy tuning

The playtester note is `docs/playtest/bots/economy_findings.md` (commit `e3482d6`). On current main a careful bot and a greedy bot both finished near −$21,000 even from a $168,000 start. Over 45 careful days the replay booked about $458,000 of penalties, about $2,440 a day of hall upkeep, about $2,290 a day of land holding, and about $1,730 a day of payroll. A short payroll day cut the security slider, which caused more threat fines.

The numbers below are a rerun of `src/playtest/run.ts` (`TUNE_BOTS=1 npx vitest run src/playtest/economyTune.test.ts`). One sim day is 180 seconds. The driver ticks at 5×. Careful runs 45 days, greedy 60, chaotic 30. Chaotic is the sloppy clicker.

## Baseline

| Lever | Was | Now |
| --- | ---: | ---: |
| Private-field hard security fine | $4,000 | $1,500 |
| Private-field soft security fine | $2,500 | $800 |
| Airline task miss | $1,600 | $500 |
| Cargo volume miss | $1,800 | $600 |
| Refused emergency | $2,500 | $800 |
| Expired inbound toast | $2,500 | $0 |
| Missed-connection rebook | $2,400 | $700 |
| Crash write-off | formula, about $36,000 on ruined pavement | capped at $12,000 |
| Property tax | 0.0012 of assessed | 0.0004 |
| Insurance | 0.0004 of assets | 0.00012 |
| Power / water utility | $14 / $9 per load | $7 / $4 |
| Food / souvenir / lounge upkeep | $480 / $360 / $600 a day | $160 / $120 / $200 |
| Early payroll share | 75% of the day's income | 45% |
| Mid-game payroll share | 57.5% | 40% |
| Ops wage cap before field level 3 | 1.65 | 1.25 |

Tax and insurance alone left a stamped starter at $1,115 a day of holding, and $780 of that was utilities. The utility rates above bring that starter bill to $719. Hall upkeep on the same field is $585. Both sit under the $800 and $900 aims.

A short payroll day still trims maintenance down to 50%. Security stops at 70% while `securityIncidents` is higher than it was at the previous payroll close, and the news says the lane is being held. A threat that arrives with security under 70% names the fine in the alert, before the player ignores it.

A one- or two-carrier field with no hotel, parking, or rail still pays 35% of building upkeep and bills 1.22× turn fees (`src/game/economyTuning.ts`). A third carrier, or a landside building, drops both. The bots above sign well past two carriers, so that relief is only the opening.

## Before

`docs/playtest/bots/rerun_oct15_0330.md` is the latest rerun on main before these cuts. Start cash $168,000. The personas already buy research and hire desk agents.

| Persona | End cash |
| --- | ---: |
| Careful (day 45) | −$16,952 |
| Greedy (day 60) | −$17,124 |

The earlier findings note, on the previous persona set, had careful and greedy both near −$21,000.

## After

Same persona file, rerun after the cuts and after desk and Wave 3 research were folded into the Growth tree.

| Persona | Day 30 | End | Minimum | Carriers | Flights | Task-miss lines |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Careful (day 45) | $126,852 | $183,534 | $9,109 | 5 | 110 | 50, totaling −$25,000 |
| Greedy (day 60) | $38,857 | $7,511 | $99 | 11 | 147 | 54 still in the journal; the category total is −$33,000 |
| Chaotic / sloppy (day 30) | $223,100 | $223,100 | $2,353 | 8 | 96 | 33, totaling −$16,500 |

Each booked task-miss line is $500 (`FIELD_TASK_FAIL_FINE`). Careful’s 50 lines are 50 × $500. The $1,600 unit and the −$16,952 ending in `rerun_oct15_0330.md` are that pre-cut run on `7776b7a`.

Careful is in the black by day 30 and still there at day 45. Greedy stays lower and finishes at $7,511. Chaotic’s lowest daily sample is $2,353 and the day-30 cash is $223,100.

## Curb demand, 15 Oct rerun

`docs/playtest/bots/rerun_oct15_0630.md` is the measurement on `48b2dca` and the rerun after the one lever below. No fee, fine, or upkeep line was added. Research tier costs and relation scores were not changed: one unstaffed lab held 26 of 62 nodes at day 30 and had not cleared the tree by day 45 (Greedy still had 46 at day 60), and a well-served carrier reached Preferred on day 29 of the baseline and day 13 of the rerun.

| Lever | Was | Now |
| --- | ---: | ---: |
| Turns the starter curb absorbs before extra passengers arrive | none (live jets only) | 52 completed turns |
| Passengers per minute for each turn past that | 0 | 0.2 |

Live departures never filled three stalls, because one runway only has a couple of jets on the ramp. The baseline curb peak was 0.72 / 0.86 / 0.76 and never crossed 1, so Careful never stamped a bay.

| | Baseline | After |
| --- | ---: | ---: |
| Careful day 30 / day 45 | $100,422 / $190,675 | $122,727 / $160,765 |
| Greedy day 30 / day 60 | $8,129 / $12,608 | $3,348 / $17,213 |
| Chaotic day 30 | $312,410 | $207,814 |
| Careful curb | peak 0.72, starter all the way | intra peak crosses 1 on day 22 (10 carriers, 74 flights, 0 bays); day-boundary 1.1 on day 24 at 80 flights, still the starter curb |
| Greedy curb | peak 0.86 | crosses 1 on day 24 (11 carriers, 80 flights, starter curb) and stays over, because Greedy does not stamp |
| First five days | under 1 | under 1 (Careful day 4 peak 0.56) |

Careful’s cash keeps rising after day 30. Greedy after day 30 goes from $3,348 to $17,213. The $1,243 sample is day 29, when a $320,000 loan was spent on construction, not a penalty bleed. One bus bay is on Careful’s field by day 25 and that day’s curb peak is 0.8. Later turns push the single bay back over 1, and Careful then adds the taxi rank and the curb lane.
