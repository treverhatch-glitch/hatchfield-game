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

Same persona file, after the cuts above.

| Persona | Day 30 | End | Minimum | Carriers | Flights |
| --- | ---: | ---: | ---: | ---: | ---: |
| Careful (day 45) | $183,906 | $158,936 | $13,900 | 12 | 87 |
| Greedy (day 60) | $26,636 | $1,840 | −$924 | 12 | 105 |
| Chaotic / sloppy (day 30) | $23,188 | $23,188 | $884 | 0 | 86 |

Careful is in the black by day 30 and still there at day 45. Greedy finishes just above zero and spends time below it. Chaotic falls to $884 and is back above $20,000 by day 30.
