# Why Careful and Greedy finish the month in the red

The bot report in `report.json` (generated 2026-10-14, standard start **$150,000**) is the cash evidence. That file has no category ledger, so the named sinks below come from a second headless run of the same personas on current `main`, which starts at **$168,000**. Both runs end in the same place. Balance numbers were not changed for this note.

| Persona | Report days | Report flights | Report signed | Report end cash | Replay end cash (start $168,000) |
| --- | --- | --- | --- | --- | --- |
| Careful | 45 | 76, 4/4 shops leased | 12 | −$21,490 | about −$21,000 |
| Greedy | 60 | 57 | 11 | −$18,424 | about −$18,400 |

A full hall, leased shops, and dozens of completed turns still lose money. The extra $18,000 now in `START_CASH.standard` does not cover the hole.

## What the report curves already show

Careful, from `report.json`:

- Day 0 cash is **$55,000**. That is $150,000 minus the city plot (`LAND.city.cost` **$95,000**). The delta is exact.
- Day 1 cash is **$8,685**, a drop of **$46,315**. The starter kit is **$48,000**, so day 0’s fees only put about **$1,700** back.
- Cash after the kit is about **$7,000**. From day 1 to day 45 the mean change is **−$686 per day**. $8,685 plus 44 days at that rate lands on the reported **−$21,490**.
- The drip is lumpy. The worst days after the opening are day 32 (**−$22,842**) and day 18 (**−$19,669**). The best day only gives back **+$12,423**.
- First negative sample is day 11. Last positive sample is day 31 ($1,654). From day 32 the balance sits between **−$19,844** and **−$21,490**.
- Passengers leave with the money. Field rating falls from 65 to 25. Guests are 0 from day 36 onward, so the late plateau is an empty airport, not a recovery.

Greedy, same file:

- Same day-0 land purchase (**$55,000**).
- Day 1 is **$34,650**, which is **$25,965** above Careful. That matches buying the kit and taking the **$25,000** micro loan the same day.
- Mean change after day 1 is **−$900 per day**. End cash **−$18,424**. 41 of 61 samples are already negative.
- Six stands, extra food and souvenir rooms, and a loan do not bend the curve up.

`CASH_DEBT_FLOOR` is **−$25,000**. `charge()` will not push cash below that. Both endings sit just above the floor, which is why a busy airport stops falling instead of going to six figures of debt. Bills that do not fit in the remaining room are simply not paid.

## Where the cash goes

Opening capex is the first hole, and it is supposed to be. On the reported $150,000 start, land plus kit leave **$7,000** (`OPENING_RESERVE` is now **$25,000** because start cash is $168,000). The rest of the loss is operations.

A replay that journals every `charge()` and bank post, Careful over 45 days (11 airlines, 59 flights, micro loan):

| Sink | Booked | What it is |
| --- | ---: | --- |
| Penalties | $458,168 | Fines below. Attempts were about $503,000; the debt floor ate the rest. |
| Day-close upkeep | $109,770 | `closeOperatingDay`: landside, pillar, and power. About **$2,440/day**. |
| Land holding | $103,032 | Plot tax, insurance, utilities, licences. About **$2,290/day**. Plot upkeep itself is only **$180/day**. |
| Payroll | $77,765 | About **$1,730/day** actually paid. The staffing floor is higher; short days pay what cash allows and then cut the maintenance and security sliders. |
| Fuel purchases | $20,800 | |
| Micro loan service | $24,147 | **$5,275** interest + **$18,872** principal, against **$25,000** borrowed. |

Penalty attempts on that Careful run:

| Fine | Hits | Cash attempted | Unit in code |
| --- | ---: | ---: | --- |
| Security shocks (`shockStock`) | 39 | $136,500 | Private field: **$4,000** hard / **$2,500** soft (`sim.ts` security failure) |
| Airline task misses | 50 | $80,000 | `FIELD_TASK_FAIL_FINE` **$1,600** |
| Refused emergencies | 30 | $75,000 | `EMERGENCY_REFUSE_FINE` **$2,500** |
| Inbound ledger (expired or refused asks) | 26 | $65,000 | Same **$2,500** refuse fine |
| Missed connections | 25 | $62,400 | `REBOOK_FEE` **$2,400** per bill (`hub/config.ts`) |
| Cargo volume misses | 27 | $48,600 | `CARGO_VOLUME_FAIL_FINE` **$1,800** |
| One crash | 1 | $35,877 | `18000 + (100 − runway condition) × 220`, then mitigated. Pavement was effectively ruined. |

Greedy over 60 days is the same list, larger: penalties **$659,314**, day-close upkeep **$234,840** (~$3,910/day), holding **$155,105** (~$2,585/day), payroll **$82,760**. The loan on that replay was the **$45,000** bridge (interest about **$8,850**, principal about **$33,500**). Two crashes booked about **$71,000**.

Income does show up. Careful’s replay booked about **$357,000** of landing fees, **$197,000** of contract fees, **$99,000** of fuel sales, and **$27,000** of retail sales. Leasing every shop is real money. It is smaller than the fine stack plus about **$4,700/day** of upkeep and holding. At roughly one to two turns a day, fees never catch a field that is also failing tasks, threats, diverts, and connections it cannot host.

The late guest collapse follows the cash collapse. A payroll shortfall cuts security toward the **50%** slider floor (`PAYROLL_SHORT_SLIDER_FLOOR`). Lower security produces more threat fines, which keeps cash under water, which misses the next payroll. Field rating 25 and an empty hall are the end of that loop. Careful’s happiness looks high (mean about 117 while guests exist) because the sim does not clamp it at 100. The rating and the empty hall are the signal that matters.

## Suggested tuning

No balance change in this pass. Targets below are sized so a careful starter that signs a handful of airlines and leases its shops can still be near even at day 45, with the debt floor left where it is.

| Lever | Current | Suggested | Why |
| --- | ---: | ---: | --- |
| Hard security fine (private field) | $4,000 | $1,500 | 39 shocks in 45 days. One per day is a sink, not a scare. |
| Soft security fine (private field) | $2,500 | $800 | Same path. |
| `FIELD_TASK_FAIL_FINE` | $1,600 | $500 | 50 misses. Spawn fewer asks until a desk is staffed, or bill this. |
| `CARGO_VOLUME_FAIL_FINE` | $1,800 | $600 | 27 misses on a passenger starter that also signed freight. |
| `EMERGENCY_REFUSE_FINE` | $2,500 | $800 | 30 refuses. A two-stand field cannot take every divert. |
| Expired inbound fine | $2,500 (same as refuse) | $0 | Letting a toast expire should not bill like a deliberate refuse. |
| `REBOOK_FEE` | $2,400 | $700 | 25 connection bills. The starter has no hub links. |
| Crash fine cap | about $36,000 once pavement is gone | cap **$12,000** | `18000 + 220 × condition loss` ran away after one bad landing. |
| Land holding | about $2,290/day | aim **under $800/day** | Plot upkeep is $180. Try `insuranceRate` **0.0004 → 0.00012** and `propertyTaxRate` **0.0012 → 0.0004**. |
| Day-close upkeep | about $2,440/day on the starter | aim **under $900/day** | `HALL_AMENITY_EXPENSE` is `per tick × 6`. Food is **$480/day** per room before the prefab’s own **$105**. Halve `PAYROLL_TICKS_PER_DAY`’s use for hall rooms, or set food/souvenir/lounge daily rates to **$160 / $120 / $200**. |
| Early payroll share | 75% of the day’s income | **45%** | `DAILY_PAYROLL_SHARE.early`. The floor already covers an empty day. |
| Mid-game payroll share | 57.5% | **40%** | Leaves room for the upkeep line. |
| `fieldOpsMultiplier` cap | 1.65 | **1.25** until field level 3 | Eleven signatures currently scale the whole wage bill. |
| `OPENING_RESERVE` | $25,000 (start $168,000) | leave it | Raising start cash to about **$208,000** would zero a $700/day hole at day 45 and still lose by day 60. Cut the fines and the daily bills first. |

Payroll slider cuts can stay. They should stop once security is low enough that threat fines exceed the wages saved. A practical guard is: do not auto-cut security below **70%** while `securityIncidents` is rising.

Shops are not the bug. Careful leased every unit and still lost. A rent bump would show up in the cash curve only after the fine and holding lines are smaller than landing fees.
