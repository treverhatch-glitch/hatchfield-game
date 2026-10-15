# Research pacing — 15 Oct

The rates and tier prices in the tables below were replaced the same day. The live curve is diminishing room returns, a wallet cap at twice the next node, and one Growth-tree balance. See [RESEARCH.md](../RESEARCH.md) and the 90-day table in [research_pace.md](research_pace.md).

No new gates. Field-level category unlocks and the prerequisite chains are unchanged. The 1.5× price on a second specialisation branch is unchanged. What moved are the tier prices and the two incomes that feed the Growth tree: the operations trickle, and the research desk, chalkboard, and lab bench.

| Tunable | Before | After |
| --- | ---: | ---: |
| Operations trickle | 0.01 RP/s | 0.009 RP/s |
| Research desk | 0.04 RP/s | 0.032 RP/s |
| Chalkboard | 0.03 RP/s | 0.024 RP/s |
| Lab bench | 0.06 RP/s | 0.048 RP/s |
| Paid tiers | 50, 52, 54, 56, 62 | 76, 86, 96, 100, 114 |

The lab bench rate is 0.048 RP/s, four fifths of the old 0.06. A careful lab with one of each room and no researchers earns 0.113 RP/s (0.009 from operations, 0.104 from the rooms). One day of that is 20 points, under the first paid tier (76), so a paid node still takes more than a day to save for.

The last tier costs 114, and the first node of any later specialisation also costs 114 (`ceil(76 × 1.5)`). A cheapest-first buyer therefore finishes one branch and the six shared lines before opening a second branch.

## Before

Published 90-day run in [morning_oct15.md](morning_oct15.md), previous tunables, seeds Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. Standard difficulty, passengers, sandbox off, 5×, tick 0.25s, act every 12 sim seconds. One day is 180 sim seconds. The field's `Math.random` is unseeded, so dollars and flight counts move between machines.

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Tree nodes | 62 / 62 | 62 / 62 | 62 / 62 |
| Points left | 380 | 150 | 17,160 |
| Lab (desk / board / bench) | 1 / 1 / 1 | — | 14 / 18 / 16 |
| Flights turned | 463 | 394 | 431 |

A rerun of those same previous tunables on this machine, same seeds and driver, still cleared the tree: Careful 59 nodes (57 left, 3,341 earned, 311 flights), Greedy 60 (52 left, 3,429 earned, 330 flights), Chaotic 62 (12,832 left, 16,395 earned, 15 / 19 / 9 furniture, 341 flights). The morning's higher flight totals were not what finished the tree.

Flight counts in both of these runs are low because a runway spacing regression was in the build and is being fixed separately. The morning Careful turned 463 flights; the same seeds on this machine turned about 310–340. The tier prices and room rates were not moved to make up for those missing turns. When the spacing fix lands, a careful airport will earn more points from flights than the tables below show.

## After

Same three bots, same seeds and driver, tunables above. 90 sim days. These flight counts are the depressed ones from the runway spacing regression, not a retune target.

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Wall | 70s | 102s | 92s |
| Tree nodes | 38 / 62 (61%) | 39 / 62 (63%) | 62 / 62 |
| Points left | 85 | 3 | 5,984 |
| Points earned | 2,933 | 2,965 | 12,121 |
| Lab (desk / board / bench) | 1 / 1 / 1 | 1 / 1 / 1 | 10 / 16 / 12 |
| Room rate | 0.104 RP/s | 0.104 RP/s | 1.28 RP/s |
| Specialisation | Cargo 4, no other branch | Cargo 4, no other branch | All five branches, depth 5 |
| Flights turned | 324 | 325 | 329 |
| Field rating, day 90 | 69 | 59 | 43 |

Careful and Greedy each hired no researchers and bought one desk, one chalkboard, and one bench. Both stopped on Cargo, four nodes deep, with no other branch open. Careful's next node is still a shared-line capstone at 114, and the wallet is holding 85. The first node of a second branch is also 114, so that choice has not started. At Careful's measured earning rate the catalog (6,136 points for every node, second branches at 1.5×) is paid off around day 188. Day 150 is still short of the last nodes. That projection holds the day-90 rate constant; it is not a second bot run.

Chaotic still finishes by day 90. The persona stamps extra lab rooms with no cap, and this run ended at 10 desks, 16 chalkboards, and 12 benches (1.28 RP/s against Careful's 0.104). The unspent pile is 5,984, down from 17,160 in the morning run and 12,832 on the previous-tunable rerun. There is no new limit on how many rooms a player can build.
