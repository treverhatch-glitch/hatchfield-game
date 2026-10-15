# Bot rerun — 15 Oct 2026, 06:30 window

Headless personas on `48b2dca` after the curb-demand lever (standard difficulty, passenger focus, sandbox off). Careful 45 sim days, Greedy 60, Chaotic 30. Browser smoke was not repeated. The step-1 baseline, before this lever, is summarised at the top of this note.

One research tree has 62 nodes (6 lines × 6, plus the specialisation charter, plus 5 branches × 5). A third of that tree is 21 nodes. The logistics adapter did not mount in these runs (`buildLogisticsConfig` returns null until a depot and a farm share a road), so there is no second fuel ledger. The sim tank is the stock. `fuelLoads` is the older load counter. Tank held 60,000–80,000 L and no departure was grounded for fuel.

## Step 1 baseline, before the curb lever

Same personas on `48b2dca`, rules unchanged. Missed-connection cash was **$0** on every persona (0 missed, 0 diverts). The #29 growth in missed-connection penalties does not come back. What remains in the penalty total is `emergency_refuse`, `security_shock`, and a smaller `penalties` bucket.

| Persona | Day 30 | End | Minimum | Carriers | Flights | Penalty total | Missed connections | Curb peak | Preferred | Nodes at day 30 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Careful | $100,422 | $190,675 | $2,653 | 10 | 125 | -$50,200 | $0 | 0.72, never crossed 1 | day 29, Puddle Jumper 20 | 26 / 62, one unstaffed lab |
| Greedy | $8,129 | $12,608 | $399 | 21 | 221 | -$51,754 | $0 | 0.86, never crossed 1 | day 12 | 28 / 62 |
| Chaotic | $312,410 | $312,410 | $2,060 | 4 | 102 | -$51,581 | $0 | 0.76 on day 3 | day 16 | 47 / 62, six desks |

Careful’s cash rose from day 30 to day 45. Greedy’s cash after day 30 hovered between $3,998 and $19,384 and finished at $12,608. It did not trend to zero. One unstaffed lab (1 desk, 1 board, 1 bench, 0 researchers) held 26 of 62 nodes at day 30, about 42% rather than a third, and 36 at day 45. Greedy still had 46 at day 60. The tree was not cleared, so research costs were left alone. Careful’s well-served carrier reached Preferred on day 29, inside the 20–30 day band, on the existing score.

The miss was the curb. Live departures stay at a couple of jets because one runway turns every 150s, so pressure sat near 0.6 from day 1 through day 35. Three starter stalls never crossed 1, and Careful never stamped a bay.

## The lever

`LANDSIDE.turnAllowance` is 52 and `LANDSIDE.perTurn` is 0.2. Completed turns past 52 add passengers a minute at the door. No new cash category. Opening days are unchanged because the allowance covers them. A bus bay still takes coaches off the curb and adds two stalls, which brings an 80-turn bank back under 1. The numbers below are the rerun after that lever only.

## Did missed-connection penalties still grow?

The #29 note said penalty totals grew on a busier field, mostly missed connections. `1c8c21c` named the miss cause. This rerun is on a later main that also spaces the runway (`3360f09`) and caps hall litter (`48b2dca` and neighbors).

| Persona | Penalty total | Missed-connection ledger | Judged | Missed | Diverts | Avg inbound delay (game-min) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Careful | -$39,980 | $0 | 34 | 0 | 0 | 14 |
| Greedy expander | -$46,444 | $0 | 49 | 0 | 0 | 104 |
| Chaotic random clicker | -$21,000 | $0 | 20 | 0 | 0 | 14 |

## Cash, rating, and the post-day-30 window

| Persona | Start | Day 30 | End | Minimum | Carriers | Flights | Rating end | Taxi-out recoveries |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Careful | $168,000 | $122,727 | $160,765 | $7,252 | 10 | 161 | 80 | 1 |
| Greedy expander | $168,000 | $3,348 | $17,213 | $1,243 | 19 | 221 | 33 | 2 |
| Chaotic random clicker | $168,000 | $207,814 | $207,814 | $2,066 | 3 | 103 | 78 | 1 |

- **Careful.** Cash $122,727 on day 30 → $160,765 on day 45 ($38,038). Largest expense growth: payroll -$144,955; building_upkeep -$97,590; land_holding -$46,951; construction -$11,000; fuel_purchase -$9,600; emergency_refuse -$8,000.
- **Greedy expander.** Cash $3,348 on day 30 → $17,213 on day 60 ($13,865). Largest expense growth: building_upkeep -$227,700; payroll -$160,396; land_holding -$142,735; loan_repayment -$120,690; construction -$84,000; loan_interest -$29,700.
- **Chaotic random clicker.** Run ends at day 30, so there is no post-day-30 window.

Greedy’s 104 game-minute average inbound delay is the one-runway book with 19 carriers. Careful and Chaotic stay at 14. Missed-connection cash is still $0. Careful’s intra-day curb first crosses 1 on day 22 (10 carriers, 74 flights, starter curb). The day-boundary sample first crosses on day 24 at 1.1 with 80 flights and still no bay, rank, or extra lane. The bay is in on day 25 and that day’s peak is 0.8. Greedy, which does not stamp, crosses on day 24 at 80 flights and 11 carriers and stays over. Days 0–4 stay under 1.

## Careful (45 days)

First landing PDJ101 at 41.3s. Stands 4, runway strips 1, signed air_regional_1, zoomjet, alpine_swift, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue, air_lowcost_1, cityhopper. Taxi-out watchdog recoveries: 1.

| Day | Cash | Rating | Guests | Happy | Taxi-out | Tank L | Loads | Grounded | Curb | Stalls | Lanes | Bays | Ranks | Curb lanes | Check-in peak | Security peak | Carriers | Flights | RP earned | Nodes | Penalty total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | $73,000 | 65 | 0 | — | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | 0 | $0 |
| 1 | $8,452 | 76 | 2 | 61.5 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 5 | 3 | 1 | 1 | 12.7 | 1 | -$1,920 |
| 2 | $7,252 | 77 | 12 | 69.3 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 5 | 2 | 2 | 3 | 32.2 | 2 | -$3,400 |
| 3 | $12,140 | 83 | 14 | 70 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 1 | 3 | 5 | 32.2 | 3 | -$3,800 |
| 4 | $19,568 | 85 | 12 | 70 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 1 | 0 | 3 | 9 | 40.2 | 4 | -$4,600 |
| 5 | $16,723 | 86 | 3 | 63.3 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 4 | 12 | 35.2 | 5 | -$5,400 |
| 6 | $20,511 | 89 | 18 | 66.2 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 2 | 4 | 16 | 40.2 | 6 | -$5,800 |
| 7 | $21,726 | 89 | 3 | 62.2 | 0 | 80,000 | 4 | 0 | 0.2 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 5 | 20 | 40.2 | 7 | -$6,600 |
| 8 | $31,550 | 88 | 18 | 67.6 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 2 | 3 | 5 | 23 | 37.2 | 8 | -$7,400 |
| 9 | $27,077 | 89 | 3 | 62.7 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 5 | 26 | 40.2 | 9 | -$7,800 |
| 10 | $17,713 | 90 | 18 | 66.8 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 3 | 6 | 30 | 40.2 | 10 | -$8,200 |
| 11 | $21,766 | 88 | 1 | 60.5 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 6 | 34 | 40.2 | 11 | -$9,000 |
| 12 | $25,435 | 88 | 18 | 63.3 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 4 | 2 | 6 | 37 | 37.2 | 12 | -$9,400 |
| 13 | $29,331 | 88 | 4 | 67.9 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 7 | 7 | 41 | 40.2 | 13 | -$9,800 |
| 14 | $29,753 | 87 | 18 | 65.1 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 5 | 2 | 7 | 45 | 40.2 | 14 | -$10,600 |
| 15 | $37,021 | 88 | 2 | 66.5 | 0 | 80,000 | 4 | 0 | 0.2 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 7 | 49 | 40.2 | 15 | -$11,400 |
| 16 | $50,851 | 89 | 18 | 61.8 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 7 | 3 | 8 | 52 | 41.2 | 16 | -$11,800 |
| 17 | $57,995 | 88 | 3 | 66.7 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 5 | 7 | 8 | 56 | 40.2 | 17 | -$11,800 |
| 18 | $61,887 | 86 | 18 | 65.2 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 4 | 1 | 9 | 59 | 37.2 | 18 | -$13,000 |
| 19 | $65,958 | 87 | 2 | 67.5 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 5 | 9 | 9 | 63 | 40.2 | 19 | -$13,400 |
| 20 | $73,948 | 87 | 18 | 65.3 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 5 | 1 | 9 | 66 | 37.2 | 20 | -$13,800 |
| 21 | $79,685 | 87 | 3 | 62.3 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 10 | 70 | 40.2 | 21 | -$14,600 |
| 22 | $82,816 | 88 | 18 | 68.4 | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 4 | 1 | 10 | 74 | 40.2 | 22 | -$15,000 |
| 23 | $88,855 | 88 | 2 | 64.5 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 10 | 78 | 41.2 | 23 | -$15,400 |
| 24 | $96,090 | 88 | 13 | 76.7 | 0 | 80,000 | 4 | 0 | 1.1 | 3 | 1 | 0 | 0 | 0 | 2 | 0 | 10 | 80 | 34.2 | 24 | -$16,200 |
| 25 | $94,294 | 87 | 1 | 63 | 0 | 80,000 | 4 | 0 | 0.6 | 5 | 1 | 1 | 0 | 0 | 3 | 5 | 10 | 85 | 41.2 | 25 | -$16,600 |
| 26 | $97,773 | 88 | 13 | 75.2 | 0 | 80,000 | 4 | 0 | 0.7 | 5 | 1 | 1 | 0 | 0 | 3 | 4 | 10 | 89 | 38.2 | 25 | -$17,000 |
| 27 | $108,453 | 88 | 13 | 70 | 0 | 80,000 | 4 | 0 | 0.8 | 5 | 1 | 1 | 0 | 0 | 3 | 4 | 10 | 91 | 32.2 | 26 | -$17,800 |
| 28 | $122,245 | 85 | 13 | 67.1 | 0 | 80,000 | 4 | 0 | 0.9 | 5 | 1 | 1 | 0 | 0 | 2 | 2 | 10 | 95 | 43.2 | 27 | -$19,000 |
| 29 | $124,729 | 87 | 5 | 70 | 0 | 80,000 | 4 | 0 | 0.9 | 5 | 1 | 1 | 0 | 0 | 2 | 1 | 10 | 99 | 38.2 | 28 | -$25,506 |
| 30 | $122,727 | 87 | 6 | 73.5 | 0 | 80,000 | 4 | 0 | 0.8 | 5 | 1 | 1 | 0 | 0 | 2 | 1 | 10 | 103 | 37.2 | 28 | -$25,506 |
| 31 | $131,945 | 87 | 5 | 70 | 0 | 80,000 | 4 | 0 | 0.9 | 5 | 1 | 1 | 0 | 0 | 2 | 1 | 10 | 106 | 34.2 | 29 | -$26,306 |
| 32 | $132,151 | 84 | 6 | 71.4 | 0 | 80,000 | 4 | 0 | 1 | 5 | 1 | 1 | 0 | 0 | 3 | 3 | 10 | 110 | 37.2 | 29 | -$26,706 |
| 33 | $138,681 | 85 | 12 | 70 | 0 | 80,000 | 4 | 0 | 1 | 5 | 1 | 1 | 0 | 0 | 3 | 3 | 10 | 114 | 37.2 | 30 | -$27,906 |
| 34 | $129,261 | 83 | 13 | 73.5 | 0 | 80,000 | 4 | 0 | 1 | 7 | 1 | 1 | 1 | 0 | 2 | 2 | 10 | 117 | 35.2 | 31 | -$28,706 |
| 35 | $140,465 | 86 | 11 | 70 | 0 | 80,000 | 4 | 0 | 1.2 | 7 | 1 | 1 | 1 | 0 | 3 | 4 | 10 | 120 | 35.2 | 31 | -$29,106 |
| 36 | $131,891 | 86 | 25 | 69.6 | 0 | 80,000 | 4 | 0 | 0.5 | 9 | 2 | 1 | 1 | 1 | 4 | 8 | 10 | 124 | 38.2 | 32 | -$35,180 |
| 37 | $138,292 | 86 | 16 | 74.6 | 0 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 3 | 6 | 10 | 127 | 35.2 | 33 | -$35,980 |
| 38 | $138,482 | 85 | 18 | 68.9 | 0 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 3 | 3 | 10 | 131 | 40.2 | 33 | -$36,380 |
| 39 | $143,360 | 86 | 11 | 70 | 0 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 0 | 0 | 10 | 135 | 40.2 | 34 | -$37,180 |
| 40 | $149,507 | 85 | 0 | — | 0 | 60,000 | 3 | 0 | 0.7 | 9 | 2 | 1 | 1 | 1 | 0 | 0 | 10 | 140 | 41.2 | 35 | -$37,580 |
| 41 | $145,299 | 83 | 0 | — | 0 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 0 | 0 | 10 | 144 | 37.2 | 35 | -$38,380 |
| 42 | $153,425 | 83 | 0 | — | 0 | 80,000 | 4 | 0 | 0.7 | 9 | 2 | 1 | 1 | 1 | 0 | 0 | 10 | 149 | 40.2 | 36 | -$38,780 |
| 43 | $156,977 | 80 | 0 | — | 0 | 80,000 | 4 | 0 | 0.7 | 9 | 2 | 1 | 1 | 1 | 0 | 0 | 10 | 154 | 40.2 | 37 | -$39,180 |
| 44 | $158,117 | 80 | 0 | — | 0 | 80,000 | 4 | 0 | 0.7 | 9 | 2 | 1 | 1 | 1 | 5 | 4 | 10 | 158 | 37.2 | 37 | -$39,580 |
| 45 | $160,765 | 80 | 10 | 70 | 0 | 80,000 | 4 | 0 | 0.8 | 9 | 2 | 1 | 1 | 1 | 0 | 0 | 10 | 161 | 34.2 | 38 | -$39,980 |

Penalty totals are cumulative. Category split at each day:

| Day | Penalties |
| --- | --- |
| 0 | $0 |
| 1 | penalties -$720, security_shock -$800, emergency_refuse -$400 |
| 2 | penalties -$1,800, security_shock -$800, emergency_refuse -$800 |
| 3 | penalties -$1,800, security_shock -$800, emergency_refuse -$1,200 |
| 4 | penalties -$1,800, security_shock -$800, emergency_refuse -$2,000 |
| 5 | penalties -$1,800, security_shock -$800, emergency_refuse -$2,800 |
| 6 | penalties -$1,800, security_shock -$800, emergency_refuse -$3,200 |
| 7 | penalties -$1,800, security_shock -$800, emergency_refuse -$4,000 |
| 8 | penalties -$1,800, security_shock -$800, emergency_refuse -$4,800 |
| 9 | penalties -$1,800, security_shock -$800, emergency_refuse -$5,200 |
| 10 | penalties -$1,800, security_shock -$800, emergency_refuse -$5,600 |
| 11 | penalties -$1,800, security_shock -$800, emergency_refuse -$6,400 |
| 12 | penalties -$1,800, security_shock -$800, emergency_refuse -$6,800 |
| 13 | penalties -$1,800, security_shock -$800, emergency_refuse -$7,200 |
| 14 | penalties -$1,800, security_shock -$800, emergency_refuse -$8,000 |
| 15 | penalties -$1,800, security_shock -$800, emergency_refuse -$8,800 |
| 16 | penalties -$1,800, security_shock -$800, emergency_refuse -$9,200 |
| 17 | penalties -$1,800, security_shock -$800, emergency_refuse -$9,200 |
| 18 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$9,600 |
| 19 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$10,000 |
| 20 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$10,400 |
| 21 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$11,200 |
| 22 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$11,600 |
| 23 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$12,000 |
| 24 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$12,800 |
| 25 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$13,200 |
| 26 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$13,600 |
| 27 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$14,400 |
| 28 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$14,800 |
| 29 | penalties -$7,506, security_shock -$2,400, emergency_refuse -$15,600 |
| 30 | penalties -$7,506, security_shock -$2,400, emergency_refuse -$15,600 |
| 31 | penalties -$7,506, security_shock -$2,400, emergency_refuse -$16,400 |
| 32 | penalties -$7,506, security_shock -$2,400, emergency_refuse -$16,800 |
| 33 | penalties -$7,506, security_shock -$3,200, emergency_refuse -$17,200 |
| 34 | penalties -$7,506, security_shock -$3,200, emergency_refuse -$18,000 |
| 35 | penalties -$7,506, security_shock -$3,200, emergency_refuse -$18,400 |
| 36 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$18,800 |
| 37 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$19,600 |
| 38 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$20,000 |
| 39 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$20,800 |
| 40 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$21,200 |
| 41 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$22,000 |
| 42 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$22,400 |
| 43 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$22,800 |
| 44 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$23,200 |
| 45 | penalties -$13,180, security_shock -$3,200, emergency_refuse -$23,600 |

Ledger by category is cumulative. Change since the previous sampled day:

| Day | Ledger change |
| --- | --- |
| 0 | construction -$95,000 |
| 1 | construction -$65,400; staff_hiring -$10,400; payroll -$9,909; fuel_purchase -$800; security_shock -$800; penalties -$720; emergency_refuse -$400; building_upkeep -$354; land_holding -$253; parking_fees $279; baggage_fees $356; passenger_fees $634; retail_sales $858; task_rewards $3,600; contract_fees $3,686; fuel_sales $4,294; landing_fees $10,781 |
| 2 | payroll -$5,989; staff_hiring -$3,200; penalties -$1,080; fuel_purchase -$400; emergency_refuse -$400; building_upkeep -$354; land_holding -$253; retail_cogs -$178; parking_fees $279; baggage_fees $356; passenger_fees $634; retail_sales $1,542; landing_fees $2,010; fuel_sales $2,147; contract_fees $3,686 |
| 3 | payroll -$12,119; construction -$9,000; fuel_purchase -$1,200; building_upkeep -$1,010; land_holding -$724; emergency_refuse -$400; parking_fees $558; baggage_fees $656; retail_sales $1,097; passenger_fees $1,215; landside_fees $2,400; contract_fees $4,721; task_rewards $5,000; fuel_sales $6,054; landing_fees $7,640 |
| 4 | payroll -$11,570; construction -$11,000; building_upkeep -$1,430; land_holding -$972; emergency_refuse -$800; fuel_purchase -$400; retail_cogs -$311; parking_fees $279; baggage_fees $292; passenger_fees $520; retail_sales $1,114; level_reward $2,500; contract_fees $3,458; fuel_sales $3,520; landside_fees $4,800; landing_fees $4,928; task_rewards $12,500 |
| 5 | payroll -$6,917; construction -$2,600; building_upkeep -$1,590; land_holding -$972; fuel_purchase -$800; emergency_refuse -$800; retail_sales $77; fuel_sales $1,760; landside_fees $2,400; landing_fees $3,200; contract_fees $3,397 |
| 6 | payroll -$6,934; construction -$2,200; building_upkeep -$1,710; land_holding -$972; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$144; baggage_fees $151; parking_fees $261; landing_fees $632; passenger_fees $1,159; fuel_sales $1,646; retail_sales $2,708; landside_fees $4,800; contract_fees $5,191 |
| 7 | construction -$10,100; payroll -$8,242; building_upkeep -$2,670; land_holding -$973; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$144; baggage_fees $148; parking_fees $261; passenger_fees $1,102; retail_sales $1,426; fuel_sales $3,406; landing_fees $3,810; task_rewards $4,800; landside_fees $4,800; contract_fees $5,191 |
| 8 | payroll -$7,380; building_upkeep -$2,670; land_holding -$973; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$432; baggage_fees $161; parking_fees $261; passenger_fees $1,338; fuel_sales $3,406; landing_fees $3,844; retail_sales $3,878; landside_fees $4,800; contract_fees $5,191 |
| 9 | construction -$20,200; payroll -$8,571; building_upkeep -$2,930; land_holding -$1,270; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; baggage_fees $151; parking_fees $261; retail_sales $924; passenger_fees $1,159; fuel_sales $3,406; landing_fees $3,829; level_reward $4,000; landside_fees $4,800; contract_fees $5,312; task_rewards $6,000 |
| 10 | construction -$18,000; payroll -$8,293; building_upkeep -$4,610; land_holding -$1,298; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$313; baggage_fees $150; parking_fees $261; landing_fees $606; passenger_fees $1,138; fuel_sales $1,646; retail_sales $3,138; landside_fees $4,800; contract_fees $5,211; task_rewards $7,000 |
| 11 | payroll -$8,373; building_upkeep -$4,610; land_holding -$1,298; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$144; baggage_fees $163; parking_fees $261; retail_sales $1,030; passenger_fees $1,359; fuel_sales $3,406; landing_fees $3,848; landside_fees $4,800; contract_fees $5,211 |
| 12 | payroll -$8,432; building_upkeep -$4,610; land_holding -$1,298; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$297; baggage_fees $155; parking_fees $261; passenger_fees $1,216; landside_fees $2,400; retail_sales $3,055; fuel_sales $3,406; landing_fees $3,802; contract_fees $5,211 |
| 13 | payroll -$8,824; building_upkeep -$4,610; land_holding -$1,298; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; baggage_fees $154; parking_fees $261; retail_sales $1,123; passenger_fees $1,209; fuel_sales $3,406; landing_fees $3,817; landside_fees $4,800; contract_fees $5,202 |
| 14 | payroll -$8,904; building_upkeep -$4,610; land_holding -$1,298; emergency_refuse -$800; fuel_purchase -$400; retail_cogs -$148; baggage_fees $150; parking_fees $261; landing_fees $585; passenger_fees $1,130; fuel_sales $1,646; retail_sales $2,717; landside_fees $4,800; contract_fees $5,293 |
| 15 | payroll -$8,983; building_upkeep -$4,610; land_holding -$1,298; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$288; baggage_fees $154; parking_fees $261; retail_sales $1,199; passenger_fees $1,209; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,293; landing_fees $7,725 |
| 16 | payroll -$9,355; building_upkeep -$4,610; land_holding -$2,498; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$298; baggage_fees $150; parking_fees $261; passenger_fees $1,130; retail_sales $3,034; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,293; level_reward $6,000; landing_fees $7,717 |
| 17 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,498; fuel_purchase -$800; retail_cogs -$292; baggage_fees $154; parking_fees $261; passenger_fees $1,209; retail_sales $1,685; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,463; landing_fees $7,738 |
| 18 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,501; security_shock -$800; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$148; baggage_fees $150; parking_fees $261; passenger_fees $1,145; fuel_sales $1,646; retail_sales $3,477; landside_fees $4,800; landing_fees $5,143; contract_fees $5,500 |
| 19 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,501; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; baggage_fees $153; parking_fees $261; passenger_fees $1,180; retail_sales $1,290; landside_fees $2,400; fuel_sales $3,406; contract_fees $5,500; landing_fees $7,709 |
| 20 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,501; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$297; baggage_fees $155; parking_fees $261; passenger_fees $1,223; retail_sales $2,162; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,500; landing_fees $8,464 |
| 21 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,501; fuel_purchase -$800; emergency_refuse -$800; baggage_fees $155; parking_fees $261; retail_sales $1,114; passenger_fees $1,216; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,136; landing_fees $7,731 |
| 22 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,501; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$288; baggage_fees $163; parking_fees $261; passenger_fees $1,374; fuel_sales $1,646; retail_sales $2,741; landing_fees $4,542; landside_fees $4,800; contract_fees $5,175 |
| 23 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,501; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$288; baggage_fees $172; parking_fees $261; retail_sales $929; passenger_fees $1,510; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,175; landing_fees $7,756 |
| 24 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,501; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$144; baggage_fees $154; parking_fees $261; passenger_fees $1,195; retail_sales $2,752; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,175; landing_fees $7,720 |
| 25 | payroll -$9,372; construction -$8,500; building_upkeep -$5,570; land_holding -$2,502; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; parking_fees $243; passenger_fees $486; baggage_fees $710; retail_sales $877; fuel_sales $3,293; landside_fees $4,800; contract_fees $5,340; landing_fees $9,743 |
| 26 | payroll -$9,372; building_upkeep -$5,570; land_holding -$2,502; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$144; parking_fees $243; passenger_fees $486; baggage_fees $710; fuel_sales $1,533; retail_sales $2,373; landside_fees $4,800; contract_fees $5,381; landing_fees $6,341 |
| 27 | payroll -$11,074; building_upkeep -$5,570; land_holding -$2,502; fuel_purchase -$1,200; emergency_refuse -$800; retail_cogs -$291; parking_fees $522; baggage_fees $1,006; passenger_fees $1,045; retail_sales $1,905; landside_fees $4,800; fuel_sales $5,053; contract_fees $6,416; landing_fees $11,371 |
| 28 | payroll -$9,372; building_upkeep -$5,570; land_holding -$3,126; security_shock -$800; fuel_purchase -$400; emergency_refuse -$400; retail_sales $901; fuel_sales $1,760; contract_fees $4,346; landside_fees $4,800; level_reward $8,000; landing_fees $13,652 |
| 29 | payroll -$12,549; penalties -$5,706; building_upkeep -$5,570; land_holding -$3,126; fuel_purchase -$1,200; emergency_refuse -$800; parking_fees $801; baggage_fees $1,148; passenger_fees $1,179; retail_sales $1,208; landside_fees $4,800; fuel_sales $5,053; contract_fees $7,596; landing_fees $9,650 |
| 30 | payroll -$9,372; building_upkeep -$5,570; land_holding -$3,126; fuel_purchase -$400; retail_sales $434; fuel_sales $1,760; landside_fees $2,400; contract_fees $4,534; landing_fees $7,337 |
| 31 | payroll -$10,348; building_upkeep -$5,570; land_holding -$3,126; fuel_purchase -$1,200; emergency_refuse -$800; retail_cogs -$144; passenger_fees $233; parking_fees $486; retail_sales $592; baggage_fees $1,124; landside_fees $4,800; fuel_sales $4,826; contract_fees $6,604; landing_fees $11,742 |
| 32 | payroll -$9,372; building_upkeep -$5,570; land_holding -$3,126; fuel_purchase -$400; emergency_refuse -$400; retail_sales $529; fuel_sales $1,760; contract_fees $4,534; landside_fees $4,800; landing_fees $7,451 |
| 33 | payroll -$9,372; building_upkeep -$5,570; land_holding -$3,129; fuel_purchase -$800; security_shock -$800; emergency_refuse -$400; parking_fees $522; passenger_fees $652; baggage_fees $861; retail_sales $1,261; fuel_sales $3,293; landside_fees $4,800; contract_fees $6,786; landing_fees $8,426 |
| 34 | payroll -$9,372; construction -$6,500; building_upkeep -$6,290; land_holding -$3,130; emergency_refuse -$800; fuel_purchase -$400; retail_cogs -$295; retail_sales $1,272; fuel_sales $1,760; landside_fees $2,400; contract_fees $4,761; landing_fees $7,174 |
| 35 | payroll -$11,596; building_upkeep -$6,290; land_holding -$3,130; fuel_purchase -$1,200; emergency_refuse -$400; parking_fees $558; baggage_fees $588; passenger_fees $1,079; retail_sales $1,607; fuel_sales $5,280; contract_fees $6,831; landside_fees $7,200; landing_fees $10,677 |
| 36 | payroll -$9,372; building_upkeep -$6,830; penalties -$5,674; construction -$4,500; land_holding -$3,131; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$292; baggage_fees $295; parking_fees $558; passenger_fees $1,040; fuel_sales $1,760; landside_fees $2,400; retail_sales $2,855; contract_fees $5,796; landing_fees $7,321 |
| 37 | payroll -$10,547; building_upkeep -$6,830; land_holding -$3,131; fuel_purchase -$1,200; emergency_refuse -$800; retail_cogs -$144; parking_fees $261; baggage_fees $453; passenger_fees $1,388; retail_sales $1,978; landside_fees $4,800; fuel_sales $5,166; contract_fees $7,021; landing_fees $7,985 |
| 38 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,131; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$144; fuel_sales $1,760; retail_sales $1,789; landside_fees $4,800; contract_fees $4,999; landing_fees $7,120 |
| 39 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,131; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$148; baggage_fees $439; parking_fees $540; passenger_fees $1,663; retail_sales $1,782; fuel_sales $3,406; landside_fees $4,800; landing_fees $6,260; contract_fees $7,069 |
| 40 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,131; fuel_purchase -$400; emergency_refuse -$400; city_levy -$22; retail_sales $203; fuel_sales $3,520; contract_fees $4,999; landside_fees $7,200; landing_fees $10,379 |
| 41 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,131; emergency_refuse -$800; fuel_purchase -$400; retail_sales $18; landing_fees $3,908; contract_fees $5,199; landside_fees $7,200 |
| 42 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,131; fuel_purchase -$800; emergency_refuse -$400; city_levy -$41; retail_sales $23; fuel_sales $3,520; contract_fees $5,249; landside_fees $9,600; landing_fees $10,309 |
| 43 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,131; fuel_purchase -$400; emergency_refuse -$400; city_levy -$59; retail_sales $27; fuel_sales $1,760; contract_fees $5,249; landing_fees $7,108; landside_fees $9,600 |
| 44 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,131; fuel_purchase -$400; emergency_refuse -$400; city_levy -$65; retail_sales $20; fuel_sales $1,760; contract_fees $5,249; landing_fees $7,108; landside_fees $7,200 |
| 45 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,131; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$144; city_levy -$77; parking_fees $279; baggage_fees $287; passenger_fees $474; retail_sales $692; fuel_sales $1,760; landing_fees $5,817; contract_fees $6,494; landside_fees $7,200 |

Relations (signed carriers):

| Day | Tier and score |
| --- | --- |
| 0 | — |
| 1 | Puddle Jumper Airlines 1.4 T1 |
| 2 | Zoomjet 2.1 T1; Puddle Jumper Airlines 1 T1 |
| 3 | Zoomjet 2.2 T1; Alpine Swift 2.1 T1; Puddle Jumper Airlines 1.7 T1 |
| 4 | Puddle Jumper Airlines 3.5 T1; Alpine Swift 2.2 T1; Zoomjet 2.2 T1 |
| 5 | Puddle Jumper Airlines 4.4 T1; Zoomjet 2.3 T1; Alpine Swift 2.2 T1; Harbor Heli 2.1 T1 |
| 6 | Puddle Jumper Airlines 6.7 T1; Alpine Swift 2.3 T1; Harbor Heli 2.2 T1; Zoomjet 1.9 T1 |
| 7 | Puddle Jumper Airlines 9.1 T1; Alpine Swift 2.4 T1; Harbor Heli 2.2 T1; Island Heli 2.1 T1; Zoomjet 1.6 T1 |
| 8 | Puddle Jumper Airlines 11.5 T1; Alpine Swift 2.5 T1; Harbor Heli 2.3 T1; Island Heli 2.2 T1; Zoomjet 1.3 T1 |
| 9 | Puddle Jumper Airlines 12.9 T1; Alpine Swift 2.6 T1; Harbor Heli 2.4 T1; Island Heli 2.2 T1; Zoomjet 1 T1 |
| 10 | Puddle Jumper Airlines 15.3 T1; Alpine Swift 2.6 T1; Harbor Heli 2.5 T1; Island Heli 2.3 T1; Medevac One 2.1 T1; Zoomjet 0.9 T1 |
| 11 | Puddle Jumper Airlines 17.6 T1; Alpine Swift 2.7 T1; Harbor Heli 2.6 T1; Island Heli 2.4 T1; Medevac One 2.2 T1; Zoomjet 0.8 T1 |
| 12 | Puddle Jumper Airlines 20 T1; Alpine Swift 2.8 T1; Harbor Heli 2.6 T1; Island Heli 2.5 T1; Medevac One 2.2 T1; Zoomjet 0.7 T1 |
| 13 | Puddle Jumper Airlines 22.4 T2; Alpine Swift 2.9 T1; Harbor Heli 2.7 T1; Island Heli 2.6 T1; Medevac One 2.3 T1; Rotorlink 2.1 T1; Zoomjet 0.7 T1 |
| 14 | Puddle Jumper Airlines 24.7 T2; Alpine Swift 3 T1; Harbor Heli 2.8 T1; Island Heli 2.6 T1; Medevac One 2.4 T1; Rotorlink 2.2 T1; Zoomjet 0.7 T1 |
| 15 | Puddle Jumper Airlines 27.1 T2; Alpine Swift 3 T1; Harbor Heli 2.9 T1; Island Heli 2.7 T1; Medevac One 2.5 T1; Rotorlink 2.2 T1; Zoomjet 0.7 T1 |
| 16 | Puddle Jumper Airlines 29.4 T2; Alpine Swift 3.1 T1; Harbor Heli 3 T1; Island Heli 2.8 T1; Medevac One 2.6 T1; Rotorlink 2.3 T1; Skyline Rescue 2.1 T1; Zoomjet 0.8 T1 |
| 17 | Puddle Jumper Airlines 31.8 T2; Alpine Swift 3.2 T1; Harbor Heli 3 T1; Island Heli 2.9 T1; Medevac One 2.6 T1; Rotorlink 2.4 T1; Skyline Rescue 2.2 T1; Zoomjet 0.8 T1 |
| 18 | Puddle Jumper Airlines 33.1 T2; Alpine Swift 3.1 T1; Harbor Heli 2.9 T1; Island Heli 2.8 T1; Medevac One 2.5 T1; Rotorlink 2.3 T1; SkyCheap 2.1 T1; Skyline Rescue 2 T1; Zoomjet 0.6 T1 |
| 19 | Puddle Jumper Airlines 35.4 T2; Alpine Swift 3.2 T1; Harbor Heli 3 T1; Island Heli 2.8 T1; Medevac One 2.6 T1; Rotorlink 2.4 T1; SkyCheap 2.2 T1; Skyline Rescue 2.1 T1; Zoomjet 0.6 T1 |
| 20 | Puddle Jumper Airlines 37.8 T2; Alpine Swift 3.2 T1; Harbor Heli 3.1 T1; Island Heli 2.9 T1; Medevac One 2.7 T1; Rotorlink 2.4 T1; SkyCheap 2.2 T1; Skyline Rescue 2.2 T1; Zoomjet 0.6 T1 |
| 21 | Puddle Jumper Airlines 40.1 T2; Alpine Swift 3.3 T1; Harbor Heli 3.2 T1; Island Heli 3 T1; Medevac One 2.8 T1; Rotorlink 2.5 T1; SkyCheap 2.3 T1; Skyline Rescue 2.3 T1; Cityhopper 2.1 T1; Zoomjet 0.6 T1 |
| 22 | Puddle Jumper Airlines 42.5 T2; Alpine Swift 3.4 T1; Harbor Heli 3.2 T1; Island Heli 3.1 T1; Medevac One 2.8 T1; Rotorlink 2.6 T1; SkyCheap 2.4 T1; Skyline Rescue 2.4 T1; Cityhopper 2.2 T1; Zoomjet 0.6 T1 |
| 23 | Puddle Jumper Airlines 44.9 T2; Alpine Swift 3.5 T1; Harbor Heli 3.3 T1; Island Heli 3.2 T1; Medevac One 2.9 T1; Rotorlink 2.7 T1; SkyCheap 2.5 T1; Skyline Rescue 2.4 T1; Cityhopper 2.2 T1; Zoomjet 0.6 T1 |
| 24 | Puddle Jumper Airlines 46.3 T3; Alpine Swift 3.6 T1; Harbor Heli 3.4 T1; Island Heli 3.2 T1; Medevac One 3 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.5 T1; Cityhopper 2.3 T1; Zoomjet 0.6 T1 |
| 25 | Puddle Jumper Airlines 49.6 T3; Harbor Heli 3.5 T1; Island Heli 3.3 T1; Alpine Swift 3.2 T1; Medevac One 3.1 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.6 T1; Cityhopper 2.4 T1; Zoomjet 1.2 T1 |
| 26 | Puddle Jumper Airlines 51.9 T3; Harbor Heli 3.6 T1; Island Heli 3.4 T1; Medevac One 3.2 T1; Rotorlink 2.9 T1; Alpine Swift 2.8 T1; SkyCheap 2.7 T1; Skyline Rescue 2.7 T1; Cityhopper 2.5 T1; Zoomjet 1.8 T1 |
| 27 | Puddle Jumper Airlines 53.4 T3; Harbor Heli 3.6 T1; Island Heli 3.5 T1; Medevac One 3.2 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Alpine Swift 2.5 T1; Zoomjet 2.3 T1 |
| 28 | Puddle Jumper Airlines 55 T3; Harbor Heli 3.5 T1; Island Heli 3.4 T1; Medevac One 3.1 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Zoomjet 2.7 T1; Alpine Swift 2.6 T1; Skyline Rescue 2.6 T1; Cityhopper 2.4 T1 |
| 29 | Puddle Jumper Airlines 52.8 T3; Harbor Heli 3.6 T1; Island Heli 3.4 T1; Medevac One 3.2 T1; Zoomjet 3.2 T1; Rotorlink 3 T1; Alpine Swift 2.8 T1; SkyCheap 2.8 T1; Skyline Rescue 2.7 T1; Cityhopper 2.5 T1 |
| 30 | Puddle Jumper Airlines 55.2 T3; Zoomjet 3.8 T1; Harbor Heli 3.7 T1; Island Heli 3.5 T1; Medevac One 3.3 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Alpine Swift 2.6 T1; Cityhopper 2.6 T1 |
| 31 | Puddle Jumper Airlines 57.5 T3; Zoomjet 4.4 T1; Harbor Heli 3.8 T1; Island Heli 3.6 T1; Medevac One 3.4 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.9 T1; Cityhopper 2.7 T1; Alpine Swift 2.4 T1 |
| 32 | Puddle Jumper Airlines 59.9 T3; Zoomjet 4.9 T1; Harbor Heli 3.8 T1; Island Heli 3.7 T1; Medevac One 3.4 T1; Rotorlink 3.2 T1; SkyCheap 3 T1; Skyline Rescue 3 T1; Cityhopper 2.8 T1; Alpine Swift 2.3 T1 |
| 33 | Puddle Jumper Airlines 62.1 T3; Zoomjet 5.3 T1; Harbor Heli 3.7 T1; Island Heli 3.6 T1; Medevac One 3.3 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Alpine Swift 2.1 T1 |
| 34 | Puddle Jumper Airlines 63 T3; Zoomjet 5.8 T1; Harbor Heli 3.8 T1; Island Heli 3.6 T1; Medevac One 3.4 T1; Rotorlink 3.2 T1; SkyCheap 3 T1; Skyline Rescue 2.9 T1; Cityhopper 2.7 T1; Alpine Swift 2.6 T1 |
| 35 | Puddle Jumper Airlines 64.8 T3; Zoomjet 6.4 T1; Harbor Heli 3.9 T1; Island Heli 3.7 T1; Medevac One 3.5 T1; Rotorlink 3.2 T1; Alpine Swift 3.1 T1; SkyCheap 3 T1; Skyline Rescue 3 T1; Cityhopper 2.8 T1 |
| 36 | Puddle Jumper Airlines 62.6 T3; Zoomjet 7 T1; Harbor Heli 4 T1; Island Heli 3.8 T1; Alpine Swift 3.6 T1; Medevac One 3.6 T1; Rotorlink 3.3 T1; SkyCheap 3.1 T1; Skyline Rescue 3.1 T1; Cityhopper 2.9 T1 |
| 37 | Puddle Jumper Airlines 64.4 T3; Zoomjet 7.5 T1; Alpine Swift 4.1 T1; Harbor Heli 4 T1; Island Heli 3.9 T1; Medevac One 3.6 T1; Rotorlink 3.4 T1; SkyCheap 3.2 T1; Skyline Rescue 3.2 T1; Cityhopper 3 T1 |
| 38 | Puddle Jumper Airlines 66.8 T3; Zoomjet 7.5 T1; Alpine Swift 4.6 T1; Harbor Heli 4.1 T1; Island Heli 4 T1; Medevac One 3.7 T1; Rotorlink 3.5 T1; SkyCheap 3.3 T1; Skyline Rescue 3.2 T1; Cityhopper 3 T1 |
| 39 | Puddle Jumper Airlines 69.1 T3; Zoomjet 7.5 T1; Alpine Swift 5.1 T1; Harbor Heli 4.2 T1; Island Heli 4 T1; Medevac One 3.8 T1; Rotorlink 3.6 T1; SkyCheap 3.4 T1; Skyline Rescue 3.3 T1; Cityhopper 3.1 T1 |
| 40 | Puddle Jumper Airlines 70.9 T4; Zoomjet 8.1 T1; Alpine Swift 5.6 T1; Harbor Heli 5.2 T1; Island Heli 4.1 T1; Medevac One 3.9 T1; Rotorlink 3.6 T1; SkyCheap 3.4 T1; Skyline Rescue 3.4 T1; Cityhopper 3.2 T1 |
| 41 | Puddle Jumper Airlines 73.3 T4; Zoomjet 8.7 T1; Harbor Heli 6.3 T1; Alpine Swift 6.1 T1; Island Heli 4.2 T1; Medevac One 4 T1; Rotorlink 3.7 T1; SkyCheap 3.5 T1; Skyline Rescue 3.5 T1; Cityhopper 3.3 T1 |
| 42 | Puddle Jumper Airlines 75.6 T4; Zoomjet 9.2 T1; Harbor Heli 7.5 T1; Alpine Swift 6.6 T1; Island Heli 5.2 T1; Medevac One 4 T1; Rotorlink 3.8 T1; SkyCheap 3.6 T1; Skyline Rescue 3.6 T1; Cityhopper 3.4 T1 |
| 43 | Puddle Jumper Airlines 78 T4; Zoomjet 9.8 T1; Harbor Heli 7.8 T1; Island Heli 7.3 T1; Alpine Swift 7.1 T1; Medevac One 4.1 T1; Rotorlink 3.9 T1; SkyCheap 3.7 T1; Skyline Rescue 3.6 T1; Cityhopper 3.4 T1 |
| 44 | Puddle Jumper Airlines 79.5 T4; Zoomjet 10.3 T1; Harbor Heli 8 T1; Alpine Swift 7.6 T1; Island Heli 7.6 T1; Medevac One 5.2 T1; Rotorlink 4 T1; SkyCheap 3.8 T1; Skyline Rescue 3.7 T1; Cityhopper 3.5 T1 |
| 45 | Puddle Jumper Airlines 81.8 T4; Zoomjet 10.9 T1; Harbor Heli 8.3 T1; Alpine Swift 8.1 T1; Island Heli 7.8 T1; Medevac One 6.3 T1; Rotorlink 4 T1; SkyCheap 3.8 T1; Skyline Rescue 3.8 T1; Cityhopper 3.6 T1 |

Research at day 30: 28 of 62 nodes (45%), earned 1130.5 RP, room rate sampled with the end-of-run pools. Lab 1 desk / 1 board / 1 bench, researchers 0. Fuel at that sample: tank 80,000 L, logistics not bound, loads 4, grounded 0.

Day-boundary curb pressure first crossed 1 on day 24 (1.1, stalls 3, bays 0, ranks 0, curb lanes 0, carriers 10, flights 80).
Intra-day curb pressure first crossed 1 on day 22 (peak 1.1).

## Greedy expander (60 days)

First landing PDJ101 at 43.8s. Stands 6, runway strips 1, signed air_regional_1, zoomjet, alpine_swift, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue, air_lowcost_1, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, borneo_wings, dune_jet, air_fullservice_1, brisa, zephyr_go. Taxi-out watchdog recoveries: 2.

| Day | Cash | Rating | Guests | Happy | Taxi-out | Tank L | Loads | Grounded | Curb | Stalls | Lanes | Bays | Ranks | Curb lanes | Check-in peak | Security peak | Carriers | Flights | RP earned | Nodes | Penalty total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | $73,000 | 65 | 0 | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 2 | 0 | 0 | 0 | 0 | $0 |
| 1 | $45,048 | 78 | 3 | 41.3 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 2 | 1 | 1 | 12.7 | 2 | -$1,120 |
| 2 | $32,331 | 80 | 11 | 71.9 | 0 | 80,000 | 4 | 0 | 0.3 | 3 | 1 | 0 | 0 | 0 | 2 | 1 | 2 | 3 | 32.2 | 2 | -$3,000 |
| 3 | $13,715 | 84 | 14 | 70 | 0 | 60,000 | 3 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 4 | 3 | 4 | 29.2 | 3 | -$3,800 |
| 4 | $15,141 | 87 | 15 | 70 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 1 | 0 | 3 | 7 | 37.2 | 6 | -$4,200 |
| 5 | $13,125 | 87 | 1 | 62 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 4 | 10 | 35.2 | 6 | -$5,800 |
| 6 | $7,289 | 86 | 18 | 68 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 5 | 4 | 4 | 15 | 43.2 | 7 | -$6,600 |
| 7 | $11,469 | 88 | 2 | 69.5 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 5 | 9 | 5 | 18 | 37.2 | 8 | -$6,600 |
| 8 | $13,986 | 86 | 18 | 65.4 | 1 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 5 | 3 | 5 | 21 | 37.2 | 9 | -$7,400 |
| 9 | $20,165 | 88 | 5 | 70 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 5 | 25 | 43.2 | 12 | -$7,800 |
| 10 | $18,498 | 87 | 18 | 67.7 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 3 | 2 | 6 | 29 | 40.2 | 12 | -$8,600 |
| 11 | $20,356 | 88 | 4 | 65.8 | 0 | 80,000 | 4 | 0 | 0.2 | 3 | 1 | 0 | 0 | 0 | 4 | 10 | 6 | 33 | 40.2 | 13 | -$9,000 |
| 12 | $23,479 | 87 | 18 | 62.6 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 7 | 4 | 6 | 35 | 35.2 | 14 | -$10,200 |
| 13 | $24,932 | 87 | 4 | 64.8 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 7 | 40 | 44.2 | 15 | -$10,600 |
| 14 | $23,851 | 86 | 18 | 67.6 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 4 | 7 | 43 | 38.2 | 15 | -$11,400 |
| 15 | $27,263 | 86 | 1 | 63 | 0 | 80,000 | 4 | 0 | 0.2 | 3 | 1 | 0 | 0 | 0 | 6 | 8 | 7 | 47 | 40.2 | 16 | -$11,800 |
| 16 | $3,820 | 83 | 13 | 74.5 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 2 | 8 | 50 | 41.2 | 18 | -$12,600 |
| 17 | $8,537 | 84 | 12 | 70 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 2 | 1 | 8 | 54 | 38.2 | 19 | -$13,000 |
| 18 | $12,480 | 84 | 12 | 70 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 2 | 9 | 57 | 35.2 | 19 | -$13,400 |
| 19 | $14,979 | 83 | 12 | 74 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 4 | 9 | 61 | 39.2 | 20 | -$14,200 |
| 20 | $14,059 | 84 | 4 | 55.9 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 6 | 9 | 65 | 38.2 | 21 | -$14,600 |
| 21 | $19,766 | 84 | 13 | 67.6 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 4 | 0 | 10 | 69 | 38.2 | 22 | -$15,400 |
| 22 | $2,721 | 81 | 5 | 70 | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 2 | 2 | 10 | 72 | 35.2 | 22 | -$15,800 |
| 23 | $7,443 | 77 | 6 | 72.5 | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 2 | 0 | 10 | 76 | 37.2 | 23 | -$16,600 |
| 24 | $10,521 | 80 | 3 | 73 | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 5 | 8 | 11 | 80 | 37.2 | 24 | -$17,000 |
| 25 | $331,715 | 81 | 18 | 72.3 | 0 | 80,000 | 4 | 0 | 0.9 | 3 | 1 | 0 | 0 | 0 | 4 | 4 | 11 | 84 | 37.2 | 24 | -$17,400 |
| 26 | $34,364 | 80 | 2 | 62.5 | 0 | 80,000 | 4 | 0 | 0.9 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 12 | 88 | 45.2 | 25 | -$18,200 |
| 27 | $35,393 | 81 | 13 | 65 | 0 | 80,000 | 4 | 0 | 1.2 | 3 | 1 | 0 | 0 | 0 | 2 | 0 | 12 | 91 | 37.2 | 26 | -$18,600 |
| 28 | $50,167 | 80 | 3 | 67 | 0 | 80,000 | 4 | 0 | 1.2 | 3 | 1 | 0 | 0 | 0 | 7 | 6 | 12 | 94 | 35.2 | 27 | -$19,400 |
| 29 | $1,243 | 79 | 33 | 69.1 | 0 | 60,000 | 3 | 0 | 1.6 | 3 | 1 | 0 | 0 | 0 | 6 | 0 | 13 | 97 | 35.2 | 27 | -$20,898 |
| 30 | $3,348 | 77 | 10 | 60.3 | 0 | 80,000 | 4 | 0 | 1.3 | 3 | 1 | 0 | 0 | 0 | 4 | 4 | 13 | 103 | 46.2 | 28 | -$21,298 |
| 31 | $7,774 | 76 | 15 | 61.7 | 0 | 80,000 | 4 | 0 | 1.5 | 3 | 1 | 0 | 0 | 0 | 3 | 0 | 13 | 107 | 39.2 | 29 | -$22,498 |
| 32 | $7,679 | 76 | 2 | 69 | 0 | 80,000 | 4 | 0 | 1.5 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 14 | 111 | 38.2 | 29 | -$22,898 |
| 33 | $7,622 | 74 | 18 | 71 | 0 | 80,000 | 4 | 0 | 1.6 | 3 | 1 | 0 | 0 | 0 | 3 | 2 | 14 | 115 | 38.2 | 30 | -$23,698 |
| 34 | $7,928 | 76 | 5 | 63.4 | 0 | 80,000 | 4 | 0 | 1.7 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 14 | 119 | 40.2 | 31 | -$24,098 |
| 35 | $7,886 | 76 | 13 | 73.8 | 0 | 80,000 | 4 | 0 | 1.9 | 3 | 1 | 0 | 0 | 0 | 2 | 0 | 15 | 122 | 37.2 | 31 | -$24,498 |
| 36 | $7,700 | 75 | 4 | 63 | 0 | 80,000 | 4 | 0 | 1.8 | 3 | 1 | 0 | 0 | 0 | 4 | 7 | 15 | 126 | 38.2 | 32 | -$25,698 |
| 37 | $9,865 | 74 | 40 | 65.5 | 0 | 80,000 | 4 | 0 | 2 | 3 | 1 | 0 | 0 | 0 | 3 | 2 | 16 | 130 | 38.2 | 33 | -$27,244 |
| 38 | $15,304 | 72 | 2 | 32 | 0 | 80,000 | 4 | 0 | 1.9 | 3 | 1 | 0 | 0 | 0 | 2 | 2 | 16 | 134 | 44.2 | 34 | -$28,844 |
| 39 | $14,326 | 70 | 6 | 81.8 | 0 | 80,000 | 4 | 0 | 2.2 | 3 | 1 | 0 | 0 | 0 | 2 | 0 | 16 | 138 | 37.2 | 34 | -$30,044 |
| 40 | $11,349 | 69 | 0 | — | 0 | 80,000 | 4 | 0 | 2.1 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 17 | 142 | 37.2 | 35 | -$31,244 |
| 41 | $10,838 | 66 | 0 | — | 0 | 80,000 | 4 | 0 | 2.4 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 17 | 146 | 37.2 | 36 | -$31,644 |
| 42 | $7,220 | 63 | 0 | — | 0 | 80,000 | 4 | 0 | 2.4 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 17 | 150 | 37.2 | 36 | -$32,044 |
| 43 | $7,244 | 59 | 0 | — | 1 | 80,000 | 4 | 0 | 2.4 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 18 | 155 | 40.2 | 37 | -$32,444 |
| 44 | $7,220 | 54 | 0 | — | 0 | 80,000 | 4 | 0 | 2.4 | 3 | 1 | 0 | 0 | 0 | 3 | 3 | 18 | 160 | 40.2 | 37 | -$33,644 |
| 45 | $7,649 | 52 | 10 | 70 | 0 | 80,000 | 4 | 0 | 2.9 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 162 | 31.2 | 38 | -$34,444 |
| 46 | $7,887 | 49 | 0 | — | 0 | 80,000 | 4 | 0 | 2.7 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 168 | 44.2 | 39 | -$34,844 |
| 47 | $7,742 | 45 | 0 | — | 0 | 80,000 | 4 | 0 | 2.8 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 172 | 37.2 | 39 | -$35,244 |
| 48 | $6,843 | 38 | 0 | — | 0 | 80,000 | 4 | 0 | 2.9 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 175 | 34.2 | 40 | -$36,444 |
| 49 | $6,659 | 34 | 0 | — | 0 | 80,000 | 4 | 0 | 2.9 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 180 | 40.2 | 40 | -$38,044 |
| 50 | $6,550 | 34 | 0 | — | 0 | 80,000 | 4 | 0 | 3.1 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 184 | 37.2 | 41 | -$38,044 |
| 51 | $6,544 | 34 | 0 | — | 0 | 80,000 | 4 | 0 | 3.2 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 188 | 37.2 | 42 | -$38,844 |
| 52 | $6,526 | 34 | 0 | — | 0 | 60,000 | 3 | 0 | 3.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 19 | 191 | 34.2 | 42 | -$39,644 |
| 53 | $3,564 | 34 | 18 | 66.8 | 0 | 80,000 | 4 | 0 | 3.3 | 3 | 1 | 0 | 0 | 0 | 4 | 1 | 19 | 195 | 37.2 | 43 | -$40,444 |
| 54 | $7,105 | 34 | 0 | — | 0 | 80,000 | 4 | 0 | 3.4 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 19 | 199 | 40.2 | 43 | -$41,244 |
| 55 | $9,491 | 34 | 18 | 62.9 | 0 | 80,000 | 4 | 0 | 3.8 | 3 | 1 | 0 | 0 | 0 | 3 | 6 | 19 | 202 | 37.2 | 44 | -$42,044 |
| 56 | $10,758 | 35 | 13 | 70 | 0 | 80,000 | 4 | 0 | 3.8 | 3 | 1 | 0 | 0 | 0 | 4 | 7 | 19 | 206 | 40.2 | 44 | -$42,844 |
| 57 | $7,199 | 33 | 15 | 69.7 | 0 | 80,000 | 4 | 0 | 3.7 | 3 | 1 | 0 | 0 | 0 | 2 | 1 | 19 | 210 | 38.2 | 45 | -$43,644 |
| 58 | $7,288 | 33 | 5 | 68.2 | 0 | 80,000 | 4 | 0 | 3.8 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 19 | 214 | 38.2 | 45 | -$44,444 |
| 59 | $7,283 | 31 | 18 | 67.9 | 0 | 80,000 | 4 | 0 | 4.1 | 3 | 1 | 0 | 0 | 0 | 4 | 3 | 19 | 216 | 32.2 | 46 | -$46,044 |
| 60 | $17,213 | 33 | 8 | 55.9 | 0 | 80,000 | 4 | 0 | 4.1 | 3 | 1 | 0 | 0 | 0 | 1 | 1 | 19 | 221 | 49.2 | 46 | -$46,444 |

Penalty totals are cumulative. Category split at each day:

| Day | Penalties |
| --- | --- |
| 0 | $0 |
| 1 | penalties -$720, emergency_refuse -$400 |
| 2 | penalties -$1,800, emergency_refuse -$1,200 |
| 3 | penalties -$1,800, emergency_refuse -$2,000 |
| 4 | penalties -$1,800, emergency_refuse -$2,400 |
| 5 | penalties -$1,800, security_shock -$800, emergency_refuse -$3,200 |
| 6 | penalties -$1,800, security_shock -$800, emergency_refuse -$4,000 |
| 7 | penalties -$1,800, security_shock -$800, emergency_refuse -$4,000 |
| 8 | penalties -$1,800, security_shock -$800, emergency_refuse -$4,800 |
| 9 | penalties -$1,800, security_shock -$800, emergency_refuse -$5,200 |
| 10 | penalties -$1,800, security_shock -$800, emergency_refuse -$6,000 |
| 11 | penalties -$1,800, security_shock -$800, emergency_refuse -$6,400 |
| 12 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$6,800 |
| 13 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$7,200 |
| 14 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$8,000 |
| 15 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$8,400 |
| 16 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$8,400 |
| 17 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$8,800 |
| 18 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$9,200 |
| 19 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$10,000 |
| 20 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$10,400 |
| 21 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$11,200 |
| 22 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$11,600 |
| 23 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$12,400 |
| 24 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$12,800 |
| 25 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$13,200 |
| 26 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$14,000 |
| 27 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$14,400 |
| 28 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$15,200 |
| 29 | penalties -$2,498, security_shock -$3,200, emergency_refuse -$15,200 |
| 30 | penalties -$2,498, security_shock -$3,200, emergency_refuse -$15,600 |
| 31 | penalties -$2,498, security_shock -$4,000, emergency_refuse -$16,000 |
| 32 | penalties -$2,498, security_shock -$4,000, emergency_refuse -$16,400 |
| 33 | penalties -$2,498, security_shock -$4,000, emergency_refuse -$17,200 |
| 34 | penalties -$2,498, security_shock -$4,000, emergency_refuse -$17,600 |
| 35 | penalties -$2,498, security_shock -$4,000, emergency_refuse -$18,000 |
| 36 | penalties -$2,498, security_shock -$4,800, emergency_refuse -$18,400 |
| 37 | penalties -$2,844, security_shock -$5,600, emergency_refuse -$18,800 |
| 38 | penalties -$2,844, security_shock -$6,400, emergency_refuse -$19,600 |
| 39 | penalties -$2,844, security_shock -$7,200, emergency_refuse -$20,000 |
| 40 | penalties -$2,844, security_shock -$8,000, emergency_refuse -$20,400 |
| 41 | penalties -$2,844, security_shock -$8,000, emergency_refuse -$20,800 |
| 42 | penalties -$2,844, security_shock -$8,000, emergency_refuse -$21,200 |
| 43 | penalties -$2,844, security_shock -$8,000, emergency_refuse -$21,600 |
| 44 | penalties -$2,844, security_shock -$8,800, emergency_refuse -$22,000 |
| 45 | penalties -$2,844, security_shock -$8,800, emergency_refuse -$22,800 |
| 46 | penalties -$2,844, security_shock -$8,800, emergency_refuse -$23,200 |
| 47 | penalties -$2,844, security_shock -$8,800, emergency_refuse -$23,600 |
| 48 | penalties -$2,844, security_shock -$9,600, emergency_refuse -$24,000 |
| 49 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$24,800 |
| 50 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$24,800 |
| 51 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$25,600 |
| 52 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$26,400 |
| 53 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$27,200 |
| 54 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$28,000 |
| 55 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$28,800 |
| 56 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$29,600 |
| 57 | penalties -$2,844, security_shock -$10,400, emergency_refuse -$30,400 |
| 58 | penalties -$2,844, security_shock -$11,200, emergency_refuse -$30,400 |
| 59 | penalties -$2,844, security_shock -$12,000, emergency_refuse -$31,200 |
| 60 | penalties -$2,844, security_shock -$12,000, emergency_refuse -$31,600 |

Ledger by category is cumulative. Change since the previous sampled day:

| Day | Ledger change |
| --- | --- |
| 0 | construction -$95,000 |
| 1 | construction -$75,900; staff_hiring -$10,400; payroll -$10,280; loan_repayment -$1,182; fuel_purchase -$800; penalties -$720; building_upkeep -$438; emergency_refuse -$400; loan_interest -$300; land_holding -$256; catering_fees $161; parking_fees $279; baggage_fees $366; passenger_fees $709; retail_sales $1,426; task_rewards $3,600; fuel_sales $4,294; contract_fees $6,044; landing_fees $10,845; loan_proceeds $45,000 |
| 2 | construction -$20,600; payroll -$6,199; loan_repayment -$2,364; penalties -$1,080; building_upkeep -$886; emergency_refuse -$800; loan_interest -$600; fuel_purchase -$400; land_holding -$257; retail_cogs -$174; catering_fees $161; parking_fees $279; baggage_fees $366; passenger_fees $709; retail_sales $2,018; fuel_sales $2,147; landing_fees $2,208; task_rewards $4,800; contract_fees $7,955 |
| 3 | construction -$27,800; payroll -$11,930; staff_hiring -$4,500; building_upkeep -$2,790; loan_repayment -$1,773; emergency_refuse -$800; fuel_purchase -$800; land_holding -$750; loan_interest -$450; retail_cogs -$317; catering_fees $293; parking_fees $558; baggage_fees $649; passenger_fees $1,164; retail_sales $1,908; task_rewards $6,000; fuel_sales $6,054; landing_fees $7,678; contract_fees $8,990 |
| 4 | construction -$11,800; payroll -$7,769; building_upkeep -$3,210; loan_repayment -$1,773; land_holding -$992; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$152; catering_fees $132; parking_fees $279; baggage_fees $305; passenger_fees $612; retail_sales $1,247; landside_fees $2,400; level_reward $2,500; fuel_sales $3,520; task_rewards $5,000; landing_fees $5,050; contract_fees $7,727 |
| 5 | construction -$13,800; payroll -$9,022; building_upkeep -$3,210; loan_repayment -$1,773; land_holding -$1,003; emergency_refuse -$800; fuel_purchase -$800; security_shock -$800; loan_interest -$450; retail_sales $451; fuel_sales $1,760; landing_fees $3,200; landside_fees $4,800; contract_fees $6,931; task_rewards $12,500 |
| 6 | construction -$20,800; building_upkeep -$4,890; loan_repayment -$2,364; payroll -$1,560; land_holding -$1,032; emergency_refuse -$800; loan_interest -$600; fuel_purchase -$400; retail_cogs -$301; catering_fees $123; baggage_fees $154; parking_fees $261; landing_fees $609; passenger_fees $1,202; fuel_sales $1,646; retail_sales $3,137; landside_fees $4,800; task_rewards $7,000; contract_fees $7,979 |
| 7 | payroll -$6,827; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,033; fuel_purchase -$800; loan_interest -$450; retail_cogs -$148; catering_fees $123; baggage_fees $156; parking_fees $261; retail_sales $1,118; passenger_fees $1,231; fuel_sales $3,406; landing_fees $3,827; landside_fees $4,800; contract_fees $7,979 |
| 8 | payroll -$6,827; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,033; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; retail_cogs -$144; catering_fees $123; baggage_fees $152; parking_fees $261; passenger_fees $1,180; landside_fees $2,400; retail_sales $2,731; fuel_sales $3,406; landing_fees $3,802; contract_fees $7,979 |
| 9 | payroll -$8,015; building_upkeep -$4,890; construction -$2,800; loan_repayment -$2,364; land_holding -$1,313; fuel_purchase -$800; loan_interest -$600; emergency_refuse -$400; retail_cogs -$312; catering_fees $123; baggage_fees $165; parking_fees $261; passenger_fees $1,381; retail_sales $1,718; fuel_sales $3,406; landing_fees $3,850; level_reward $4,000; landside_fees $4,800; contract_fees $7,969 |
| 10 | payroll -$8,392; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,314; emergency_refuse -$800; loan_interest -$450; fuel_purchase -$400; retail_cogs -$288; catering_fees $123; baggage_fees $151; parking_fees $261; landing_fees $610; passenger_fees $1,152; fuel_sales $1,646; retail_sales $2,632; landside_fees $4,800; contract_fees $8,065 |
| 11 | payroll -$8,468; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,314; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; catering_fees $123; baggage_fees $155; parking_fees $261; retail_sales $893; passenger_fees $1,223; fuel_sales $3,406; landing_fees $3,827; landside_fees $4,800; contract_fees $8,065 |
| 12 | payroll -$8,507; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,318; fuel_purchase -$800; security_shock -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$291; catering_fees $123; baggage_fees $168; parking_fees $261; passenger_fees $1,445; retail_sales $3,029; fuel_sales $3,406; landing_fees $3,855; landside_fees $4,800; contract_fees $8,065 |
| 13 | payroll -$8,903; building_upkeep -$4,890; construction -$2,800; loan_repayment -$2,364; land_holding -$1,318; fuel_purchase -$800; loan_interest -$600; emergency_refuse -$400; catering_fees $123; baggage_fees $169; parking_fees $261; passenger_fees $1,474; retail_sales $1,479; fuel_sales $3,406; landing_fees $3,855; landside_fees $4,800; contract_fees $7,961 |
| 14 | payroll -$8,960; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,319; emergency_refuse -$800; loan_interest -$450; retail_cogs -$440; fuel_purchase -$400; catering_fees $123; baggage_fees $171; parking_fees $261; landing_fees $643; passenger_fees $1,495; fuel_sales $1,646; retail_sales $3,651; landside_fees $4,800; contract_fees $7,961 |
| 15 | payroll -$9,012; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,319; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$153; catering_fees $123; baggage_fees $151; parking_fees $261; passenger_fees $1,152; retail_sales $1,838; landside_fees $2,400; fuel_sales $3,406; landing_fees $7,717; contract_fees $7,961 |
| 16 | construction -$44,800; building_upkeep -$6,690; land_holding -$2,523; loan_repayment -$1,773; fuel_purchase -$800; security_shock -$800; loan_interest -$450; retail_cogs -$435; catering_fees $123; baggage_fees $155; parking_fees $261; passenger_fees $1,231; retail_sales $3,153; fuel_sales $3,406; landside_fees $4,800; level_reward $6,000; landing_fees $7,738; contract_fees $7,961 |
| 17 | payroll -$9,093; building_upkeep -$6,690; construction -$2,800; land_holding -$2,524; loan_repayment -$2,364; fuel_purchase -$800; loan_interest -$600; emergency_refuse -$400; catering_fees $264; parking_fees $558; baggage_fees $584; passenger_fees $1,056; retail_sales $1,608; fuel_sales $3,520; landside_fees $4,800; landing_fees $8,356; contract_fees $9,242 |
| 18 | payroll -$8,454; building_upkeep -$6,690; construction -$2,800; land_holding -$2,524; loan_repayment -$1,773; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$292; catering_fees $132; parking_fees $279; baggage_fees $288; passenger_fees $497; retail_sales $1,514; fuel_sales $3,520; landside_fees $4,800; contract_fees $8,308; landing_fees $8,788 |
| 19 | payroll -$8,454; building_upkeep -$6,690; construction -$2,800; land_holding -$2,524; loan_repayment -$1,773; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; catering_fees $132; parking_fees $279; baggage_fees $298; passenger_fees $566; retail_sales $1,192; landside_fees $2,400; fuel_sales $3,520; contract_fees $8,308; landing_fees $10,094 |
| 20 | payroll -$8,454; building_upkeep -$6,690; construction -$2,800; land_holding -$2,525; loan_repayment -$2,364; loan_interest -$600; emergency_refuse -$400; fuel_purchase -$400; retail_cogs -$144; catering_fees $132; parking_fees $279; baggage_fees $298; passenger_fees $566; retail_sales $1,673; fuel_sales $1,760; landside_fees $4,800; landing_fees $5,642; contract_fees $8,308 |
| 21 | payroll -$9,432; building_upkeep -$6,690; construction -$2,800; land_holding -$2,525; loan_repayment -$1,773; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; retail_cogs -$288; catering_fees $132; parking_fees $279; baggage_fees $298; passenger_fees $566; retail_sales $1,882; fuel_sales $3,520; landside_fees $7,200; contract_fees $8,566; landing_fees $8,822 |
| 22 | construction -$30,800; building_upkeep -$7,590; land_holding -$2,526; loan_repayment -$1,773; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; parking_fees $522; passenger_fees $686; baggage_fees $860; retail_sales $1,064; catering_fees $1,154; landside_fees $2,400; fuel_sales $3,293; landing_fees $7,850; contract_fees $9,465 |
| 23 | building_upkeep -$7,590; payroll -$5,501; construction -$2,800; land_holding -$2,526; loan_repayment -$1,773; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; retail_cogs -$148; retail_sales $582; fuel_sales $3,520; landside_fees $4,800; contract_fees $7,395; landing_fees $10,812 |
| 24 | payroll -$8,476; building_upkeep -$7,590; construction -$2,800; land_holding -$2,526; loan_repayment -$2,364; fuel_purchase -$800; loan_interest -$600; emergency_refuse -$400; passenger_fees $107; parking_fees $243; retail_sales $256; baggage_fees $568; catering_fees $1,022; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,430; landing_fees $9,916 |
| 25 | building_upkeep -$7,590; payroll -$7,337; construction -$2,800; land_holding -$2,527; loan_repayment -$1,702; city_levy -$925; loan_interest -$450; emergency_refuse -$400; fuel_purchase -$400; passenger_fees $127; parking_fees $243; baggage_fees $562; catering_fees $1,022; fuel_sales $1,533; retail_sales $1,770; landside_fees $4,800; landing_fees $6,567; contract_fees $8,701; loan_proceeds $320,000 |
| 26 | construction -$308,614; payroll -$7,958; building_upkeep -$7,590; land_holding -$4,530; loan_repayment -$2,235; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$550; retail_cogs -$303; catering_fees $123; baggage_fees $152; parking_fees $261; passenger_fees $1,180; retail_sales $1,593; fuel_sales $3,406; landside_fees $4,800; landing_fees $7,714; level_reward $8,000; contract_fees $8,800 |
| 27 | payroll -$8,379; building_upkeep -$7,590; land_holding -$4,530; loan_repayment -$4,470; loan_interest -$1,100; fuel_purchase -$800; construction -$700; emergency_refuse -$400; catering_fees $123; baggage_fees $156; parking_fees $261; passenger_fees $1,245; retail_sales $2,486; fuel_sales $3,406; landside_fees $4,800; landing_fees $7,721; contract_fees $8,800 |
| 28 | payroll -$9,124; building_upkeep -$7,590; land_holding -$4,530; loan_repayment -$4,470; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$800; construction -$700; retail_cogs -$296; parking_fees $243; passenger_fees $493; baggage_fees $714; retail_sales $972; catering_fees $1,022; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,800; landing_fees $23,847 |
| 29 | construction -$70,252; building_upkeep -$7,590; land_holding -$4,742; loan_repayment -$4,470; fuel_purchase -$1,200; loan_interest -$1,100; security_shock -$800; penalties -$698; retail_cogs -$144; parking_fees $1,080; catering_fees $1,418; baggage_fees $1,610; passenger_fees $2,199; landside_fees $2,400; retail_sales $2,903; fuel_sales $6,813; landing_fees $11,804; contract_fees $11,845 |
| 30 | building_upkeep -$7,590; land_holding -$4,743; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; catering_fees $132; parking_fees $279; baggage_fees $298; passenger_fees $566; fuel_sales $1,760; retail_sales $2,107; landside_fees $4,800; landing_fees $5,679; contract_fees $8,531 |
| 31 | building_upkeep -$7,590; land_holding -$4,747; payroll -$4,552; construction -$2,800; loan_repayment -$2,235; fuel_purchase -$800; security_shock -$800; loan_interest -$550; emergency_refuse -$400; retail_cogs -$288; catering_fees $132; parking_fees $279; baggage_fees $298; passenger_fees $566; retail_sales $2,192; fuel_sales $3,520; landside_fees $4,800; contract_fees $8,531; landing_fees $8,871 |
| 32 | building_upkeep -$7,590; payroll -$6,494; land_holding -$4,748; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; catering_fees $132; parking_fees $279; baggage_fees $308; passenger_fees $635; retail_sales $1,090; fuel_sales $3,520; landside_fees $4,800; contract_fees $8,531; landing_fees $9,011 |
| 33 | building_upkeep -$7,590; land_holding -$4,748; loan_repayment -$4,470; construction -$2,800; payroll -$2,791; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$400; retail_cogs -$288; catering_fees $132; parking_fees $279; baggage_fees $307; passenger_fees $635; fuel_sales $1,760; retail_sales $2,699; landside_fees $4,800; landing_fees $5,838; contract_fees $8,480 |
| 34 | building_upkeep -$7,590; payroll -$6,268; land_holding -$4,749; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$288; catering_fees $123; baggage_fees $166; parking_fees $261; passenger_fees $1,409; retail_sales $2,272; fuel_sales $3,406; landside_fees $4,800; landing_fees $7,761; contract_fees $8,574 |
| 35 | building_upkeep -$7,590; payroll -$7,456; land_holding -$4,749; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; catering_fees $123; baggage_fees $156; parking_fees $261; passenger_fees $1,231; retail_sales $3,200; fuel_sales $3,406; landside_fees $4,800; landing_fees $7,715; contract_fees $8,574 |
| 36 | payroll -$8,078; building_upkeep -$7,590; land_holding -$4,754; construction -$2,800; loan_repayment -$2,235; fuel_purchase -$800; security_shock -$800; loan_interest -$550; emergency_refuse -$400; retail_cogs -$147; catering_fees $132; parking_fees $279; baggage_fees $298; passenger_fees $543; retail_sales $912; fuel_sales $3,520; landside_fees $4,800; contract_fees $8,574; landing_fees $8,910 |
| 37 | payroll -$7,874; building_upkeep -$7,590; land_holding -$4,754; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; security_shock -$800; emergency_refuse -$400; penalties -$346; retail_cogs -$310; catering_fees $264; baggage_fees $598; parking_fees $801; passenger_fees $1,176; retail_sales $3,387; fuel_sales $3,520; landside_fees $4,800; landing_fees $9,419; contract_fees $9,444 |
| 38 | payroll -$9,022; building_upkeep -$7,590; land_holding -$4,755; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$800; security_shock -$800; passenger_fees $100; parking_fees $243; baggage_fees $1,124; retail_sales $1,558; catering_fees $2,044; landside_fees $2,400; fuel_sales $3,066; landing_fees $7,820; contract_fees $9,221; level_reward $10,000 |
| 39 | payroll -$9,756; building_upkeep -$7,590; land_holding -$4,755; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; security_shock -$800; emergency_refuse -$400; retail_cogs -$144; passenger_fees $80; parking_fees $243; baggage_fees $562; catering_fees $1,022; retail_sales $1,512; fuel_sales $3,293; landside_fees $7,200; contract_fees $8,186; landing_fees $9,539 |
| 40 | payroll -$8,475; building_upkeep -$7,590; land_holding -$4,756; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; security_shock -$800; emergency_refuse -$400; retail_cogs -$144; passenger_fees $80; parking_fees $243; retail_sales $378; baggage_fees $562; catering_fees $1,022; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,186; landing_fees $9,794 |
| 41 | building_upkeep -$7,590; payroll -$7,387; land_holding -$4,756; construction -$2,800; loan_repayment -$2,235; loan_interest -$550; emergency_refuse -$400; fuel_purchase -$400; retail_sales $30; fuel_sales $1,760; landing_fees $7,108; contract_fees $7,109; landside_fees $9,600 |
| 42 | building_upkeep -$7,590; land_holding -$4,757; loan_repayment -$4,470; payroll -$2,990; construction -$2,800; loan_interest -$1,100; emergency_refuse -$400; fuel_purchase -$400; retail_sales $31; fuel_sales $1,760; landside_fees $4,800; landing_fees $7,109; contract_fees $7,189 |
| 43 | building_upkeep -$7,590; land_holding -$4,757; loan_repayment -$4,470; payroll -$4,171; construction -$2,800; loan_interest -$1,100; emergency_refuse -$400; fuel_purchase -$400; retail_sales $55; fuel_sales $1,760; landing_fees $7,108; contract_fees $7,189; landside_fees $9,600 |
| 44 | building_upkeep -$7,590; land_holding -$4,758; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; payroll -$994; security_shock -$800; emergency_refuse -$400; fuel_purchase -$400; retail_sales $31; fuel_sales $1,760; landing_fees $7,108; contract_fees $7,189; landside_fees $7,200 |
| 45 | building_upkeep -$7,590; payroll -$7,042; land_holding -$4,758; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$800; catering_fees $132; parking_fees $279; baggage_fees $287; retail_sales $750; fuel_sales $3,520; landside_fees $7,200; contract_fees $8,664; landing_fees $8,957 |
| 46 | building_upkeep -$7,590; land_holding -$4,759; construction -$2,800; payroll -$2,774; loan_repayment -$2,235; loan_interest -$550; emergency_refuse -$400; fuel_purchase -$400; retail_sales $358; fuel_sales $1,760; landside_fees $4,800; landing_fees $7,108; contract_fees $7,720 |
| 47 | building_upkeep -$7,590; payroll -$4,836; land_holding -$4,759; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$400; fuel_purchase -$400; retail_sales $22; fuel_sales $1,760; landing_fees $7,108; contract_fees $7,720; landside_fees $9,600 |
| 48 | building_upkeep -$7,590; land_holding -$4,760; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; security_shock -$800; emergency_refuse -$400; fuel_purchase -$400; retail_sales $33; fuel_sales $1,760; landside_fees $4,800; landing_fees $7,108; contract_fees $7,720 |
| 49 | building_upkeep -$7,590; land_holding -$4,760; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; security_shock -$800; fuel_purchase -$400; payroll -$192; retail_sales $28; fuel_sales $1,760; contract_fees $6,631; landing_fees $7,109; landside_fees $7,200 |
| 50 | building_upkeep -$7,590; land_holding -$4,761; loan_repayment -$4,470; construction -$2,800; payroll -$2,200; loan_interest -$1,100; fuel_purchase -$400; retail_sales $44; fuel_sales $1,760; contract_fees $6,506; landside_fees $7,200; landing_fees $7,702 |
| 51 | building_upkeep -$7,590; land_holding -$4,761; payroll -$3,482; construction -$2,800; loan_repayment -$2,235; emergency_refuse -$800; loan_interest -$550; fuel_purchase -$400; retail_sales $38; fuel_sales $1,760; contract_fees $6,506; landing_fees $7,108; landside_fees $7,200 |
| 52 | building_upkeep -$7,590; land_holding -$4,762; loan_repayment -$4,470; payroll -$3,250; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$400; retail_sales $20; fuel_sales $3,520; landside_fees $4,800; contract_fees $6,506; landing_fees $10,309 |
| 53 | building_upkeep -$7,590; land_holding -$4,762; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$400; retail_cogs -$144; retail_sales $1,304; landing_fees $3,908; contract_fees $6,692; landside_fees $7,200 |
| 54 | building_upkeep -$7,590; land_holding -$4,763; loan_repayment -$4,470; payroll -$3,729; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$800; retail_cogs -$156; parking_fees $243; baggage_fees $921; catering_fees $1,022; retail_sales $1,282; fuel_sales $3,293; landside_fees $4,800; contract_fees $7,817; landing_fees $10,370 |
| 55 | payroll -$8,934; building_upkeep -$7,590; land_holding -$4,763; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$800; retail_cogs -$292; passenger_fees $220; parking_fees $243; baggage_fees $921; catering_fees $1,022; retail_sales $2,885; fuel_sales $3,293; landside_fees $7,200; contract_fees $7,817; landing_fees $10,333 |
| 56 | payroll -$10,816; building_upkeep -$7,590; land_holding -$4,764; construction -$2,800; loan_repayment -$2,235; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$550; retail_cogs -$144; parking_fees $486; passenger_fees $1,246; baggage_fees $1,686; catering_fees $2,044; retail_sales $2,247; landside_fees $2,400; fuel_sales $3,066; contract_fees $8,852; landing_fees $9,740 |
| 57 | building_upkeep -$7,590; land_holding -$4,764; loan_repayment -$4,470; payroll -$3,833; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$400; retail_cogs -$159; retail_sales $1,441; fuel_sales $1,760; landside_fees $4,800; contract_fees $7,027; landing_fees $7,329 |
| 58 | building_upkeep -$7,590; payroll -$6,985; land_holding -$4,765; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; security_shock -$800; retail_cogs -$148; passenger_fees $207; parking_fees $243; baggage_fees $726; catering_fees $1,022; retail_sales $1,131; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,156; landing_fees $9,969 |
| 59 | building_upkeep -$7,590; payroll -$7,545; land_holding -$4,765; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$800; security_shock -$800; retail_cogs -$292; passenger_fees $200; parking_fees $243; baggage_fees $726; catering_fees $1,022; retail_sales $2,645; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,156; landing_fees $9,872 |
| 60 | payroll -$8,470; building_upkeep -$7,590; land_holding -$4,766; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; catering_fees $132; passenger_fees $245; parking_fees $279; baggage_fees $303; retail_sales $1,517; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,156; landing_fees $9,745; level_reward $12,000 |

Relations (signed carriers):

| Day | Tier and score |
| --- | --- |
| 0 | — |
| 1 | Puddle Jumper Airlines 1.6 T1 |
| 2 | Zoomjet 2.1 T1; Puddle Jumper Airlines 1.2 T1 |
| 3 | Zoomjet 2.2 T1; Alpine Swift 2.1 T1; Puddle Jumper Airlines 1 T1 |
| 4 | Alpine Swift 2.2 T1; Zoomjet 2.2 T1; Puddle Jumper Airlines 1.7 T1 |
| 5 | Puddle Jumper Airlines 2.3 T1; Harbor Heli 2.1 T1; Zoomjet 2.1 T1; Alpine Swift 2 T1 |
| 6 | Puddle Jumper Airlines 5.6 T1; Harbor Heli 2.2 T1; Alpine Swift 2.1 T1; Zoomjet 1.7 T1 |
| 7 | Puddle Jumper Airlines 7.1 T1; Alpine Swift 2.2 T1; Harbor Heli 2.2 T1; Island Heli 2.1 T1; Zoomjet 1.4 T1 |
| 8 | Puddle Jumper Airlines 9.4 T1; Alpine Swift 2.3 T1; Harbor Heli 2.3 T1; Island Heli 2.2 T1; Zoomjet 1.1 T1 |
| 9 | Puddle Jumper Airlines 11.8 T1; Alpine Swift 2.4 T1; Harbor Heli 2.4 T1; Island Heli 2.2 T1; Zoomjet 0.8 T1 |
| 10 | Puddle Jumper Airlines 14.1 T1; Harbor Heli 2.5 T1; Alpine Swift 2.4 T1; Island Heli 2.3 T1; Medevac One 2.1 T1; Zoomjet 0.7 T1 |
| 11 | Puddle Jumper Airlines 16.5 T1; Harbor Heli 2.6 T1; Alpine Swift 2.5 T1; Island Heli 2.4 T1; Medevac One 2.2 T1; Zoomjet 0.6 T1 |
| 12 | Puddle Jumper Airlines 17.8 T1; Alpine Swift 2.4 T1; Harbor Heli 2.4 T1; Island Heli 2.3 T1; Medevac One 2 T1; Zoomjet 0.3 T1 |
| 13 | Puddle Jumper Airlines 21 T2; Alpine Swift 2.5 T1; Harbor Heli 2.5 T1; Island Heli 2.4 T1; Medevac One 2.1 T1; Rotorlink 2.1 T1; Zoomjet 0.3 T1 |
| 14 | Puddle Jumper Airlines 22.5 T2; Alpine Swift 2.6 T1; Harbor Heli 2.6 T1; Island Heli 2.4 T1; Medevac One 2.2 T1; Rotorlink 2.2 T1; Zoomjet 0.3 T1 |
| 15 | Puddle Jumper Airlines 24.8 T2; Harbor Heli 2.7 T1; Alpine Swift 2.6 T1; Island Heli 2.5 T1; Medevac One 2.3 T1; Rotorlink 2.2 T1; Zoomjet 0.3 T1 |
| 16 | Puddle Jumper Airlines 27 T2; Harbor Heli 2.6 T1; Alpine Swift 2.5 T1; Island Heli 2.4 T1; Medevac One 2.2 T1; Rotorlink 2.1 T1; Skyline Rescue 1.9 T1; Zoomjet 0.2 T1 |
| 17 | Puddle Jumper Airlines 28.8 T2; Alpine Swift 2.6 T1; Harbor Heli 2.6 T1; Island Heli 2.5 T1; Medevac One 2.2 T1; Rotorlink 2.2 T1; Skyline Rescue 2 T1; Zoomjet 0.7 T1 |
| 18 | Puddle Jumper Airlines 29.7 T2; Alpine Swift 2.7 T1; Harbor Heli 2.7 T1; Island Heli 2.6 T1; Medevac One 2.3 T1; Rotorlink 2.3 T1; SkyCheap 2.1 T1; Skyline Rescue 2 T1; Zoomjet 1.3 T1 |
| 19 | Puddle Jumper Airlines 31 T2; Alpine Swift 2.8 T1; Harbor Heli 2.8 T1; Island Heli 2.6 T1; Medevac One 2.4 T1; Rotorlink 2.4 T1; SkyCheap 2.2 T1; Skyline Rescue 2.1 T1; Zoomjet 1.8 T1 |
| 20 | Puddle Jumper Airlines 32.8 T2; Harbor Heli 2.9 T1; Alpine Swift 2.8 T1; Island Heli 2.7 T1; Medevac One 2.5 T1; Rotorlink 2.4 T1; Zoomjet 2.4 T1; SkyCheap 2.2 T1; Skyline Rescue 2.2 T1 |
| 21 | Puddle Jumper Airlines 35.5 T2; Harbor Heli 3 T1; Zoomjet 3 T1; Alpine Swift 2.9 T1; Island Heli 2.8 T1; Medevac One 2.6 T1; Rotorlink 2.5 T1; SkyCheap 2.3 T1; Skyline Rescue 2.3 T1; Cityhopper 2.1 T1 |
| 22 | Puddle Jumper Airlines 36.4 T2; Zoomjet 3.5 T1; Alpine Swift 3 T1; Harbor Heli 3 T1; Island Heli 2.9 T1; Medevac One 2.6 T1; Rotorlink 2.6 T1; SkyCheap 2.4 T1; Skyline Rescue 2.4 T1; Cityhopper 2.2 T1 |
| 23 | Puddle Jumper Airlines 38.8 T2; Zoomjet 4.1 T1; Harbor Heli 3.1 T1; Island Heli 3 T1; Medevac One 2.7 T1; Rotorlink 2.7 T1; Alpine Swift 2.6 T1; SkyCheap 2.5 T1; Skyline Rescue 2.4 T1; Cityhopper 2.2 T1 |
| 24 | Puddle Jumper Airlines 41.1 T2; Zoomjet 4.6 T1; Harbor Heli 3.2 T1; Island Heli 3 T1; Medevac One 2.8 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.5 T1; Cityhopper 2.3 T1; Alpine Swift 2.2 T1; Maple Coastal 2.1 T1 |
| 25 | Puddle Jumper Airlines 43.5 T2; Zoomjet 5.2 T1; Harbor Heli 3.3 T1; Island Heli 3.1 T1; Medevac One 2.9 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.6 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Alpine Swift 2 T1 |
| 26 | Puddle Jumper Airlines 45.8 T3; Zoomjet 5.2 T1; Harbor Heli 3.4 T1; Island Heli 3.2 T1; Medevac One 3 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.7 T1; Cityhopper 2.5 T1; Alpine Swift 2.2 T1; Maple Coastal 2.2 T1; Outback Link 2.1 T1 |
| 27 | Puddle Jumper Airlines 48.2 T3; Zoomjet 5.2 T1; Harbor Heli 3.4 T1; Island Heli 3.3 T1; Medevac One 3 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Alpine Swift 2.5 T1; Maple Coastal 2.3 T1; Outback Link 2.2 T1 |
| 28 | Puddle Jumper Airlines 49.7 T3; Zoomjet 5.8 T1; Harbor Heli 3.5 T1; Island Heli 3.4 T1; Medevac One 3.1 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Maple Coastal 2.4 T1; Alpine Swift 2.2 T1; Outback Link 2.2 T1 |
| 29 | Puddle Jumper Airlines 52.7 T3; Zoomjet 6.1 T1; Harbor Heli 3.4 T1; Island Heli 3.2 T1; Medevac One 3 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.7 T1; Cityhopper 2.5 T1; Alpine Swift 2.4 T1; Maple Coastal 2.3 T1; Outback Link 2.1 T1; Savanna Air 2.1 T1 |
| 30 | Puddle Jumper Airlines 56.9 T3; Zoomjet 6.7 T1; Harbor Heli 3.5 T1; Island Heli 3.3 T1; Medevac One 3.1 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Maple Coastal 2.4 T1; Alpine Swift 2.2 T1; Outback Link 2.2 T1; Savanna Air 2.2 T1 |
| 31 | Puddle Jumper Airlines 57.9 T3; Zoomjet 7.1 T1; Harbor Heli 3.4 T1; Island Heli 3.2 T1; Medevac One 3 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.7 T1; Cityhopper 2.5 T1; Alpine Swift 2.4 T1; Maple Coastal 2.2 T1; Outback Link 2.1 T1; Savanna Air 2 T1 |
| 32 | Puddle Jumper Airlines 59.8 T3; Zoomjet 7.6 T1; Harbor Heli 3.4 T1; Island Heli 3.3 T1; Medevac One 3 T1; Rotorlink 3 T1; Alpine Swift 2.8 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Maple Coastal 2.3 T1; Outback Link 2.2 T1; Kauri Air 2.1 T1; Savanna Air 2.1 T1 |
| 33 | Puddle Jumper Airlines 61.6 T3; Zoomjet 8.2 T1; Harbor Heli 3.5 T1; Island Heli 3.4 T1; Alpine Swift 3.1 T1; Medevac One 3.1 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Maple Coastal 2.4 T1; Kauri Air 2.2 T1; Outback Link 2.2 T1; Savanna Air 2.2 T1 |
| 34 | Puddle Jumper Airlines 63.9 T3; Zoomjet 8.2 T1; Harbor Heli 3.6 T1; Alpine Swift 3.5 T1; Island Heli 3.4 T1; Medevac One 3.2 T1; Rotorlink 3.2 T1; SkyCheap 3 T1; Skyline Rescue 2.9 T1; Cityhopper 2.7 T1; Maple Coastal 2.5 T1; Outback Link 2.3 T1; Savanna Air 2.3 T1; Kauri Air 2.2 T1 |
| 35 | Puddle Jumper Airlines 66.3 T3; Zoomjet 8.2 T1; Alpine Swift 3.9 T1; Harbor Heli 3.7 T1; Island Heli 3.5 T1; Medevac One 3.3 T1; Rotorlink 3.2 T1; SkyCheap 3 T1; Skyline Rescue 3 T1; Cityhopper 2.8 T1; Maple Coastal 2.6 T1; Outback Link 2.4 T1; Savanna Air 2.4 T1; Kauri Air 2.3 T1; Borneo Wings 2.1 T1 |
| 36 | Puddle Jumper Airlines 67.9 T3; Zoomjet 8.6 T1; Alpine Swift 4.1 T1; Harbor Heli 3.6 T1; Island Heli 3.4 T1; Medevac One 3.2 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.9 T1; Cityhopper 2.7 T1; Maple Coastal 2.4 T1; Outback Link 2.3 T1; Kauri Air 2.2 T1; Savanna Air 2.2 T1; Borneo Wings 2 T1 |
| 37 | Puddle Jumper Airlines 69.5 T3; Zoomjet 8.9 T1; Alpine Swift 4.3 T1; Harbor Heli 3.4 T1; Island Heli 3.3 T1; Medevac One 3 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Maple Coastal 2.3 T1; Outback Link 2.2 T1; Kauri Air 2.1 T1; Savanna Air 2.1 T1; Dune Jet 1.9 T1; Borneo Wings 1.8 T1 |
| 38 | Puddle Jumper Airlines 70.2 T4; Zoomjet 9.3 T1; Alpine Swift 3.5 T1; Harbor Heli 3.3 T1; Island Heli 3.2 T1; Medevac One 2.9 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.6 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Kauri Air 2 T1; Outback Link 2 T1; Savanna Air 2 T1; Dune Jet 1.8 T1; Borneo Wings 1.7 T1 |
| 39 | Puddle Jumper Airlines 72.4 T4; Zoomjet 9.6 T1; Harbor Heli 4.2 T1; Alpine Swift 3.3 T1; Island Heli 3 T1; Medevac One 2.8 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.5 T1; Cityhopper 2.3 T1; Maple Coastal 2.1 T1; Outback Link 1.9 T1; Savanna Air 1.9 T1; Kauri Air 1.8 T1; Borneo Wings 1.6 T1; Dune Jet 1.6 T1 |
| 40 | Puddle Jumper Airlines 74.5 T4; Zoomjet 10 T1; Harbor Heli 4.1 T1; Alpine Swift 3.1 T1; Island Heli 2.9 T1; Medevac One 2.7 T1; Rotorlink 2.6 T1; SkyCheap 2.4 T1; Skyline Rescue 2.4 T1; Cityhopper 2.2 T1; Maple Coastal 2 T1; Prestige Air 1.9 T1; Outback Link 1.8 T1; Savanna Air 1.8 T1; Kauri Air 1.7 T1; Borneo Wings 1.5 T1; Dune Jet 1.5 T1 |
| 41 | Puddle Jumper Airlines 76 T4; Zoomjet 10.6 T1; Harbor Heli 6.2 T1; Alpine Swift 3.6 T1; Island Heli 3 T1; Medevac One 2.8 T1; Rotorlink 2.7 T1; SkyCheap 2.5 T1; Skyline Rescue 2.5 T1; Cityhopper 2.3 T1; Maple Coastal 2 T1; Prestige Air 2 T1; Outback Link 1.9 T1; Kauri Air 1.8 T1; Savanna Air 1.8 T1; Borneo Wings 1.6 T1; Dune Jet 1.6 T1 |
| 42 | Puddle Jumper Airlines 78.4 T4; Zoomjet 11.1 T1; Harbor Heli 6.4 T1; Alpine Swift 4.2 T1; Island Heli 4 T1; Medevac One 2.8 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.6 T1; Cityhopper 2.4 T1; Maple Coastal 2.1 T1; Outback Link 2 T1; Prestige Air 2 T1; Kauri Air 1.9 T1; Savanna Air 1.9 T1; Dune Jet 1.7 T1; Borneo Wings 1.6 T1 |
| 43 | Puddle Jumper Airlines 80.7 T4; Zoomjet 11.7 T1; Harbor Heli 6.7 T1; Island Heli 6.1 T1; Alpine Swift 4.8 T1; Medevac One 2.9 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.6 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Brisa 2.1 T1; Prestige Air 2.1 T1; Kauri Air 2 T1; Outback Link 2 T1; Savanna Air 2 T1; Dune Jet 1.8 T1; Borneo Wings 1.7 T1 |
| 44 | Puddle Jumper Airlines 82.9 T4; Zoomjet 12 T1; Harbor Heli 6.7 T1; Island Heli 6.2 T1; Alpine Swift 5.1 T1; Medevac One 3.8 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.5 T1; Cityhopper 2.3 T1; Maple Coastal 2.1 T1; Brisa 2 T1; Prestige Air 2 T1; Outback Link 1.9 T1; Savanna Air 1.9 T1; Kauri Air 1.8 T1; Borneo Wings 1.6 T1; Dune Jet 1.6 T1 |
| 45 | Puddle Jumper Airlines 85.2 T4; Zoomjet 12.6 T1; Harbor Heli 7 T1; Island Heli 6.4 T1; Alpine Swift 5.7 T1; Medevac One 3.9 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.6 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Prestige Air 2.1 T1; Zephyr Go 2.1 T1; Brisa 2 T1; Outback Link 2 T1; Savanna Air 2 T1; Kauri Air 1.9 T1; Borneo Wings 1.7 T1; Dune Jet 1.7 T1 |
| 46 | Puddle Jumper Airlines 87 T4; Zoomjet 13.2 T1; Harbor Heli 7.3 T1; Island Heli 6.7 T1; Alpine Swift 6.2 T1; Medevac One 5 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.7 T1; Cityhopper 2.5 T1; Maple Coastal 2.2 T1; Prestige Air 2.2 T1; Zephyr Go 2.2 T1; Brisa 2.1 T1; Outback Link 2.1 T1; Kauri Air 2 T1; Savanna Air 2 T1; Borneo Wings 1.8 T1; Dune Jet 1.8 T1 |
| 47 | Puddle Jumper Airlines 88.5 T4; Zoomjet 13.7 T1; Harbor Heli 7.5 T1; Island Heli 6.9 T1; Alpine Swift 6.8 T1; Medevac One 6.2 T1; Rotorlink 4 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Cityhopper 2.6 T1; Maple Coastal 2.3 T1; Brisa 2.2 T1; Outback Link 2.2 T1; Prestige Air 2.2 T1; Zephyr Go 2.2 T1; Kauri Air 2.1 T1; Savanna Air 2.1 T1; Dune Jet 1.9 T1; Borneo Wings 1.8 T1 |
| 48 | Puddle Jumper Airlines 90.7 T5; Zoomjet 14.1 T1; Harbor Heli 7.6 T1; Alpine Swift 7.2 T1; Island Heli 7 T1; Medevac One 6.2 T1; Rotorlink 3.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.6 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Brisa 2.1 T1; Prestige Air 2.1 T1; Zephyr Go 2.1 T1; Kauri Air 2 T1; Outback Link 2 T1; Savanna Air 2 T1; Dune Jet 1.8 T1; Borneo Wings 1.7 T1 |
| 49 | Puddle Jumper Airlines 92.8 T5; Zoomjet 14.4 T1; Harbor Heli 7.6 T1; Alpine Swift 7.5 T1; Island Heli 7.1 T1; Medevac One 6.3 T1; Rotorlink 5.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.5 T1; Cityhopper 2.3 T1; Maple Coastal 2.1 T1; Brisa 2 T1; Prestige Air 2 T1; Zephyr Go 2 T1; Outback Link 1.9 T1; Savanna Air 1.9 T1; Kauri Air 1.8 T1; Borneo Wings 1.6 T1; Dune Jet 1.6 T1 |
| 50 | Puddle Jumper Airlines 95.2 T5; Zoomjet 15 T1; Alpine Swift 8.1 T1; Harbor Heli 7.9 T1; Island Heli 7.3 T1; Medevac One 6.5 T1; Rotorlink 6 T1; Skyline Rescue 3.6 T1; SkyCheap 2.6 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Prestige Air 2.1 T1; Zephyr Go 2.1 T1; Brisa 2 T1; Outback Link 2 T1; Savanna Air 2 T1; Kauri Air 1.9 T1; Borneo Wings 1.7 T1; Dune Jet 1.7 T1 |
| 51 | Puddle Jumper Airlines 97.5 T5; Zoomjet 15.6 T1; Alpine Swift 8.6 T1; Harbor Heli 8.2 T1; Island Heli 7.6 T1; Medevac One 6.8 T1; Rotorlink 6.3 T1; Skyline Rescue 4.7 T1; SkyCheap 2.7 T1; Cityhopper 2.5 T1; Maple Coastal 2.2 T1; Prestige Air 2.2 T1; Zephyr Go 2.2 T1; Brisa 2.1 T1; Outback Link 2.1 T1; Kauri Air 2 T1; Savanna Air 2 T1; Borneo Wings 1.8 T1; Dune Jet 1.8 T1 |
| 52 | Puddle Jumper Airlines 99.9 T5; Zoomjet 16.1 T1; Alpine Swift 9.2 T1; Harbor Heli 8.4 T1; Island Heli 7.8 T1; Medevac One 7.1 T1; Rotorlink 6.5 T1; Skyline Rescue 4.9 T1; SkyCheap 2.8 T1; Cityhopper 2.6 T1; Maple Coastal 2.3 T1; Brisa 2.2 T1; Outback Link 2.2 T1; Prestige Air 2.2 T1; Zephyr Go 2.2 T1; Kauri Air 2.1 T1; Savanna Air 2.1 T1; Dune Jet 1.9 T1; Borneo Wings 1.8 T1 |
| 53 | Puddle Jumper Airlines 100 T5; Zoomjet 16.7 T1; Alpine Swift 9.8 T1; Harbor Heli 8.7 T1; Island Heli 8.1 T1; Medevac One 7.3 T1; Rotorlink 6.8 T1; Skyline Rescue 6 T1; SkyCheap 2.9 T1; Cityhopper 2.6 T1; Maple Coastal 2.4 T1; Brisa 2.3 T1; Prestige Air 2.3 T1; Zephyr Go 2.3 T1; Kauri Air 2.2 T1; Outback Link 2.2 T1; Savanna Air 2.2 T1; Dune Jet 2 T1; Borneo Wings 1.9 T1 |
| 54 | Puddle Jumper Airlines 100 T5; Zoomjet 17.2 T1; Alpine Swift 10.3 T1; Harbor Heli 8.9 T1; Island Heli 8.4 T1; Medevac One 7.6 T1; Rotorlink 7.1 T1; Skyline Rescue 6.3 T1; Cityhopper 2.7 T1; Maple Coastal 2.5 T1; SkyCheap 2.5 T1; Brisa 2.4 T1; Prestige Air 2.4 T1; Zephyr Go 2.4 T1; Outback Link 2.3 T1; Savanna Air 2.3 T1; Kauri Air 2.2 T1; Borneo Wings 2 T1; Dune Jet 2 T1 |
| 55 | Puddle Jumper Airlines 100 T5; Zoomjet 17.8 T1; Alpine Swift 10.9 T1; Harbor Heli 9.2 T1; Island Heli 8.6 T1; Medevac One 7.8 T1; Rotorlink 7.3 T1; Skyline Rescue 6.5 T1; Cityhopper 2.8 T1; Maple Coastal 2.6 T1; Prestige Air 2.5 T1; Zephyr Go 2.5 T1; Brisa 2.4 T1; Outback Link 2.4 T1; Savanna Air 2.4 T1; Kauri Air 2.3 T1; Borneo Wings 2.1 T1; Dune Jet 2.1 T1; SkyCheap 2.1 T1 |
| 56 | Puddle Jumper Airlines 100 T5; Zoomjet 18.4 T1; Alpine Swift 11.4 T1; Harbor Heli 9.5 T1; Island Heli 8.9 T1; Medevac One 8.1 T1; Rotorlink 7.6 T1; Skyline Rescue 6.8 T1; Cityhopper 2.9 T1; Maple Coastal 2.6 T1; Prestige Air 2.6 T1; Zephyr Go 2.6 T1; Brisa 2.5 T1; Outback Link 2.5 T1; Kauri Air 2.4 T1; Savanna Air 2.4 T1; Borneo Wings 2.2 T1; Dune Jet 2.2 T1; SkyCheap 1.8 T1 |
| 57 | Puddle Jumper Airlines 100 T5; Zoomjet 18.9 T1; Alpine Swift 12 T1; Harbor Heli 9.7 T1; Island Heli 9.1 T1; Medevac One 8.4 T1; Rotorlink 7.8 T1; Skyline Rescue 7.1 T1; Maple Coastal 2.7 T1; Brisa 2.6 T1; Outback Link 2.6 T1; Prestige Air 2.6 T1; Zephyr Go 2.6 T1; Cityhopper 2.5 T1; Kauri Air 2.5 T1; Savanna Air 2.5 T1; Dune Jet 2.3 T1; Borneo Wings 2.2 T1; SkyCheap 2.1 T1 |
| 58 | Puddle Jumper Airlines 100 T5; Zoomjet 19.3 T1; Alpine Swift 12.4 T1; Harbor Heli 9.8 T1; Island Heli 9.2 T1; Medevac One 8.4 T1; Rotorlink 7.9 T1; Skyline Rescue 7.1 T1; Maple Coastal 2.6 T1; Brisa 2.5 T1; Prestige Air 2.5 T1; Zephyr Go 2.5 T1; Kauri Air 2.4 T1; Outback Link 2.4 T1; Savanna Air 2.4 T1; Dune Jet 2.2 T1; SkyCheap 2.2 T1; Borneo Wings 2.1 T1; Cityhopper 1.9 T1 |
| 59 | Puddle Jumper Airlines 100 T5; Zoomjet 19.6 T1; Alpine Swift 12.7 T1; Harbor Heli 9.8 T1; Island Heli 9.3 T1; Medevac One 8.5 T1; Rotorlink 8 T1; Skyline Rescue 7.2 T1; Maple Coastal 2.5 T1; Brisa 2.4 T1; Prestige Air 2.4 T1; Zephyr Go 2.4 T1; Outback Link 2.3 T1; Savanna Air 2.3 T1; Kauri Air 2.2 T1; SkyCheap 2.2 T1; Borneo Wings 2 T1; Dune Jet 2 T1; Cityhopper 1.4 T1 |
| 60 | Puddle Jumper Airlines 100 T5; Zoomjet 20.2 T2; Alpine Swift 13.3 T1; Harbor Heli 10.1 T1; Island Heli 9.5 T1; Medevac One 8.7 T1; Rotorlink 8.2 T1; Skyline Rescue 7.4 T1; Maple Coastal 2.6 T1; Prestige Air 2.5 T1; SkyCheap 2.5 T1; Zephyr Go 2.5 T1; Brisa 2.4 T1; Outback Link 2.4 T1; Savanna Air 2.4 T1; Kauri Air 2.3 T1; Borneo Wings 2.1 T1; Dune Jet 2.1 T1; Cityhopper 1.7 T1 |

Research at day 30: 28 of 62 nodes (45%), earned 1121.5 RP, room rate sampled with the end-of-run pools. Lab 1 desk / 1 board / 1 bench, researchers 0. Fuel at that sample: tank 80,000 L, logistics not bound, loads 4, grounded 0.

Day-boundary curb pressure first crossed 1 on day 27 (1.2, stalls 3, bays 0, ranks 0, curb lanes 0, carriers 12, flights 91).
Intra-day curb pressure first crossed 1 on day 24 (peak 1.1).

## Chaotic random clicker (30 days)

First landing LIF101 at 80s. Stands 11, runway strips 1, signed zoomjet, air_regional_1, harbor_heli. Taxi-out watchdog recoveries: 1.

| Day | Cash | Rating | Guests | Happy | Taxi-out | Tank L | Loads | Grounded | Curb | Stalls | Lanes | Bays | Ranks | Curb lanes | Check-in peak | Security peak | Carriers | Flights | RP earned | Nodes | Penalty total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | $118,000 | 65 | 0 | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0 |
| 1 | $50,926 | 64 | 0 | — | 0 | 80,000 | 4 | 0 | 0.2 | 3 | 1 | 0 | 0 | 0 | 4 | 6 | 0 | 1 | 7.1 | 2 | -$1,120 |
| 2 | $18,628 | 69 | 17 | 72.6 | 0 | 80,000 | 4 | 0 | 0.3 | 3 | 1 | 0 | 0 | 0 | 3 | 6 | 1 | 2 | 26.3 | 2 | -$3,800 |
| 3 | $2,066 | 71 | 4 | 36.5 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 1 | 5 | 40.2 | 3 | -$5,000 |
| 4 | $6,166 | 74 | 18 | 73.7 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 9 | 8 | 1 | 9 | 40.2 | 4 | -$5,000 |
| 5 | $10,449 | 74 | 41 | 66.5 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 6 | 8 | 1 | 13 | 42.2 | 5 | -$6,600 |
| 6 | $14,571 | 78 | 17 | 74.9 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 6 | 9 | 1 | 17 | 40.2 | 7 | -$7,400 |
| 7 | $21,938 | 80 | 16 | 75.2 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 1 | 20 | 37.2 | 8 | -$7,800 |
| 8 | $20,606 | 85 | 7 | 60.7 | 0 | 80,000 | 4 | 0 | 0.3 | 3 | 1 | 0 | 0 | 0 | 10 | 9 | 1 | 24 | 43.2 | 9 | -$8,200 |
| 9 | $16,404 | 83 | 18 | 65.6 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 6 | 8 | 1 | 27 | 45.3 | 10 | -$9,000 |
| 10 | $8,526 | 83 | 28 | 71.7 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 1 | 31 | 65.1 | 11 | -$9,000 |
| 11 | $11,135 | 83 | 18 | 63.6 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 1 | 35 | 73.8 | 14 | -$9,400 |
| 12 | $11,621 | 83 | 36 | 65.8 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 5 | 9 | 1 | 38 | 71.4 | 16 | -$9,400 |
| 13 | $7,262 | 77 | 18 | 65.8 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 5 | 8 | 1 | 41 | 89.3 | 17 | -$10,200 |
| 14 | $14,627 | 80 | 36 | 68.9 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 1 | 45 | 97.8 | 19 | -$10,600 |
| 15 | $12,645 | 80 | 18 | 62.3 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 6 | 8 | 1 | 49 | 97.8 | 21 | -$11,000 |
| 16 | $17,601 | 81 | 36 | 65.6 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 4 | 6 | 1 | 52 | 105.6 | 23 | -$11,400 |
| 17 | $16,075 | 82 | 18 | 65.7 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 7 | 9 | 1 | 56 | 108.6 | 25 | -$11,800 |
| 18 | $16,412 | 82 | 36 | 70 | 0 | 60,000 | 3 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 1 | 59 | 112.9 | 27 | -$12,200 |
| 19 | $19,582 | 80 | 18 | 70.9 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 1 | 63 | 124.2 | 29 | -$13,000 |
| 20 | $38,007 | 81 | 36 | 68.4 | 0 | 60,000 | 3 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 2 | 66 | 129.9 | 31 | -$13,400 |
| 21 | $26,612 | 81 | 18 | 64 | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 2 | 70 | 140.5 | 35 | -$14,600 |
| 22 | $30,506 | 78 | 36 | 67.7 | 0 | 80,000 | 4 | 0 | 0.9 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 2 | 74 | 142.8 | 37 | -$15,000 |
| 23 | $26,482 | 79 | 18 | 72.8 | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 5 | 8 | 2 | 78 | 149.9 | 40 | -$15,800 |
| 24 | $36,669 | 81 | 36 | 70.9 | 0 | 60,000 | 3 | 0 | 1.1 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 2 | 81 | 148 | 42 | -$15,800 |
| 25 | $31,977 | 79 | 18 | 71.5 | 0 | 80,000 | 4 | 0 | 1.2 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 2 | 85 | 154.1 | 44 | -$16,600 |
| 26 | $25,344 | 78 | 36 | 67.5 | 0 | 60,000 | 3 | 0 | 1.2 | 3 | 1 | 0 | 0 | 0 | 5 | 6 | 3 | 88 | 158.7 | 46 | -$17,400 |
| 27 | $28,572 | 80 | 15 | 70 | 0 | 80,000 | 4 | 0 | 1.1 | 3 | 1 | 0 | 0 | 0 | 5 | 6 | 3 | 92 | 166.2 | 48 | -$18,200 |
| 28 | $211,193 | 79 | 15 | 70 | 1 | 80,000 | 4 | 0 | 1.2 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 3 | 96 | 165.2 | 51 | -$19,000 |
| 29 | $201,958 | 79 | 1 | 70 | 0 | 80,000 | 4 | 0 | 1.1 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 3 | 100 | 164.2 | 53 | -$20,200 |
| 30 | $207,814 | 78 | 18 | 62.7 | 0 | 80,000 | 4 | 0 | 1.5 | 3 | 1 | 0 | 0 | 0 | 1 | 5 | 3 | 103 | 163.2 | 54 | -$21,000 |

Penalty totals are cumulative. Category split at each day:

| Day | Penalties |
| --- | --- |
| 0 | $0 |
| 1 | penalties -$720, emergency_refuse -$400 |
| 2 | penalties -$1,800, security_shock -$800, emergency_refuse -$1,200 |
| 3 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$1,600 |
| 4 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$1,600 |
| 5 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$1,600 |
| 6 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$1,600 |
| 7 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$2,000 |
| 8 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$2,400 |
| 9 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$3,200 |
| 10 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$3,200 |
| 11 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$3,600 |
| 12 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$3,600 |
| 13 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$4,400 |
| 14 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$4,800 |
| 15 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$5,200 |
| 16 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$5,600 |
| 17 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$6,000 |
| 18 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$6,400 |
| 19 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$7,200 |
| 20 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$7,600 |
| 21 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$8,000 |
| 22 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$8,400 |
| 23 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$9,200 |
| 24 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$9,200 |
| 25 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$10,000 |
| 26 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$10,800 |
| 27 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$11,600 |
| 28 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$12,400 |
| 29 | penalties -$1,800, security_shock -$5,600, emergency_refuse -$12,800 |
| 30 | penalties -$1,800, security_shock -$5,600, emergency_refuse -$13,600 |

Ledger by category is cumulative. Change since the previous sampled day:

| Day | Ledger change |
| --- | --- |
| 0 | construction -$95,000; loan_proceeds $45,000 |
| 1 | construction -$56,400; staff_hiring -$10,000; payroll -$4,755; loan_repayment -$1,773; building_upkeep -$1,170; penalties -$720; land_holding -$719; loan_interest -$450; emergency_refuse -$400; fuel_purchase -$400; fuel_sales $2,400; landing_fees $7,313 |
| 2 | construction -$25,900; staff_hiring -$10,000; payroll -$8,467; loan_repayment -$1,773; penalties -$1,080; emergency_refuse -$800; fuel_purchase -$800; security_shock -$800; building_upkeep -$746; loan_interest -$450; land_holding -$298; baggage_fees $183; parking_fees $261; contract_fees $1,263; retail_sales $1,315; passenger_fees $1,397; landing_fees $4,661; task_rewards $4,800; fuel_sales $4,936 |
| 3 | construction -$27,200; staff_hiring -$6,400; payroll -$2,700; loan_repayment -$1,773; building_upkeep -$837; fuel_purchase -$800; security_shock -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$338; land_holding -$304; baggage_fees $194; parking_fees $261; passenger_fees $1,571; landside_fees $2,400; contract_fees $3,128; retail_sales $3,181; fuel_sales $4,016; landing_fees $4,689; task_rewards $6,000 |
| 4 | payroll -$7,302; loan_repayment -$2,364; building_upkeep -$837; loan_interest -$600; fuel_purchase -$400; land_holding -$304; retail_cogs -$288; baggage_fees $183; parking_fees $261; landing_fees $772; passenger_fees $1,397; fuel_sales $2,008; retail_sales $2,854; contract_fees $3,920; landside_fees $4,800 |
| 5 | construction -$8,800; payroll -$8,546; loan_repayment -$1,773; security_shock -$1,600; building_upkeep -$1,096; fuel_purchase -$800; loan_interest -$450; retail_cogs -$445; land_holding -$390; baggage_fees $183; parking_fees $522; level_reward $2,500; retail_sales $2,775; passenger_fees $2,837; fuel_sales $4,016; landside_fees $4,800; landing_fees $5,172; contract_fees $5,378 |
| 6 | payroll -$9,135; construction -$8,500; loan_repayment -$1,773; fuel_purchase -$1,200; building_upkeep -$1,138; security_shock -$800; loan_interest -$450; land_holding -$397; retail_cogs -$288; parking_fees $261; baggage_fees $379; passenger_fees $1,588; retail_sales $2,507; landside_fees $4,800; landing_fees $4,937; fuel_sales $6,024; contract_fees $7,307 |
| 7 | payroll -$7,621; construction -$3,300; loan_repayment -$1,773; building_upkeep -$1,194; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; land_holding -$397; retail_cogs -$288; baggage_fees $179; parking_fees $261; passenger_fees $1,326; retail_sales $2,229; fuel_sales $4,016; landing_fees $4,642; landside_fees $4,800; contract_fees $6,137 |
| 8 | construction -$17,100; payroll -$9,418; loan_repayment -$2,364; building_upkeep -$1,194; loan_interest -$600; land_holding -$404; emergency_refuse -$400; fuel_purchase -$400; retail_cogs -$292; baggage_fees $184; parking_fees $261; landing_fees $752; passenger_fees $1,414; fuel_sales $2,008; landside_fees $2,400; retail_sales $3,365; contract_fees $7,956; task_rewards $12,500 |
| 9 | construction -$15,500; payroll -$8,338; loan_repayment -$1,773; building_upkeep -$1,194; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; land_holding -$404; retail_cogs -$292; catering_fees $150; baggage_fees $190; parking_fees $261; passenger_fees $1,502; retail_sales $2,522; fuel_sales $4,016; landing_fees $4,673; landside_fees $4,800; contract_fees $7,235 |
| 10 | construction -$25,600; payroll -$10,483; building_upkeep -$1,782; loan_repayment -$1,773; loan_interest -$450; land_holding -$414; fuel_purchase -$400; retail_cogs -$144; catering_fees $300; baggage_fees $383; parking_fees $522; landing_fees $1,547; retail_sales $2,317; passenger_fees $3,063; fuel_sales $4,016; landside_fees $4,800; task_rewards $7,000; contract_fees $9,220 |
| 11 | payroll -$8,643; construction -$5,600; loan_repayment -$2,364; building_upkeep -$1,782; fuel_purchase -$800; loan_interest -$600; land_holding -$518; emergency_refuse -$400; retail_cogs -$159; retail_sales $1,947; fuel_sales $2,008; landing_fees $3,928; level_reward $4,000; landside_fees $4,800; contract_fees $6,792 |
| 12 | construction -$16,650; payroll -$10,346; building_upkeep -$1,782; loan_repayment -$1,773; fuel_purchase -$800; land_holding -$518; loan_interest -$450; retail_cogs -$288; catering_fees $300; baggage_fees $398; parking_fees $522; retail_sales $2,878; passenger_fees $3,326; landside_fees $4,800; landing_fees $5,456; fuel_sales $6,024; contract_fees $9,389 |
| 13 | construction -$12,400; payroll -$5,233; building_upkeep -$1,782; loan_repayment -$1,618; emergency_refuse -$800; fuel_purchase -$800; land_holding -$518; loan_interest -$450; retail_sales $1,614; fuel_sales $2,008; landing_fees $3,920; landside_fees $4,800; contract_fees $6,900 |
| 14 | payroll -$9,338; construction -$2,200; building_upkeep -$1,782; loan_repayment -$1,773; land_holding -$518; loan_interest -$450; emergency_refuse -$400; fuel_purchase -$400; retail_cogs -$288; catering_fees $300; baggage_fees $368; parking_fees $522; landing_fees $1,460; landside_fees $2,400; passenger_fees $2,819; retail_sales $3,135; fuel_sales $4,016; contract_fees $9,495 |
| 15 | construction -$10,100; payroll -$9,530; loan_repayment -$2,364; building_upkeep -$1,851; fuel_purchase -$800; loan_interest -$600; land_holding -$518; emergency_refuse -$400; retail_cogs -$156; retail_sales $1,767; fuel_sales $2,008; landside_fees $4,800; contract_fees $7,072; landing_fees $8,689 |
| 16 | construction -$13,800; payroll -$12,176; building_upkeep -$1,851; loan_repayment -$1,773; fuel_purchase -$800; land_holding -$519; loan_interest -$450; emergency_refuse -$400; retail_cogs -$300; catering_fees $300; baggage_fees $390; parking_fees $522; retail_sales $2,831; passenger_fees $3,195; landside_fees $4,800; fuel_sales $6,024; contract_fees $8,757; landing_fees $10,206 |
| 17 | payroll -$10,081; construction -$9,400; building_upkeep -$1,851; loan_repayment -$1,773; fuel_purchase -$800; land_holding -$527; loan_interest -$450; emergency_refuse -$400; retail_cogs -$294; fuel_sales $2,008; retail_sales $2,283; landside_fees $4,800; contract_fees $6,270; landing_fees $8,689 |
| 18 | construction -$13,700; payroll -$10,513; building_upkeep -$1,851; loan_repayment -$1,773; land_holding -$527; loan_interest -$450; emergency_refuse -$400; fuel_purchase -$400; retail_cogs -$144; catering_fees $300; baggage_fees $380; refunds $511; parking_fees $522; landside_fees $2,400; retail_sales $2,799; passenger_fees $3,037; fuel_sales $4,016; landing_fees $6,298; contract_fees $9,832 |
| 19 | payroll -$10,663; construction -$5,400; loan_repayment -$2,364; building_upkeep -$1,851; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$600; land_holding -$527; retail_cogs -$174; fuel_sales $2,008; retail_sales $2,556; landside_fees $4,800; contract_fees $8,282; landing_fees $8,703 |
| 20 | payroll -$12,166; construction -$7,900; building_upkeep -$1,851; loan_repayment -$1,773; land_holding -$947; fuel_purchase -$800; loan_interest -$450; retail_cogs -$432; emergency_refuse -$400; catering_fees $300; baggage_fees $390; parking_fees $522; retail_sales $2,852; passenger_fees $3,150; landside_fees $4,800; level_reward $6,000; fuel_sales $6,024; landing_fees $10,206; contract_fees $10,900 |
| 21 | construction -$21,600; payroll -$11,439; building_upkeep -$1,851; loan_repayment -$1,773; land_holding -$954; fuel_purchase -$800; security_shock -$800; loan_interest -$450; emergency_refuse -$400; retail_sales $1,776; fuel_sales $2,008; landside_fees $4,800; contract_fees $8,365; landing_fees $11,723 |
| 22 | payroll -$11,851; construction -$10,300; loan_repayment -$2,364; building_upkeep -$1,851; land_holding -$960; loan_interest -$600; emergency_refuse -$400; fuel_purchase -$400; retail_cogs -$288; baggage_fees $194; catering_fees $300; parking_fees $522; fuel_sales $2,008; retail_sales $3,020; passenger_fees $3,500; landside_fees $4,800; landing_fees $7,581; contract_fees $10,983 |
| 23 | payroll -$12,425; construction -$11,650; building_upkeep -$1,851; loan_repayment -$1,773; land_holding -$960; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; retail_cogs -$144; retail_sales $1,621; fuel_sales $4,016; landside_fees $4,800; contract_fees $7,702; landing_fees $8,690 |
| 24 | payroll -$12,970; construction -$12,300; building_upkeep -$1,851; loan_repayment -$1,773; land_holding -$964; fuel_purchase -$800; loan_interest -$450; retail_cogs -$300; catering_fees $300; parking_fees $522; retail_sales $3,134; passenger_fees $3,491; landside_fees $4,800; fuel_sales $6,024; contract_fees $11,220; landing_fees $12,104 |
| 25 | construction -$13,000; payroll -$12,854; building_upkeep -$1,851; loan_repayment -$1,773; land_holding -$974; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; retail_sales $1,821; fuel_sales $2,008; landside_fees $4,800; landing_fees $8,698; contract_fees $10,483 |
| 26 | construction -$14,400; payroll -$13,060; building_upkeep -$5,290; land_holding -$2,783; emergency_refuse -$800; fuel_purchase -$400; loan_interest -$150; retail_cogs -$144; loan_repayment -$84; catering_fees $273; parking_fees $522; landside_fees $2,400; passenger_fees $2,684; retail_sales $2,715; fuel_sales $3,292; landing_fees $4,883; contract_fees $13,709 |
| 27 | payroll -$13,288; construction -$5,600; building_upkeep -$5,290; land_holding -$2,783; fuel_purchase -$1,200; emergency_refuse -$800; retail_cogs -$144; catering_fees $132; parking_fees $279; passenger_fees $658; retail_sales $2,398; fuel_sales $3,406; landside_fees $4,800; landing_fees $8,743; contract_fees $11,917 |
| 28 | payroll -$13,288; construction -$6,100; building_upkeep -$5,290; land_holding -$2,795; emergency_refuse -$800; fuel_purchase -$800; city_levy -$301; retail_cogs -$144; catering_fees $132; parking_fees $279; passenger_fees $658; retail_sales $2,057; fuel_sales $3,406; landside_fees $4,800; landing_fees $8,744; contract_fees $12,063; loan_proceeds $180,000 |
| 29 | payroll -$13,402; construction -$9,700; building_upkeep -$5,290; loan_repayment -$3,120; land_holding -$2,795; loan_interest -$800; security_shock -$800; emergency_refuse -$400; fuel_purchase -$400; city_levy -$253; catering_fees $132; parking_fees $279; passenger_fees $666; fuel_sales $1,760; retail_sales $2,403; landside_fees $4,800; landing_fees $5,493; contract_fees $12,192 |
| 30 | payroll -$13,474; building_upkeep -$5,290; loan_repayment -$3,120; land_holding -$2,795; construction -$1,600; loan_interest -$800; emergency_refuse -$800; fuel_purchase -$800; city_levy -$272; retail_cogs -$144; catering_fees $123; parking_fees $261; passenger_fees $1,388; fuel_sales $3,292; retail_sales $3,554; landside_fees $4,800; landing_fees $7,570; contract_fees $13,963 |

Relations (signed carriers):

| Day | Tier and score |
| --- | --- |
| 0 | — |
| 1 | — |
| 2 | Zoomjet 1.9 T1 |
| 3 | Zoomjet 1.7 T1 |
| 4 | Zoomjet 3.4 T1 |
| 5 | Zoomjet 5 T1 |
| 6 | Zoomjet 6.7 T1 |
| 7 | Zoomjet 8.6 T1 |
| 8 | Zoomjet 9.1 T1 |
| 9 | Zoomjet 11 T1 |
| 10 | Zoomjet 13 T1 |
| 11 | Zoomjet 14.9 T1 |
| 12 | Zoomjet 16.8 T1 |
| 13 | Zoomjet 17.9 T1 |
| 14 | Zoomjet 19.8 T1 |
| 15 | Zoomjet 21.7 T2 |
| 16 | Zoomjet 23.6 T2 |
| 17 | Zoomjet 25.6 T2 |
| 18 | Zoomjet 26.6 T2 |
| 19 | Zoomjet 28.5 T2 |
| 20 | Zoomjet 30.5 T2; Puddle Jumper Airlines -6.9 T1 |
| 21 | Zoomjet 32.2 T2; Puddle Jumper Airlines -7 T1 |
| 22 | Zoomjet 34.1 T2; Puddle Jumper Airlines -7 T1 |
| 23 | Zoomjet 36.1 T2; Puddle Jumper Airlines -6.9 T1 |
| 24 | Zoomjet 38 T2; Puddle Jumper Airlines -6.8 T1 |
| 25 | Zoomjet 39.9 T2; Puddle Jumper Airlines -6.7 T1 |
| 26 | Zoomjet 40.9 T2; Harbor Heli 2.1 T1; Puddle Jumper Airlines -6.6 T1 |
| 27 | Zoomjet 42.9 T2; Harbor Heli 2.2 T1; Puddle Jumper Airlines -6.6 T1 |
| 28 | Zoomjet 45.4 T3; Harbor Heli 2.2 T1; Puddle Jumper Airlines -7.5 T1 |
| 29 | Zoomjet 47.6 T3; Harbor Heli 2.1 T1; Puddle Jumper Airlines -7.9 T1 |
| 30 | Zoomjet 49.6 T3; Harbor Heli 2.2 T1; Puddle Jumper Airlines -7.6 T1 |

Research at day 30: 54 of 62 nodes (87%), earned 2951.1 RP, room rate sampled with the end-of-run pools. Lab 5 desk / 7 board / 7 bench, researchers 0. Fuel at that sample: tank 80,000 L, logistics not bound, loads 4, grounded 0.

Day-boundary curb pressure first crossed 1 on day 24 (1.1, stalls 3, bays 0, ranks 0, curb lanes 0, carriers 2, flights 81).
Intra-day curb pressure first crossed 1 on day 21 (peak 1).
