# Bot rerun — 15 Oct 2026, 06:30 window

Headless personas on `9065876` after the curb-demand lever (standard difficulty, passenger focus, sandbox off). Careful 45 sim days, Greedy 60, Chaotic 30. Browser smoke was not repeated. The step-1 baseline, before this lever, is summarised at the top of this note.

One research tree has 62 nodes. A third of that is 21 nodes. The logistics adapter did not mount (no depot and farm on the same road), so there is no second fuel ledger. The sim tank held 60,000–80,000 L and no departure was grounded. `fuelLoads` is the older load counter.

## Step 1 baseline, before the curb lever

Measured on `48b2dca` with tier costs 50–62, before the curb lever. Missed-connection cash was **$0** on every persona (0 missed, 0 diverts). The #29 growth in missed-connection penalties does not come back. Remaining penalty cash is `emergency_refuse`, `security_shock`, and a smaller `penalties` bucket.

| Persona | Day 30 | End | Carriers | Flights | Penalty total | Curb peak | Preferred | Nodes at day 30 |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: |
| Careful | $100,422 | $190,675 | 10 | 125 | -$50,200 | 0.72, never crossed 1 | day 29 | 26 / 62, one unstaffed lab |
| Greedy | $8,129 | $12,608 | 21 | 221 | -$51,754 | 0.86, never crossed 1 | day 12 | 28 / 62 |
| Chaotic | $312,410 | $312,410 | 4 | 102 | -$51,581 | 0.76 on day 3 | day 16 | 47 / 62, six desks |

Careful’s cash rose through day 45. Greedy after day 30 hovered and finished at $12,608. One unstaffed lab held 26 of 62 nodes at day 30 and 36 at day 45, so it was not clearing the tree before day 60. Research costs were not changed by this job. While this rerun was in progress, `595672c` raised tier costs to 76–114; the tables below include that. Careful’s carrier reached Preferred on day 29 of the baseline, inside the 20–30 day band.

The miss was the curb. One runway keeps only a couple of jets on the ramp, so pressure sat near 0.6 from day 1 through day 35. Three starter stalls never crossed 1.

## The lever

`LANDSIDE.turnAllowance` is 52 and `LANDSIDE.perTurn` is 0.2. Completed turns past 52 add passengers a minute at the door. No new cash category. Days 0–4 stay under pressure 1 because the allowance covers them. The numbers below were rerun after that lever, on the rebased main (tier costs 76–114 and the crash-fine cap in `144e852`).

## Did missed-connection penalties still grow?

The #29 note said penalty totals grew on a busier field, mostly missed connections. `1c8c21c` named the miss cause. This rerun is on a later main that also spaces the runway (`3360f09`) and caps hall litter (`48b2dca` and neighbors).

| Persona | Penalty total | Missed-connection ledger | Judged | Missed | Diverts | Avg inbound delay (game-min) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Careful | -$51,720 | $0 | 37 | 0 | 0 | 14 |
| Greedy expander | -$50,134 | $0 | 51 | 0 | 0 | 85 |
| Chaotic random clicker | -$20,600 | $0 | 15 | 0 | 0 | 12 |

## Cash, rating, and the post-day-30 window

| Persona | Start | Day 30 | End | Minimum | Carriers | Flights | Rating end | Taxi-out recoveries |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Careful | $168,000 | $112,395 | $158,421 | $6,176 | 10 | 146 | 78 | 3 |
| Greedy expander | $168,000 | $8,368 | $20,441 | $3,531 | 19 | 225 | 29 | 1 |
| Chaotic random clicker | $168,000 | $209,834 | $209,834 | $3,830 | 5 | 104 | 76 | 0 |

- **Careful.** Cash $112,395 on day 30 → $158,421 on day 45 ($46,026). Largest expense growth: payroll -$142,604; building_upkeep -$94,350; land_holding -$46,389; penalties -$20,320; construction -$11,000; fuel_purchase -$10,400.
- **Greedy expander.** Cash $8,368 on day 30 → $20,441 on day 60 ($12,073). Largest expense growth: building_upkeep -$227,700; payroll -$146,362; land_holding -$142,769; loan_repayment -$120,690; construction -$83,300; loan_interest -$29,700.
- **Chaotic random clicker.** Run ends at day 30, so there is no post-day-30 window.

Careful’s intra-day curb first crosses 1 on day 26 (10 carriers, 77 flights, starter curb, peak 1.02). Day 27 is the first sample with at least 80 flights: 10 carriers, starter curb, peak 1.19. The bus bay is in on day 29 and that day’s peak is 0.86. Further turns push the single bay over 1 again; the taxi rank and curb lane are both down by day 38 and the peak falls to 0.65. Greedy does not stamp. It crosses on day 20 and is over 1 on day 23 at 80 flights and 11 carriers, still on the starter curb. Days 0–4 stay under 1. One unstaffed lab owns 18 of 62 nodes at day 30 (about 29%) and 24 at day 45. Greedy owns 29 at day 60. The tree is not cleared. Careful’s carrier reached Preferred on day 18 this seed.

## Careful (45 days)

First landing PDJ101 at 42.5s. Stands 4, runway strips 1, signed air_regional_1, zoomjet, alpine_swift, air_lowcost_1, cityhopper, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue. Taxi-out watchdog recoveries: 3.

| Day | Cash | Rating | Guests | Happy | Taxi-out | Tank L | Loads | Grounded | Curb | Stalls | Lanes | Bays | Ranks | Curb lanes | Check-in peak | Security peak | Carriers | Flights | RP earned | Nodes | Penalty total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | $73,000 | 65 | 0 | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | 0 | $0 |
| 1 | $6,176 | 73 | 3 | 45 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 3 | 4 | 1 | 1 | 11.1 | 1 | -$1,920 |
| 2 | $8,755 | 76 | 14 | 65.2 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 3 | 2 | 2 | 3 | 27.4 | 2 | -$3,400 |
| 3 | $19,102 | 80 | 14 | 72.1 | 1 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 3 | 3 | 3 | 4 | 24.3 | 2 | -$3,800 |
| 4 | $22,218 | 81 | 14 | 70 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 2 | 1 | 3 | 6 | 27.4 | 3 | -$4,600 |
| 5 | $21,575 | 83 | 5 | 64.6 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 4 | 8 | 29.3 | 4 | -$5,000 |
| 6 | $11,120 | 84 | 18 | 69.6 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 1 | 2 | 4 | 10 | 29.3 | 5 | -$5,800 |
| 7 | $10,495 | 84 | 3 | 62.7 | 0 | 80,000 | 4 | 0 | 0.2 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 4 | 12 | 29.4 | 6 | -$6,600 |
| 8 | $14,549 | 87 | 18 | 68.9 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 2 | 2 | 5 | 13 | 26.3 | 6 | -$8,200 |
| 9 | $16,989 | 87 | 3 | 62.7 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 5 | 17 | 35.4 | 7 | -$8,600 |
| 10 | $18,758 | 88 | 18 | 66.8 | 0 | 80,000 | 4 | 0 | 0.3 | 3 | 1 | 0 | 0 | 0 | 2 | 3 | 6 | 20 | 32.3 | 7 | -$9,000 |
| 11 | $29,227 | 87 | 4 | 64.8 | 0 | 80,000 | 4 | 0 | 0.3 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 6 | 24 | 38.3 | 8 | -$9,800 |
| 12 | $16,974 | 87 | 18 | 68.1 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 0 | 6 | 27 | 32.4 | 9 | -$10,200 |
| 13 | $21,068 | 84 | 4 | 64.3 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 7 | 30 | 32.3 | 10 | -$11,000 |
| 14 | $19,135 | 84 | 13 | 68.4 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 7 | 34 | 35.4 | 11 | -$11,800 |
| 15 | $33,082 | 87 | 14 | 76.6 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 7 | 7 | 37 | 30.3 | 11 | -$12,200 |
| 16 | $36,330 | 87 | 18 | 68.8 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 8 | 41 | 35.3 | 12 | -$12,600 |
| 17 | $44,662 | 87 | 14 | 75.3 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 8 | 45 | 35.4 | 12 | -$13,400 |
| 18 | $53,071 | 85 | 18 | 66.2 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 3 | 4 | 9 | 49 | 39.3 | 13 | -$14,200 |
| 19 | $65,448 | 87 | 13 | 70 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 2 | 2 | 9 | 52 | 32.4 | 14 | -$14,600 |
| 20 | $66,097 | 85 | 12 | 73.5 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 2 | 9 | 56 | 33.3 | 14 | -$15,800 |
| 21 | $74,950 | 86 | 12 | 70 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 2 | 3 | 10 | 60 | 33.3 | 15 | -$16,600 |
| 22 | $76,896 | 84 | 13 | 65.4 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 1 | 0 | 10 | 64 | 33.4 | 15 | -$17,400 |
| 23 | $82,143 | 83 | 2 | 64.5 | 1 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 4 | 10 | 67 | 30.3 | 16 | -$17,800 |
| 24 | $90,910 | 86 | 12 | 76.6 | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 2 | 0 | 10 | 70 | 30.4 | 16 | -$18,200 |
| 25 | $97,772 | 86 | 2 | 66.5 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 2 | 3 | 10 | 74 | 33.3 | 16 | -$18,600 |
| 26 | $99,077 | 85 | 12 | 80.5 | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 2 | 0 | 10 | 77 | 30.3 | 17 | -$19,000 |
| 27 | $105,360 | 84 | 2 | 62.5 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 6 | 10 | 10 | 81 | 33.4 | 17 | -$19,800 |
| 28 | $112,852 | 83 | 18 | 63.1 | 0 | 80,000 | 4 | 0 | 1 | 3 | 1 | 0 | 0 | 0 | 3 | 6 | 10 | 84 | 30.3 | 17 | -$20,600 |
| 29 | $110,115 | 86 | 5 | 66.2 | 0 | 80,000 | 4 | 0 | 0.8 | 5 | 1 | 1 | 0 | 0 | 3 | 8 | 10 | 87 | 32.4 | 18 | -$21,000 |
| 30 | $112,395 | 86 | 13 | 69.6 | 0 | 80,000 | 4 | 0 | 0.8 | 5 | 1 | 1 | 0 | 0 | 1 | 0 | 10 | 91 | 35.3 | 18 | -$21,400 |
| 31 | $116,527 | 84 | 3 | 73 | 0 | 80,000 | 4 | 0 | 0.7 | 5 | 1 | 1 | 0 | 0 | 3 | 5 | 10 | 95 | 33.3 | 19 | -$22,200 |
| 32 | $121,415 | 81 | 15 | 75.6 | 0 | 80,000 | 4 | 0 | 0.8 | 5 | 1 | 1 | 0 | 0 | 1 | 0 | 10 | 98 | 35.4 | 19 | -$33,160 |
| 33 | $117,224 | 84 | 1 | 60 | 0 | 80,000 | 4 | 0 | 0.8 | 5 | 1 | 1 | 0 | 0 | 4 | 8 | 10 | 102 | 33.3 | 19 | -$43,320 |
| 34 | $121,378 | 86 | 18 | 68.5 | 0 | 80,000 | 4 | 0 | 0.9 | 5 | 1 | 1 | 0 | 0 | 2 | 1 | 10 | 106 | 33.4 | 20 | -$43,720 |
| 35 | $125,960 | 82 | 4 | 61.5 | 0 | 80,000 | 4 | 0 | 0.9 | 5 | 1 | 1 | 0 | 0 | 4 | 8 | 10 | 110 | 35.3 | 20 | -$44,920 |
| 36 | $132,715 | 84 | 13 | 74.8 | 0 | 80,000 | 4 | 0 | 1 | 5 | 1 | 1 | 0 | 0 | 1 | 0 | 10 | 113 | 32.3 | 21 | -$45,720 |
| 37 | $130,822 | 83 | 3 | 63 | 0 | 80,000 | 4 | 0 | 1 | 7 | 1 | 1 | 1 | 0 | 3 | 8 | 10 | 117 | 33.4 | 21 | -$46,520 |
| 38 | $124,787 | 82 | 18 | 70.5 | 0 | 80,000 | 4 | 0 | 0.5 | 9 | 2 | 1 | 1 | 1 | 2 | 2 | 10 | 120 | 30.3 | 21 | -$47,720 |
| 39 | $132,959 | 83 | 3 | 65.3 | 0 | 80,000 | 4 | 0 | 0.5 | 9 | 2 | 1 | 1 | 1 | 4 | 9 | 10 | 124 | 35.4 | 22 | -$48,120 |
| 40 | $141,681 | 83 | 18 | 66.9 | 0 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 2 | 3 | 10 | 127 | 32.3 | 22 | -$48,520 |
| 41 | $150,714 | 83 | 10 | 70 | 0 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 3 | 2 | 10 | 131 | 35.3 | 22 | -$48,920 |
| 42 | $150,087 | 81 | 12 | 71.9 | 0 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 1 | 0 | 10 | 135 | 33.4 | 23 | -$49,720 |
| 43 | $154,996 | 82 | 1 | 70 | 1 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 2 | 3 | 10 | 139 | 33.3 | 23 | -$50,120 |
| 44 | $162,581 | 80 | 0 | — | 0 | 80,000 | 4 | 0 | 0.7 | 9 | 2 | 1 | 1 | 1 | 0 | 0 | 10 | 142 | 30.4 | 23 | -$50,920 |
| 45 | $158,421 | 78 | 0 | — | 0 | 80,000 | 4 | 0 | 0.6 | 9 | 2 | 1 | 1 | 1 | 0 | 0 | 10 | 146 | 32.3 | 24 | -$51,720 |

Penalty totals are cumulative. Category split at each day:

| Day | Penalties |
| --- | --- |
| 0 | $0 |
| 1 | penalties -$720, security_shock -$800, emergency_refuse -$400 |
| 2 | penalties -$1,800, security_shock -$800, emergency_refuse -$800 |
| 3 | penalties -$1,800, security_shock -$800, emergency_refuse -$1,200 |
| 4 | penalties -$1,800, security_shock -$800, emergency_refuse -$2,000 |
| 5 | penalties -$1,800, security_shock -$800, emergency_refuse -$2,400 |
| 6 | penalties -$1,800, security_shock -$800, emergency_refuse -$3,200 |
| 7 | penalties -$1,800, security_shock -$800, emergency_refuse -$4,000 |
| 8 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$4,800 |
| 9 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$5,200 |
| 10 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$5,600 |
| 11 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$5,600 |
| 12 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$6,000 |
| 13 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$6,800 |
| 14 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$7,600 |
| 15 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$8,000 |
| 16 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$8,400 |
| 17 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$9,200 |
| 18 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$10,000 |
| 19 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$10,400 |
| 20 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$10,800 |
| 21 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$11,600 |
| 22 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$12,400 |
| 23 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$12,800 |
| 24 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$13,200 |
| 25 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$13,600 |
| 26 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$14,000 |
| 27 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$14,800 |
| 28 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$15,600 |
| 29 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$16,000 |
| 30 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$16,400 |
| 31 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$17,200 |
| 32 | penalties -$11,960, security_shock -$3,200, emergency_refuse -$18,000 |
| 33 | penalties -$22,120, security_shock -$3,200, emergency_refuse -$18,000 |
| 34 | penalties -$22,120, security_shock -$3,200, emergency_refuse -$18,400 |
| 35 | penalties -$22,120, security_shock -$4,000, emergency_refuse -$18,800 |
| 36 | penalties -$22,120, security_shock -$4,000, emergency_refuse -$19,600 |
| 37 | penalties -$22,120, security_shock -$4,000, emergency_refuse -$20,400 |
| 38 | penalties -$22,120, security_shock -$4,800, emergency_refuse -$20,800 |
| 39 | penalties -$22,120, security_shock -$4,800, emergency_refuse -$21,200 |
| 40 | penalties -$22,120, security_shock -$4,800, emergency_refuse -$21,600 |
| 41 | penalties -$22,120, security_shock -$4,800, emergency_refuse -$22,000 |
| 42 | penalties -$22,120, security_shock -$4,800, emergency_refuse -$22,800 |
| 43 | penalties -$22,120, security_shock -$4,800, emergency_refuse -$23,200 |
| 44 | penalties -$22,120, security_shock -$4,800, emergency_refuse -$24,000 |
| 45 | penalties -$22,120, security_shock -$4,800, emergency_refuse -$24,800 |

Ledger by category is cumulative. Change since the previous sampled day:

| Day | Ledger change |
| --- | --- |
| 0 | construction -$95,000 |
| 1 | construction -$65,400; staff_hiring -$10,400; payroll -$8,051; security_shock -$800; fuel_purchase -$800; penalties -$720; emergency_refuse -$400; building_upkeep -$354; land_holding -$253; parking_fees $279; baggage_fees $346; passenger_fees $560; retail_sales $685; contract_fees $3,686; fuel_sales $4,294; landing_fees $10,504 |
| 2 | payroll -$5,702; penalties -$1,080; fuel_purchase -$400; emergency_refuse -$400; building_upkeep -$354; land_holding -$253; retail_cogs -$174; parking_fees $279; baggage_fees $346; passenger_fees $560; retail_sales $1,823; landing_fees $2,101; fuel_sales $2,147; contract_fees $3,686 |
| 3 | payroll -$9,115; building_upkeep -$1,010; fuel_purchase -$800; land_holding -$723; emergency_refuse -$400; retail_cogs -$311; parking_fees $558; baggage_fees $658; passenger_fees $1,229; retail_sales $1,815; contract_fees $4,721; fuel_sales $6,054; landing_fees $7,671 |
| 4 | payroll -$6,090; construction -$2,600; building_upkeep -$1,170; fuel_purchase -$800; emergency_refuse -$800; land_holding -$723; retail_cogs -$144; parking_fees $279; baggage_fees $300; passenger_fees $581; retail_sales $1,270; fuel_sales $3,520; contract_fees $4,417; landing_fees $5,076 |
| 5 | construction -$13,200; payroll -$6,519; building_upkeep -$1,710; land_holding -$971; fuel_purchase -$400; emergency_refuse -$400; retail_sales $95; level_reward $2,500; landing_fees $3,200; contract_fees $4,262; task_rewards $12,500 |
| 6 | construction -$15,600; payroll -$7,043; staff_hiring -$3,200; building_upkeep -$1,970; land_holding -$987; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$308; baggage_fees $159; parking_fees $261; landing_fees $657; passenger_fees $1,288; retail_sales $3,185; fuel_sales $3,406; contract_fees $5,297; task_rewards $6,000 |
| 7 | construction -$8,500; payroll -$7,083; building_upkeep -$2,930; land_holding -$988; fuel_purchase -$800; emergency_refuse -$800; baggage_fees $151; parking_fees $261; passenger_fees $1,159; retail_sales $1,570; fuel_sales $3,406; landing_fees $3,832; task_rewards $4,800; contract_fees $5,297 |
| 8 | payroll -$7,100; building_upkeep -$2,930; land_holding -$991; security_shock -$800; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$436; baggage_fees $150; parking_fees $261; passenger_fees $1,130; fuel_sales $3,406; retail_sales $3,809; landing_fees $3,810; contract_fees $5,345 |
| 9 | construction -$9,000; payroll -$8,375; building_upkeep -$2,930; land_holding -$992; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$300; baggage_fees $153; parking_fees $261; passenger_fees $1,188; retail_sales $1,400; fuel_sales $3,406; landing_fees $3,832; landside_fees $4,800; task_rewards $5,000; contract_fees $5,197 |
| 10 | payroll -$7,100; building_upkeep -$2,930; land_holding -$992; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$288; baggage_fees $147; parking_fees $261; landing_fees $614; passenger_fees $1,087; fuel_sales $1,646; landside_fees $2,400; retail_sales $2,527; contract_fees $5,197 |
| 11 | payroll -$7,947; building_upkeep -$2,930; land_holding -$1,275; security_shock -$800; fuel_purchase -$800; retail_cogs -$144; baggage_fees $159; parking_fees $261; passenger_fees $1,302; retail_sales $1,383; fuel_sales $3,406; landing_fees $3,857; level_reward $4,000; landside_fees $4,800; contract_fees $5,197 |
| 12 | construction -$24,200; payroll -$10,000; building_upkeep -$4,610; land_holding -$1,304; fuel_purchase -$800; retail_cogs -$432; emergency_refuse -$400; baggage_fees $147; parking_fees $261; passenger_fees $1,087; fuel_sales $3,406; retail_sales $3,734; landing_fees $3,811; landside_fees $4,800; contract_fees $5,247; task_rewards $7,000 |
| 13 | payroll -$8,606; building_upkeep -$4,610; land_holding -$1,304; fuel_purchase -$800; emergency_refuse -$800; baggage_fees $160; parking_fees $261; retail_sales $1,149; passenger_fees $1,324; fuel_sales $3,406; landing_fees $3,824; landside_fees $4,800; contract_fees $5,290 |
| 14 | payroll -$8,685; building_upkeep -$4,610; land_holding -$1,304; emergency_refuse -$800; fuel_purchase -$400; retail_cogs -$306; baggage_fees $154; parking_fees $261; landing_fees $632; passenger_fees $1,202; fuel_sales $1,646; landside_fees $2,400; retail_sales $2,587; contract_fees $5,290 |
| 15 | payroll -$8,925; building_upkeep -$4,610; land_holding -$1,304; fuel_purchase -$1,200; emergency_refuse -$400; retail_cogs -$144; baggage_fees $458; parking_fees $540; passenger_fees $1,910; retail_sales $1,913; landside_fees $4,800; fuel_sales $5,166; contract_fees $6,325; landing_fees $9,418 |
| 16 | payroll -$9,137; building_upkeep -$4,610; land_holding -$1,304; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$147; retail_sales $1,247; fuel_sales $1,760; contract_fees $4,308; landside_fees $4,800; landing_fees $7,131 |
| 17 | payroll -$9,216; building_upkeep -$4,610; land_holding -$1,304; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$435; baggage_fees $313; parking_fees $522; retail_sales $2,384; passenger_fees $2,511; fuel_sales $3,292; landside_fees $4,800; landing_fees $5,142; contract_fees $6,533 |
| 18 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,504; emergency_refuse -$800; fuel_purchase -$400; fuel_sales $1,760; retail_sales $1,942; contract_fees $4,463; landside_fees $4,800; level_reward $6,000; landing_fees $7,130 |
| 19 | payroll -$10,871; building_upkeep -$4,610; land_holding -$2,504; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$288; baggage_fees $453; parking_fees $540; passenger_fees $1,795; retail_sales $2,492; landside_fees $4,800; fuel_sales $5,166; contract_fees $6,533; landing_fees $10,071 |
| 20 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; security_shock -$800; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$148; retail_sales $998; fuel_sales $1,760; contract_fees $4,519; landside_fees $4,800; landing_fees $7,210 |
| 21 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$292; parking_fees $522; passenger_fees $976; baggage_fees $998; retail_sales $1,787; fuel_sales $3,293; landside_fees $4,800; contract_fees $6,756; landing_fees $8,103 |
| 22 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; emergency_refuse -$800; fuel_purchase -$400; retail_sales $1,081; fuel_sales $1,760; contract_fees $4,686; landside_fees $4,800; landing_fees $7,309 |
| 23 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; fuel_purchase -$800; emergency_refuse -$400; parking_fees $243; retail_sales $300; passenger_fees $480; baggage_fees $710; landside_fees $2,400; fuel_sales $3,293; contract_fees $5,721; landing_fees $9,790 |
| 24 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$288; parking_fees $243; passenger_fees $480; baggage_fees $710; retail_sales $2,026; fuel_sales $3,293; landside_fees $4,800; contract_fees $5,423; landing_fees $9,770 |
| 25 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; fuel_purchase -$800; emergency_refuse -$400; parking_fees $279; baggage_fees $288; passenger_fees $497; retail_sales $683; fuel_sales $3,520; landside_fees $4,800; contract_fees $5,599; landing_fees $8,886 |
| 26 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$148; parking_fees $279; baggage_fees $288; passenger_fees $490; fuel_sales $1,760; retail_sales $2,254; landside_fees $2,400; contract_fees $5,599; landing_fees $5,672 |
| 27 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$144; parking_fees $279; baggage_fees $288; passenger_fees $490; retail_sales $643; fuel_sales $3,520; landside_fees $4,800; contract_fees $5,599; landing_fees $8,900 |
| 28 | payroll -$9,372; building_upkeep -$4,610; land_holding -$2,508; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$148; parking_fees $279; baggage_fees $288; passenger_fees $490; retail_sales $1,790; fuel_sales $3,520; landside_fees $4,800; contract_fees $5,652; landing_fees $8,911 |
| 29 | payroll -$9,372; construction -$8,500; building_upkeep -$5,570; land_holding -$2,509; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$314; baggage_fees $155; parking_fees $261; passenger_fees $1,216; retail_sales $1,672; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,477; landing_fees $7,740 |
| 30 | payroll -$9,372; building_upkeep -$5,570; land_holding -$2,509; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$148; baggage_fees $155; parking_fees $261; passenger_fees $1,223; fuel_sales $1,646; retail_sales $2,578; landing_fees $4,539; landside_fees $4,800; contract_fees $5,477 |
| 31 | payroll -$9,372; building_upkeep -$5,570; land_holding -$2,509; fuel_purchase -$800; emergency_refuse -$800; parking_fees $243; passenger_fees $486; baggage_fees $710; retail_sales $770; landside_fees $2,400; fuel_sales $3,293; contract_fees $5,477; landing_fees $9,805 |
| 32 | penalties -$10,160; payroll -$9,372; building_upkeep -$5,570; land_holding -$3,129; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$288; parking_fees $243; passenger_fees $480; baggage_fees $710; retail_sales $2,189; fuel_sales $3,293; landside_fees $4,800; contract_fees $5,523; level_reward $8,000; landing_fees $9,768 |
| 33 | penalties -$10,160; payroll -$9,372; building_upkeep -$5,570; land_holding -$3,129; fuel_purchase -$800; parking_fees $279; baggage_fees $305; retail_sales $564; passenger_fees $620; fuel_sales $3,520; landside_fees $4,800; contract_fees $5,699; landing_fees $9,053 |
| 34 | payroll -$9,372; building_upkeep -$5,570; land_holding -$3,129; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$291; parking_fees $279; baggage_fees $305; passenger_fees $620; fuel_sales $1,760; retail_sales $2,648; landside_fees $4,800; contract_fees $5,699; landing_fees $7,205 |
| 35 | payroll -$9,372; building_upkeep -$5,570; land_holding -$3,132; security_shock -$800; fuel_purchase -$800; emergency_refuse -$400; baggage_fees $150; parking_fees $261; passenger_fees $1,145; retail_sales $1,478; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,699; landing_fees $7,717 |
| 36 | payroll -$9,372; building_upkeep -$5,570; land_holding -$3,132; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$435; baggage_fees $163; parking_fees $261; passenger_fees $1,367; retail_sales $3,392; fuel_sales $3,406; landside_fees $4,800; contract_fees $5,712; landing_fees $7,763 |
| 37 | payroll -$9,372; construction -$6,500; building_upkeep -$6,290; land_holding -$3,133; fuel_purchase -$800; emergency_refuse -$800; parking_fees $279; baggage_fees $296; passenger_fees $559; retail_sales $739; fuel_sales $3,520; landside_fees $4,800; contract_fees $5,897; landing_fees $8,911 |
| 38 | payroll -$9,372; building_upkeep -$6,830; construction -$4,500; land_holding -$3,137; security_shock -$800; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$288; parking_fees $279; baggage_fees $296; passenger_fees $551; fuel_sales $1,760; landside_fees $2,400; retail_sales $2,799; landing_fees $5,711; contract_fees $5,897 |
| 39 | payroll -$9,478; building_upkeep -$6,830; land_holding -$3,137; fuel_purchase -$800; emergency_refuse -$400; parking_fees $243; baggage_fees $1,007; passenger_fees $1,280; retail_sales $1,634; fuel_sales $3,293; landside_fees $4,800; contract_fees $5,897; landing_fees $10,663 |
| 40 | payroll -$10,221; building_upkeep -$6,830; land_holding -$3,137; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$295; parking_fees $243; baggage_fees $1,011; passenger_fees $1,280; fuel_sales $3,293; retail_sales $3,383; landside_fees $4,800; contract_fees $5,730; landing_fees $10,665 |
| 41 | payroll -$10,255; building_upkeep -$6,830; land_holding -$3,137; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$303; city_levy -$28; parking_fees $486; baggage_fees $1,702; passenger_fees $1,707; retail_sales $2,072; fuel_sales $3,066; landside_fees $4,800; contract_fees $6,987; landing_fees $9,965 |
| 42 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,137; emergency_refuse -$800; fuel_purchase -$400; city_levy -$26; retail_sales $1,104; fuel_sales $1,760; landside_fees $4,800; contract_fees $4,917; landing_fees $7,359 |
| 43 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,137; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$150; city_levy -$50; parking_fees $243; retail_sales $389; passenger_fees $427; baggage_fees $691; fuel_sales $3,293; landside_fees $4,800; contract_fees $5,952; landing_fees $9,852 |
| 44 | payroll -$9,558; building_upkeep -$6,830; land_holding -$3,137; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$144; city_levy -$88; parking_fees $243; passenger_fees $453; baggage_fees $699; retail_sales $1,182; fuel_sales $3,293; contract_fees $5,993; landside_fees $7,200; landing_fees $9,879 |
| 45 | payroll -$9,372; building_upkeep -$6,830; land_holding -$3,137; emergency_refuse -$800; fuel_purchase -$400; city_levy -$67; retail_sales $13; fuel_sales $1,760; landside_fees $2,400; contract_fees $5,164; landing_fees $7,109 |

Relations (signed carriers):

| Day | Tier and score |
| --- | --- |
| 0 | — |
| 1 | Puddle Jumper Airlines 1.4 T1 |
| 2 | Zoomjet 2.1 T1; Puddle Jumper Airlines 1 T1 |
| 3 | Zoomjet 2.2 T1; Alpine Swift 2.1 T1; Puddle Jumper Airlines 0.8 T1 |
| 4 | Alpine Swift 2.2 T1; Zoomjet 2.2 T1; Puddle Jumper Airlines 0.5 T1 |
| 5 | Zoomjet 2.3 T1; Alpine Swift 2.2 T1; SkyCheap 2.1 T1; Puddle Jumper Airlines 0.4 T1 |
| 6 | Alpine Swift 2.3 T1; SkyCheap 2.2 T1; Zoomjet 1.9 T1; Puddle Jumper Airlines 0.7 T1 |
| 7 | Alpine Swift 2.4 T1; SkyCheap 2.2 T1; Zoomjet 1.6 T1; Puddle Jumper Airlines 1.1 T1 |
| 8 | Alpine Swift 2.3 T1; SkyCheap 2.1 T1; Cityhopper 1.9 T1; Puddle Jumper Airlines 1.3 T1; Zoomjet 1.1 T1 |
| 9 | Puddle Jumper Airlines 3.6 T1; Alpine Swift 2.4 T1; SkyCheap 2.2 T1; Cityhopper 2 T1; Zoomjet 0.8 T1 |
| 10 | Puddle Jumper Airlines 5.1 T1; Alpine Swift 2.4 T1; SkyCheap 2.3 T1; Harbor Heli 2.1 T1; Cityhopper 2 T1; Zoomjet 0.7 T1 |
| 11 | Puddle Jumper Airlines 7.2 T1; Alpine Swift 2.3 T1; SkyCheap 2.2 T1; Harbor Heli 2 T1; Cityhopper 1.9 T1; Zoomjet 0.4 T1 |
| 12 | Puddle Jumper Airlines 9.6 T1; Alpine Swift 2.4 T1; SkyCheap 2.2 T1; Cityhopper 2 T1; Harbor Heli 2 T1; Zoomjet 0.3 T1 |
| 13 | Puddle Jumper Airlines 11 T1; Alpine Swift 2.5 T1; SkyCheap 2.3 T1; Cityhopper 2.1 T1; Harbor Heli 2.1 T1; Island Heli 2.1 T1; Zoomjet 0.3 T1 |
| 14 | Puddle Jumper Airlines 13.4 T1; Alpine Swift 2.6 T1; SkyCheap 2.4 T1; Cityhopper 2.2 T1; Harbor Heli 2.2 T1; Island Heli 2.2 T1; Zoomjet 0.3 T1 |
| 15 | Puddle Jumper Airlines 15.2 T1; Alpine Swift 2.6 T1; SkyCheap 2.5 T1; Harbor Heli 2.3 T1; Cityhopper 2.2 T1; Island Heli 2.2 T1; Zoomjet 0.9 T1 |
| 16 | Puddle Jumper Airlines 17.6 T1; Alpine Swift 2.7 T1; SkyCheap 2.6 T1; Harbor Heli 2.4 T1; Cityhopper 2.3 T1; Island Heli 2.3 T1; Medevac One 2.1 T1; Zoomjet 0.9 T1 |
| 17 | Puddle Jumper Airlines 19.9 T1; Alpine Swift 2.8 T1; SkyCheap 2.6 T1; Cityhopper 2.4 T1; Harbor Heli 2.4 T1; Island Heli 2.4 T1; Medevac One 2.2 T1; Zoomjet 0.9 T1 |
| 18 | Puddle Jumper Airlines 22.3 T2; Alpine Swift 2.9 T1; SkyCheap 2.7 T1; Cityhopper 2.5 T1; Harbor Heli 2.5 T1; Island Heli 2.5 T1; Medevac One 2.2 T1; Rotorlink 2.1 T1; Zoomjet 0.9 T1 |
| 19 | Puddle Jumper Airlines 24.6 T2; Alpine Swift 3 T1; SkyCheap 2.8 T1; Cityhopper 2.6 T1; Harbor Heli 2.6 T1; Island Heli 2.6 T1; Medevac One 2.3 T1; Rotorlink 2.2 T1; Zoomjet 0.9 T1 |
| 20 | Puddle Jumper Airlines 26.3 T2; Alpine Swift 2.8 T1; SkyCheap 2.7 T1; Harbor Heli 2.5 T1; Cityhopper 2.4 T1; Island Heli 2.4 T1; Medevac One 2.2 T1; Rotorlink 2 T1; Zoomjet 1.3 T1 |
| 21 | Puddle Jumper Airlines 28.1 T2; Alpine Swift 2.9 T1; SkyCheap 2.8 T1; Harbor Heli 2.6 T1; Cityhopper 2.5 T1; Island Heli 2.5 T1; Medevac One 2.3 T1; Rotorlink 2.1 T1; Skyline Rescue 2.1 T1; Zoomjet 1.9 T1 |
| 22 | Puddle Jumper Airlines 30.4 T2; SkyCheap 2.8 T1; Cityhopper 2.6 T1; Harbor Heli 2.6 T1; Island Heli 2.6 T1; Alpine Swift 2.5 T1; Medevac One 2.4 T1; Zoomjet 2.4 T1; Rotorlink 2.2 T1; Skyline Rescue 2.2 T1 |
| 23 | Puddle Jumper Airlines 31.9 T2; Zoomjet 3 T1; SkyCheap 2.9 T1; Cityhopper 2.7 T1; Harbor Heli 2.7 T1; Island Heli 2.7 T1; Medevac One 2.4 T1; Rotorlink 2.3 T1; Alpine Swift 2.2 T1; Skyline Rescue 2.2 T1 |
| 24 | Puddle Jumper Airlines 34.2 T2; Zoomjet 3.5 T1; SkyCheap 3 T1; Cityhopper 2.8 T1; Harbor Heli 2.8 T1; Island Heli 2.8 T1; Medevac One 2.5 T1; Rotorlink 2.4 T1; Skyline Rescue 2.3 T1; Alpine Swift 1.9 T1 |
| 25 | Puddle Jumper Airlines 36.1 T2; Zoomjet 4.1 T1; SkyCheap 3.1 T1; Harbor Heli 2.9 T1; Cityhopper 2.8 T1; Island Heli 2.8 T1; Medevac One 2.6 T1; Rotorlink 2.4 T1; Skyline Rescue 2.4 T1; Alpine Swift 2.1 T1 |
| 26 | Puddle Jumper Airlines 37 T2; Zoomjet 4.7 T1; SkyCheap 3.2 T1; Harbor Heli 3 T1; Cityhopper 2.9 T1; Island Heli 2.9 T1; Medevac One 2.7 T1; Rotorlink 2.5 T1; Skyline Rescue 2.5 T1; Alpine Swift 2.4 T1 |
| 27 | Puddle Jumper Airlines 38.8 T2; Zoomjet 5.2 T1; SkyCheap 3.2 T1; Cityhopper 3 T1; Harbor Heli 3 T1; Island Heli 3 T1; Medevac One 2.8 T1; Alpine Swift 2.7 T1; Rotorlink 2.6 T1; Skyline Rescue 2.6 T1 |
| 28 | Puddle Jumper Airlines 40.6 T2; Zoomjet 5.8 T1; SkyCheap 3.3 T1; Cityhopper 3.1 T1; Harbor Heli 3.1 T1; Island Heli 3.1 T1; Alpine Swift 2.9 T1; Medevac One 2.8 T1; Rotorlink 2.7 T1; Skyline Rescue 2.6 T1 |
| 29 | Puddle Jumper Airlines 42 T2; Zoomjet 5.8 T1; SkyCheap 3.4 T1; Alpine Swift 3.2 T1; Cityhopper 3.2 T1; Harbor Heli 3.2 T1; Island Heli 3.2 T1; Medevac One 2.9 T1; Rotorlink 2.8 T1; Skyline Rescue 2.7 T1 |
| 30 | Puddle Jumper Airlines 44.4 T2; Zoomjet 5.8 T1; SkyCheap 3.5 T1; Alpine Swift 3.4 T1; Harbor Heli 3.3 T1; Cityhopper 3.2 T1; Island Heli 3.2 T1; Medevac One 3 T1; Rotorlink 2.8 T1; Skyline Rescue 2.8 T1 |
| 31 | Puddle Jumper Airlines 46.8 T3; Zoomjet 6.4 T1; SkyCheap 3.6 T1; Harbor Heli 3.4 T1; Cityhopper 3.3 T1; Island Heli 3.3 T1; Alpine Swift 3.2 T1; Medevac One 3.1 T1; Rotorlink 2.9 T1; Skyline Rescue 2.9 T1 |
| 32 | Puddle Jumper Airlines 49.1 T3; Zoomjet 6.9 T1; SkyCheap 3.6 T1; Cityhopper 3.4 T1; Harbor Heli 3.4 T1; Island Heli 3.4 T1; Medevac One 3.2 T1; Alpine Swift 3 T1; Rotorlink 3 T1; Skyline Rescue 3 T1 |
| 33 | Puddle Jumper Airlines 50.9 T3; Zoomjet 7.5 T1; SkyCheap 3.7 T1; Cityhopper 3.5 T1; Harbor Heli 3.5 T1; Island Heli 3.5 T1; Alpine Swift 3.4 T1; Medevac One 3.2 T1; Rotorlink 3.1 T1; Skyline Rescue 3 T1 |
| 34 | Puddle Jumper Airlines 52.7 T3; Zoomjet 8 T1; Alpine Swift 3.8 T1; SkyCheap 3.8 T1; Cityhopper 3.6 T1; Harbor Heli 3.6 T1; Island Heli 3.6 T1; Medevac One 3.3 T1; Rotorlink 3.2 T1; Skyline Rescue 3.1 T1 |
| 35 | Puddle Jumper Airlines 54.9 T3; Zoomjet 7.8 T1; Alpine Swift 4 T1; SkyCheap 3.7 T1; Harbor Heli 3.5 T1; Cityhopper 3.4 T1; Island Heli 3.4 T1; Medevac One 3.2 T1; Rotorlink 3 T1; Skyline Rescue 3 T1 |
| 36 | Puddle Jumper Airlines 57.3 T3; Zoomjet 7.9 T1; Alpine Swift 4.4 T1; SkyCheap 3.8 T1; Harbor Heli 3.6 T1; Cityhopper 3.5 T1; Island Heli 3.5 T1; Medevac One 3.3 T1; Rotorlink 3.1 T1; Skyline Rescue 3.1 T1 |
| 37 | Puddle Jumper Airlines 59.1 T3; Zoomjet 8.4 T1; Alpine Swift 4.7 T1; SkyCheap 3.8 T1; Cityhopper 3.6 T1; Harbor Heli 3.6 T1; Island Heli 3.6 T1; Medevac One 3.4 T1; Rotorlink 3.2 T1; Skyline Rescue 3.2 T1 |
| 38 | Puddle Jumper Airlines 59.8 T3; Zoomjet 8.8 T1; Alpine Swift 4.9 T1; SkyCheap 3.7 T1; Cityhopper 3.5 T1; Harbor Heli 3.5 T1; Island Heli 3.5 T1; Medevac One 3.2 T1; Rotorlink 3.1 T1; Skyline Rescue 3 T1 |
| 39 | Puddle Jumper Airlines 62.1 T3; Zoomjet 9.3 T1; Alpine Swift 5.3 T1; Cityhopper 3.6 T1; Harbor Heli 3.6 T1; Island Heli 3.6 T1; Medevac One 3.3 T1; SkyCheap 3.3 T1; Rotorlink 3.2 T1; Skyline Rescue 3.1 T1 |
| 40 | Puddle Jumper Airlines 64.5 T3; Zoomjet 9.9 T1; Alpine Swift 5.7 T1; Harbor Heli 3.7 T1; Cityhopper 3.6 T1; Island Heli 3.6 T1; Medevac One 3.4 T1; Rotorlink 3.2 T1; Skyline Rescue 3.2 T1; SkyCheap 3 T1 |
| 41 | Puddle Jumper Airlines 66.9 T3; Zoomjet 10.5 T1; Alpine Swift 6.1 T1; Harbor Heli 3.8 T1; Cityhopper 3.7 T1; Island Heli 3.7 T1; Medevac One 3.5 T1; Rotorlink 3.3 T1; Skyline Rescue 3.3 T1; SkyCheap 2.7 T1 |
| 42 | Puddle Jumper Airlines 69.2 T3; Zoomjet 11 T1; Alpine Swift 6.4 T1; Harbor Heli 3.8 T1; Island Heli 3.8 T1; Medevac One 3.6 T1; Rotorlink 3.4 T1; Skyline Rescue 3.4 T1; Cityhopper 3.3 T1; SkyCheap 2.9 T1 |
| 43 | Puddle Jumper Airlines 71.6 T4; Zoomjet 11.6 T1; Alpine Swift 6.8 T1; Harbor Heli 3.9 T1; Island Heli 3.9 T1; Medevac One 3.6 T1; Rotorlink 3.5 T1; Skyline Rescue 3.4 T1; SkyCheap 3.2 T1; Cityhopper 3 T1 |
| 44 | Puddle Jumper Airlines 73.9 T4; Zoomjet 12.1 T1; Alpine Swift 7.2 T1; Harbor Heli 4 T1; Island Heli 4 T1; Medevac One 3.7 T1; Rotorlink 3.6 T1; SkyCheap 3.5 T1; Skyline Rescue 3.5 T1; Cityhopper 2.7 T1 |
| 45 | Puddle Jumper Airlines 75.4 T4; Zoomjet 12.7 T1; Alpine Swift 7.6 T1; Harbor Heli 5 T1; Island Heli 4 T1; Medevac One 3.8 T1; SkyCheap 3.7 T1; Rotorlink 3.6 T1; Skyline Rescue 3.6 T1; Cityhopper 2.9 T1 |

Research at day 30: 18 of 62 nodes (29%), earned 939 RP, room rate sampled with the end-of-run pools. Lab 1 desk / 1 board / 1 bench, researchers 0. Fuel at that sample: tank 80,000 L, logistics not bound, loads 4, grounded 0.

Day-boundary curb pressure never crossed 1.
Intra-day curb pressure first crossed 1 on day 26 (peak 1).

## Greedy expander (60 days)

First landing PDJ101 at 41.3s. Stands 6, runway strips 1, signed air_regional_1, zoomjet, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue, air_lowcost_1, alpine_swift, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, borneo_wings, dune_jet, air_fullservice_1, brisa, zephyr_go. Taxi-out watchdog recoveries: 1.

| Day | Cash | Rating | Guests | Happy | Taxi-out | Tank L | Loads | Grounded | Curb | Stalls | Lanes | Bays | Ranks | Curb lanes | Check-in peak | Security peak | Carriers | Flights | RP earned | Nodes | Penalty total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | $73,000 | 65 | 0 | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 1 | 0 | 0 | 0 | 0 | $0 |
| 1 | $44,527 | 78 | 1 | 54 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 4 | 1 | 1 | 11.1 | 2 | -$1,120 |
| 2 | $32,637 | 80 | 14 | 67.4 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 2 | 1 | 2 | 4 | 30.4 | 2 | -$3,400 |
| 3 | $6,850 | 85 | 11 | 70 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 4 | 3 | 7 | 32.3 | 4 | -$4,600 |
| 4 | $7,147 | 86 | 15 | 70 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 1 | 0 | 3 | 11 | 33.4 | 5 | -$5,800 |
| 5 | $7,108 | 80 | 2 | 63.5 | 0 | 80,000 | 4 | 0 | 0.2 | 3 | 1 | 0 | 0 | 0 | 4 | 7 | 4 | 15 | 33.3 | 5 | -$7,400 |
| 6 | $9,844 | 83 | 18 | 68 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 1 | 1 | 4 | 18 | 32.3 | 6 | -$7,800 |
| 7 | $8,006 | 81 | 2 | 63.5 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 5 | 21 | 32.4 | 6 | -$8,600 |
| 8 | $7,261 | 80 | 18 | 67.5 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 1 | 0 | 5 | 25 | 38.3 | 9 | -$8,600 |
| 9 | $9,744 | 80 | 1 | 64 | 0 | 80,000 | 4 | 0 | 0.3 | 3 | 1 | 0 | 0 | 0 | 5 | 10 | 5 | 29 | 35.4 | 9 | -$9,400 |
| 10 | $13,775 | 80 | 18 | 63.6 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 2 | 4 | 6 | 32 | 32.3 | 10 | -$10,200 |
| 11 | $16,915 | 81 | 4 | 71 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 6 | 36 | 35.3 | 10 | -$10,600 |
| 12 | $17,022 | 81 | 18 | 71 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 2 | 1 | 6 | 40 | 35.4 | 11 | -$11,000 |
| 13 | $19,324 | 81 | 4 | 69 | 0 | 80,000 | 4 | 0 | 0.3 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 7 | 44 | 35.3 | 11 | -$11,400 |
| 14 | $23,293 | 80 | 12 | 71.7 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 7 | 47 | 32.4 | 11 | -$12,600 |
| 15 | $32,543 | 80 | 17 | 70 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 8 | 50 | 34.3 | 13 | -$13,400 |
| 16 | $7,486 | 78 | 18 | 68.7 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 2 | 2 | 8 | 54 | 35.3 | 13 | -$13,800 |
| 17 | $15,493 | 80 | 12 | 70 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 2 | 1 | 8 | 57 | 33.4 | 14 | -$13,800 |
| 18 | $16,264 | 79 | 12 | 71.2 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 9 | 61 | 33.3 | 14 | -$14,200 |
| 19 | $20,728 | 79 | 16 | 72.8 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 9 | 65 | 33.4 | 15 | -$15,800 |
| 20 | $21,294 | 76 | 18 | 70.6 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 1 | 2 | 9 | 69 | 35.3 | 15 | -$16,600 |
| 21 | $28,349 | 78 | 0 | — | 0 | 80,000 | 4 | 0 | 0.8 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 10 | 74 | 38.3 | 15 | -$17,000 |
| 22 | $31,893 | 79 | 0 | — | 0 | 80,000 | 4 | 0 | 0.9 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 10 | 77 | 29.4 | 16 | -$17,000 |
| 23 | $3,531 | 78 | 0 | — | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 11 | 80 | 29.3 | 16 | -$17,800 |
| 24 | $9,147 | 79 | 0 | — | 0 | 80,000 | 4 | 0 | 1 | 3 | 1 | 0 | 0 | 0 | 3 | 5 | 11 | 85 | 35.4 | 16 | -$18,200 |
| 25 | $341,789 | 79 | 0 | — | 0 | 80,000 | 4 | 0 | 0.9 | 3 | 1 | 0 | 0 | 0 | 3 | 4 | 11 | 90 | 41.3 | 17 | -$19,000 |
| 26 | $56,192 | 79 | 15 | 66.8 | 0 | 80,000 | 4 | 0 | 1.1 | 3 | 1 | 0 | 0 | 0 | 1 | 0 | 12 | 94 | 32.3 | 17 | -$19,400 |
| 27 | $72,790 | 78 | 2 | 69.5 | 0 | 80,000 | 4 | 0 | 1 | 3 | 1 | 0 | 0 | 0 | 5 | 14 | 12 | 97 | 30.4 | 18 | -$20,200 |
| 28 | $8,167 | 76 | 57 | 55.9 | 0 | 80,000 | 4 | 0 | 1.8 | 3 | 1 | 0 | 0 | 0 | 5 | 10 | 12 | 100 | 30.3 | 18 | -$21,234 |
| 29 | $8,037 | 78 | 30 | 73.9 | 0 | 80,000 | 4 | 0 | 1.5 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 13 | 106 | 41.4 | 18 | -$21,234 |
| 30 | $8,368 | 74 | 2 | 0 | 0 | 80,000 | 4 | 0 | 1.7 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 13 | 110 | 38.3 | 19 | -$24,934 |
| 31 | $7,705 | 70 | 0 | — | 0 | 80,000 | 4 | 0 | 1.4 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 13 | 114 | 32.3 | 19 | -$25,334 |
| 32 | $7,713 | 70 | 0 | — | 0 | 80,000 | 4 | 0 | 1.6 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 14 | 119 | 35.4 | 20 | -$26,534 |
| 33 | $7,844 | 66 | 0 | — | 0 | 80,000 | 4 | 0 | 1.5 | 3 | 1 | 0 | 0 | 0 | 5 | 7 | 14 | 122 | 29.3 | 20 | -$26,934 |
| 34 | $8,084 | 65 | 18 | 61.7 | 0 | 80,000 | 4 | 0 | 1.8 | 3 | 1 | 0 | 0 | 0 | 2 | 1 | 15 | 126 | 32.4 | 20 | -$28,134 |
| 35 | $8,386 | 65 | 2 | 68 | 0 | 80,000 | 4 | 0 | 1.8 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 15 | 130 | 35.3 | 21 | -$29,334 |
| 36 | $9,888 | 64 | 18 | 68.9 | 0 | 80,000 | 4 | 0 | 2.2 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 15 | 133 | 33.3 | 21 | -$30,934 |
| 37 | $18,709 | 70 | 15 | 73.7 | 0 | 80,000 | 4 | 0 | 2.1 | 3 | 1 | 0 | 0 | 0 | 3 | 10 | 16 | 137 | 41.4 | 22 | -$31,334 |
| 38 | $15,682 | 70 | 18 | 67.1 | 0 | 80,000 | 4 | 0 | 2.4 | 3 | 1 | 0 | 0 | 0 | 1 | 3 | 16 | 140 | 35.3 | 22 | -$31,734 |
| 39 | $13,590 | 69 | 0 | — | 0 | 80,000 | 4 | 0 | 2.3 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 16 | 145 | 38.4 | 22 | -$32,534 |
| 40 | $8,147 | 67 | 0 | — | 0 | 80,000 | 4 | 0 | 2.3 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 17 | 149 | 32.3 | 23 | -$34,134 |
| 41 | $8,657 | 64 | 0 | — | 0 | 60,000 | 3 | 0 | 2.4 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 17 | 152 | 29.3 | 23 | -$34,534 |
| 42 | $7,107 | 63 | 0 | — | 0 | 80,000 | 4 | 0 | 2.6 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 18 | 156 | 32.4 | 23 | -$34,934 |
| 43 | $7,084 | 56 | 0 | — | 0 | 60,000 | 3 | 0 | 2.6 | 3 | 1 | 0 | 0 | 0 | 4 | 1 | 18 | 159 | 29.3 | 24 | -$35,734 |
| 44 | $6,531 | 52 | 11 | 67.4 | 0 | 80,000 | 4 | 0 | 2.8 | 3 | 1 | 0 | 0 | 0 | 3 | 4 | 18 | 164 | 35.4 | 24 | -$36,134 |
| 45 | $6,635 | 50 | 0 | — | 0 | 80,000 | 4 | 0 | 2.9 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 169 | 36.3 | 24 | -$38,134 |
| 46 | $6,607 | 44 | 0 | — | 0 | 80,000 | 4 | 0 | 2.8 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 173 | 32.3 | 25 | -$39,334 |
| 47 | $6,586 | 39 | 0 | — | 0 | 80,000 | 4 | 0 | 2.9 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 176 | 29.4 | 25 | -$40,134 |
| 48 | $6,133 | 30 | 0 | — | 0 | 80,000 | 4 | 0 | 2.9 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 181 | 35.3 | 25 | -$42,134 |
| 49 | $5,309 | 29 | 0 | — | 0 | 80,000 | 4 | 0 | 2.9 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 184 | 29.4 | 26 | -$42,134 |
| 50 | $6,800 | 29 | 0 | — | 0 | 80,000 | 4 | 0 | 3.1 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 19 | 189 | 35.3 | 26 | -$42,534 |
| 51 | $8,134 | 32 | 14 | 75.7 | 0 | 80,000 | 4 | 0 | 3.4 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 19 | 192 | 29.3 | 26 | -$42,934 |
| 52 | $7,052 | 28 | 18 | 71.5 | 0 | 80,000 | 4 | 0 | 3.5 | 3 | 1 | 0 | 0 | 0 | 2 | 2 | 19 | 195 | 32.4 | 27 | -$44,134 |
| 53 | $8,162 | 29 | 15 | 74.3 | 0 | 80,000 | 4 | 0 | 3.6 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 19 | 199 | 35.3 | 27 | -$44,534 |
| 54 | $7,421 | 25 | 6 | 81.7 | 1 | 80,000 | 4 | 0 | 3.7 | 3 | 1 | 0 | 0 | 0 | 1 | 0 | 19 | 203 | 35.4 | 27 | -$46,534 |
| 55 | $7,124 | 25 | 1 | 62 | 0 | 80,000 | 4 | 0 | 3.5 | 3 | 1 | 0 | 0 | 0 | 3 | 2 | 19 | 207 | 32.3 | 28 | -$47,334 |
| 56 | $7,855 | 25 | 11 | 73.1 | 0 | 80,000 | 4 | 0 | 3.8 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 19 | 210 | 29.3 | 28 | -$48,134 |
| 57 | $7,490 | 25 | 0 | — | 0 | 80,000 | 4 | 0 | 3.8 | 3 | 1 | 0 | 0 | 0 | 3 | 11 | 19 | 214 | 33.4 | 28 | -$48,534 |
| 58 | $7,427 | 26 | 23 | 64.5 | 0 | 80,000 | 4 | 0 | 3.9 | 3 | 1 | 0 | 0 | 0 | 2 | 6 | 19 | 217 | 30.3 | 29 | -$49,334 |
| 59 | $23,854 | 28 | 3 | 65.7 | 0 | 60,000 | 3 | 0 | 4 | 3 | 1 | 0 | 0 | 0 | 3 | 5 | 19 | 221 | 42.4 | 29 | -$49,734 |
| 60 | $20,441 | 29 | 14 | 65.8 | 0 | 80,000 | 4 | 0 | 4 | 3 | 1 | 0 | 0 | 0 | 1 | 0 | 19 | 225 | 33.3 | 29 | -$50,134 |

Penalty totals are cumulative. Category split at each day:

| Day | Penalties |
| --- | --- |
| 0 | $0 |
| 1 | penalties -$720, emergency_refuse -$400 |
| 2 | penalties -$1,800, security_shock -$800, emergency_refuse -$800 |
| 3 | penalties -$1,800, security_shock -$1,600, emergency_refuse -$1,200 |
| 4 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$1,600 |
| 5 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$2,400 |
| 6 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$2,800 |
| 7 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$3,600 |
| 8 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$3,600 |
| 9 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$4,400 |
| 10 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$5,200 |
| 11 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$5,600 |
| 12 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$6,000 |
| 13 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$6,400 |
| 14 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$6,800 |
| 15 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$7,600 |
| 16 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$8,000 |
| 17 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$8,000 |
| 18 | penalties -$1,800, security_shock -$4,000, emergency_refuse -$8,400 |
| 19 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$9,200 |
| 20 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$10,000 |
| 21 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$10,400 |
| 22 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$10,400 |
| 23 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$11,200 |
| 24 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$11,600 |
| 25 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$12,400 |
| 26 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$12,800 |
| 27 | penalties -$1,800, security_shock -$4,800, emergency_refuse -$13,600 |
| 28 | penalties -$2,834, security_shock -$4,800, emergency_refuse -$13,600 |
| 29 | penalties -$2,834, security_shock -$4,800, emergency_refuse -$13,600 |
| 30 | penalties -$5,334, security_shock -$5,600, emergency_refuse -$14,000 |
| 31 | penalties -$5,334, security_shock -$5,600, emergency_refuse -$14,400 |
| 32 | penalties -$5,334, security_shock -$6,400, emergency_refuse -$14,800 |
| 33 | penalties -$5,334, security_shock -$6,400, emergency_refuse -$15,200 |
| 34 | penalties -$5,334, security_shock -$7,200, emergency_refuse -$15,600 |
| 35 | penalties -$5,334, security_shock -$8,000, emergency_refuse -$16,000 |
| 36 | penalties -$5,334, security_shock -$8,800, emergency_refuse -$16,800 |
| 37 | penalties -$5,334, security_shock -$8,800, emergency_refuse -$17,200 |
| 38 | penalties -$5,334, security_shock -$8,800, emergency_refuse -$17,600 |
| 39 | penalties -$5,334, security_shock -$8,800, emergency_refuse -$18,400 |
| 40 | penalties -$5,334, security_shock -$9,600, emergency_refuse -$19,200 |
| 41 | penalties -$5,334, security_shock -$9,600, emergency_refuse -$19,600 |
| 42 | penalties -$5,334, security_shock -$9,600, emergency_refuse -$20,000 |
| 43 | penalties -$5,334, security_shock -$9,600, emergency_refuse -$20,800 |
| 44 | penalties -$5,334, security_shock -$9,600, emergency_refuse -$21,200 |
| 45 | penalties -$5,334, security_shock -$11,200, emergency_refuse -$21,600 |
| 46 | penalties -$5,334, security_shock -$12,000, emergency_refuse -$22,000 |
| 47 | penalties -$5,334, security_shock -$12,000, emergency_refuse -$22,800 |
| 48 | penalties -$5,334, security_shock -$13,600, emergency_refuse -$23,200 |
| 49 | penalties -$5,334, security_shock -$13,600, emergency_refuse -$23,200 |
| 50 | penalties -$5,334, security_shock -$13,600, emergency_refuse -$23,600 |
| 51 | penalties -$5,334, security_shock -$13,600, emergency_refuse -$24,000 |
| 52 | penalties -$5,334, security_shock -$14,400, emergency_refuse -$24,400 |
| 53 | penalties -$5,334, security_shock -$14,400, emergency_refuse -$24,800 |
| 54 | penalties -$5,334, security_shock -$16,000, emergency_refuse -$25,200 |
| 55 | penalties -$5,334, security_shock -$16,000, emergency_refuse -$26,000 |
| 56 | penalties -$5,334, security_shock -$16,000, emergency_refuse -$26,800 |
| 57 | penalties -$5,334, security_shock -$16,000, emergency_refuse -$27,200 |
| 58 | penalties -$5,334, security_shock -$16,800, emergency_refuse -$27,200 |
| 59 | penalties -$5,334, security_shock -$16,800, emergency_refuse -$27,600 |
| 60 | penalties -$5,334, security_shock -$16,800, emergency_refuse -$28,000 |

Ledger by category is cumulative. Change since the previous sampled day:

| Day | Ledger change |
| --- | --- |
| 0 | construction -$95,000 |
| 1 | construction -$75,900; staff_hiring -$10,400; payroll -$9,864; loan_repayment -$1,182; fuel_purchase -$800; penalties -$720; building_upkeep -$438; emergency_refuse -$400; loan_interest -$300; land_holding -$256; catering_fees $161; parking_fees $279; baggage_fees $356; passenger_fees $634; retail_sales $1,239; task_rewards $3,600; fuel_sales $4,294; contract_fees $6,044; landing_fees $10,180; loan_proceeds $45,000 |
| 2 | construction -$21,100; payroll -$7,338; loan_repayment -$2,364; penalties -$1,080; security_shock -$800; loan_interest -$600; building_upkeep -$550; fuel_purchase -$400; emergency_refuse -$400; land_holding -$258; retail_cogs -$174; catering_fees $161; parking_fees $279; baggage_fees $356; passenger_fees $634; landing_fees $2,050; fuel_sales $2,147; retail_sales $2,192; landside_fees $2,400; task_rewards $5,000; contract_fees $7,955 |
| 3 | construction -$55,016; payroll -$3,154; building_upkeep -$2,250; loan_repayment -$1,773; fuel_purchase -$1,200; land_holding -$1,187; security_shock -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$311; catering_fees $293; parking_fees $558; baggage_fees $653; passenger_fees $1,191; retail_sales $2,001; level_reward $2,500; landside_fees $4,800; task_rewards $6,000; fuel_sales $6,054; landing_fees $7,714; contract_fees $8,990 |
| 4 | construction -$11,300; payroll -$8,758; building_upkeep -$3,210; loan_repayment -$1,773; land_holding -$1,192; security_shock -$800; loan_interest -$450; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$144; catering_fees $132; parking_fees $279; baggage_fees $305; passenger_fees $620; retail_sales $1,447; fuel_sales $3,520; task_rewards $4,800; landside_fees $4,800; landing_fees $5,094; contract_fees $7,727 |
| 5 | building_upkeep -$3,210; construction -$2,800; loan_repayment -$1,773; land_holding -$1,195; emergency_refuse -$800; security_shock -$800; payroll -$650; loan_interest -$450; fuel_purchase -$400; retail_sales $308; landside_fees $4,800; contract_fees $6,931 |
| 6 | construction -$13,800; payroll -$12,126; building_upkeep -$3,210; loan_repayment -$2,364; land_holding -$1,205; fuel_purchase -$800; loan_interest -$600; retail_cogs -$432; emergency_refuse -$400; catering_fees $123; baggage_fees $155; parking_fees $261; passenger_fees $1,223; retail_sales $3,396; fuel_sales $3,406; landing_fees $3,830; landside_fees $4,800; contract_fees $7,979; task_rewards $12,500 |
| 7 | payroll -$6,404; staff_hiring -$4,500; building_upkeep -$3,210; construction -$2,800; loan_repayment -$1,773; land_holding -$1,205; fuel_purchase -$800; emergency_refuse -$800; loan_interest -$450; retail_cogs -$147; catering_fees $123; baggage_fees $151; parking_fees $261; retail_sales $963; passenger_fees $1,159; landside_fees $2,400; fuel_sales $3,406; landing_fees $3,809; contract_fees $7,979 |
| 8 | construction -$20,800; building_upkeep -$4,890; payroll -$1,951; loan_repayment -$1,773; land_holding -$1,514; loan_interest -$450; retail_cogs -$444; fuel_purchase -$400; catering_fees $123; baggage_fees $151; parking_fees $261; landing_fees $610; passenger_fees $1,152; fuel_sales $1,646; retail_sales $3,755; level_reward $4,000; landside_fees $4,800; task_rewards $7,000; contract_fees $7,979 |
| 9 | payroll -$7,089; building_upkeep -$4,890; construction -$2,800; loan_repayment -$2,364; land_holding -$1,515; fuel_purchase -$800; emergency_refuse -$800; loan_interest -$600; catering_fees $123; baggage_fees $159; parking_fees $261; passenger_fees $1,288; retail_sales $1,508; fuel_sales $3,406; landing_fees $3,827; landside_fees $4,800; contract_fees $7,969 |
| 10 | payroll -$7,402; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,515; fuel_purchase -$800; emergency_refuse -$800; loan_interest -$450; retail_cogs -$296; catering_fees $123; baggage_fees $164; parking_fees $261; passenger_fees $1,381; retail_sales $2,892; fuel_sales $3,406; landing_fees $3,857; landside_fees $4,800; contract_fees $7,873 |
| 11 | payroll -$7,469; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,516; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$295; catering_fees $123; baggage_fees $151; parking_fees $261; passenger_fees $1,152; retail_sales $1,955; fuel_sales $3,406; landing_fees $3,812; landside_fees $4,800; contract_fees $7,873 |
| 12 | payroll -$7,536; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,516; loan_interest -$450; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$288; catering_fees $123; baggage_fees $155; parking_fees $261; landing_fees $628; passenger_fees $1,231; fuel_sales $1,646; retail_sales $3,443; landside_fees $4,800; contract_fees $7,873 |
| 13 | payroll -$7,866; building_upkeep -$4,890; construction -$2,800; loan_repayment -$2,364; land_holding -$1,517; fuel_purchase -$800; loan_interest -$600; emergency_refuse -$400; retail_cogs -$144; catering_fees $123; baggage_fees $164; parking_fees $261; passenger_fees $1,381; retail_sales $1,572; fuel_sales $3,406; landing_fees $3,853; landside_fees $4,800; contract_fees $8,123 |
| 14 | payroll -$7,895; building_upkeep -$4,890; construction -$2,800; loan_repayment -$1,773; land_holding -$1,521; fuel_purchase -$800; security_shock -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$300; catering_fees $123; baggage_fees $164; parking_fees $261; passenger_fees $1,381; retail_sales $3,393; fuel_sales $3,406; landing_fees $3,856; landside_fees $4,800; contract_fees $8,214 |
| 15 | payroll -$7,895; building_upkeep -$4,890; construction -$2,800; land_holding -$2,721; loan_repayment -$1,773; fuel_purchase -$800; emergency_refuse -$800; loan_interest -$450; retail_cogs -$296; catering_fees $255; baggage_fees $439; parking_fees $540; retail_sales $1,464; passenger_fees $1,642; landside_fees $2,400; fuel_sales $3,406; level_reward $6,000; landing_fees $6,280; contract_fees $9,249 |
| 16 | construction -$33,282; payroll -$6,392; building_upkeep -$4,890; land_holding -$2,914; loan_repayment -$1,773; loan_interest -$450; fuel_purchase -$400; emergency_refuse -$400; fuel_sales $1,760; retail_sales $2,170; landing_fees $7,135; contract_fees $7,179; landside_fees $7,200 |
| 17 | payroll -$10,355; building_upkeep -$4,890; land_holding -$2,914; construction -$2,800; loan_repayment -$2,364; fuel_purchase -$1,200; loan_interest -$600; retail_cogs -$297; catering_fees $255; baggage_fees $463; parking_fees $540; passenger_fees $2,064; landside_fees $2,400; retail_sales $2,586; fuel_sales $5,166; contract_fees $9,234; landing_fees $10,719 |
| 18 | payroll -$7,637; building_upkeep -$4,890; land_holding -$2,914; construction -$2,800; loan_repayment -$1,773; loan_interest -$450; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$144; retail_sales $1,166; fuel_sales $1,760; landside_fees $4,800; landing_fees $7,192; contract_fees $7,260 |
| 19 | payroll -$8,446; building_upkeep -$4,890; land_holding -$2,919; construction -$2,800; loan_repayment -$1,773; fuel_purchase -$800; emergency_refuse -$800; security_shock -$800; loan_interest -$450; retail_cogs -$294; catering_fees $255; baggage_fees $449; parking_fees $540; retail_sales $1,643; passenger_fees $1,765; fuel_sales $3,406; landside_fees $4,800; landing_fees $6,248; contract_fees $9,330 |
| 20 | payroll -$7,637; building_upkeep -$4,890; land_holding -$2,919; construction -$2,800; loan_repayment -$2,364; emergency_refuse -$800; loan_interest -$600; fuel_purchase -$400; fuel_sales $1,760; retail_sales $2,024; landside_fees $4,800; landing_fees $7,133; contract_fees $7,260 |
| 21 | payroll -$9,016; building_upkeep -$4,890; land_holding -$2,920; construction -$2,800; loan_repayment -$1,773; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$297; catering_fees $123; baggage_fees $165; parking_fees $261; passenger_fees $1,395; retail_sales $1,529; fuel_sales $3,406; landside_fees $7,200; landing_fees $7,764; contract_fees $8,558 |
| 22 | payroll -$7,637; building_upkeep -$4,890; land_holding -$2,920; construction -$2,100; loan_repayment -$1,773; loan_interest -$450; fuel_purchase -$400; retail_sales $21; fuel_sales $1,760; landing_fees $7,108; landside_fees $7,200; contract_fees $7,624 |
| 23 | construction -$35,848; building_upkeep -$4,890; land_holding -$3,114; loan_repayment -$1,773; emergency_refuse -$800; loan_interest -$450; fuel_purchase -$400; retail_sales $21; fuel_sales $1,760; landside_fees $2,400; landing_fees $7,108; contract_fees $7,624 |
| 24 | payroll -$8,347; building_upkeep -$4,890; land_holding -$3,115; construction -$2,800; loan_repayment -$2,364; loan_interest -$600; fuel_purchase -$400; emergency_refuse -$400; retail_sales $40; fuel_sales $1,760; landing_fees $7,109; contract_fees $7,624; landside_fees $12,000 |
| 25 | payroll -$8,481; building_upkeep -$4,890; land_holding -$3,735; construction -$2,800; loan_repayment -$1,702; city_levy -$973; fuel_purchase -$800; emergency_refuse -$800; loan_interest -$450; catering_fees $132; parking_fees $279; baggage_fees $307; passenger_fees $627; retail_sales $1,613; fuel_sales $3,520; landside_fees $4,800; level_reward $8,000; contract_fees $8,936; landing_fees $9,059; loan_proceeds $320,000 |
| 26 | construction -$287,168; building_upkeep -$7,590; payroll -$7,379; land_holding -$4,542; loan_repayment -$2,235; loan_interest -$550; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$152; retail_sales $743; fuel_sales $1,760; landing_fees $7,108; landside_fees $7,200; contract_fees $8,007 |
| 27 | building_upkeep -$7,590; payroll -$7,379; land_holding -$4,542; loan_repayment -$4,470; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$800; construction -$700; retail_cogs -$144; catering_fees $132; parking_fees $279; baggage_fees $307; passenger_fees $627; retail_sales $765; landside_fees $2,400; fuel_sales $3,520; contract_fees $9,042; landing_fees $27,052 |
| 28 | construction -$72,352; payroll -$16,566; building_upkeep -$7,590; land_holding -$4,750; loan_repayment -$4,470; fuel_purchase -$1,600; loan_interest -$1,100; penalties -$1,034; retail_cogs -$144; catering_fees $528; parking_fees $1,116; baggage_fees $1,186; passenger_fees $2,226; retail_sales $2,454; fuel_sales $7,040; landside_fees $7,200; landing_fees $11,087; contract_fees $12,147 |
| 29 | payroll -$9,158; building_upkeep -$7,590; land_holding -$4,751; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; retail_cogs -$315; catering_fees $255; baggage_fees $463; parking_fees $540; passenger_fees $1,858; retail_sales $3,251; fuel_sales $3,406; landside_fees $4,800; landing_fees $6,644; contract_fees $9,636 |
| 30 | building_upkeep -$7,590; payroll -$6,375; land_holding -$4,751; loan_repayment -$4,470; construction -$2,800; penalties -$2,500; loan_interest -$1,100; fuel_purchase -$800; security_shock -$800; emergency_refuse -$400; retail_cogs -$294; catering_fees $123; baggage_fees $165; parking_fees $261; passenger_fees $1,395; retail_sales $3,185; fuel_sales $3,406; landside_fees $7,200; landing_fees $7,763; contract_fees $8,713 |
| 31 | building_upkeep -$7,590; land_holding -$4,752; construction -$2,800; loan_repayment -$2,235; payroll -$1,186; loan_interest -$550; fuel_purchase -$400; emergency_refuse -$400; retail_sales $303; fuel_sales $1,760; landside_fees $2,400; landing_fees $7,109; contract_fees $7,678 |
| 32 | building_upkeep -$7,590; land_holding -$4,752; payroll -$4,485; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; security_shock -$800; fuel_purchase -$400; emergency_refuse -$400; retail_sales $35; fuel_sales $1,760; contract_fees $7,678; landing_fees $7,732; landside_fees $9,600 |
| 33 | building_upkeep -$7,590; land_holding -$4,753; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$400; emergency_refuse -$400; retail_sales $30; fuel_sales $1,760; landside_fees $4,800; landing_fees $7,108; contract_fees $7,946 |
| 34 | building_upkeep -$7,590; land_holding -$4,753; loan_repayment -$4,470; construction -$2,800; payroll -$2,418; loan_interest -$1,100; security_shock -$800; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$144; retail_sales $984; fuel_sales $1,760; landing_fees $7,109; landside_fees $7,200; contract_fees $8,063 |
| 35 | building_upkeep -$7,590; payroll -$5,059; land_holding -$4,754; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; security_shock -$800; emergency_refuse -$400; catering_fees $123; baggage_fees $156; parking_fees $261; passenger_fees $1,209; retail_sales $1,287; fuel_sales $3,406; landside_fees $4,800; landing_fees $7,734; contract_fees $9,098 |
| 36 | payroll -$9,094; building_upkeep -$7,590; land_holding -$4,754; construction -$2,800; loan_repayment -$2,235; fuel_purchase -$800; emergency_refuse -$800; security_shock -$800; loan_interest -$550; retail_cogs -$292; catering_fees $123; baggage_fees $173; parking_fees $261; passenger_fees $1,502; fuel_sales $3,406; retail_sales $4,093; landside_fees $4,800; landing_fees $7,761; contract_fees $9,098 |
| 37 | payroll -$8,652; building_upkeep -$7,590; land_holding -$4,755; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$292; catering_fees $246; baggage_fees $307; parking_fees $522; passenger_fees $2,304; retail_sales $3,189; fuel_sales $3,292; landside_fees $4,800; landing_fees $5,123; contract_fees $9,896; level_reward $10,000 |
| 38 | building_upkeep -$7,590; payroll -$6,967; land_holding -$4,755; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; retail_cogs -$606; fuel_purchase -$400; emergency_refuse -$400; catering_fees $123; baggage_fees $165; parking_fees $261; passenger_fees $1,374; fuel_sales $1,646; retail_sales $4,114; landing_fees $4,596; landside_fees $4,800; contract_fees $8,984 |
| 39 | payroll -$7,971; building_upkeep -$7,590; land_holding -$4,756; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$800; catering_fees $123; baggage_fees $165; parking_fees $261; passenger_fees $1,345; retail_sales $1,347; fuel_sales $3,406; landside_fees $4,800; landing_fees $7,763; contract_fees $8,984 |
| 40 | building_upkeep -$7,590; payroll -$6,778; land_holding -$4,756; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; security_shock -$800; fuel_purchase -$400; retail_sales $34; fuel_sales $1,760; landing_fees $7,108; landside_fees $7,200; contract_fees $7,949 |
| 41 | building_upkeep -$7,590; payroll -$7,451; land_holding -$4,757; construction -$2,800; loan_repayment -$2,235; loan_interest -$550; fuel_purchase -$400; emergency_refuse -$400; retail_sales $26; fuel_sales $3,520; landside_fees $4,800; contract_fees $8,039; landing_fees $10,308 |
| 42 | building_upkeep -$7,590; land_holding -$4,757; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; payroll -$649; fuel_purchase -$400; emergency_refuse -$400; retail_sales $51; landing_fees $3,909; contract_fees $7,056; landside_fees $9,600 |
| 43 | building_upkeep -$7,590; land_holding -$4,758; loan_repayment -$4,470; payroll -$3,817; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; fuel_purchase -$400; retail_sales $28; fuel_sales $3,520; landside_fees $4,800; contract_fees $7,056; landing_fees $10,308 |
| 44 | building_upkeep -$7,590; land_holding -$4,758; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$400; emergency_refuse -$400; retail_sales $401; landing_fees $3,908; contract_fees $7,056; landside_fees $9,600 |
| 45 | building_upkeep -$7,590; payroll -$4,977; land_holding -$4,759; loan_repayment -$4,470; construction -$2,800; security_shock -$1,600; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; catering_fees $132; parking_fees $279; baggage_fees $288; retail_sales $697; fuel_sales $3,520; landside_fees $7,200; contract_fees $7,526; landing_fees $9,102 |
| 46 | building_upkeep -$7,590; land_holding -$4,759; construction -$2,800; loan_repayment -$2,235; security_shock -$800; payroll -$769; loan_interest -$550; fuel_purchase -$400; emergency_refuse -$400; retail_sales $36; fuel_sales $1,760; landside_fees $4,800; contract_fees $6,571; landing_fees $7,108 |
| 47 | building_upkeep -$7,590; land_holding -$4,760; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; emergency_refuse -$800; payroll -$755; fuel_purchase -$400; retail_sales $15; fuel_sales $1,760; contract_fees $6,571; landing_fees $7,108; landside_fees $7,200 |
| 48 | building_upkeep -$7,590; land_holding -$4,760; loan_repayment -$4,470; construction -$2,800; security_shock -$1,600; loan_interest -$1,100; fuel_purchase -$400; emergency_refuse -$400; retail_sales $28; fuel_sales $1,760; contract_fees $6,571; landing_fees $7,108; landside_fees $7,200 |
| 49 | building_upkeep -$7,590; land_holding -$4,761; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$400; retail_sales $28; fuel_sales $1,760; landside_fees $4,800; contract_fees $6,600; landing_fees $7,109 |
| 50 | building_upkeep -$7,590; land_holding -$4,761; loan_repayment -$4,470; construction -$2,800; payroll -$2,256; loan_interest -$1,100; fuel_purchase -$400; emergency_refuse -$400; retail_sales $52; fuel_sales $1,760; contract_fees $6,748; landing_fees $7,108; landside_fees $9,600 |
| 51 | payroll -$9,232; building_upkeep -$7,590; land_holding -$4,762; construction -$2,800; loan_repayment -$2,235; fuel_purchase -$800; loan_interest -$550; emergency_refuse -$400; retail_cogs -$144; parking_fees $243; baggage_fees $917; catering_fees $1,022; retail_sales $1,613; fuel_sales $3,293; landside_fees $4,800; contract_fees $7,783; landing_fees $10,176 |
| 52 | building_upkeep -$7,590; land_holding -$4,762; loan_repayment -$4,470; construction -$2,800; payroll -$2,109; loan_interest -$1,100; security_shock -$800; fuel_purchase -$400; emergency_refuse -$400; retail_cogs -$294; fuel_sales $1,760; retail_sales $1,762; landside_fees $4,800; contract_fees $6,748; landing_fees $8,573 |
| 53 | payroll -$10,604; building_upkeep -$7,590; land_holding -$4,763; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; passenger_fees $480; parking_fees $486; baggage_fees $917; catering_fees $1,022; retail_sales $2,379; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,029; landing_fees $12,375 |
| 54 | payroll -$9,884; building_upkeep -$7,590; land_holding -$4,763; loan_repayment -$4,470; construction -$2,800; security_shock -$1,600; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$288; parking_fees $243; passenger_fees $826; baggage_fees $1,492; catering_fees $2,044; fuel_sales $3,066; retail_sales $3,386; landside_fees $4,800; landing_fees $7,942; contract_fees $9,155 |
| 55 | building_upkeep -$7,590; land_holding -$4,764; loan_repayment -$4,470; payroll -$3,724; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$800; retail_cogs -$147; parking_fees $243; retail_sales $340; baggage_fees $565; catering_fees $1,022; landside_fees $2,400; fuel_sales $3,293; contract_fees $8,120; landing_fees $9,915 |
| 56 | payroll -$8,806; building_upkeep -$7,590; land_holding -$4,764; construction -$2,800; loan_repayment -$2,235; fuel_purchase -$800; emergency_refuse -$800; loan_interest -$550; parking_fees $243; baggage_fees $572; catering_fees $1,022; retail_sales $1,111; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,120; landing_fees $9,916 |
| 57 | building_upkeep -$7,590; payroll -$7,509; land_holding -$4,765; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; parking_fees $243; baggage_fees $683; retail_sales $916; catering_fees $1,022; fuel_sales $3,293; landside_fees $4,800; contract_fees $8,379; landing_fees $9,876 |
| 58 | building_upkeep -$7,590; land_holding -$4,765; loan_repayment -$4,470; construction -$2,800; payroll -$1,474; loan_interest -$1,100; security_shock -$800; fuel_purchase -$400; retail_cogs -$144; parking_fees $243; baggage_fees $691; catering_fees $1,022; fuel_sales $1,533; landside_fees $2,400; retail_sales $2,627; landing_fees $6,643; contract_fees $8,321 |
| 59 | payroll -$12,276; building_upkeep -$7,590; land_holding -$4,765; loan_repayment -$4,470; construction -$2,100; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$291; parking_fees $486; passenger_fees $547; baggage_fees $1,406; catering_fees $2,044; retail_sales $2,269; landside_fees $4,800; fuel_sales $4,826; contract_fees $9,356; level_reward $12,000; landing_fees $12,485 |
| 60 | building_upkeep -$7,590; payroll -$7,460; land_holding -$4,766; loan_repayment -$4,470; construction -$2,800; loan_interest -$1,100; fuel_purchase -$800; emergency_refuse -$400; retail_cogs -$144; passenger_fees $227; parking_fees $243; baggage_fees $723; catering_fees $1,022; fuel_sales $1,533; retail_sales $2,445; landside_fees $4,800; landing_fees $6,803; contract_fees $8,321 |

Relations (signed carriers):

| Day | Tier and score |
| --- | --- |
| 0 | — |
| 1 | Puddle Jumper Airlines 1.6 T1 |
| 2 | Puddle Jumper Airlines 2 T1; Zoomjet 1.9 T1 |
| 3 | Puddle Jumper Airlines 3.5 T1; Harbor Heli 1.9 T1; Zoomjet 1.8 T1 |
| 4 | Puddle Jumper Airlines 5.1 T1; Harbor Heli 1.8 T1; Zoomjet 1.6 T1 |
| 5 | Puddle Jumper Airlines 6.7 T1; Island Heli 1.9 T1; Harbor Heli 1.6 T1; Zoomjet 1.5 T1 |
| 6 | Puddle Jumper Airlines 9.1 T1; Island Heli 2 T1; Harbor Heli 1.7 T1; Zoomjet 1.1 T1 |
| 7 | Puddle Jumper Airlines 10.5 T1; Medevac One 2.1 T1; Island Heli 2 T1; Harbor Heli 1.8 T1; Zoomjet 0.8 T1 |
| 8 | Puddle Jumper Airlines 12.9 T1; Medevac One 2.2 T1; Island Heli 2.1 T1; Harbor Heli 1.9 T1; Zoomjet 0.5 T1 |
| 9 | Puddle Jumper Airlines 15.3 T1; Island Heli 2.2 T1; Medevac One 2.2 T1; Harbor Heli 2 T1; Zoomjet 0.2 T1 |
| 10 | Puddle Jumper Airlines 17.6 T1; Island Heli 2.3 T1; Medevac One 2.3 T1; Rotorlink 2.1 T1; Harbor Heli 2 T1; Zoomjet 0.1 T1 |
| 11 | Puddle Jumper Airlines 20 T1; Island Heli 2.4 T1; Medevac One 2.4 T1; Rotorlink 2.2 T1; Harbor Heli 2.1 T1; Zoomjet 0 T1 |
| 12 | Puddle Jumper Airlines 22.3 T2; Medevac One 2.5 T1; Island Heli 2.4 T1; Harbor Heli 2.2 T1; Rotorlink 2.2 T1; Zoomjet -0.1 T1 |
| 13 | Puddle Jumper Airlines 24.7 T2; Medevac One 2.6 T1; Island Heli 2.5 T1; Harbor Heli 2.3 T1; Rotorlink 2.3 T1; Skyline Rescue 2.1 T1; Zoomjet -0.1 T1 |
| 14 | Puddle Jumper Airlines 26.9 T2; Island Heli 2.4 T1; Medevac One 2.4 T1; Harbor Heli 2.2 T1; Rotorlink 2.2 T1; Skyline Rescue 2 T1; Zoomjet -0.3 T1 |
| 15 | Puddle Jumper Airlines 27.8 T2; Island Heli 2.5 T1; Medevac One 2.5 T1; Rotorlink 2.3 T1; Harbor Heli 2.2 T1; SkyCheap 2.1 T1; Skyline Rescue 2 T1; Zoomjet 0.3 T1 |
| 16 | Puddle Jumper Airlines 30.1 T2; Island Heli 2.6 T1; Medevac One 2.6 T1; Rotorlink 2.4 T1; Harbor Heli 2.3 T1; SkyCheap 2.2 T1; Skyline Rescue 2.1 T1; Zoomjet 0.3 T1 |
| 17 | Puddle Jumper Airlines 32.5 T2; Medevac One 2.7 T1; Island Heli 2.6 T1; Harbor Heli 2.4 T1; Rotorlink 2.4 T1; SkyCheap 2.2 T1; Skyline Rescue 2.2 T1; Zoomjet 0.3 T1 |
| 18 | Puddle Jumper Airlines 34.3 T2; Medevac One 2.8 T1; Island Heli 2.7 T1; Harbor Heli 2.5 T1; Rotorlink 2.5 T1; SkyCheap 2.3 T1; Skyline Rescue 2.3 T1; Alpine Swift 2.1 T1; Zoomjet 0.9 T1 |
| 19 | Puddle Jumper Airlines 35.9 T2; Island Heli 2.6 T1; Medevac One 2.6 T1; Harbor Heli 2.4 T1; Rotorlink 2.4 T1; SkyCheap 2.2 T1; Skyline Rescue 2.2 T1; Alpine Swift 2 T1; Zoomjet 1.2 T1 |
| 20 | Puddle Jumper Airlines 38.3 T2; Island Heli 2.7 T1; Medevac One 2.7 T1; Rotorlink 2.5 T1; Harbor Heli 2.4 T1; SkyCheap 2.3 T1; Skyline Rescue 2.2 T1; Alpine Swift 2 T1; Zoomjet 1.2 T1 |
| 21 | Puddle Jumper Airlines 40.6 T2; Harbor Heli 3.5 T1; Island Heli 2.8 T1; Medevac One 2.8 T1; Rotorlink 2.6 T1; SkyCheap 2.4 T1; Skyline Rescue 2.3 T1; Alpine Swift 2.1 T1; Cityhopper 2.1 T1; Zoomjet 1.3 T1 |
| 22 | Puddle Jumper Airlines 43 T2; Harbor Heli 3.6 T1; Medevac One 2.9 T1; Island Heli 2.8 T1; Rotorlink 2.6 T1; SkyCheap 2.4 T1; Skyline Rescue 2.4 T1; Alpine Swift 2.2 T1; Cityhopper 2.2 T1; Zoomjet 1.8 T1 |
| 23 | Puddle Jumper Airlines 44.4 T2; Harbor Heli 4.7 T1; Medevac One 3 T1; Island Heli 2.9 T1; Rotorlink 2.7 T1; SkyCheap 2.5 T1; Skyline Rescue 2.5 T1; Zoomjet 2.4 T1; Alpine Swift 2.3 T1; Cityhopper 2.2 T1; Maple Coastal 2.1 T1 |
| 24 | Puddle Jumper Airlines 46.8 T3; Harbor Heli 6.8 T1; Island Heli 3 T1; Medevac One 3 T1; Zoomjet 2.9 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.6 T1; Alpine Swift 2.4 T1; Cityhopper 2.3 T1; Maple Coastal 2.2 T1 |
| 25 | Puddle Jumper Airlines 49.5 T3; Harbor Heli 7.2 T1; Zoomjet 3.5 T1; Island Heli 3.1 T1; Medevac One 3.1 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.6 T1; Alpine Swift 2.4 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1 |
| 26 | Puddle Jumper Airlines 51.9 T3; Harbor Heli 8.4 T1; Zoomjet 4.1 T1; Island Heli 3.2 T1; Medevac One 3.2 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.7 T1; Alpine Swift 2.5 T1; Cityhopper 2.5 T1; Maple Coastal 2.3 T1; Outback Link 2.1 T1 |
| 27 | Puddle Jumper Airlines 52.8 T3; Harbor Heli 8.8 T1; Zoomjet 4.6 T1; Medevac One 3.3 T1; Island Heli 3.2 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Alpine Swift 2.6 T1; Cityhopper 2.6 T1; Maple Coastal 2.4 T1; Outback Link 2.2 T1 |
| 28 | Puddle Jumper Airlines 56 T3; Harbor Heli 9.2 T1; Zoomjet 5.2 T1; Medevac One 3.4 T1; Island Heli 3.3 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.9 T1; Alpine Swift 2.7 T1; Cityhopper 2.6 T1; Maple Coastal 2.5 T1; Outback Link 2.2 T1 |
| 29 | Puddle Jumper Airlines 62 T3; Harbor Heli 9.6 T1; Zoomjet 5.7 T1; Island Heli 3.4 T1; Medevac One 3.4 T1; Rotorlink 3.2 T1; SkyCheap 3 T1; Skyline Rescue 3 T1; Alpine Swift 2.8 T1; Cityhopper 2.7 T1; Maple Coastal 2.6 T1; Outback Link 2.3 T1; Savanna Air 2.1 T1 |
| 30 | Puddle Jumper Airlines 59.3 T3; Harbor Heli 10.7 T1; Zoomjet 5 T1; Island Heli 3.3 T1; Medevac One 3.3 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.8 T1; Alpine Swift 2.6 T1; Cityhopper 2.6 T1; Maple Coastal 2.4 T1; Outback Link 2.2 T1; Savanna Air 2 T1 |
| 31 | Puddle Jumper Airlines 61.6 T3; Harbor Heli 11.2 T1; Zoomjet 5.6 T1; Island Heli 3.4 T1; Medevac One 3.4 T1; Rotorlink 3.2 T1; SkyCheap 3 T1; Skyline Rescue 2.9 T1; Alpine Swift 2.7 T1; Cityhopper 2.7 T1; Maple Coastal 2.5 T1; Outback Link 2.3 T1; Savanna Air 2 T1 |
| 32 | Puddle Jumper Airlines 63.8 T3; Harbor Heli 13.3 T1; Zoomjet 5.9 T1; Medevac One 3.3 T1; Island Heli 3.2 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Alpine Swift 2.6 T1; Cityhopper 2.6 T1; Maple Coastal 2.4 T1; Outback Link 2.2 T1; Kauri Air 1.9 T1; Savanna Air 1.9 T1 |
| 33 | Puddle Jumper Airlines 66.1 T3; Harbor Heli 13.9 T1; Zoomjet 6.5 T1; Medevac One 3.4 T1; Island Heli 3.3 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.9 T1; Alpine Swift 2.7 T1; Cityhopper 2.6 T1; Maple Coastal 2.5 T1; Outback Link 2.2 T1; Kauri Air 2 T1; Savanna Air 2 T1 |
| 34 | Puddle Jumper Airlines 68.3 T3; Harbor Heli 15.1 T1; Zoomjet 6.8 T1; Island Heli 3.2 T1; Medevac One 3.2 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Alpine Swift 2.6 T1; Cityhopper 2.5 T1; Maple Coastal 2.4 T1; Borneo Wings 2.1 T1; Outback Link 2.1 T1; Savanna Air 1.9 T1; Kauri Air 1.8 T1 |
| 35 | Puddle Jumper Airlines 70.5 T4; Harbor Heli 15.5 T1; Zoomjet 6.6 T1; Island Heli 3.1 T1; Medevac One 3.1 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.6 T1; Alpine Swift 2.4 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Borneo Wings 2 T1; Outback Link 2 T1; Savanna Air 1.8 T1; Kauri Air 1.7 T1 |
| 36 | Puddle Jumper Airlines 72.6 T4; Harbor Heli 15.9 T1; Zoomjet 6.5 T1; Island Heli 3 T1; Medevac One 3 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.5 T1; Alpine Swift 2.3 T1; Cityhopper 2.3 T1; Maple Coastal 2.1 T1; Outback Link 1.9 T1; Borneo Wings 1.8 T1; Kauri Air 1.6 T1; Savanna Air 1.6 T1 |
| 37 | Puddle Jumper Airlines 75 T4; Harbor Heli 16.4 T1; Zoomjet 6.5 T1; Medevac One 3.1 T1; Island Heli 3 T1; Rotorlink 2.8 T1; SkyCheap 2.6 T1; Skyline Rescue 2.6 T1; Alpine Swift 2.4 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Dune Jet 2.1 T1; Outback Link 2 T1; Borneo Wings 1.9 T1; Kauri Air 1.7 T1; Savanna Air 1.7 T1 |
| 38 | Puddle Jumper Airlines 76.4 T4; Harbor Heli 17 T1; Zoomjet 5.9 T1; Medevac One 3.2 T1; Island Heli 3.1 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.7 T1; Alpine Swift 2.5 T1; Cityhopper 2.4 T1; Maple Coastal 2.3 T1; Dune Jet 2.2 T1; Borneo Wings 2 T1; Outback Link 2 T1; Kauri Air 1.8 T1; Savanna Air 1.8 T1 |
| 39 | Puddle Jumper Airlines 78.8 T4; Harbor Heli 17.5 T1; Zoomjet 5.9 T1; Island Heli 4.2 T1; Medevac One 3.2 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Alpine Swift 2.6 T1; Cityhopper 2.5 T1; Maple Coastal 2.4 T1; Dune Jet 2.2 T1; Borneo Wings 2.1 T1; Outback Link 2.1 T1; Savanna Air 1.9 T1; Kauri Air 1.8 T1 |
| 40 | Puddle Jumper Airlines 81 T4; Harbor Heli 17.9 T1; Zoomjet 6.3 T1; Island Heli 5.1 T1; Medevac One 3.1 T1; Rotorlink 2.9 T1; SkyCheap 2.7 T1; Skyline Rescue 2.6 T1; Alpine Swift 2.4 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Dune Jet 2.1 T1; Prestige Air 2.1 T1; Borneo Wings 2 T1; Outback Link 2 T1; Savanna Air 1.8 T1; Kauri Air 1.7 T1 |
| 41 | Puddle Jumper Airlines 83.3 T4; Harbor Heli 18.5 T1; Zoomjet 6.9 T1; Island Heli 5.3 T1; Medevac One 3.2 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.7 T1; Alpine Swift 2.5 T1; Cityhopper 2.5 T1; Maple Coastal 2.3 T1; Dune Jet 2.2 T1; Prestige Air 2.2 T1; Outback Link 2.1 T1; Borneo Wings 2 T1; Kauri Air 1.8 T1; Savanna Air 1.8 T1 |
| 42 | Puddle Jumper Airlines 84.8 T4; Harbor Heli 19 T1; Zoomjet 7.4 T1; Island Heli 6.4 T1; Medevac One 4.2 T1; Rotorlink 3 T1; SkyCheap 2.8 T1; Skyline Rescue 2.8 T1; Alpine Swift 2.6 T1; Cityhopper 2.6 T1; Maple Coastal 2.4 T1; Dune Jet 2.3 T1; Outback Link 2.2 T1; Prestige Air 2.2 T1; Borneo Wings 2.1 T1; Brisa 2.1 T1; Kauri Air 1.9 T1; Savanna Air 1.9 T1 |
| 43 | Puddle Jumper Airlines 87.1 T4; Harbor Heli 19.6 T1; Zoomjet 8 T1; Island Heli 6.7 T1; Medevac One 4.4 T1; Rotorlink 3.1 T1; SkyCheap 2.9 T1; Skyline Rescue 2.9 T1; Alpine Swift 2.7 T1; Cityhopper 2.6 T1; Maple Coastal 2.5 T1; Dune Jet 2.4 T1; Prestige Air 2.3 T1; Borneo Wings 2.2 T1; Brisa 2.2 T1; Outback Link 2.2 T1; Kauri Air 2 T1; Savanna Air 2 T1 |
| 44 | Puddle Jumper Airlines 89.5 T4; Harbor Heli 20.1 T2; Zoomjet 8.5 T1; Island Heli 6.9 T1; Medevac One 6.4 T1; Rotorlink 3.2 T1; SkyCheap 3 T1; Skyline Rescue 3 T1; Alpine Swift 2.8 T1; Cityhopper 2.7 T1; Maple Coastal 2.6 T1; Dune Jet 2.4 T1; Prestige Air 2.4 T1; Borneo Wings 2.3 T1; Outback Link 2.3 T1; Brisa 2.2 T1; Savanna Air 2.1 T1; Kauri Air 2 T1 |
| 45 | Puddle Jumper Airlines 90.9 T5; Harbor Heli 20.3 T2; Zoomjet 8.7 T1; Island Heli 6.8 T1; Medevac One 6.3 T1; Rotorlink 3.8 T1; SkyCheap 2.7 T1; Skyline Rescue 2.6 T1; Alpine Swift 2.4 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Dune Jet 2.1 T1; Prestige Air 2.1 T1; Borneo Wings 2 T1; Outback Link 2 T1; Brisa 1.9 T1; Zephyr Go 1.9 T1; Savanna Air 1.8 T1; Kauri Air 1.7 T1 |
| 46 | Puddle Jumper Airlines 93.1 T5; Harbor Heli 20.7 T2; Zoomjet 9.1 T1; Island Heli 6.9 T1; Medevac One 6.4 T1; Rotorlink 4.7 T1; SkyCheap 2.6 T1; Skyline Rescue 2.5 T1; Alpine Swift 2.3 T1; Cityhopper 2.3 T1; Maple Coastal 2.1 T1; Dune Jet 2 T1; Prestige Air 2 T1; Outback Link 1.9 T1; Borneo Wings 1.8 T1; Brisa 1.8 T1; Zephyr Go 1.8 T1; Kauri Air 1.6 T1; Savanna Air 1.6 T1 |
| 47 | Puddle Jumper Airlines 95.4 T5; Harbor Heli 21.2 T2; Zoomjet 9.6 T1; Island Heli 7.1 T1; Medevac One 6.6 T1; Rotorlink 4.9 T1; SkyCheap 2.6 T1; Skyline Rescue 2.6 T1; Alpine Swift 2.4 T1; Cityhopper 2.4 T1; Maple Coastal 2.2 T1; Dune Jet 2.1 T1; Outback Link 2 T1; Prestige Air 2 T1; Borneo Wings 1.9 T1; Brisa 1.9 T1; Zephyr Go 1.8 T1; Kauri Air 1.7 T1; Savanna Air 1.7 T1 |
| 48 | Puddle Jumper Airlines 97.4 T5; Harbor Heli 21.4 T2; Zoomjet 9.8 T1; Island Heli 7 T1; Medevac One 6.5 T1; Rotorlink 5.7 T1; Skyline Rescue 3.2 T1; SkyCheap 2.3 T1; Alpine Swift 2.1 T1; Cityhopper 2 T1; Maple Coastal 1.9 T1; Dune Jet 1.8 T1; Prestige Air 1.7 T1; Borneo Wings 1.6 T1; Brisa 1.6 T1; Outback Link 1.6 T1; Zephyr Go 1.5 T1; Kauri Air 1.4 T1; Savanna Air 1.4 T1 |
| 49 | Puddle Jumper Airlines 99.8 T5; Harbor Heli 21.9 T2; Zoomjet 10.3 T1; Island Heli 7.2 T1; Medevac One 6.7 T1; Rotorlink 6 T1; Skyline Rescue 3.4 T1; SkyCheap 2.4 T1; Alpine Swift 2.2 T1; Cityhopper 2.1 T1; Maple Coastal 2 T1; Dune Jet 1.8 T1; Prestige Air 1.8 T1; Borneo Wings 1.7 T1; Outback Link 1.7 T1; Brisa 1.6 T1; Zephyr Go 1.6 T1; Savanna Air 1.5 T1; Kauri Air 1.4 T1 |
| 50 | Puddle Jumper Airlines 100 T5; Harbor Heli 22.5 T2; Zoomjet 10.9 T1; Island Heli 7.5 T1; Medevac One 7 T1; Rotorlink 6.2 T1; Skyline Rescue 5.4 T1; SkyCheap 2.5 T1; Alpine Swift 2.2 T1; Cityhopper 2.2 T1; Maple Coastal 2 T1; Dune Jet 1.9 T1; Prestige Air 1.9 T1; Borneo Wings 1.8 T1; Outback Link 1.8 T1; Brisa 1.7 T1; Zephyr Go 1.7 T1; Savanna Air 1.6 T1; Kauri Air 1.5 T1 |
| 51 | Puddle Jumper Airlines 100 T5; Harbor Heli 23.1 T2; Zoomjet 11.5 T1; Island Heli 7.8 T1; Medevac One 7.3 T1; Rotorlink 6.5 T1; Skyline Rescue 5.7 T1; SkyCheap 2.6 T1; Alpine Swift 2.3 T1; Cityhopper 2.3 T1; Maple Coastal 2.1 T1; Dune Jet 2 T1; Prestige Air 2 T1; Outback Link 1.9 T1; Borneo Wings 1.8 T1; Brisa 1.8 T1; Zephyr Go 1.8 T1; Kauri Air 1.6 T1; Savanna Air 1.6 T1 |
| 52 | Puddle Jumper Airlines 100 T5; Harbor Heli 23.4 T2; Zoomjet 11.8 T1; Island Heli 7.8 T1; Medevac One 7.3 T1; Rotorlink 6.5 T1; Skyline Rescue 5.8 T1; Alpine Swift 2.2 T1; Cityhopper 2.2 T1; Maple Coastal 2 T1; SkyCheap 2 T1; Dune Jet 1.9 T1; Outback Link 1.8 T1; Prestige Air 1.8 T1; Borneo Wings 1.7 T1; Brisa 1.7 T1; Zephyr Go 1.6 T1; Kauri Air 1.5 T1; Savanna Air 1.5 T1 |
| 53 | Puddle Jumper Airlines 100 T5; Harbor Heli 24 T2; Zoomjet 12.4 T1; Island Heli 8.1 T1; Medevac One 7.6 T1; Rotorlink 6.8 T1; Skyline Rescue 6 T1; Alpine Swift 2.3 T1; Cityhopper 2.2 T1; Maple Coastal 2.1 T1; Dune Jet 2 T1; Prestige Air 1.9 T1; Borneo Wings 1.8 T1; Brisa 1.8 T1; Outback Link 1.8 T1; Zephyr Go 1.7 T1; Kauri Air 1.6 T1; Savanna Air 1.6 T1; SkyCheap 1.6 T1 |
| 54 | Puddle Jumper Airlines 100 T5; Harbor Heli 24.1 T2; Zoomjet 12.5 T1; Island Heli 7.9 T1; Medevac One 7.4 T1; Rotorlink 6.7 T1; Skyline Rescue 5.9 T1; Cityhopper 1.9 T1; Maple Coastal 1.8 T1; Dune Jet 1.6 T1; Prestige Air 1.6 T1; Alpine Swift 1.5 T1; Borneo Wings 1.5 T1; Outback Link 1.5 T1; Brisa 1.4 T1; Zephyr Go 1.4 T1; Savanna Air 1.3 T1; Kauri Air 1.2 T1; SkyCheap 0.9 T1 |
| 55 | Puddle Jumper Airlines 100 T5; Harbor Heli 24.7 T2; Zoomjet 13.1 T1; Island Heli 8.2 T1; Medevac One 7.7 T1; Rotorlink 6.9 T1; Skyline Rescue 6.1 T1; Cityhopper 2 T1; Maple Coastal 1.8 T1; Dune Jet 1.7 T1; Prestige Air 1.7 T1; Borneo Wings 1.6 T1; Outback Link 1.6 T1; Brisa 1.5 T1; Zephyr Go 1.5 T1; Savanna Air 1.4 T1; Kauri Air 1.3 T1; SkyCheap 1.2 T1; Alpine Swift 1.1 T1 |
| 56 | Puddle Jumper Airlines 100 T5; Harbor Heli 25.3 T2; Zoomjet 13.7 T1; Island Heli 8.5 T1; Medevac One 8 T1; Rotorlink 7.2 T1; Skyline Rescue 6.4 T1; Cityhopper 2.1 T1; Maple Coastal 1.9 T1; Dune Jet 1.8 T1; Prestige Air 1.8 T1; Outback Link 1.7 T1; Borneo Wings 1.6 T1; Brisa 1.6 T1; Zephyr Go 1.6 T1; Kauri Air 1.4 T1; Savanna Air 1.4 T1; SkyCheap 1.4 T1; Alpine Swift 0.8 T1 |
| 57 | Puddle Jumper Airlines 100 T5; Harbor Heli 25.8 T2; Zoomjet 14.2 T1; Island Heli 8.7 T1; Medevac One 8.2 T1; Rotorlink 7.4 T1; Skyline Rescue 6.7 T1; Maple Coastal 2 T1; Dune Jet 1.9 T1; Outback Link 1.8 T1; Prestige Air 1.8 T1; Borneo Wings 1.7 T1; Brisa 1.7 T1; Cityhopper 1.7 T1; SkyCheap 1.7 T1; Zephyr Go 1.6 T1; Kauri Air 1.5 T1; Savanna Air 1.5 T1; Alpine Swift 1.1 T1 |
| 58 | Puddle Jumper Airlines 100 T5; Harbor Heli 26.2 T2; Zoomjet 14.6 T1; Island Heli 8.8 T1; Medevac One 8.3 T1; Rotorlink 7.5 T1; Skyline Rescue 6.7 T1; Maple Coastal 1.9 T1; Dune Jet 1.8 T1; SkyCheap 1.8 T1; Prestige Air 1.7 T1; Borneo Wings 1.6 T1; Brisa 1.6 T1; Outback Link 1.6 T1; Zephyr Go 1.5 T1; Kauri Air 1.4 T1; Savanna Air 1.4 T1; Alpine Swift 1.2 T1; Cityhopper 1.1 T1 |
| 59 | Puddle Jumper Airlines 100 T5; Harbor Heli 26.7 T2; Zoomjet 15.1 T1; Island Heli 9 T1; Medevac One 8.5 T1; Rotorlink 7.8 T1; Skyline Rescue 7 T1; SkyCheap 2 T1; Dune Jet 1.8 T1; Prestige Air 1.8 T1; Borneo Wings 1.7 T1; Outback Link 1.7 T1; Brisa 1.6 T1; Zephyr Go 1.6 T1; Maple Coastal 1.5 T1; Savanna Air 1.5 T1; Alpine Swift 1.4 T1; Kauri Air 1.4 T1; Cityhopper 0.8 T1 |
| 60 | Puddle Jumper Airlines 100 T5; Harbor Heli 27.3 T2; Zoomjet 15.7 T1; Island Heli 9.3 T1; Medevac One 8.8 T1; Rotorlink 8 T1; Skyline Rescue 7.2 T1; SkyCheap 2.3 T1; Dune Jet 1.9 T1; Prestige Air 1.9 T1; Borneo Wings 1.8 T1; Outback Link 1.8 T1; Alpine Swift 1.7 T1; Brisa 1.7 T1; Zephyr Go 1.7 T1; Savanna Air 1.6 T1; Kauri Air 1.5 T1; Cityhopper 1.1 T1; Maple Coastal 1.1 T1 |

Research at day 30: 19 of 62 nodes (31%), earned 1001 RP, room rate sampled with the end-of-run pools. Lab 1 desk / 1 board / 1 bench, researchers 0. Fuel at that sample: tank 80,000 L, logistics not bound, loads 4, grounded 0.

Day-boundary curb pressure first crossed 1 on day 26 (1.1, stalls 3, bays 0, ranks 0, curb lanes 0, carriers 12, flights 94).
Intra-day curb pressure first crossed 1 on day 20 (peak 1).

## Chaotic random clicker (30 days)

First landing LIF102 at 80s. Stands 10, runway strips 1, signed zoomjet, air_regional_1, harbor_heli, island_heli, medevac_one. Taxi-out watchdog recoveries: 0.

| Day | Cash | Rating | Guests | Happy | Taxi-out | Tank L | Loads | Grounded | Curb | Stalls | Lanes | Bays | Ranks | Curb lanes | Check-in peak | Security peak | Carriers | Flights | RP earned | Nodes | Penalty total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | $118,000 | 65 | 0 | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0 |
| 1 | $50,971 | 64 | 0 | — | 0 | 80,000 | 4 | 0 | 0.2 | 3 | 1 | 0 | 0 | 0 | 5 | 5 | 0 | 1 | 6.5 | 2 | -$1,120 |
| 2 | $20,018 | 72 | 18 | 70 | 0 | 80,000 | 4 | 0 | 0.3 | 3 | 1 | 0 | 0 | 0 | 4 | 5 | 1 | 2 | 21.8 | 2 | -$2,600 |
| 3 | $10,990 | 81 | 3 | 49.3 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 7 | 1 | 5 | 36.9 | 2 | -$2,600 |
| 4 | $5,734 | 85 | 18 | 72.1 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 1 | 9 | 39.6 | 3 | -$3,000 |
| 5 | $6,597 | 86 | 36 | 65.3 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 4 | 7 | 1 | 12 | 36.7 | 3 | -$3,400 |
| 6 | $5,776 | 90 | 16 | 75 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 2 | 16 | 41.7 | 6 | -$3,800 |
| 7 | $5,306 | 87 | 17 | 76.5 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 2 | 20 | 39.6 | 6 | -$4,200 |
| 8 | $5,526 | 87 | 8 | 50 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 2 | 23 | 41 | 7 | -$4,600 |
| 9 | $3,830 | 85 | 18 | 66.4 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 2 | 27 | 49.6 | 8 | -$5,400 |
| 10 | $12,941 | 85 | 36 | 67.8 | 0 | 60,000 | 3 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 3 | 6 | 2 | 30 | 56 | 8 | -$6,200 |
| 11 | $8,155 | 83 | 18 | 65.8 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 2 | 35 | 66 | 11 | -$6,600 |
| 12 | $8,387 | 83 | 36 | 71 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 5 | 8 | 2 | 39 | 65.6 | 12 | -$7,000 |
| 13 | $8,448 | 82 | 18 | 65.1 | 0 | 80,000 | 4 | 0 | 0.5 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 3 | 42 | 72.5 | 13 | -$7,400 |
| 14 | $9,157 | 80 | 36 | 67.1 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 3 | 46 | 80 | 14 | -$8,200 |
| 15 | $9,314 | 80 | 18 | 69.4 | 0 | 80,000 | 4 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 3 | 49 | 82.6 | 15 | -$9,400 |
| 16 | $10,934 | 81 | 36 | 67.2 | 0 | 60,000 | 3 | 0 | 0.6 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 3 | 53 | 94.4 | 16 | -$9,800 |
| 17 | $8,395 | 79 | 18 | 72.2 | 0 | 80,000 | 4 | 0 | 0.4 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 3 | 57 | 94.4 | 17 | -$10,200 |
| 18 | $12,542 | 82 | 36 | 64.9 | 0 | 60,000 | 3 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 4 | 60 | 99.4 | 18 | -$11,000 |
| 19 | $15,826 | 82 | 18 | 66.6 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 3 | 7 | 4 | 64 | 103 | 20 | -$11,400 |
| 20 | $11,496 | 80 | 36 | 62.1 | 0 | 60,000 | 3 | 0 | 0.9 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 4 | 67 | 100.3 | 21 | -$12,200 |
| 21 | $10,570 | 78 | 18 | 63.1 | 0 | 80,000 | 4 | 0 | 0.7 | 3 | 1 | 0 | 0 | 0 | 3 | 9 | 4 | 71 | 107.3 | 23 | -$12,600 |
| 22 | $9,595 | 80 | 19 | 70.2 | 0 | 60,000 | 3 | 0 | 1 | 3 | 1 | 0 | 0 | 0 | 4 | 8 | 5 | 74 | 104.4 | 24 | -$13,000 |
| 23 | $9,340 | 79 | 18 | 69.8 | 0 | 80,000 | 4 | 0 | 0.9 | 3 | 1 | 0 | 0 | 0 | 3 | 8 | 5 | 78 | 107.3 | 25 | -$13,800 |
| 24 | $11,766 | 78 | 19 | 71 | 0 | 60,000 | 3 | 0 | 1.1 | 3 | 1 | 0 | 0 | 0 | 4 | 9 | 5 | 82 | 108.4 | 26 | -$16,200 |
| 25 | $12,698 | 76 | 18 | 70.4 | 0 | 80,000 | 4 | 0 | 1 | 3 | 1 | 0 | 0 | 0 | 3 | 6 | 5 | 86 | 119.3 | 27 | -$17,000 |
| 26 | $197,994 | 78 | 15 | 70 | 0 | 60,000 | 3 | 0 | 1.3 | 3 | 1 | 0 | 0 | 0 | 5 | 6 | 5 | 89 | 128.8 | 28 | -$17,800 |
| 27 | $196,477 | 79 | 15 | 68.6 | 0 | 80,000 | 4 | 0 | 1.2 | 3 | 1 | 0 | 0 | 0 | 1 | 4 | 5 | 93 | 129.8 | 29 | -$18,200 |
| 28 | $201,460 | 79 | 0 | — | 0 | 80,000 | 4 | 0 | 1.1 | 3 | 1 | 0 | 0 | 0 | 3 | 5 | 5 | 97 | 129.9 | 31 | -$18,600 |
| 29 | $209,979 | 79 | 0 | — | 0 | 80,000 | 4 | 0 | 1.4 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 5 | 101 | 129.8 | 32 | -$19,800 |
| 30 | $209,834 | 76 | 0 | — | 0 | 80,000 | 4 | 0 | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 104 | 128.6 | 33 | -$20,600 |

Penalty totals are cumulative. Category split at each day:

| Day | Penalties |
| --- | --- |
| 0 | $0 |
| 1 | penalties -$720, emergency_refuse -$400 |
| 2 | penalties -$1,800, emergency_refuse -$800 |
| 3 | penalties -$1,800, emergency_refuse -$800 |
| 4 | penalties -$1,800, emergency_refuse -$1,200 |
| 5 | penalties -$1,800, emergency_refuse -$1,600 |
| 6 | penalties -$1,800, emergency_refuse -$2,000 |
| 7 | penalties -$1,800, emergency_refuse -$2,400 |
| 8 | penalties -$1,800, emergency_refuse -$2,800 |
| 9 | penalties -$1,800, emergency_refuse -$3,600 |
| 10 | penalties -$1,800, emergency_refuse -$4,400 |
| 11 | penalties -$1,800, emergency_refuse -$4,800 |
| 12 | penalties -$1,800, emergency_refuse -$5,200 |
| 13 | penalties -$1,800, emergency_refuse -$5,600 |
| 14 | penalties -$1,800, emergency_refuse -$6,400 |
| 15 | penalties -$1,800, security_shock -$800, emergency_refuse -$6,800 |
| 16 | penalties -$1,800, security_shock -$800, emergency_refuse -$7,200 |
| 17 | penalties -$1,800, security_shock -$800, emergency_refuse -$7,600 |
| 18 | penalties -$1,800, security_shock -$800, emergency_refuse -$8,400 |
| 19 | penalties -$1,800, security_shock -$800, emergency_refuse -$8,800 |
| 20 | penalties -$1,800, security_shock -$800, emergency_refuse -$9,600 |
| 21 | penalties -$1,800, security_shock -$800, emergency_refuse -$10,000 |
| 22 | penalties -$1,800, security_shock -$800, emergency_refuse -$10,400 |
| 23 | penalties -$1,800, security_shock -$800, emergency_refuse -$11,200 |
| 24 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$12,000 |
| 25 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$12,800 |
| 26 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$13,600 |
| 27 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$14,000 |
| 28 | penalties -$1,800, security_shock -$2,400, emergency_refuse -$14,400 |
| 29 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$14,800 |
| 30 | penalties -$1,800, security_shock -$3,200, emergency_refuse -$15,600 |

Ledger by category is cumulative. Change since the previous sampled day:

| Day | Ledger change |
| --- | --- |
| 0 | construction -$95,000; loan_proceeds $45,000 |
| 1 | construction -$56,400; staff_hiring -$10,000; payroll -$4,755; loan_repayment -$1,773; building_upkeep -$1,170; penalties -$720; land_holding -$719; loan_interest -$450; emergency_refuse -$400; fuel_purchase -$400; fuel_sales $2,400; landing_fees $7,358 |
| 2 | construction -$25,900; staff_hiring -$10,000; payroll -$8,585; loan_repayment -$1,773; penalties -$1,080; fuel_purchase -$800; building_upkeep -$746; loan_interest -$450; emergency_refuse -$400; land_holding -$296; baggage_fees $183; parking_fees $261; contract_fees $1,263; passenger_fees $1,397; retail_sales $1,565; landing_fees $4,672; task_rewards $4,800; fuel_sales $4,936 |
| 3 | construction -$20,000; payroll -$11,041; loan_repayment -$1,773; fuel_purchase -$800; building_upkeep -$746; retail_cogs -$510; loan_interest -$450; land_holding -$297; baggage_fees $183; parking_fees $261; passenger_fees $1,388; contract_fees $3,128; retail_sales $3,164; fuel_sales $4,016; landing_fees $4,649; landside_fees $4,800; task_rewards $5,000 |
| 4 | construction -$17,200; payroll -$9,470; loan_repayment -$2,364; building_upkeep -$746; loan_interest -$600; emergency_refuse -$400; fuel_purchase -$400; land_holding -$300; retail_cogs -$294; baggage_fees $183; parking_fees $261; landing_fees $773; passenger_fees $1,397; fuel_sales $2,008; landside_fees $2,400; retail_sales $3,076; contract_fees $3,920; task_rewards $12,500 |
| 5 | construction -$11,400; payroll -$10,160; staff_hiring -$3,200; loan_repayment -$1,773; building_upkeep -$913; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; land_holding -$300; retail_cogs -$288; baggage_fees $377; parking_fees $522; retail_sales $2,946; passenger_fees $2,968; landside_fees $4,800; landing_fees $5,451; fuel_sales $6,024; contract_fees $7,459 |
| 6 | construction -$18,700; payroll -$10,647; loan_repayment -$1,773; building_upkeep -$1,649; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; land_holding -$394; retail_cogs -$296; baggage_fees $199; parking_fees $261; passenger_fees $1,658; level_reward $2,500; retail_sales $2,926; fuel_sales $4,016; landing_fees $4,732; landside_fees $4,800; contract_fees $6,196; task_rewards $7,000 |
| 7 | construction -$7,400; payroll -$5,178; loan_repayment -$1,773; building_upkeep -$1,649; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; land_holding -$394; retail_cogs -$288; baggage_fees $182; parking_fees $261; landing_fees $749; passenger_fees $1,353; fuel_sales $2,008; retail_sales $2,220; landside_fees $4,800; contract_fees $6,289 |
| 8 | construction -$9,400; payroll -$5,487; staff_hiring -$3,200; loan_repayment -$2,026; building_upkeep -$1,691; fuel_purchase -$800; loan_interest -$600; emergency_refuse -$400; land_holding -$398; retail_cogs -$295; baggage_fees $192; parking_fees $261; passenger_fees $1,536; retail_sales $2,710; fuel_sales $4,016; landing_fees $4,673; landside_fees $4,800; contract_fees $6,329 |
| 9 | construction -$11,200; loan_repayment -$1,773; building_upkeep -$1,691; emergency_refuse -$800; loan_interest -$450; fuel_purchase -$400; land_holding -$398; retail_cogs -$288; catering_fees $150; baggage_fees $194; parking_fees $261; landing_fees $802; passenger_fees $1,588; fuel_sales $2,008; landside_fees $2,400; retail_sales $2,954; contract_fees $4,947 |
| 10 | payroll -$11,422; construction -$6,550; loan_repayment -$1,773; building_upkeep -$1,691; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; land_holding -$398; retail_cogs -$296; catering_fees $300; baggage_fees $384; parking_fees $522; passenger_fees $3,089; retail_sales $3,248; landing_fees $5,424; fuel_sales $6,024; contract_fees $7,100; landside_fees $7,200 |
| 11 | construction -$21,200; loan_repayment -$2,364; building_upkeep -$1,691; payroll -$1,419; fuel_purchase -$800; loan_interest -$600; land_holding -$543; emergency_refuse -$400; retail_sales $1,770; fuel_sales $2,008; landing_fees $3,928; level_reward $4,000; landside_fees $4,800; contract_fees $7,725 |
| 12 | construction -$13,850; payroll -$8,619; loan_repayment -$1,773; building_upkeep -$1,691; land_holding -$547; loan_interest -$450; retail_cogs -$441; emergency_refuse -$400; fuel_purchase -$400; catering_fees $300; baggage_fees $389; parking_fees $522; landing_fees $1,540; passenger_fees $3,178; retail_sales $3,375; fuel_sales $4,016; landside_fees $4,800; contract_fees $10,283 |
| 13 | construction -$9,000; building_upkeep -$4,830; loan_repayment -$1,773; land_holding -$1,564; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$156; retail_sales $2,003; fuel_sales $2,008; landside_fees $2,400; landing_fees $3,930; contract_fees $8,693 |
| 14 | construction -$21,200; building_upkeep -$4,830; loan_repayment -$1,773; land_holding -$1,699; payroll -$1,434; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; retail_cogs -$432; catering_fees $246; baggage_fees $300; parking_fees $522; passenger_fees $2,290; retail_sales $3,405; landing_fees $4,418; fuel_sales $4,938; landside_fees $7,200; contract_fees $10,808 |
| 15 | payroll -$8,902; building_upkeep -$4,830; construction -$4,300; loan_repayment -$2,364; land_holding -$1,704; fuel_purchase -$800; security_shock -$800; loan_interest -$600; emergency_refuse -$400; fuel_sales $1,646; retail_sales $2,411; landside_fees $4,800; landing_fees $7,134; contract_fees $8,866 |
| 16 | payroll -$9,040; construction -$7,600; building_upkeep -$4,950; loan_repayment -$1,773; land_holding -$1,704; loan_interest -$450; emergency_refuse -$400; fuel_purchase -$400; retail_cogs -$307; catering_fees $246; baggage_fees $305; parking_fees $522; passenger_fees $2,354; landside_fees $2,400; retail_sales $2,975; fuel_sales $3,292; landing_fees $5,167; contract_fees $10,983 |
| 17 | construction -$11,400; payroll -$5,077; building_upkeep -$4,950; loan_repayment -$1,773; land_holding -$1,716; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; retail_cogs -$304; fuel_sales $1,646; retail_sales $2,736; landside_fees $4,800; landing_fees $7,131; contract_fees $8,019 |
| 18 | construction -$15,200; payroll -$10,678; building_upkeep -$4,950; land_holding -$2,917; loan_repayment -$1,773; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; retail_cogs -$312; catering_fees $246; baggage_fees $306; parking_fees $522; passenger_fees $2,383; retail_sales $3,493; landside_fees $4,800; fuel_sales $4,938; level_reward $6,000; landing_fees $8,368; contract_fees $10,970 |
| 19 | payroll -$9,998; building_upkeep -$4,950; land_holding -$2,917; loan_repayment -$2,364; fuel_purchase -$800; loan_interest -$600; emergency_refuse -$400; retail_cogs -$147; fuel_sales $1,646; retail_sales $2,148; landside_fees $4,800; landing_fees $7,668; contract_fees $9,198 |
| 20 | construction -$14,500; payroll -$9,894; building_upkeep -$5,110; land_holding -$2,919; loan_repayment -$1,773; emergency_refuse -$800; loan_interest -$450; retail_cogs -$432; fuel_purchase -$400; catering_fees $246; baggage_fees $315; parking_fees $522; landside_fees $2,400; passenger_fees $2,540; retail_sales $3,168; fuel_sales $3,292; landing_fees $6,419; contract_fees $13,047 |
| 21 | construction -$13,600; building_upkeep -$5,110; land_holding -$2,942; loan_repayment -$1,773; payroll -$1,163; fuel_purchase -$800; loan_interest -$450; emergency_refuse -$400; fuel_sales $1,646; retail_sales $1,695; landside_fees $4,800; landing_fees $7,129; contract_fees $10,041 |
| 22 | construction -$20,100; building_upkeep -$5,110; payroll -$3,625; land_holding -$2,972; loan_repayment -$2,364; fuel_purchase -$800; loan_interest -$600; emergency_refuse -$400; retail_cogs -$288; baggage_fees $164; parking_fees $522; passenger_fees $2,669; retail_sales $2,836; landside_fees $4,800; fuel_sales $4,938; landing_fees $8,184; contract_fees $11,171 |
| 23 | construction -$12,750; building_upkeep -$5,110; land_holding -$2,985; loan_repayment -$1,773; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; retail_sales $1,456; fuel_sales $1,646; landside_fees $4,800; landing_fees $7,132; contract_fees $9,378 |
| 24 | construction -$19,400; building_upkeep -$5,370; land_holding -$3,011; payroll -$2,778; loan_repayment -$1,773; security_shock -$1,600; emergency_refuse -$800; loan_interest -$450; fuel_purchase -$400; retail_cogs -$291; parking_fees $522; passenger_fees $2,454; retail_sales $3,156; fuel_sales $3,292; landside_fees $4,800; landing_fees $4,807; task_rewards $6,000; contract_fees $13,269 |
| 25 | construction -$9,400; payroll -$5,833; building_upkeep -$5,370; land_holding -$3,022; loan_repayment -$1,773; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$450; fuel_sales $1,646; retail_sales $1,968; landside_fees $4,800; landing_fees $7,831; contract_fees $12,135 |
| 26 | payroll -$11,104; construction -$10,000; building_upkeep -$5,490; land_holding -$3,022; loan_repayment -$1,827; emergency_refuse -$800; fuel_purchase -$800; loan_interest -$550; city_levy -$227; retail_cogs -$144; parking_fees $540; passenger_fees $1,909; retail_sales $3,610; landside_fees $4,800; fuel_sales $5,052; landing_fees $9,100; contract_fees $14,249; loan_proceeds $180,000 |
| 27 | payroll -$11,246; construction -$5,600; building_upkeep -$5,490; loan_repayment -$3,120; land_holding -$3,022; loan_interest -$800; fuel_purchase -$800; emergency_refuse -$400; city_levy -$211; retail_sales $1,320; fuel_sales $1,646; landside_fees $4,800; landing_fees $7,206; contract_fees $14,201 |
| 28 | payroll -$11,246; building_upkeep -$5,490; loan_repayment -$4,680; land_holding -$3,022; construction -$1,800; loan_interest -$1,200; fuel_purchase -$800; emergency_refuse -$400; city_levy -$235; retail_cogs -$148; parking_fees $279; passenger_fees $643; retail_sales $829; fuel_sales $3,406; landside_fees $4,800; landing_fees $8,739; contract_fees $15,308 |
| 29 | payroll -$11,246; building_upkeep -$5,490; loan_repayment -$3,120; land_holding -$3,028; loan_interest -$800; security_shock -$800; emergency_refuse -$400; fuel_purchase -$400; city_levy -$258; parking_fees $279; passenger_fees $643; fuel_sales $1,760; retail_sales $1,787; landing_fees $5,529; landside_fees $7,200; contract_fees $16,863 |
| 30 | payroll -$11,279; construction -$9,550; building_upkeep -$5,490; loan_repayment -$3,120; land_holding -$3,029; loan_interest -$800; emergency_refuse -$800; fuel_purchase -$800; city_levy -$268; retail_sales $54; fuel_sales $3,292; landside_fees $4,800; landing_fees $10,308; contract_fees $16,536 |

Relations (signed carriers):

| Day | Tier and score |
| --- | --- |
| 0 | — |
| 1 | — |
| 2 | Zoomjet 2.1 T1 |
| 3 | Zoomjet 2.1 T1 |
| 4 | Zoomjet 3.8 T1 |
| 5 | Zoomjet 5.8 T1 |
| 6 | Zoomjet 7.7 T1; Puddle Jumper Airlines -0.9 T1 |
| 7 | Zoomjet 9.6 T1; Puddle Jumper Airlines -0.8 T1 |
| 8 | Zoomjet 10.1 T1; Puddle Jumper Airlines -0.8 T1 |
| 9 | Zoomjet 12 T1; Puddle Jumper Airlines -0.7 T1 |
| 10 | Zoomjet 14 T1; Puddle Jumper Airlines -0.6 T1 |
| 11 | Zoomjet 16.8 T1; Puddle Jumper Airlines -0.5 T1 |
| 12 | Zoomjet 18.7 T1; Puddle Jumper Airlines -0.4 T1 |
| 13 | Zoomjet 19.8 T1; Puddle Jumper Airlines -0.4 T1; Harbor Heli -0.9 T1 |
| 14 | Zoomjet 22.6 T2; Puddle Jumper Airlines -0.3 T1; Harbor Heli -0.8 T1 |
| 15 | Zoomjet 23.4 T2; Puddle Jumper Airlines -0.4 T1; Harbor Heli -1 T1 |
| 16 | Zoomjet 25.3 T2; Puddle Jumper Airlines -0.3 T1; Harbor Heli -0.9 T1 |
| 17 | Zoomjet 27.3 T2; Puddle Jumper Airlines -0.2 T1; Harbor Heli -0.8 T1 |
| 18 | Zoomjet 29.2 T2; Island Heli 2.1 T1; Puddle Jumper Airlines -0.2 T1; Harbor Heli -0.7 T1 |
| 19 | Zoomjet 31.1 T2; Island Heli 2.2 T1; Puddle Jumper Airlines -0.1 T1; Harbor Heli -0.6 T1 |
| 20 | Zoomjet 32.2 T2; Island Heli 2.2 T1; Puddle Jumper Airlines 0 T1; Harbor Heli -0.6 T1 |
| 21 | Zoomjet 34.1 T2; Island Heli 2.3 T1; Puddle Jumper Airlines 0.1 T1; Harbor Heli -0.5 T1 |
| 22 | Zoomjet 36 T2; Island Heli 2.4 T1; Medevac One 2.1 T1; Puddle Jumper Airlines 0.2 T1; Harbor Heli -0.4 T1 |
| 23 | Zoomjet 38 T2; Island Heli 2.5 T1; Medevac One 2.2 T1; Puddle Jumper Airlines 0.2 T1; Harbor Heli -0.3 T1 |
| 24 | Zoomjet 39.5 T2; Island Heli 2.2 T1; Medevac One 1.8 T1; Puddle Jumper Airlines -0.1 T1; Harbor Heli -0.6 T1 |
| 25 | Zoomjet 41.4 T2; Island Heli 2.2 T1; Medevac One 1.9 T1; Puddle Jumper Airlines 0 T1; Harbor Heli -0.6 T1 |
| 26 | Zoomjet 43.3 T2; Island Heli 2.3 T1; Medevac One 2 T1; Puddle Jumper Airlines 0.1 T1; Harbor Heli -0.5 T1 |
| 27 | Zoomjet 45.8 T3; Island Heli 2.4 T1; Medevac One 2.1 T1; Puddle Jumper Airlines -0.3 T1; Harbor Heli -0.4 T1 |
| 28 | Zoomjet 48.3 T3; Island Heli 2.5 T1; Medevac One 2.2 T1; Harbor Heli -0.3 T1; Puddle Jumper Airlines -0.6 T1 |
| 29 | Zoomjet 49.7 T3; Island Heli 2.4 T1; Medevac One 2 T1; Harbor Heli 0.5 T1; Puddle Jumper Airlines -1.1 T1 |
| 30 | Zoomjet 52.2 T3; Island Heli 2.4 T1; Medevac One 2.1 T1; Harbor Heli 0.7 T1; Puddle Jumper Airlines -0.8 T1 |

Research at day 30: 33 of 62 nodes (53%), earned 2421.2 RP, room rate sampled with the end-of-run pools. Lab 9 desk / 6 board / 5 bench, researchers 0. Fuel at that sample: tank 80,000 L, logistics not bound, loads 4, grounded 0.

Day-boundary curb pressure first crossed 1 on day 24 (1.1, stalls 3, bays 0, ranks 0, curb lanes 0, carriers 5, flights 82).
Intra-day curb pressure first crossed 1 on day 21 (peak 1.1).
