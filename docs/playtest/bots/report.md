# Hatchfield bot playtest

Generated 2026-10-15T01:01:33.962Z.

Headless bots use the player command API (new game, land, starter kit, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at 5×. One sim day is 180s. Tick dt is 0.25s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful, when the curb pressure is over 1 and cash can cover it, adds a bus bay, then a taxi rank, then a curb lane instead of that day's expansion.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 31.4s wall.

#### Time to first landing

42.5s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $158,421.

`▄▁▁▂▂▂▁▁▁▁▂▂▁▂▂▂▂▃▃▄▄▄▄▄▅▅▅▅▆▆▆▆▆▆▆▆▇▇▆▇▇▇▇███`  $6,176 → $162,581

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 4 | $22,218 |
| 8 | $14,549 |
| 12 | $16,974 |
| 16 | $36,330 |
| 20 | $66,097 |
| 24 | $90,910 |
| 28 | $112,852 |
| 32 | $121,415 |
| 36 | $132,715 |
| 40 | $141,681 |
| 44 | $162,581 |
| 45 | $158,421 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 3.

Recovered:

- PDJ106 taxi_out for 44s step=none cleared at 631s
- PDJ106 stuck on the ground step=none cleared at 634s
- ALS127 taxi_out for 45s step=none cleared at 4276s
- ALS127 stuck on the ground step=none cleared at 4279s
- CHP152 taxi_out for 45s step=none cleared at 7874s
- CHP152 stuck on the ground step=none cleared at 7876s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 67.9.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 14 | 70 | 81 |
| 8 | 18 | 68.9 | 87 |
| 12 | 18 | 68.1 | 87 |
| 16 | 18 | 68.8 | 87 |
| 20 | 12 | 73.5 | 85 |
| 24 | 12 | 76.6 | 86 |
| 28 | 18 | 63.1 | 83 |
| 32 | 15 | 75.6 | 81 |
| 36 | 13 | 74.8 | 84 |
| 40 | 18 | 66.9 | 83 |
| 44 | 0 | — | 80 |
| 45 | 0 | — | 78 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 71.8 | 0 | 13.8s | 0 | 0 |
| 22 | 0 | 1.3s | 0 | 0 |
| 18.5 | 35 | 6431.3s | 1 | 8 |
| 18.3 | 40 | 7306.3s | 0 | 3 |
| 17.7 | 42 | 7656.3s | 1 | 3 |
| 17.6 | 38 | 6956.3s | 2 | 5 |
| 17.2 | 39 | 7131.3s | 2 | 13 |
| 17 | 29 | 5306.3s | 1 | 17 |

#### Anything the bot could not do

2 failed commands.

- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.

Built:

- Runway strips 1, stands 4, terminal tiles 9, snack bars 1
- Shop units 5, leased 5, flights completed 146
- Signed: air_regional_1, zoomjet, alpine_swift, air_lowcost_1, cityhopper, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 2, bagdrop 1, lounge 1, bathroom 3, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 16 points, 24 nodes (airfield-1, terminal-1, airfield-2, airside-1, landside-1, airside-2, landside-2, retail-1, safety-1, retail-2, safety-2, terminal-2, spec-charter, spec-cargo-1, airfield-3, airside-3, landside-3, retail-3, safety-3, spec-cargo-2, terminal-3, airfield-4, airside-4, landside-4).
Desks: 3 agents, check-in empty, security empty.
Queues at the end: check-in 0, security 0. Peaks: check-in 3, security 6.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 0.6 (peak 1), queue 0 (peak 0.2), delay 0s, lanes 2, bus bays 1, curb lanes 1, taxi ranks 1.
Happiness peak 80.5. Guest peak 18. Field-ask fines booked at the full rate: 0. Penalties total $-51,720.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 0.

Measured room rate: 0.1 RP/s from the R&D rooms, on top of 0.009 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.1 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.1 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 63 | 275 | 0 | 0 | 63 | 939 |
| 45 | 16 | 284 | 0 | 0 | 16 | 1438.1 |

End of run: desk 16 balance / 284 earned, Wave 3 0 balance / 0 earned, Growth 16 balance / 1438.1 earned.

Old research desk nodes bought:

- day 3: De-ice ops (deice) for 34 points
- day 4: Hydrant fuel system (hydrant_fuel) for 36 points
- day 15: Belts and sorter (bag_sorter) for 32 points
- day 15: Kiosks and bag drop (self_service) for 22 points
- day 20: Stand classes (stand_class) for 40 points
- day 20: Widebody ops (widebody_ops) for 48 points
- day 35: Travelators (travelator) for 26 points
- day 41: Tank farm II (tank_farm_ii) for 30 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 1: Hall shell (terminal-1) for 0 points
- day 3: De-ice pad (airfield-2) for 76 points
- day 4: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 6: Catering kitchen (airside-2) for 76 points
- day 8: Inn (landside-2) for 76 points
- day 10: Transfer Centre (retail-1) for 0 points
- day 11: ARFF station (safety-1) for 0 points
- day 12: RFID bag line (retail-2) for 76 points
- day 13: Police post (safety-2) for 76 points
- day 15: Processing (terminal-2) for 76 points
- day 17: Specialisation charter (spec-charter) for 0 points
- day 18: Freight shed (spec-cargo-1) for 76 points
- day 20: Large stands (airfield-3) for 86 points
- day 22: GSE depot (airside-3) for 86 points
- day 25: Long-stay park (landside-3) for 86 points
- day 28: Food hall (retail-3) for 86 points
- day 30: Guard lanes (safety-3) for 86 points
- day 33: Night freight (spec-cargo-2) for 86 points
- day 35: Concourse (terminal-3) for 86 points
- day 38: Heavy runway (airfield-4) for 96 points
- day 41: Wide hangar (airside-4) for 96 points
- day 44: Bus station (landside-4) for 96 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| payroll | $-400,633 |
| construction | $-253,000 |
| building_upkeep | $-205,078 |
| land_holding | $-95,959 |
| fuel_purchase | $-31,200 |
| emergency_refuse | $-24,800 |
| penalties | $-22,120 |
| staff_hiring | $-13,600 |
| retail_cogs | $-7,681 |
| security_shock | $-4,800 |
| city_levy | $-259 |
| parking_fees | $11,574 |
| baggage_fees | $16,179 |
| level_reward | $20,500 |
| task_rewards | $35,300 |
| passenger_fees | $37,230 |
| retail_sales | $77,178 |
| fuel_sales | $134,780 |
| landside_fees | $163,200 |
| contract_fees | $243,042 |
| landing_fees | $310,568 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 75.4 | partner | 4 Priority |
| Zoomjet | 12.7 | neutral | 1 Published |
| Alpine Swift | 7.6 | neutral | 1 Published |
| Harbor Heli | 5 | neutral | 1 Published |
| Island Heli | 4 | neutral | 1 Published |
| Medevac One | 3.8 | neutral | 1 Published |
| SkyCheap | 3.7 | neutral | 1 Published |
| Rotorlink | 3.6 | neutral | 1 Published |
| Skyline Rescue | 3.6 | neutral | 1 Published |
| Cityhopper | 2.9 | neutral | 1 Published |


- taxi-out recoveries cleared 3 stalls; teleport entries: 0

### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 54.8s wall.

#### Time to first landing

41.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $20,441.

`▂▂▁▁▁▁▁▁▁▁▁▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁`  $3,531 → $341,789

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 5 | $7,108 |
| 10 | $13,775 |
| 15 | $32,543 |
| 20 | $21,294 |
| 25 | $341,789 |
| 30 | $8,368 |
| 35 | $8,386 |
| 40 | $8,147 |
| 45 | $6,635 |
| 50 | $6,800 |
| 55 | $7,124 |
| 60 | $20,441 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 1.

Recovered:

- PUD260 hold for 86s step=none cleared at 4970s
- PUD260 stuck in the hold step=none cleared at 4971s
- ALS213 taxi_out for 53s step=none cleared at 9833s
- ALS213 stuck on the ground step=none cleared at 9834s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 66.6.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 2 | 63.5 | 80 |
| 10 | 18 | 63.6 | 80 |
| 15 | 17 | 70 | 80 |
| 20 | 18 | 70.6 | 76 |
| 25 | 0 | — | 79 |
| 30 | 2 | 0 | 74 |
| 35 | 2 | 68 | 65 |
| 40 | 0 | — | 67 |
| 45 | 0 | — | 50 |
| 50 | 0 | — | 29 |
| 55 | 1 | 62 | 25 |
| 60 | 14 | 65.8 | 29 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 20.3 | 47 | 8461.3s | 1 | 0 |
| 20.1 | 0 | 13.8s | 0 | 0 |
| 17.5 | 27 | 4860s | 4 | 2 |
| 17 | 54 | 9826.3s | 2 | 5 |
| 16.7 | 53 | 9628.8s | 1 | 18 |
| 15.9 | 22 | 4130s | 0 | 0 |
| 15.8 | 53 | 9590s | 2 | 41 |
| 15.5 | 28 | 5105s | 4 | 40 |

#### Anything the bot could not do

94 failed commands.

- buyParcel ×27 — Parcel locked — reach Field Level 2 first.
- buyResearch ×6 — Already unlocked.
- buyParcel ×5 — Need Industrial plot 1-3 — short 2021.
- buyParcel ×4 — Need Apron plot 3-2 — short 8756.
- buyParcel ×3 — Need Apron plot 3-2 — short 7041.
- buyParcel ×3 — Need Apron plot 3-2 — short 7441.
- buyParcel ×3 — Need Apron plot 3-3 — short 42041.
- buyParcel ×2 — Need Industrial plot 1-3 — short 3680.
- buyParcel ×2 — Need Industrial plot 1-3 — short 1280.
- buyParcel ×2 — Need Industrial plot 1-3 — short 362.
- buyResearch ×2 — Need 86 RP (have 1).
- buyParcel ×2 — Need Apron plot 3-2 — short 5571.
- buyResearch ×2 — Need 96 RP (have 0).
- buyParcel ×2 — Need Apron plot 3-3 — short 42046.
- buyParcel ×2 — Need Apron plot 3-3 — short 42117.
- buyResearch ×1 — Need 76 RP (have 1).
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyResearch ×1 — Need 86 RP (have 4).
- buyParcel ×1 — Need Industrial plot 1-3 — short 2955.
- buyParcel ×1 — Need Industrial plot 1-3 — short 496.
- buyParcel ×1 — Need Apron plot 3-2 — short 8356.
- buyParcel ×1 — Need Apron plot 3-2 — short 8684.
- buyParcel ×1 — Need Apron plot 3-2 — short 8455.
- buyParcel ×1 — Need Apron plot 3-2 — short 5957.
- buyParcel ×1 — Need Apron plot 3-2 — short 10657.
- buyParcel ×1 — Need Apron plot 3-2 — short 11057.
- buyParcel ×1 — Need Apron plot 3-2 — short 8163.
- buyParcel ×1 — Need Apron plot 3-2 — short 6403.
- buyParcel ×1 — Need Apron plot 3-2 — short 6803.
- buyParcel ×1 — Need Apron plot 3-2 — short 4403.
- buyResearch ×1 — Need 86 RP (have 2).
- buyParcel ×1 — Need Apron plot 3-2 — short 4382.
- buyResearch ×1 — Need 86 RP (have 0).
- buyResearch ×1 — Need 96 RP (have 1).
- buyResearch ×1 — Need 100 RP (have 1).
- buyParcel ×1 — Need Apron plot 3-3 — short 43319.
- buyParcel ×1 — Need Apron plot 3-3 — short 41646.
- buyParcel ×1 — Need Apron plot 3-3 — short 39332.
- buyParcel ×1 — Need Apron plot 3-3 — short 37157.

Built:

- Runway strips 1, stands 6, terminal tiles 9, snack bars 2
- Shop units 8, leased 4, flights completed 225
- Signed: air_regional_1, zoomjet, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue, air_lowcost_1, alpine_swift, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, borneo_wings, dune_jet, air_fullservice_1, brisa, zephyr_go
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 98 points, 29 nodes (airfield-1, terminal-1, airside-1, landside-1, airfield-2, airside-2, retail-1, terminal-2, safety-1, landside-2, retail-2, safety-2, spec-charter, spec-cargo-1, airfield-3, airside-3, landside-3, retail-3, safety-3, spec-cargo-2, terminal-3, airfield-4, airside-4, landside-4, retail-4, safety-4, spec-cargo-3, terminal-4, airfield-5).
Desks: 3 agents, check-in empty, security empty.
Queues at the end: check-in 1, security 0. Peaks: check-in 3, security 10.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 2 in use · Queue 3 · wait 10s · Throughput 40.0/min · Lane 1 · queue 3 · wait 10s · in use · Lane 2 · queue 0 · wait 2s · in use
Curb: pressure 4 (peak 4), queue 18.9 (peak 18.9), delay 73s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 81.7. Guest peak 57. Field-ask fines booked at the full rate: 0. Penalties total $-50,134.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 0.

Measured room rate: 0.1 RP/s from the R&D rooms, on top of 0.009 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.1 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.1 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 39 | 339 | 0 | 0 | 39 | 1001 |
| 45 | 87 | 443 | 0 | 0 | 87 | 1509.1 |
| 60 | 98 | 482 | 0 | 0 | 98 | 2004.2 |

End of run: desk 98 balance / 482 earned, Wave 3 0 balance / 0 earned, Growth 98 balance / 2004.2 earned.

Old research desk nodes bought:

- day 2: Hydrant fuel system (hydrant_fuel) for 36 points
- day 3: De-ice ops (deice) for 34 points
- day 7: Belts and sorter (bag_sorter) for 32 points
- day 7: Kiosks and bag drop (self_service) for 22 points
- day 18: Stand classes (stand_class) for 40 points
- day 18: Widebody ops (widebody_ops) for 48 points
- day 25: Transfer Centre (transfer_centre) for 36 points
- day 25: RFID bag line (rfid_bag_line) for 52 points
- day 34: Travelators (travelator) for 26 points
- day 39: Tank farm II (tank_farm_ii) for 30 points
- day 48: Scanner lanes (ct_lanes) for 28 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 2: Fuel farm (airside-1) for 0 points
- day 2: Curb road (landside-1) for 0 points
- day 3: De-ice pad (airfield-2) for 76 points
- day 5: Catering kitchen (airside-2) for 76 points
- day 7: Transfer Centre (retail-1) for 0 points
- day 7: Processing (terminal-2) for 76 points
- day 7: ARFF station (safety-1) for 0 points
- day 9: Inn (landside-2) for 76 points
- day 11: RFID bag line (retail-2) for 76 points
- day 14: Police post (safety-2) for 76 points
- day 14: Specialisation charter (spec-charter) for 0 points
- day 16: Freight shed (spec-cargo-1) for 76 points
- day 18: Large stands (airfield-3) for 86 points
- day 21: GSE depot (airside-3) for 86 points
- day 24: Long-stay park (landside-3) for 86 points
- day 26: Food hall (retail-3) for 86 points
- day 29: Guard lanes (safety-3) for 86 points
- day 31: Night freight (spec-cargo-2) for 86 points
- day 34: Concourse (terminal-3) for 86 points
- day 36: Heavy runway (airfield-4) for 96 points
- day 39: Wide hangar (airside-4) for 96 points
- day 42: Bus station (landside-4) for 96 points
- day 45: Lounge (retail-4) for 96 points
- day 48: Security hall (safety-4) for 96 points
- day 51: Sorter (spec-cargo-3) for 96 points
- day 54: Jet bridge (terminal-4) for 96 points
- day 57: Control tower (airfield-5) for 100 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-858,066 |
| payroll | $-370,564 |
| building_upkeep | $-369,748 |
| land_holding | $-216,322 |
| loan_repayment | $-188,605 |
| loan_interest | $-46,800 |
| fuel_purchase | $-38,000 |
| emergency_refuse | $-28,000 |
| security_shock | $-16,800 |
| staff_hiring | $-14,900 |
| retail_cogs | $-8,570 |
| penalties | $-5,334 |
| city_levy | $-973 |
| parking_fees | $12,618 |
| catering_fees | $16,024 |
| baggage_fees | $16,248 |
| passenger_fees | $37,840 |
| task_rewards | $38,900 |
| level_reward | $42,500 |
| retail_sales | $90,365 |
| fuel_sales | $164,244 |
| landside_fees | $314,400 |
| loan_proceeds | $365,000 |
| landing_fees | $432,552 |
| contract_fees | $484,432 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 100 | partner | 5 Flagship |
| Harbor Heli | 27.3 | warm | 2 Preferred |
| Zoomjet | 15.7 | neutral | 1 Published |
| Island Heli | 9.3 | neutral | 1 Published |
| Medevac One | 8.8 | neutral | 1 Published |
| Rotorlink | 8 | neutral | 1 Published |
| Skyline Rescue | 7.2 | neutral | 1 Published |
| SkyCheap | 2.3 | neutral | 1 Published |
| Dune Jet | 1.9 | neutral | 1 Published |
| Prestige Air | 1.9 | neutral | 1 Published |
| Borneo Wings | 1.8 | neutral | 1 Published |
| Outback Link | 1.8 | neutral | 1 Published |
| Alpine Swift | 1.7 | neutral | 1 Published |
| Brisa | 1.7 | neutral | 1 Published |
| Zephyr Go | 1.7 | neutral | 1 Published |
| Savanna Air | 1.6 | neutral | 1 Published |
| Kauri Air | 1.5 | neutral | 1 Published |
| Cityhopper | 1.1 | neutral | 1 Published |
| Maple Coastal | 1.1 | neutral | 1 Published |


- taxi-out recoveries cleared 1 stalls; teleport entries: 0

### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 21.8s wall.

#### Time to first landing

80s (day 0) — LIF102 entered landing.

#### Cash curve

Start $168,000 · end $209,834.

`▅▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████`  $3,830 → $209,979

| Day | Cash |
| --- | --- |
| 0 | $118,000 |
| 3 | $10,990 |
| 6 | $5,776 |
| 9 | $3,830 |
| 12 | $8,387 |
| 15 | $9,314 |
| 18 | $12,542 |
| 21 | $10,570 |
| 24 | $11,766 |
| 27 | $196,477 |
| 30 | $209,834 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 67.2.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 3 | 49.3 | 81 |
| 6 | 16 | 75 | 90 |
| 9 | 18 | 66.4 | 85 |
| 12 | 36 | 71 | 83 |
| 15 | 18 | 69.4 | 80 |
| 18 | 36 | 64.9 | 82 |
| 21 | 18 | 63.1 | 78 |
| 24 | 19 | 71 | 78 |
| 27 | 15 | 68.6 | 79 |
| 30 | 0 | — | 76 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 24.2 | 29 | 5298.8s | 1 | 0 |
| 20.4 | 26 | 4751.3s | 2 | 15 |
| 19.7 | 0 | 38.8s | 0 | 0 |
| 17.8 | 11 | 2006.3s | 2 | 34 |
| 17.4 | 20 | 3685s | 1 | 9 |
| 17.2 | 21 | 3867.5s | 2 | 2 |
| 17 | 29 | 5390s | 1 | 0 |
| 16.7 | 24 | 4446.3s | 1 | 0 |

#### Anything the bot could not do

23 failed commands.

- hireJanitor ×15 — Janitor crew maxed (6).
- hireJanitor ×1 — Need hire janitor — short 965.
- hireJanitor ×1 — Need hire janitor — short 863.
- hireJanitor ×1 — Need hire janitor — short 1202.
- buyRoom ×1 — Need Research desk — short 739.
- buyRoom ×1 — Need Airline lounge — short 2680.
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyRoom ×1 — Need Lab bench — short 1542.

Built:

- Runway strips 1, stands 10, terminal tiles 17, snack bars 8
- Shop units 18, leased 18, flights completed 104
- Signed: zoomjet, air_regional_1, harbor_heli, island_heli, medevac_one
- Rooms: checkin 6, security 9, gate 13, bagclaim 1, food 5, souvenir 5, bagdrop 1, lounge 2, bathroom 4, rdesk 9, rboard 6, rmachine 5

#### New systems

Research tree: 115 points, 33 nodes (airfield-1, terminal-1, airfield-2, airside-1, landside-1, airside-2, landside-2, terminal-2, retail-1, safety-1, retail-2, safety-2, airfield-3, airside-3, landside-3, retail-3, safety-3, terminal-3, spec-charter, spec-cargo-1, spec-cargo-2, airfield-4, airside-4, landside-4, retail-4, safety-4, spec-cargo-3, terminal-4, airfield-5, airside-5, landside-5, retail-5, safety-5).
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 1, security 7.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 2 (peak 2), queue 1.4 (peak 2.1), delay 180s, lanes 0, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 76.5. Guest peak 36. Field-ask fines booked at the full rate: 0. Penalties total $-20,600.

#### Research pools

Lab furniture at the end: 9 research desks, 6 chalkboards, 5 lab benches. Researchers on payroll: 0.

Measured room rate: 0.67 RP/s from the R&D rooms, on top of 0.009 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 0 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.06 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.06 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 115 | 525 | 0 | 0 | 115 | 2421.2 |

End of run: desk 115 balance / 525 earned, Wave 3 0 balance / 0 earned, Growth 115 balance / 2421.2 earned.

Old research desk nodes bought:

- day 3: De-ice ops (deice) for 34 points
- day 5: Hydrant fuel system (hydrant_fuel) for 36 points
- day 8: Belts and sorter (bag_sorter) for 32 points
- day 8: Kiosks and bag drop (self_service) for 22 points
- day 12: Stand classes (stand_class) for 40 points
- day 12: Widebody ops (widebody_ops) for 48 points
- day 17: Travelators (travelator) for 26 points
- day 20: Tank farm II (tank_farm_ii) for 30 points
- day 23: Scanner lanes (ct_lanes) for 28 points
- day 27: Hangar MRO (mro_hangar) for 72 points
- day 29: Military ramp (mil_ramp) for 42 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 3: De-ice pad (airfield-2) for 76 points
- day 5: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 5: Catering kitchen (airside-2) for 76 points
- day 7: Inn (landside-2) for 76 points
- day 8: Processing (terminal-2) for 76 points
- day 10: Transfer Centre (retail-1) for 0 points
- day 10: ARFF station (safety-1) for 0 points
- day 10: RFID bag line (retail-2) for 76 points
- day 11: Police post (safety-2) for 76 points
- day 12: Large stands (airfield-3) for 86 points
- day 13: GSE depot (airside-3) for 86 points
- day 14: Long-stay park (landside-3) for 86 points
- day 15: Food hall (retail-3) for 86 points
- day 16: Guard lanes (safety-3) for 86 points
- day 17: Concourse (terminal-3) for 86 points
- day 18: Specialisation charter (spec-charter) for 0 points
- day 18: Freight shed (spec-cargo-1) for 76 points
- day 19: Night freight (spec-cargo-2) for 86 points
- day 20: Heavy runway (airfield-4) for 96 points
- day 20: Wide hangar (airside-4) for 96 points
- day 21: Bus station (landside-4) for 96 points
- day 22: Lounge (retail-4) for 96 points
- day 23: Security hall (safety-4) for 96 points
- day 24: Sorter (spec-cargo-3) for 96 points
- day 25: Jet bridge (terminal-4) for 96 points
- day 26: Control tower (airfield-5) for 100 points
- day 27: MRO bay (airside-5) for 100 points
- day 27: Rail spur (landside-5) for 100 points
- day 28: Seating (retail-5) for 100 points
- day 29: Incident drill (safety-5) for 100 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-499,600 |
| payroll | $-211,326 |
| building_upkeep | $-108,994 |
| loan_repayment | $-63,400 |
| land_holding | $-52,179 |
| staff_hiring | $-26,400 |
| fuel_purchase | $-20,800 |
| loan_interest | $-16,300 |
| emergency_refuse | $-15,600 |
| retail_cogs | $-5,957 |
| security_shock | $-3,200 |
| penalties | $-1,800 |
| city_levy | $-1,199 |
| catering_fees | $1,734 |
| baggage_fees | $3,856 |
| parking_fees | $7,623 |
| level_reward | $12,500 |
| task_rewards | $35,300 |
| passenger_fees | $37,437 |
| retail_sales | $71,004 |
| fuel_sales | $95,210 |
| landside_fees | $129,600 |
| landing_fees | $170,951 |
| loan_proceeds | $225,000 |
| contract_fees | $278,374 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Zoomjet | 52.2 | warm | 3 Trusted |
| Island Heli | 2.4 | neutral | 1 Published |
| Medevac One | 2.1 | neutral | 1 Published |
| Harbor Heli | 0.7 | neutral | 1 Published |
| Puddle Jumper Airlines | -0.8 | neutral | 1 Published |


- Driver put the clock back to 5× after the persona touched the speed buttons.
- taxi-out recoveries cleared 0 stalls; teleport entries: 0

## Browser smoke

Skipped. Headless measurement only. Browser smoke was not repeated.
