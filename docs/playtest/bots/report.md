# Hatchfield bot playtest

Generated 2026-10-15T03:09:40.765Z.

Headless bots use the player command API (new game, land, starter kit, the Apex Local fuel term, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at 5×. One sim day is 180s. Tick dt is 0.25s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. Careful and Greedy then hire one researcher. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful and Greedy, once cash is above three times the stamp and the airfield says Over the runway or curb or stand pressure is above 1, build a second runway and two more stands. Careful, when that expansion is not affordable and the curb pressure is over 1, adds a bus bay, then a taxi rank, then a curb lane instead of that day's other stamp.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 47.6s wall.

Flights 185 (4.1/day). Diverts 17 (connection diverts 24). Go-arounds 28. Missed-connection cash -$44,640. Curb crossed 1 on day 18. Fuel groundings 0. Tree complete day —. Preferred day 13, Trusted day 25. Hub checklist station from day 1.

#### Time to first landing

42.5s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $202,387.

`▃▁▂▂▁▁▁▂▂▂▂▂▂▂▂▃▃▃▃▄▄▄▅▅▅▅▅▅▆▆▆▆▇▅▅▆▆▆▆▆▇▇▇▇██`  $2,469 → $211,858

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 4 | $16,192 |
| 8 | $25,365 |
| 12 | $30,350 |
| 16 | $55,108 |
| 20 | $93,680 |
| 24 | $107,815 |
| 28 | $154,923 |
| 32 | $168,743 |
| 36 | $153,624 |
| 40 | $178,080 |
| 44 | $211,858 |
| 45 | $202,387 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 3.

Recovered:

- LIF171 taxi_out for 43s step=none cleared at 1708s
- LIF171 stuck on the ground step=none cleared at 1709s
- PUD247 hold for 90s step=none cleared at 5154s
- PUD247 stuck in the hold step=none cleared at 5156s
- PDJ140 taxi_out for 46s step=none cleared at 5686s
- PDJ140 stuck on the ground step=none cleared at 5689s
- ALS142 taxi_out for 41s step=none cleared at 6025s
- ZO275 hold for 95s step=none cleared at 6516s
- ZO275 stuck in the hold step=none cleared at 6519s
- ALS283 hold for 95s step=none cleared at 6963s
- ALS283 stuck in the hold step=none cleared at 6964s
- ALS147 hold for 95s step=none cleared at 7099s
- … 7 more

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 61.2.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 11 | 70 | 82 |
| 8 | 18 | 69.5 | 86 |
| 12 | 18 | 68.6 | 84 |
| 16 | 15 | 75 | 83 |
| 20 | 5 | 70 | 82 |
| 24 | 1 | 61 | 80 |
| 28 | 2 | 62.5 | 76 |
| 32 | 2 | 75.5 | 77 |
| 36 | 67 | 53.5 | 75 |
| 40 | 106 | 34 | 64 |
| 44 | 84 | 37.8 | 65 |
| 45 | 64 | 31.9 | 63 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 67.5 | 0 | 13.8s | 0 | 0 |
| 37.7 | 42 | 7593.8s | 4 | 37 |
| 31.4 | 42 | 7618.8s | 4 | 43 |
| 30.3 | 40 | 7218.8s | 4 | 88 |
| 28.3 | 41 | 7393.8s | 4 | 72 |
| 27.9 | 40 | 7243.8s | 4 | 79 |
| 27.4 | 43 | 7918.8s | 5 | 88 |
| 27 | 39 | 7168.8s | 1 | 88 |

#### Anything the bot could not do

6 failed commands.

- stamp ×4 — runway: That strip sits inside runway clearance. Leave the shoulder empty.
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.

Built:

- Runway strips 2, stands 6, terminal tiles 9, snack bars 1
- Shop units 5, leased 5, flights completed 185
- Signed: air_regional_1, zoomjet, alpine_swift, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue, air_lowcost_1, cityhopper
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 2, bagdrop 1, lounge 1, bathroom 3, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 151 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airside-1, landside-1, airside-2, landside-2, airfield-3, retail-1, safety-1, retail-2, safety-2, airside-3, landside-3, spec-charter, spec-cargo-1, retail-3, safety-3, spec-cargo-2, terminal-3, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, airfield-4, airside-4, landside-4, retail-4, safety-4, spec-cargo-3, terminal-4, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, airfield-5, airside-5, landside-5, retail-5, safety-5, spec-cargo-4, terminal-5, spec-green-3, spec-hub-3).
Desks: 3 agents, check-in empty, security empty.
Queues at the end: check-in 0, security 0. Peaks: check-in 2, security 18.
Check-in: Check-in · 2 of 2 desks staffed · 2 in use · Queue 3 · wait 21s · Throughput 25.8/min · Desk 1 · queue 1 · wait 21s · in use · Desk 2 · queue 2 · wait 19s · in use
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 1 (peak 1.4), queue 0.5 (peak 2.1), delay 2s, lanes 2, bus bays 1, curb lanes 1, taxi ranks 1.
Happiness peak 79.1. Guest peak 106. Field-ask fines booked at the full rate: 0. Penalties total $-163,470.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 108 | 404 | 0 | 0 | 108 | 982 |
| 45 | 151 | 595 | 0 | 0 | 151 | 2055.93 |

End of run: desk 151 balance / 595 earned, Wave 3 0 balance / 0 earned, Growth 151 balance / 2055.93 earned.

Old research desk nodes bought:

- day 2: De-ice ops (deice) for 34 points
- day 3: Belts and sorter (bag_sorter) for 32 points
- day 3: Kiosks and bag drop (self_service) for 22 points
- day 4: Hydrant fuel system (hydrant_fuel) for 36 points
- day 8: Stand classes (stand_class) for 40 points
- day 8: Widebody ops (widebody_ops) for 48 points
- day 20: Travelators (travelator) for 26 points
- day 26: Tank farm II (tank_farm_ii) for 30 points
- day 29: Scanner lanes (ct_lanes) for 28 points
- day 37: Hangar MRO (mro_hangar) for 72 points
- day 40: Military ramp (mil_ramp) for 42 points
- day 42: Skywalks (skywalk) for 34 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 1: Hall shell (terminal-1) for 0 points
- day 2: De-ice pad (airfield-2) for 26 points
- day 3: Processing (terminal-2) for 26 points
- day 4: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 6: Catering kitchen (airside-2) for 26 points
- day 7: Inn (landside-2) for 26 points
- day 8: Large stands (airfield-3) for 38 points
- day 9: Transfer Centre (retail-1) for 0 points
- day 10: ARFF station (safety-1) for 0 points
- day 11: RFID bag line (retail-2) for 26 points
- day 12: Police post (safety-2) for 26 points
- day 13: GSE depot (airside-3) for 38 points
- day 14: Long-stay park (landside-3) for 38 points
- day 15: Specialisation charter (spec-charter) for 0 points
- day 16: Freight shed (spec-cargo-1) for 26 points
- day 17: Food hall (retail-3) for 38 points
- day 18: Guard lanes (safety-3) for 38 points
- day 19: Night freight (spec-cargo-2) for 38 points
- day 20: Concourse (terminal-3) for 38 points
- day 21: SAF blend (spec-green-1) for 39 points
- day 22: Transfer bank (spec-hub-1) for 39 points
- day 23: Fast turn (spec-lowcost-1) for 39 points
- day 24: Premium lane (spec-premium-1) for 39 points
- day 25: Heavy runway (airfield-4) for 54 points
- day 26: Wide hangar (airside-4) for 54 points
- day 27: Bus station (landside-4) for 54 points
- day 28: Lounge (retail-4) for 54 points
- day 29: Security hall (safety-4) for 54 points
- day 30: Sorter (spec-cargo-3) for 54 points
- day 31: Jet bridge (terminal-4) for 54 points
- day 32: Quiet hours (spec-green-2) for 57 points
- day 33: Wave scheduling (spec-hub-2) for 57 points
- day 34: Remote stand (spec-lowcost-2) for 57 points
- day 35: Fast track (spec-premium-2) for 57 points
- day 36: Control tower (airfield-5) for 76 points
- day 37: MRO bay (airside-5) for 76 points
- day 38: Rail spur (landside-5) for 76 points
- day 39: Seating (retail-5) for 76 points
- day 40: Incident drill (safety-5) for 76 points
- day 41: Freighter stand (spec-cargo-4) for 76 points
- day 42: Skywalk (terminal-5) for 76 points
- day 43: Electric GSE (spec-green-3) for 81 points
- day 44: Minimum connect (spec-hub-3) for 81 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| payroll | $-516,056 |
| construction | $-306,900 |
| building_upkeep | $-221,714 |
| land_holding | $-106,268 |
| penalties | $-92,430 |
| fuel_purchase | $-56,760 |
| missed_connection | $-44,640 |
| loan_repayment | $-26,400 |
| staff_hiring | $-18,400 |
| emergency_refuse | $-17,600 |
| retail_cogs | $-12,776 |
| security_shock | $-8,800 |
| loan_interest | $-7,040 |
| city_levy | $-2,101 |
| parking_fees | $22,707 |
| loan_proceeds | $25,000 |
| level_reward | $30,500 |
| task_rewards | $38,900 |
| baggage_fees | $42,199 |
| passenger_fees | $64,104 |
| retail_sales | $130,240 |
| fuel_sales | $182,357 |
| landside_fees | $261,600 |
| contract_fees | $282,718 |
| landing_fees | $391,947 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 71.9 | partner | 4 Priority |
| Harbor Heli | 21.5 | warm | 2 Preferred |
| Rotorlink | 16 | neutral | 1 Published |
| Island Heli | 15.8 | neutral | 1 Published |
| Skyline Rescue | 13.3 | neutral | 1 Published |
| Medevac One | 11.7 | neutral | 1 Published |
| SkyCheap | -6.6 | neutral | 1 Published |
| Zoomjet | -21.3 | neutral | 1 Published |
| Cityhopper | -44.6 | cold | 1 Published |
| Alpine Swift | -48.6 | cold | 1 Published |


- taxi-out recoveries cleared 3 stalls; teleport entries: 0

### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 96.8s wall.

Flights 222 (3.7/day). Diverts 3 (connection diverts 1). Go-arounds 8. Missed-connection cash -$1,860. Curb crossed 1 on day 20. Fuel groundings 0. Tree complete day 51. Preferred day 18, Trusted day 37. Hub checklist station from day 1.

#### Time to first landing

41.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $33,924.

`▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▂▂▂▂▁▁▁▁▂▂▂`  $5,658 → $350,200

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 5 | $7,068 |
| 10 | $17,971 |
| 15 | $11,402 |
| 20 | $19,478 |
| 25 | $350,200 |
| 30 | $8,704 |
| 35 | $14,855 |
| 40 | $48,354 |
| 45 | $44,212 |
| 50 | $17,690 |
| 55 | $35,165 |
| 60 | $33,924 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 3.

Recovered:

- LIF103 taxi_out for 41s step=none cleared at 265s
- LIF318 taxi_out for 43s step=none cleared at 8163s
- LIF318 stuck on the ground step=none cleared at 8164s
- LIF328 taxi_out for 41s step=none cleared at 8710s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 65.3.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 3 | 65.7 | 81 |
| 10 | 13 | 70 | 76 |
| 15 | 13 | 64.2 | 75 |
| 20 | 3 | 66.3 | 72 |
| 25 | 30 | 68.5 | 74 |
| 30 | 40 | 65.6 | 70 |
| 35 | 6 | 73.7 | 67 |
| 40 | 15 | 67.3 | 66 |
| 45 | 0 | — | 54 |
| 50 | 25 | 42.6 | 61 |
| 55 | 25 | 76.2 | 59 |
| 60 | 11 | 57.4 | 53 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 102 | 47 | 8522.5s | 1 | 12 |
| 86.6 | 48 | 8688.8s | 3 | 45 |
| 63.3 | 53 | 9651.3s | 1 | 0 |
| 63.3 | 59 | 10666.3s | 3 | 16 |
| 58.1 | 57 | 10433.8s | 2 | 29 |
| 58.1 | 58 | 10440s | 3 | 8 |
| 56.1 | 58 | 10482.5s | 2 | 1 |
| 54.7 | 44 | 8035s | 1 | 0 |

#### Anything the bot could not do

245 failed commands.

- buyResearch ×11 — Already unlocked.
- buyParcel ×7 — Parcel locked — reach Field Level 2 first.
- buyParcel ×5 — Need Fringe plot 2-4 — short 49074.
- buyParcel ×4 — Need Apron plot 3-3 — short 22586.
- buyParcel ×4 — Need Apron plot 3-3 — short 23371.
- buyParcel ×4 — Need Apron plot 3-3 — short 28576.
- buyResearch ×3 — Need 76 RP (have 4).
- buyParcel ×3 — Need Apron plot 3-3 — short 25371.
- buyParcel ×3 — Need Apron plot 3-3 — short 31761.
- buyParcel ×3 — Need Apron plot 3-3 — short 29361.
- buyParcel ×3 — Need Fringe plot 2-4 — short 45473.
- buyParcel ×3 — Need Fringe plot 2-4 — short 41339.
- buyParcel ×3 — Need Fringe plot 2-4 — short 35051.
- buyParcel ×3 — Need Fringe plot 2-4 — short 35460.
- buyParcel ×3 — Need Fringe plot 2-4 — short 34572.
- buyResearch ×2 — Need 108 RP (have 2).
- buyParcel ×2 — Need Apron plot 3-3 — short 19407.
- buyParcel ×2 — Need Apron plot 3-3 — short 17677.
- buyParcel ×2 — Need Apron plot 3-3 — short 13287.
- buyParcel ×2 — Need Apron plot 3-3 — short 16759.
- buyParcel ×2 — Need Apron plot 3-3 — short 30976.
- buyParcel ×2 — Need Fringe plot 2-4 — short 45571.
- buyParcel ×2 — Need Fringe plot 2-4 — short 48126.
- buyParcel ×2 — Need Fringe plot 2-4 — short 44632.
- buyParcel ×2 — Need Fringe plot 2-4 — short 42232.
- buyParcel ×2 — Need Fringe plot 2-4 — short 38316.
- buyParcel ×2 — Need Fringe plot 2-4 — short 35302.
- buyParcel ×2 — Need Fringe plot 2-4 — short 32275.
- buyResearch ×1 — Need 76 RP (have 3).
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyResearch ×1 — Need 54 RP (have 2).
- buyParcel ×1 — Need Industrial plot 1-3 — short 542.
- buyParcel ×1 — Need Apron plot 3-2 — short 3166.
- buyParcel ×1 — Need Apron plot 3-2 — short 3094.
- buyParcel ×1 — Need Apron plot 3-2 — short 502.
- buyParcel ×1 — Need Apron plot 3-2 — short 37.
- buyResearch ×1 — Need 108 RP (have 0).
- buyResearch ×1 — Need 108 RP (have 4).
- buyResearch ×1 — Need 108 RP (have 5).

Built:

- Runway strips 1, stands 8, terminal tiles 9, snack bars 2
- Shop units 8, leased 7, flights completed 222
- Signed: air_regional_1, zoomjet, alpine_swift, air_lowcost_1, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, borneo_wings, dune_jet, air_fullservice_1, brisa, zephyr_go, tango_air, rio_sol, andaman_hop, mekong_express, pampas_air
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 324 points, 62 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airfield-5, airside-5, landside-5, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, retail-5, safety-5, terminal-5, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-cargo-4, spec-green-3, spec-hub-3, spec-lowcost-3, spec-premium-3, airfield-6, airside-6, landside-6, retail-6, safety-6, spec-cargo-5, terminal-6, spec-green-4, spec-hub-4, spec-lowcost-4, spec-premium-4, spec-green-5, spec-hub-5, spec-lowcost-5, spec-premium-5).
Desks: 3 agents, check-in empty, security staffed.
Queues at the end: check-in 2, security 1. Peaks: check-in 5, security 9.
Check-in: Check-in · 2 of 2 desks staffed · 2 in use · Queue 1 · wait 6s · Throughput 25.8/min · Desk 1 · queue 1 · wait 6s · in use · Desk 2 · queue 0 · wait 4s · in use
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 4 (peak 4.2), queue 18 (peak 19.4), delay 69s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 78.8. Guest peak 43. Field-ask fines booked at the full rate: 0. Penalties total $-129,524.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 45 | 818 | 0 | 0 | 45 | 2327.23 |
| 45 | 77 | 1000 | 0 | 0 | 77 | 3517.43 |
| 60 | 324 | 1247 | 0 | 0 | 324 | 4250.54 |

End of run: desk 324 balance / 1247 earned, Wave 3 0 balance / 0 earned, Growth 324 balance / 4250.54 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 1: Stand classes (stand_class) for 40 points
- day 1: Widebody ops (widebody_ops) for 48 points
- day 2: Travelators (travelator) for 26 points
- day 4: Hydrant fuel system (hydrant_fuel) for 36 points
- day 6: Tank farm II (tank_farm_ii) for 30 points
- day 8: Hangar MRO (mro_hangar) for 72 points
- day 12: Scanner lanes (ct_lanes) for 28 points
- day 14: Military ramp (mil_ramp) for 42 points
- day 15: Skywalks (skywalk) for 34 points
- day 25: Transfer Centre (transfer_centre) for 36 points
- day 25: RFID bag line (rfid_bag_line) for 52 points
- day 28: Heavy metal pack (heavy_pack) for 55 points
- day 28: Tank farm III (tank_farm_iii) for 46 points
- day 29: Night bank (night_bank) for 28 points
- day 29: Fuel rail (rail_fuel) for 44 points
- day 29: Cargo night hub (cargo_night_hub) for 68 points
- day 33: E-gates (egates) for 40 points
- day 36: Automated baggage (bag_bhs) for 58 points
- day 36: People mover (people_mover) for 52 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 1: De-ice pad (airfield-2) for 26 points
- day 1: Processing (terminal-2) for 26 points
- day 1: Large stands (airfield-3) for 38 points
- day 2: Concourse (terminal-3) for 38 points
- day 3: Heavy runway (airfield-4) for 54 points
- day 3: Jet bridge (terminal-4) for 54 points
- day 4: Fuel farm (airside-1) for 0 points
- day 4: Curb road (landside-1) for 0 points
- day 4: Catering kitchen (airside-2) for 26 points
- day 4: Inn (landside-2) for 26 points
- day 4: GSE depot (airside-3) for 38 points
- day 5: Long-stay park (landside-3) for 38 points
- day 6: Wide hangar (airside-4) for 54 points
- day 6: Bus station (landside-4) for 54 points
- day 7: Control tower (airfield-5) for 76 points
- day 8: MRO bay (airside-5) for 76 points
- day 9: Rail spur (landside-5) for 76 points
- day 9: Transfer Centre (retail-1) for 0 points
- day 9: ARFF station (safety-1) for 0 points
- day 10: RFID bag line (retail-2) for 26 points
- day 10: Police post (safety-2) for 26 points
- day 10: Food hall (retail-3) for 38 points
- day 11: Guard lanes (safety-3) for 38 points
- day 11: Lounge (retail-4) for 54 points
- day 12: Security hall (safety-4) for 54 points
- day 13: Seating (retail-5) for 76 points
- day 14: Incident drill (safety-5) for 76 points
- day 15: Skywalk (terminal-5) for 76 points
- day 15: Specialisation charter (spec-charter) for 0 points
- day 15: Freight shed (spec-cargo-1) for 26 points
- day 16: Night freight (spec-cargo-2) for 38 points
- day 16: SAF blend (spec-green-1) for 39 points
- day 17: Transfer bank (spec-hub-1) for 39 points
- day 17: Fast turn (spec-lowcost-1) for 39 points
- day 18: Premium lane (spec-premium-1) for 39 points
- day 18: Sorter (spec-cargo-3) for 54 points
- day 19: Quiet hours (spec-green-2) for 57 points
- day 20: Wave scheduling (spec-hub-2) for 57 points
- day 20: Remote stand (spec-lowcost-2) for 57 points
- day 21: Fast track (spec-premium-2) for 57 points
- day 22: Freighter stand (spec-cargo-4) for 76 points
- day 23: Electric GSE (spec-green-3) for 81 points
- day 24: Minimum connect (spec-hub-3) for 81 points
- day 25: Thin lounge (spec-lowcost-3) for 81 points
- day 26: VIP room (spec-premium-3) for 81 points
- day 28: Code E pier (airfield-6) for 108 points
- day 29: Night bank (airside-6) for 108 points
- day 30: Airport hotel (landside-6) for 108 points
- day 32: Comfort (retail-6) for 108 points
- day 33: Hardened perimeter (safety-6) for 108 points
- day 34: Cargo airline (spec-cargo-5) for 108 points
- day 36: People mover (terminal-6) for 108 points
- day 37: Rail first (spec-green-4) for 114 points
- day 39: Hub pier (spec-hub-4) for 114 points
- day 40: High frequency (spec-lowcost-4) for 114 points
- day 42: Bridge service (spec-premium-4) for 114 points
- day 44: Green report (spec-green-5) for 162 points
- day 46: Alliance desk (spec-hub-5) for 162 points
- day 48: Low-cost deal (spec-lowcost-5) for 162 points
- day 50: Flagship deal (spec-premium-5) for 162 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-923,554 |
| payroll | $-606,591 |
| building_upkeep | $-367,224 |
| land_holding | $-215,580 |
| loan_repayment | $-188,605 |
| penalties | $-74,464 |
| fuel_purchase | $-71,760 |
| loan_interest | $-46,800 |
| emergency_refuse | $-31,600 |
| staff_hiring | $-19,700 |
| security_shock | $-17,600 |
| retail_cogs | $-15,378 |
| crash_fine | $-4,000 |
| missed_connection | $-1,860 |
| city_levy | $-1,000 |
| parking_fees | $25,728 |
| task_rewards | $38,900 |
| level_reward | $42,500 |
| baggage_fees | $69,095 |
| catering_fees | $70,781 |
| passenger_fees | $80,142 |
| retail_sales | $171,411 |
| fuel_sales | $225,392 |
| landside_fees | $278,400 |
| loan_proceeds | $365,000 |
| contract_fees | $525,321 |
| landing_fees | $558,970 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 92.3 | partner | 5 Flagship |
| Skyline Rescue | 17.3 | neutral | 1 Published |
| Rotorlink | 16.9 | neutral | 1 Published |
| Harbor Heli | 14.1 | neutral | 1 Published |
| Island Heli | 14 | neutral | 1 Published |
| Medevac One | 13.6 | neutral | 1 Published |
| Alpine Swift | 9.6 | neutral | 1 Published |
| Zoomjet | 7.5 | neutral | 1 Published |
| Dune Jet | 3.1 | neutral | 1 Published |
| Prestige Air | 2.8 | neutral | 1 Published |
| Mekong Express | 2.2 | neutral | 1 Published |
| Pampas Air | 2.2 | neutral | 1 Published |
| Andaman Hop | 2 | neutral | 1 Published |
| Tango Air | 1.4 | neutral | 1 Published |
| Borneo Wings | -0.4 | neutral | 1 Published |
| Zephyr Go | -2 | neutral | 1 Published |
| Cityhopper | -2.3 | neutral | 1 Published |
| Rio Sol | -2.8 | neutral | 1 Published |
| Maple Coastal | -4.3 | neutral | 1 Published |
| Outback Link | -4.8 | neutral | 1 Published |
| Brisa | -5.6 | neutral | 1 Published |
| Savanna Air | -8.8 | neutral | 1 Published |
| SkyCheap | -10.5 | neutral | 1 Published |
| Kauri Air | -12.6 | neutral | 1 Published |


- taxi-out recoveries cleared 3 stalls; teleport entries: 0

### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 47.7s wall.

Flights 130 (4.3/day). Diverts 1 (connection diverts 0). Go-arounds 2. Missed-connection cash $0. Curb crossed 1 on day 18. Fuel groundings 0. Tree complete day —. Preferred day 14, Trusted day 30. Hub checklist station from day 2.

#### Time to first landing

80s (day 0) — LIF102 entered landing.

#### Cash curve

Start $168,000 · end $93,553.

`█▄▂▁▁▁▁▁▁▁▂▂▁▁▁▁▁▁▂▂▁▁▁▁▂▂▂▂▂▆▇`  $2,072 → $118,000

| Day | Cash |
| --- | --- |
| 0 | $118,000 |
| 3 | $2,072 |
| 6 | $5,190 |
| 9 | $3,416 |
| 12 | $6,669 |
| 15 | $9,374 |
| 18 | $14,968 |
| 21 | $8,929 |
| 24 | $13,296 |
| 27 | $14,520 |
| 30 | $93,553 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 1.

Recovered:

- ZO120 taxi_out for 43s step=none cleared at 2608s
- ZO120 stuck on the ground step=none cleared at 2609s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 65.2.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 5 | 56.2 | 77 |
| 6 | 18 | 74.6 | 84 |
| 9 | 18 | 63.7 | 81 |
| 12 | 36 | 67 | 71 |
| 15 | 18 | 68 | 71 |
| 18 | 36 | 66.2 | 75 |
| 21 | 18 | 66.9 | 70 |
| 24 | 36 | 58.1 | 74 |
| 27 | 3 | 56.7 | 75 |
| 30 | 8 | 48.9 | 75 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 65.5 | 29 | 5220s | 3 | 2 |
| 64.2 | 25 | 4568.8s | 3 | 0 |
| 60.6 | 29 | 5293.8s | 3 | 39 |
| 56.2 | 26 | 4851.3s | 4 | 3 |
| 54 | 11 | 1991.3s | 2 | 37 |
| 53.6 | 11 | 1986.3s | 2 | 52 |
| 51.5 | 27 | 4978.8s | 3 | 41 |
| 49.5 | 30 | 5400s | 1 | 8 |

#### Anything the bot could not do

24 failed commands.

- hireJanitor ×19 — Janitor crew maxed (6).
- hireJanitor ×1 — Need hire janitor — short 1160.
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyRoom ×1 — Need Gate hold — short 393.
- buyRoom ×1 — Need Research desk — short 1883.

Built:

- Runway strips 1, stands 15, terminal tiles 13, snack bars 10
- Shop units 20, leased 10, flights completed 130
- Signed: zoomjet, air_regional_1, harbor_heli, island_heli, medevac_one, rotorlink
- Rooms: checkin 3, security 6, gate 11, bagclaim 1, food 4, souvenir 6, bagdrop 1, lounge 2, bathroom 5, rdesk 7, rboard 3, rmachine 2

#### New systems

Research tree: 21 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, terminal-4, airfield-5, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, airside-5, landside-5, retail-5, safety-5, spec-cargo-4, terminal-5, spec-green-3, spec-hub-3).
Desks: 3 agents, check-in empty, security empty.
Queues at the end: check-in 0, security 0. Peaks: check-in 1, security 8.
Check-in: walk paused, estimate · 0 waiting at check-in
Security: walk paused, estimate · 0 waiting at security
Curb: pressure 2 (peak 2.5), queue 6.9 (peak 6.9), delay 27s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 89.5. Guest peak 57. Field-ask fines booked at the full rate: 0. Penalties total $-32,863.

#### Research pools

Lab furniture at the end: 7 research desks, 3 chalkboards, 2 lab benches. Researchers on payroll: 0.

Measured room rate: 0.43 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 0 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.16 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.16 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 21 | 465 | 0 | 0 | 21 | 1925.08 |

End of run: desk 21 balance / 465 earned, Wave 3 0 balance / 0 earned, Growth 21 balance / 1925.08 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 2: Stand classes (stand_class) for 40 points
- day 2: Widebody ops (widebody_ops) for 48 points
- day 3: Travelators (travelator) for 26 points
- day 5: Hydrant fuel system (hydrant_fuel) for 36 points
- day 7: Tank farm II (tank_farm_ii) for 30 points
- day 13: Scanner lanes (ct_lanes) for 28 points
- day 23: Hangar MRO (mro_hangar) for 72 points
- day 26: Military ramp (mil_ramp) for 42 points
- day 27: Skywalks (skywalk) for 34 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 1: De-ice pad (airfield-2) for 26 points
- day 1: Processing (terminal-2) for 26 points
- day 2: Large stands (airfield-3) for 38 points
- day 3: Concourse (terminal-3) for 38 points
- day 4: Heavy runway (airfield-4) for 54 points
- day 5: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 5: Catering kitchen (airside-2) for 26 points
- day 5: Inn (landside-2) for 26 points
- day 6: GSE depot (airside-3) for 38 points
- day 7: Long-stay park (landside-3) for 38 points
- day 7: Wide hangar (airside-4) for 54 points
- day 9: Bus station (landside-4) for 54 points
- day 9: Transfer Centre (retail-1) for 0 points
- day 9: ARFF station (safety-1) for 0 points
- day 10: RFID bag line (retail-2) for 26 points
- day 10: Police post (safety-2) for 26 points
- day 11: Food hall (retail-3) for 38 points
- day 11: Guard lanes (safety-3) for 38 points
- day 12: Lounge (retail-4) for 54 points
- day 13: Security hall (safety-4) for 54 points
- day 14: Jet bridge (terminal-4) for 54 points
- day 15: Control tower (airfield-5) for 76 points
- day 15: Specialisation charter (spec-charter) for 0 points
- day 15: Freight shed (spec-cargo-1) for 26 points
- day 16: Night freight (spec-cargo-2) for 38 points
- day 16: SAF blend (spec-green-1) for 39 points
- day 17: Transfer bank (spec-hub-1) for 39 points
- day 17: Fast turn (spec-lowcost-1) for 39 points
- day 18: Premium lane (spec-premium-1) for 39 points
- day 19: Sorter (spec-cargo-3) for 54 points
- day 19: Quiet hours (spec-green-2) for 57 points
- day 20: Wave scheduling (spec-hub-2) for 57 points
- day 21: Remote stand (spec-lowcost-2) for 57 points
- day 22: Fast track (spec-premium-2) for 57 points
- day 23: MRO bay (airside-5) for 76 points
- day 23: Rail spur (landside-5) for 76 points
- day 25: Seating (retail-5) for 76 points
- day 26: Incident drill (safety-5) for 76 points
- day 27: Freighter stand (spec-cargo-4) for 76 points
- day 27: Skywalk (terminal-5) for 76 points
- day 29: Electric GSE (spec-green-3) for 81 points
- day 29: Minimum connect (spec-hub-3) for 81 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-483,400 |
| payroll | $-220,500 |
| building_upkeep | $-117,529 |
| land_holding | $-58,005 |
| loan_repayment | $-50,755 |
| fuel_purchase | $-32,880 |
| staff_hiring | $-26,400 |
| loan_interest | $-12,900 |
| emergency_refuse | $-12,400 |
| crash_fine | $-12,000 |
| retail_cogs | $-7,590 |
| penalties | $-5,263 |
| security_shock | $-3,200 |
| refunds | $511 |
| catering_fees | $3,261 |
| baggage_fees | $6,206 |
| parking_fees | $8,946 |
| level_reward | $20,500 |
| task_rewards | $30,300 |
| passenger_fees | $42,354 |
| retail_sales | $80,813 |
| loan_proceeds | $90,000 |
| fuel_sales | $91,870 |
| landing_fees | $172,387 |
| landside_fees | $192,000 |
| contract_fees | $229,226 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Zoomjet | 46.9 | warm | 3 Trusted |
| Medevac One | 14.2 | neutral | 1 Published |
| Island Heli | 13.5 | neutral | 1 Published |
| Rotorlink | 11.9 | neutral | 1 Published |
| Harbor Heli | 8.7 | neutral | 1 Published |
| Puddle Jumper Airlines | -2.2 | neutral | 1 Published |
| Skyline Rescue | -3 | neutral | 1 Published |


- Driver put the clock back to 5× after the persona touched the speed buttons.
- taxi-out recoveries cleared 1 stalls; teleport entries: 0

## Browser smoke

Scripted opening finished.

Opening played through the first landing.

Wall 147.8s. Clock ended at 99s.

#### Time to first landing

20.5s.

#### Cash curve

Ended at $40,119.

▄  $27,500

#### Stuck or recovered

None still stuck.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness 62.

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 15.1 | 0 | 9s | 1 | 16 |
| 14.8 | 0 | 5.3s | 0 | 14 |
| 13.3 | 0 | 24.5s | 1 | 13 |
| 13.1 | 0 | 25.5s | 1 | 14 |
| 11.6 | 0 | 16.3s | 1 | 8 |
| 10.6 | 0 | 8s | 0 | 15 |
| 10.1 | 0 | 14s | 1 | 19 |
| 9.9 | 0 | 32.8s | 1 | 14 |

#### Anything the bot could not do

Scripted clicks landed.

Script:

- open http://127.0.0.1:45991/?playtest=1
- sandbox off
- new game
- passenger start
- starter kit stamped from the coach
- phone preview flashed
- open contract letter
- accept contract
- open airfield tray
- select taxiway
- click the field
- open services menu
- services tab
- open shops menu
- shops tab
- furnish Hall food
- furnish Souvenirs
- terminal view
- 5x

Screenshots:

- docs/playtest/bots/smoke/01-title.png
- docs/playtest/bots/smoke/02-route.png
- docs/playtest/bots/smoke/03-field.png
- docs/playtest/bots/smoke/04-kit.png
- docs/playtest/bots/smoke/05-contract.png
- docs/playtest/bots/smoke/06-accepted.png
- docs/playtest/bots/smoke/07-services.png
- docs/playtest/bots/smoke/07b-hall.png
- docs/playtest/bots/smoke/08-five-minutes.png

- Coach stamped the starter kit on the empty plot.
- Sim clock reached 96s before the 90s wall cap (target 300s).
- Opening check passed. Screenshots: /workspace/docs/playtest/opening/01-title.png, /workspace/docs/playtest/opening/02-plot.png, /workspace/docs/playtest/opening/03-coach.png, /workspace/docs/playtest/opening/04-runway-refused.png, /workspace/docs/playtest/opening/05-kit-stamped.png, /workspace/docs/playtest/opening/06-contract.png, /workspace/docs/playtest/opening/07-landing.png, /workspace/docs/playtest/opening/08-pause.png
