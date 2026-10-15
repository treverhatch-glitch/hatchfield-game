# Hatchfield bot playtest

Generated 2026-10-15T00:28:21.077Z.

Headless bots use the player command API (new game, land, starter kit, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at 5×. One sim day is 180s. Tick dt is 0.25s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful, when the curb pressure is over 1 and cash can cover it, adds a bus bay, then a taxi rank, then a curb lane instead of that day's expansion.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 30.7s wall.

#### Time to first landing

41.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $160,765.

`▄▁▁▁▂▁▂▂▂▂▁▂▂▂▂▂▃▃▃▄▄▄▄▅▅▅▅▆▆▆▆▇▇▇▇▇▇▇▇▇▇▇████`  $7,252 → $160,765

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 4 | $19,568 |
| 8 | $31,550 |
| 12 | $25,435 |
| 16 | $50,851 |
| 20 | $73,948 |
| 24 | $96,090 |
| 28 | $122,245 |
| 32 | $132,151 |
| 36 | $131,891 |
| 40 | $149,507 |
| 44 | $158,117 |
| 45 | $160,765 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 1.

Recovered:

- PDJ101 taxi_out for 45s step=none cleared at 175s
- PDJ101 stuck on the ground step=none cleared at 176s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 67.7.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 12 | 70 | 85 |
| 8 | 18 | 67.6 | 88 |
| 12 | 18 | 63.3 | 88 |
| 16 | 18 | 61.8 | 89 |
| 20 | 18 | 65.3 | 87 |
| 24 | 13 | 76.7 | 88 |
| 28 | 13 | 67.1 | 85 |
| 32 | 6 | 71.4 | 84 |
| 36 | 25 | 69.6 | 86 |
| 40 | 0 | — | 85 |
| 44 | 0 | — | 80 |
| 45 | 10 | 70 | 80 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 70.6 | 0 | 13.8s | 0 | 0 |
| 21.4 | 0 | 1.3s | 0 | 0 |
| 18.8 | 32 | 5768.8s | 2 | 12 |
| 18.6 | 24 | 4418.8s | 1 | 11 |
| 18.3 | 0 | 31.3s | 1 | 4 |
| 16.8 | 31 | 5643.8s | 2 | 5 |
| 16.8 | 37 | 6693.8s | 1 | 16 |
| 16.7 | 39 | 7043.8s | 2 | 11 |

#### Anything the bot could not do

2 failed commands.

- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.

Built:

- Runway strips 1, stands 4, terminal tiles 9, snack bars 1
- Shop units 5, leased 5, flights completed 161
- Signed: air_regional_1, zoomjet, alpine_swift, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue, air_lowcost_1, cityhopper
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 2, bagdrop 1, lounge 1, bathroom 3, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 23 points, 38 nodes (airfield-1, terminal-1, airfield-2, airside-1, landside-1, airside-2, landside-2, terminal-2, airfield-3, retail-1, safety-1, retail-2, safety-2, airside-3, landside-3, retail-3, spec-charter, spec-cargo-1, safety-3, spec-cargo-2, terminal-3, airfield-4, airside-4, landside-4, retail-4, safety-4, spec-cargo-3, terminal-4, airfield-5, airside-5, landside-5, retail-5, safety-5, spec-cargo-4, terminal-5, airfield-6, airside-6, landside-6).
Desks: 3 agents, check-in staffed, security empty.
Queues at the end: check-in 0, security 0. Peaks: check-in 3, security 4.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 0.8 (peak 1.2), queue 0 (peak 0.7), delay 0s, lanes 2, bus bays 1, curb lanes 1, taxi ranks 1.
Happiness peak 76.7. Guest peak 25. Field-ask fines booked at the full rate: 0. Penalties total $-39,980.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 0.

Measured room rate: 0.13 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.13 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.13 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 38 | 334 | 0 | 0 | 38 | 1130.5 |
| 45 | 23 | 708 | 0 | 0 | 23 | 1693.5 |

End of run: desk 23 balance / 708 earned, Wave 3 0 balance / 0 earned, Growth 23 balance / 1693.5 earned.

Old research desk nodes bought:

- day 2: De-ice ops (deice) for 34 points
- day 3: Hydrant fuel system (hydrant_fuel) for 36 points
- day 7: Belts and sorter (bag_sorter) for 32 points
- day 7: Kiosks and bag drop (self_service) for 22 points
- day 8: Stand classes (stand_class) for 40 points
- day 8: Widebody ops (widebody_ops) for 48 points
- day 20: Travelators (travelator) for 26 points
- day 22: Tank farm II (tank_farm_ii) for 30 points
- day 26: Scanner lanes (ct_lanes) for 28 points
- day 32: Hangar MRO (mro_hangar) for 72 points
- day 36: Military ramp (mil_ramp) for 42 points
- day 39: Skywalks (skywalk) for 34 points
- day 41: Heavy metal pack (heavy_pack) for 55 points
- day 41: Tank farm III (tank_farm_iii) for 46 points
- day 42: Night bank (night_bank) for 28 points
- day 42: Fuel rail (rail_fuel) for 44 points
- day 42: Cargo night hub (cargo_night_hub) for 68 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 1: Hall shell (terminal-1) for 0 points
- day 2: De-ice pad (airfield-2) for 50 points
- day 3: Fuel farm (airside-1) for 0 points
- day 4: Curb road (landside-1) for 0 points
- day 5: Catering kitchen (airside-2) for 50 points
- day 6: Inn (landside-2) for 50 points
- day 7: Processing (terminal-2) for 50 points
- day 8: Large stands (airfield-3) for 52 points
- day 9: Transfer Centre (retail-1) for 0 points
- day 10: ARFF station (safety-1) for 0 points
- day 11: RFID bag line (retail-2) for 50 points
- day 12: Police post (safety-2) for 50 points
- day 13: GSE depot (airside-3) for 52 points
- day 14: Long-stay park (landside-3) for 52 points
- day 15: Food hall (retail-3) for 52 points
- day 16: Specialisation charter (spec-charter) for 0 points
- day 17: Freight shed (spec-cargo-1) for 50 points
- day 18: Guard lanes (safety-3) for 52 points
- day 19: Night freight (spec-cargo-2) for 52 points
- day 20: Concourse (terminal-3) for 52 points
- day 21: Heavy runway (airfield-4) for 54 points
- day 22: Wide hangar (airside-4) for 54 points
- day 23: Bus station (landside-4) for 54 points
- day 24: Lounge (retail-4) for 54 points
- day 26: Security hall (safety-4) for 54 points
- day 27: Sorter (spec-cargo-3) for 54 points
- day 28: Jet bridge (terminal-4) for 54 points
- day 30: Control tower (airfield-5) for 56 points
- day 32: MRO bay (airside-5) for 56 points
- day 33: Rail spur (landside-5) for 56 points
- day 35: Seating (retail-5) for 56 points
- day 36: Incident drill (safety-5) for 56 points
- day 38: Freighter stand (spec-cargo-4) for 56 points
- day 39: Skywalk (terminal-5) for 56 points
- day 41: Code E pier (airfield-6) for 62 points
- day 42: Night bank (airside-6) for 62 points
- day 44: Airport hotel (landside-6) for 62 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| payroll | $-419,837 |
| construction | $-253,000 |
| building_upkeep | $-214,878 |
| land_holding | $-101,488 |
| fuel_purchase | $-30,800 |
| emergency_refuse | $-23,600 |
| staff_hiring | $-13,600 |
| penalties | $-13,180 |
| retail_cogs | $-6,476 |
| security_shock | $-3,200 |
| city_levy | $-264 |
| parking_fees | $11,367 |
| baggage_fees | $12,224 |
| level_reward | $20,500 |
| passenger_fees | $35,929 |
| task_rewards | $38,900 |
| retail_sales | $67,416 |
| fuel_sales | $133,472 |
| landside_fees | $211,200 |
| contract_fees | $239,624 |
| landing_fees | $302,456 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 81.8 | partner | 4 Priority |
| Zoomjet | 10.9 | neutral | 1 Published |
| Harbor Heli | 8.3 | neutral | 1 Published |
| Alpine Swift | 8.1 | neutral | 1 Published |
| Island Heli | 7.8 | neutral | 1 Published |
| Medevac One | 6.3 | neutral | 1 Published |
| Rotorlink | 4 | neutral | 1 Published |
| SkyCheap | 3.8 | neutral | 1 Published |
| Skyline Rescue | 3.8 | neutral | 1 Published |
| Cityhopper | 3.6 | neutral | 1 Published |


- recovery teleports: 0

### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 52.5s wall.

#### Time to first landing

43.8s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $17,213.

`▃▂▁▁▁▁▁▁▁▁▁▁▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁`  $1,243 → $331,715

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 5 | $13,125 |
| 10 | $18,498 |
| 15 | $27,263 |
| 20 | $14,059 |
| 25 | $331,715 |
| 30 | $3,348 |
| 35 | $7,886 |
| 40 | $11,349 |
| 45 | $7,649 |
| 50 | $6,550 |
| 55 | $9,491 |
| 60 | $17,213 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 2.

Recovered:

- ZO110 taxi_out for 50s step=none cleared at 1558s
- ZO110 stuck on the ground step=none cleared at 1559s
- LIF326 taxi_out for 44s step=none cleared at 7773s
- LIF326 stuck on the ground step=none cleared at 7774s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 66.3.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 1 | 62 | 87 |
| 10 | 18 | 67.7 | 87 |
| 15 | 1 | 63 | 86 |
| 20 | 4 | 55.9 | 84 |
| 25 | 18 | 72.3 | 81 |
| 30 | 10 | 60.3 | 77 |
| 35 | 13 | 73.8 | 76 |
| 40 | 0 | — | 69 |
| 45 | 10 | 70 | 52 |
| 50 | 0 | — | 34 |
| 55 | 18 | 62.9 | 34 |
| 60 | 8 | 55.9 | 33 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 28.8 | 58 | 10447.5s | 1 | 10 |
| 19.9 | 0 | 13.8s | 0 | 0 |
| 19.1 | 59 | 10771.3s | 1 | 3 |
| 17.9 | 37 | 6746.3s | 3 | 15 |
| 17.8 | 54 | 9861.3s | 1 | 14 |
| 16.5 | 25 | 4655s | 0 | 0 |
| 16.1 | 28 | 5040s | 5 | 3 |
| 15.8 | 55 | 10001.3s | 0 | 6 |

#### Anything the bot could not do

105 failed commands.

- buyParcel ×27 — Parcel locked — reach Field Level 2 first.
- buyResearch ×11 — Already unlocked.
- buyResearch ×3 — Need 52 RP (have 0).
- buyParcel ×3 — Need Apron plot 3-2 — short 29224.
- buyParcel ×3 — Need Apron plot 3-2 — short 26824.
- buyParcel ×3 — Need Apron plot 3-2 — short 28351.
- buyParcel ×3 — Need Apron plot 3-2 — short 30578.
- buyResearch ×2 — Need 54 RP (have 2).
- buyParcel ×2 — Need Apron plot 3-2 — short 30835.
- buyParcel ×2 — Need Apron plot 3-2 — short 27836.
- buyParcel ×2 — Need Apron plot 3-2 — short 26461.
- buyParcel ×2 — Need Apron plot 3-2 — short 3927.
- buyResearch ×2 — Need 56 RP (have 1).
- buyResearch ×2 — Need 56 RP (have 0).
- buyResearch ×2 — Need 62 RP (have 0).
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyResearch ×1 — Need 52 RP (have 2).
- buyResearch ×1 — Need 54 RP (have 0).
- buyResearch ×1 — Need 54 RP (have 3).
- buyResearch ×1 — Need 54 RP (have 6).
- buyParcel ×1 — Need Apron plot 3-2 — short 27224.
- buyParcel ×1 — Need Apron plot 3-2 — short 38184.
- buyParcel ×1 — Need Apron plot 3-2 — short 37825.
- buyParcel ×1 — Need Apron plot 3-2 — short 31271.
- buyParcel ×1 — Need Apron plot 3-2 — short 30617.
- buyParcel ×1 — Need Apron plot 3-2 — short 27212.
- buyParcel ×1 — Need Apron plot 3-2 — short 25452.
- buyParcel ×1 — Need Apron plot 3-2 — short 25852.
- buyParcel ×1 — Need Apron plot 3-2 — short 28637.
- buyParcel ×1 — Need Apron plot 3-2 — short 28579.
- buyParcel ×1 — Need Apron plot 3-2 — short 25804.
- buyParcel ×1 — Need Apron plot 3-2 — short 27250.
- buyParcel ×1 — Need Apron plot 3-2 — short 30406.
- buyParcel ×1 — Need Apron plot 3-2 — short 27421.
- buyParcel ×1 — Need Apron plot 3-2 — short 26061.
- buyParcel ×1 — Need Apron plot 3-2 — short 23449.
- buyParcel ×1 — Need Apron plot 3-2 — short 20997.
- buyParcel ×1 — Need Apron plot 3-2 — short 18278.
- buyParcel ×1 — Need Apron plot 3-2 — short 17689.

Built:

- Runway strips 1, stands 6, terminal tiles 9, snack bars 2
- Shop units 8, leased 7, flights completed 221
- Signed: air_regional_1, zoomjet, alpine_swift, harbor_heli, island_heli, medevac_one, rotorlink, skyline_rescue, air_lowcost_1, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, borneo_wings, dune_jet, air_fullservice_1, brisa, zephyr_go
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 54 points, 46 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airside-1, landside-1, airside-2, landside-2, airfield-3, retail-1, safety-1, retail-2, safety-2, airside-3, landside-3, retail-3, safety-3, spec-charter, spec-cargo-1, spec-cargo-2, terminal-3, airfield-4, airside-4, landside-4, retail-4, safety-4, spec-cargo-3, terminal-4, airfield-5, airside-5, landside-5, retail-5, safety-5, spec-cargo-4, terminal-5, airfield-6, airside-6, landside-6, retail-6, safety-6, spec-cargo-5, terminal-6, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1).
Desks: 3 agents, check-in empty, security empty.
Queues at the end: check-in 1, security 1. Peaks: check-in 4, security 5.
Check-in: Check-in · 2 of 2 desks staffed · 2 in use · Queue 2 · wait 13s · Throughput 16.0/min · Desk 1 · queue 1 · wait 13s · in use · Desk 2 · queue 1 · wait 10s · in use
Security: Security · 2 of 2 lanes staffed · 1 in use · Queue 0 · wait 3s · Throughput 20.0/min · Lane 1 · queue 0 · wait 3s · in use · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 4.1 (peak 4.1), queue 18.5 (peak 19), delay 71s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 81.8. Guest peak 40. Field-ask fines booked at the full rate: 0. Penalties total $-46,444.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 0.

Measured room rate: 0.13 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.13 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.13 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 29 | 413 | 0 | 0 | 29 | 1121.5 |
| 45 | 25 | 798 | 0 | 0 | 25 | 1695.5 |
| 60 | 54 | 977 | 0 | 0 | 54 | 2272.5 |

End of run: desk 54 balance / 977 earned, Wave 3 0 balance / 0 earned, Growth 54 balance / 2272.5 earned.

Old research desk nodes bought:

- day 2: De-ice ops (deice) for 34 points
- day 3: Belts and sorter (bag_sorter) for 32 points
- day 3: Kiosks and bag drop (self_service) for 22 points
- day 3: Hydrant fuel system (hydrant_fuel) for 36 points
- day 7: Stand classes (stand_class) for 40 points
- day 7: Widebody ops (widebody_ops) for 48 points
- day 15: Transfer Centre (transfer_centre) for 36 points
- day 19: Travelators (travelator) for 26 points
- day 21: RFID bag line (rfid_bag_line) for 52 points
- day 22: Tank farm II (tank_farm_ii) for 30 points
- day 26: Scanner lanes (ct_lanes) for 28 points
- day 32: Hangar MRO (mro_hangar) for 72 points
- day 36: Military ramp (mil_ramp) for 42 points
- day 39: Skywalks (skywalk) for 34 points
- day 40: Heavy metal pack (heavy_pack) for 55 points
- day 40: Tank farm III (tank_farm_iii) for 46 points
- day 42: Night bank (night_bank) for 28 points
- day 42: Fuel rail (rail_fuel) for 44 points
- day 42: Cargo night hub (cargo_night_hub) for 68 points
- day 47: E-gates (egates) for 40 points
- day 50: Automated baggage (bag_bhs) for 58 points
- day 50: People mover (people_mover) for 52 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 2: De-ice pad (airfield-2) for 50 points
- day 3: Processing (terminal-2) for 50 points
- day 3: Fuel farm (airside-1) for 0 points
- day 3: Curb road (landside-1) for 0 points
- day 5: Catering kitchen (airside-2) for 50 points
- day 6: Inn (landside-2) for 50 points
- day 7: Large stands (airfield-3) for 52 points
- day 8: Transfer Centre (retail-1) for 0 points
- day 8: ARFF station (safety-1) for 0 points
- day 8: RFID bag line (retail-2) for 50 points
- day 10: Police post (safety-2) for 50 points
- day 11: GSE depot (airside-3) for 52 points
- day 12: Long-stay park (landside-3) for 52 points
- day 14: Food hall (retail-3) for 52 points
- day 15: Guard lanes (safety-3) for 52 points
- day 15: Specialisation charter (spec-charter) for 0 points
- day 16: Freight shed (spec-cargo-1) for 50 points
- day 18: Night freight (spec-cargo-2) for 52 points
- day 19: Concourse (terminal-3) for 52 points
- day 20: Heavy runway (airfield-4) for 54 points
- day 22: Wide hangar (airside-4) for 54 points
- day 23: Bus station (landside-4) for 54 points
- day 25: Lounge (retail-4) for 54 points
- day 26: Security hall (safety-4) for 54 points
- day 27: Sorter (spec-cargo-3) for 54 points
- day 29: Jet bridge (terminal-4) for 54 points
- day 30: Control tower (airfield-5) for 56 points
- day 32: MRO bay (airside-5) for 56 points
- day 33: Rail spur (landside-5) for 56 points
- day 35: Seating (retail-5) for 56 points
- day 36: Incident drill (safety-5) for 56 points
- day 37: Freighter stand (spec-cargo-4) for 56 points
- day 39: Skywalk (terminal-5) for 56 points
- day 40: Code E pier (airfield-6) for 62 points
- day 42: Night bank (airside-6) for 62 points
- day 44: Airport hotel (landside-6) for 62 points
- day 45: Comfort (retail-6) for 62 points
- day 47: Hardened perimeter (safety-6) for 62 points
- day 49: Cargo airline (spec-cargo-5) for 62 points
- day 50: People mover (terminal-6) for 62 points
- day 52: SAF blend (spec-green-1) for 75 points
- day 54: Transfer bank (spec-hub-1) for 75 points
- day 56: Fast turn (spec-lowcost-1) for 75 points
- day 58: Premium lane (spec-premium-1) for 75 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-855,966 |
| building_upkeep | $-395,584 |
| payroll | $-371,729 |
| land_holding | $-206,631 |
| loan_repayment | $-188,605 |
| loan_interest | $-46,800 |
| fuel_purchase | $-40,400 |
| emergency_refuse | $-31,600 |
| staff_hiring | $-14,900 |
| security_shock | $-12,000 |
| retail_cogs | $-8,146 |
| penalties | $-2,844 |
| city_levy | $-925 |
| parking_fees | $14,256 |
| baggage_fees | $20,068 |
| catering_fees | $20,430 |
| passenger_fees | $35,787 |
| task_rewards | $38,900 |
| level_reward | $42,500 |
| retail_sales | $89,123 |
| fuel_sales | $174,353 |
| landside_fees | $290,400 |
| loan_proceeds | $365,000 |
| landing_fees | $449,812 |
| contract_fees | $484,714 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 100 | partner | 5 Flagship |
| Zoomjet | 20.2 | warm | 2 Preferred |
| Alpine Swift | 13.3 | neutral | 1 Published |
| Harbor Heli | 10.1 | neutral | 1 Published |
| Island Heli | 9.5 | neutral | 1 Published |
| Medevac One | 8.7 | neutral | 1 Published |
| Rotorlink | 8.2 | neutral | 1 Published |
| Skyline Rescue | 7.4 | neutral | 1 Published |
| Maple Coastal | 2.6 | neutral | 1 Published |
| Prestige Air | 2.5 | neutral | 1 Published |
| SkyCheap | 2.5 | neutral | 1 Published |
| Zephyr Go | 2.5 | neutral | 1 Published |
| Brisa | 2.4 | neutral | 1 Published |
| Outback Link | 2.4 | neutral | 1 Published |
| Savanna Air | 2.4 | neutral | 1 Published |
| Kauri Air | 2.3 | neutral | 1 Published |
| Borneo Wings | 2.1 | neutral | 1 Published |
| Dune Jet | 2.1 | neutral | 1 Published |
| Cityhopper | 1.7 | neutral | 1 Published |


- recovery teleports: 0

### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 23.1s wall.

#### Time to first landing

80s (day 0) — LIF101 entered landing.

#### Cash curve

Start $168,000 · end $207,814.

`▅▃▂▁▁▁▁▂▂▁▁▁▁▁▁▁▂▁▁▂▂▂▂▂▂▂▂▂███`  $2,066 → $211,193

| Day | Cash |
| --- | --- |
| 0 | $118,000 |
| 3 | $2,066 |
| 6 | $14,571 |
| 9 | $16,404 |
| 12 | $11,621 |
| 15 | $12,645 |
| 18 | $16,412 |
| 21 | $26,612 |
| 24 | $36,669 |
| 27 | $28,572 |
| 30 | $207,814 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 1.

Recovered:

- PDJ189 taxi_out for 45s step=none cleared at 5218s
- PDJ189 stuck on the ground step=none cleared at 5219s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 67.3.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 4 | 36.5 | 71 |
| 6 | 17 | 74.9 | 78 |
| 9 | 18 | 65.6 | 83 |
| 12 | 36 | 65.8 | 83 |
| 15 | 18 | 62.3 | 80 |
| 18 | 36 | 70 | 82 |
| 21 | 18 | 64 | 81 |
| 24 | 36 | 70.9 | 81 |
| 27 | 15 | 70 | 80 |
| 30 | 18 | 62.7 | 78 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 21.2 | 0 | 38.8s | 0 | 0 |
| 20.5 | 29 | 5223.8s | 0 | 2 |
| 18.9 | 23 | 4217.5s | 3 | 17 |
| 18.6 | 27 | 5036.3s | 2 | 15 |
| 18.3 | 24 | 4491.3s | 3 | 18 |
| 18.1 | 27 | 4861.3s | 1 | 15 |
| 17.9 | 23 | 4308.8s | 2 | 36 |
| 17.7 | 13 | 2443.8s | 0 | 13 |

#### Anything the bot could not do

16 failed commands.

- hireJanitor ×13 — Janitor crew maxed (6).
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyRoom ×1 — Need Research desk — short 135.

Built:

- Runway strips 1, stands 11, terminal tiles 9, snack bars 7
- Shop units 18, leased 13, flights completed 103
- Signed: zoomjet, air_regional_1, harbor_heli
- Rooms: checkin 4, security 10, gate 11, bagclaim 1, food 4, souvenir 7, bagdrop 1, lounge 4, bathroom 4, rdesk 5, rboard 7, rmachine 7

#### New systems

Research tree: 97 points, 54 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airside-1, landside-1, airside-2, landside-2, airfield-3, airside-3, landside-3, terminal-3, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, airfield-4, airside-4, landside-4, retail-4, safety-4, terminal-4, airfield-5, airside-5, landside-5, retail-5, safety-5, terminal-5, airfield-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-cargo-3, spec-cargo-4, airside-6, landside-6, retail-6, safety-6, spec-cargo-5, terminal-6, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-green-3, spec-hub-3, spec-lowcost-3, spec-premium-3).
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 1, security 5. Peaks: check-in 7, security 7.
Check-in: Check-in · 2 of 2 desks staffed · 2 in use · Queue 2 · wait 11s · Throughput 16.0/min · Desk 1 · queue 1 · wait 11s · in use · Desk 2 · queue 1 · wait 9s · in use
Security: Security · 2 of 2 lanes staffed · 1 in use · Queue 3 · wait 14s · Throughput 20.0/min · Lane 1 · queue 3 · wait 14s · in use · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 1.5 (peak 1.5), queue 3 (peak 3), delay 12s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 75.2. Guest peak 41. Field-ask fines booked at the full rate: 0. Penalties total $-21,000.

#### Research pools

Lab furniture at the end: 5 research desks, 7 chalkboards, 7 lab benches. Researchers on payroll: 0.

Measured room rate: 0.83 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 0 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.07 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.07 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 97 | 932 | 0 | 0 | 97 | 2951.13 |

End of run: desk 97 balance / 932 earned, Wave 3 0 balance / 0 earned, Growth 97 balance / 2951.13 earned.

Old research desk nodes bought:

- day 2: De-ice ops (deice) for 34 points
- day 3: Belts and sorter (bag_sorter) for 32 points
- day 3: Kiosks and bag drop (self_service) for 22 points
- day 4: Hydrant fuel system (hydrant_fuel) for 36 points
- day 7: Stand classes (stand_class) for 40 points
- day 7: Widebody ops (widebody_ops) for 48 points
- day 10: Travelators (travelator) for 26 points
- day 14: Tank farm II (tank_farm_ii) for 30 points
- day 15: Scanner lanes (ct_lanes) for 28 points
- day 17: Hangar MRO (mro_hangar) for 72 points
- day 18: Military ramp (mil_ramp) for 42 points
- day 19: Skywalks (skywalk) for 34 points
- day 19: Heavy metal pack (heavy_pack) for 55 points
- day 19: Tank farm III (tank_farm_iii) for 46 points
- day 21: Night bank (night_bank) for 28 points
- day 21: Fuel rail (rail_fuel) for 44 points
- day 21: Cargo night hub (cargo_night_hub) for 68 points
- day 22: E-gates (egates) for 40 points
- day 23: Automated baggage (bag_bhs) for 58 points
- day 23: People mover (people_mover) for 52 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 2: De-ice pad (airfield-2) for 50 points
- day 3: Processing (terminal-2) for 50 points
- day 4: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 5: Catering kitchen (airside-2) for 50 points
- day 6: Inn (landside-2) for 50 points
- day 7: Large stands (airfield-3) for 52 points
- day 8: GSE depot (airside-3) for 52 points
- day 9: Long-stay park (landside-3) for 52 points
- day 10: Concourse (terminal-3) for 52 points
- day 10: Transfer Centre (retail-1) for 0 points
- day 10: ARFF station (safety-1) for 0 points
- day 11: RFID bag line (retail-2) for 50 points
- day 11: Police post (safety-2) for 50 points
- day 12: Food hall (retail-3) for 52 points
- day 13: Guard lanes (safety-3) for 52 points
- day 13: Heavy runway (airfield-4) for 54 points
- day 14: Wide hangar (airside-4) for 54 points
- day 14: Bus station (landside-4) for 54 points
- day 15: Lounge (retail-4) for 54 points
- day 15: Security hall (safety-4) for 54 points
- day 16: Jet bridge (terminal-4) for 54 points
- day 16: Control tower (airfield-5) for 56 points
- day 17: MRO bay (airside-5) for 56 points
- day 17: Rail spur (landside-5) for 56 points
- day 18: Seating (retail-5) for 56 points
- day 18: Incident drill (safety-5) for 56 points
- day 19: Skywalk (terminal-5) for 56 points
- day 19: Code E pier (airfield-6) for 62 points
- day 20: Specialisation charter (spec-charter) for 0 points
- day 20: Freight shed (spec-cargo-1) for 50 points
- day 20: Night freight (spec-cargo-2) for 52 points
- day 20: Sorter (spec-cargo-3) for 54 points
- day 21: Freighter stand (spec-cargo-4) for 56 points
- day 21: Night bank (airside-6) for 62 points
- day 22: Airport hotel (landside-6) for 62 points
- day 22: Comfort (retail-6) for 62 points
- day 22: Hardened perimeter (safety-6) for 62 points
- day 23: Cargo airline (spec-cargo-5) for 62 points
- day 23: People mover (terminal-6) for 62 points
- day 24: SAF blend (spec-green-1) for 75 points
- day 24: Transfer bank (spec-hub-1) for 75 points
- day 25: Fast turn (spec-lowcost-1) for 75 points
- day 25: Premium lane (spec-premium-1) for 75 points
- day 26: Quiet hours (spec-green-2) for 78 points
- day 26: Wave scheduling (spec-hub-2) for 78 points
- day 27: Remote stand (spec-lowcost-2) for 78 points
- day 27: Fast track (spec-premium-2) for 78 points
- day 27: Electric GSE (spec-green-3) for 81 points
- day 28: Minimum connect (spec-hub-3) for 81 points
- day 28: Thin lounge (spec-lowcost-3) for 81 points
- day 29: VIP room (spec-premium-3) for 81 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-486,700 |
| payroll | $-303,505 |
| building_upkeep | $-65,127 |
| loan_repayment | $-54,040 |
| land_holding | $-28,431 |
| staff_hiring | $-26,400 |
| fuel_purchase | $-21,200 |
| loan_interest | $-13,900 |
| emergency_refuse | $-13,600 |
| retail_cogs | $-5,918 |
| security_shock | $-5,600 |
| penalties | $-1,800 |
| city_levy | $-826 |
| refunds | $511 |
| catering_fees | $3,342 |
| baggage_fees | $4,178 |
| parking_fees | $8,145 |
| level_reward | $12,500 |
| task_rewards | $30,300 |
| passenger_fees | $44,667 |
| retail_sales | $72,226 |
| fuel_sales | $104,820 |
| landside_fees | $122,400 |
| landing_fees | $190,942 |
| loan_proceeds | $225,000 |
| contract_fees | $247,830 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Zoomjet | 49.6 | warm | 3 Trusted |
| Harbor Heli | 2.2 | neutral | 1 Published |
| Island Heli | -6 | neutral | 1 Published |
| Puddle Jumper Airlines | -7.6 | neutral | 1 Published |


- Driver put the clock back to 5× after the persona touched the speed buttons.
- recovery teleports: 0

## Browser smoke

Skipped. Headless measurement only. Browser smoke was not repeated.
