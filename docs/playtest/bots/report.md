# Hatchfield bot playtest

Generated 2026-10-15T04:27:54.203Z.

Headless bots use the player command API (new game, land, starter kit, the Apex Local fuel term, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at 5×. One sim day is 180s. Tick dt is 0.25s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. Careful and Greedy then hire one researcher. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful and Greedy, once cash is above three times the stamp and the airfield says Over the runway or curb or stand pressure is above 1, build a second runway and two more stands. Careful, when that expansion is not affordable and the curb pressure is over 1, adds a bus bay, then a taxi rank, then a curb lane instead of that day's other stamp.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 60.6s wall.

Flights 153 (3.4/day). Diverts 0 (connection diverts 0). Go-arounds 0. Missed-connection cash $0. Curb crossed 1 on day 20. Fuel groundings 0. Tree complete day —. Preferred day 14, Trusted day 30. Hub checklist station from day 1.

#### Time to first landing

42.5s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $508,046.

`▂▁▁▁▁▁▁▁▁▂▂▂▂▁▂▂▂▂▂▃▃▃▃▄▄▄▅▅▅▅▆▅▅▆▆▆▆▆▇▇▇▇▇███`  $2,477 → $508,046

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 4 | $25,109 |
| 8 | $34,994 |
| 12 | $75,956 |
| 16 | $60,896 |
| 20 | $131,067 |
| 24 | $219,184 |
| 28 | $295,535 |
| 32 | $324,621 |
| 36 | $373,130 |
| 40 | $431,713 |
| 44 | $495,366 |
| 45 | $508,046 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 1.

Recovered:

- PDJ127 taxi_out for 51s step=none cleared at 3575s
- PDJ127 stuck on the ground step=none cleared at 3576s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 52.5.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 14 | 70 | 83 |
| 8 | 12 | 70 | 86 |
| 12 | 13 | 70 | 85 |
| 16 | 28 | 70 | 83 |
| 20 | 13 | 68.9 | 78 |
| 24 | 28 | 65.3 | 78 |
| 28 | 77 | 54.1 | 76 |
| 32 | 67 | 44.8 | 76 |
| 36 | 53 | 18.2 | 65 |
| 40 | 43 | 16.6 | 66 |
| 44 | 63 | 35.4 | 66 |
| 45 | 41 | 7.4 | 66 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 119.2 | 0 | 13.8s | 0 | 0 |
| 47.1 | 38 | 6922.5s | 4 | 68 |
| 43.5 | 0 | 31.3s | 0 | 4 |
| 36.4 | 32 | 5836.3s | 4 | 73 |
| 35.1 | 39 | 7113.8s | 4 | 44 |
| 34.1 | 38 | 6931.3s | 4 | 68 |
| 32.8 | 43 | 7752.5s | 5 | 85 |
| 31.1 | 38 | 6840s | 4 | 61 |

#### Anything the bot could not do

254 failed commands.

- acceptContract ×134 — Harbor Heli signed, and they will remember the squeeze.
- acceptContract ×111 — Harbor Heli signed.
- acceptContract ×2 — Zoomjet signed.
- acceptContract ×2 — Alpine Swift signed.
- stamp ×2 — runway: That strip sits inside runway clearance. Leave the shoulder empty.
- acceptContract ×1 — Zoomjet needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Alpine Swift needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Harbor Heli needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks

Built:

- Runway strips 2, stands 6, terminal tiles 9, snack bars 1
- Shop units 5, leased 5, flights completed 153
- Signed: air_regional_1
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 2, bagdrop 1, lounge 1, bathroom 3, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 149 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, airfield-4, airside-4, landside-4, retail-4, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, safety-4, spec-cargo-3, terminal-4, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, airfield-5, airside-5, landside-5, retail-5, safety-5, spec-cargo-4, terminal-5, spec-green-3, spec-hub-3).
Desks: 3 agents, check-in empty, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 2, security 13.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 0.8 (peak 2.1), queue 0 (peak 6), delay 0s, lanes 2, bus bays 1, curb lanes 1, taxi ranks 1.
Happiness peak 76.5. Guest peak 77. Field-ask fines booked at the full rate: 0. Penalties total $-24,700.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 108 | 492 | 0 | 0 | 108 | 982 |
| 45 | 149 | 681 | 0 | 0 | 149 | 2053.15 |

End of run: desk 149 balance / 681 earned, Wave 3 0 balance / 0 earned, Growth 149 balance / 2053.15 earned.

Old research desk nodes bought:

- day 2: De-ice ops (deice) for 34 points
- day 3: Belts and sorter (bag_sorter) for 32 points
- day 3: Kiosks and bag drop (self_service) for 22 points
- day 4: Stand classes (stand_class) for 40 points
- day 4: Widebody ops (widebody_ops) for 48 points
- day 5: Travelators (travelator) for 26 points
- day 6: Hydrant fuel system (hydrant_fuel) for 36 points
- day 12: Transfer Centre (transfer_centre) for 36 points
- day 14: RFID bag line (rfid_bag_line) for 52 points
- day 19: Tank farm II (tank_farm_ii) for 30 points
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
- day 4: Large stands (airfield-3) for 38 points
- day 5: Concourse (terminal-3) for 38 points
- day 6: Fuel farm (airside-1) for 0 points
- day 7: Curb road (landside-1) for 0 points
- day 8: Catering kitchen (airside-2) for 26 points
- day 9: Inn (landside-2) for 26 points
- day 10: GSE depot (airside-3) for 38 points
- day 11: Long-stay park (landside-3) for 38 points
- day 12: Transfer Centre (retail-1) for 0 points
- day 13: ARFF station (safety-1) for 0 points
- day 14: RFID bag line (retail-2) for 26 points
- day 15: Police post (safety-2) for 26 points
- day 16: Food hall (retail-3) for 38 points
- day 17: Guard lanes (safety-3) for 38 points
- day 18: Heavy runway (airfield-4) for 54 points
- day 19: Wide hangar (airside-4) for 54 points
- day 20: Bus station (landside-4) for 54 points
- day 21: Lounge (retail-4) for 54 points
- day 22: Specialisation charter (spec-charter) for 0 points
- day 23: Freight shed (spec-cargo-1) for 26 points
- day 24: Night freight (spec-cargo-2) for 38 points
- day 25: SAF blend (spec-green-1) for 39 points
- day 26: Transfer bank (spec-hub-1) for 39 points
- day 27: Fast turn (spec-lowcost-1) for 39 points
- day 28: Premium lane (spec-premium-1) for 39 points
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
| payroll | $-509,042 |
| construction | $-376,900 |
| building_upkeep | $-111,447 |
| fuel_purchase | $-39,896 |
| land_holding | $-31,577 |
| loan_repayment | $-26,400 |
| city_levy | $-24,793 |
| staff_hiring | $-18,400 |
| emergency_refuse | $-12,400 |
| security_shock | $-8,000 |
| loan_interest | $-7,040 |
| retail_cogs | $-6,497 |
| penalties | $-4,300 |
| parking_fees | $16,461 |
| level_reward | $20,500 |
| baggage_fees | $21,373 |
| loan_proceeds | $25,000 |
| task_rewards | $38,900 |
| passenger_fees | $40,214 |
| retail_sales | $84,756 |
| fuel_sales | $163,172 |
| landside_fees | $196,800 |
| contract_fees | $265,570 |
| landing_fees | $643,992 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 64.5 | partner | 3 Trusted |


- taxi-out recoveries cleared 1 stalls; teleport entries: 0

### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 104.9s wall.

Flights 197 (3.3/day). Diverts 1 (connection diverts 0). Go-arounds 0. Missed-connection cash $0. Curb crossed 1 on day 21. Fuel groundings 0. Tree complete day 53. Preferred day 16, Trusted day 34. Hub checklist station from day 1.

#### Time to first landing

40s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $70,861.

`▂▁▁▁▂▁▁▁▁▂▁▁▂▂▃▃▃▁▂▂▁▁▂▃▁▂▂▃▁▂▂`  $6,676 → $335,166

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 5 | $15,702 |
| 10 | $21,851 |
| 15 | $41,797 |
| 20 | $27,425 |
| 25 | $335,166 |
| 30 | $123,498 |
| 35 | $32,601 |
| 40 | $6,676 |
| 45 | $65,914 |
| 50 | $44,482 |
| 55 | $12,189 |
| 60 | $70,861 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 2.

Recovered:

- PDJ109 taxi_out for 48s step=none cleared at 793s
- PDJ109 stuck on the ground step=none cleared at 794s
- LIF173 taxi_out for 41s step=none cleared at 2396s
- LIF173 stuck on the ground step=none cleared at 2399s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 45.1.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 12 | 70 | 87 |
| 10 | 30 | 64.3 | 83 |
| 15 | 13 | 71.8 | 80 |
| 20 | 15 | 70 | 80 |
| 25 | 40 | 72.6 | 80 |
| 30 | 63 | 49.8 | 70 |
| 35 | 47 | 28.6 | 66 |
| 40 | 47 | 23.8 | 61 |
| 45 | 24 | 7.9 | 61 |
| 50 | 50 | 21.3 | 62 |
| 55 | 65 | 20.7 | 60 |
| 60 | 58 | 25.3 | 60 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 53.2 | 29 | 5363.8s | 5 | 72 |
| 44.2 | 59 | 10771.3s | 5 | 80 |
| 43.4 | 56 | 10132.5s | 5 | 54 |
| 37.8 | 45 | 8216.3s | 5 | 76 |
| 37.5 | 29 | 5296.3s | 5 | 69 |
| 37.4 | 52 | 9493.8s | 5 | 59 |
| 36.8 | 31 | 5661.3s | 5 | 47 |
| 36.5 | 35 | 6391.3s | 5 | 44 |

#### Anything the bot could not do

708 failed commands.

- acceptContract ×212 — Harbor Heli signed, and they will remember the squeeze.
- acceptContract ×113 — Harbor Heli signed.
- buyParcel ×70 — Parcel locked — reach Field Level 5 first.
- buyResearch ×12 — Already unlocked.
- acceptContract ×8 — Alpine Swift signed.
- buyParcel ×7 — Parcel locked — reach Field Level 2 first.
- buyParcel ×5 — Need Fringe plot 4-2 — short 56414.
- buyParcel ×4 — Need Fringe plot 3-4 — short 13036.
- buyParcel ×4 — Need Fringe plot 4-3 — short 27685.
- buyParcel ×4 — Need Fringe plot 4-3 — short 8463.
- buyParcel ×4 — Need Fringe plot 4-4 — short 34387.
- buyParcel ×4 — Need Approach plot 4-1 — short 84016.
- buyParcel ×4 — Need Approach plot 4-1 — short 53965.
- buyParcel ×3 — Need Fringe plot 4-2 — short 44311.
- buyParcel ×3 — Need Fringe plot 4-2 — short 33585.
- buyParcel ×3 — Need Fringe plot 4-2 — short 9189.
- buyParcel ×3 — Need Fringe plot 4-3 — short 58862.
- buyParcel ×3 — Need Fringe plot 4-3 — short 49994.
- buyParcel ×3 — Need Fringe plot 4-3 — short 8078.
- buyParcel ×3 — Need Fringe plot 4-4 — short 64985.
- buyParcel ×3 — Need Fringe plot 4-4 — short 45252.
- buyParcel ×3 — Need Fringe plot 4-4 — short 27538.
- buyParcel ×3 — Need Fringe plot 4-4 — short 13734.
- buyParcel ×3 — Need Approach plot 4-1 — short 64677.
- acceptContract ×2 — Zoomjet signed.
- buyResearch ×2 — Need 108 RP (have 5).
- buyResearch ×2 — Need 108 RP (have 3).
- buyParcel ×2 — Need Approach plot 3-1 — short 283.
- buyParcel ×2 — Need Fringe plot 4-2 — short 41525.
- buyParcel ×2 — Need Fringe plot 4-2 — short 36206.
- buyParcel ×2 — Need Fringe plot 4-2 — short 11589.
- buyParcel ×2 — Need Fringe plot 4-2 — short 1045.
- buyParcel ×2 — Need Fringe plot 4-2 — short 3788.
- buyParcel ×2 — Need Fringe plot 4-3 — short 59100.
- buyParcel ×2 — Need Fringe plot 4-3 — short 49609.
- buyParcel ×2 — Need Fringe plot 4-3 — short 49804.
- buyParcel ×2 — Need Fringe plot 4-3 — short 38746.
- buyParcel ×2 — Need Fringe plot 4-3 — short 38805.
- buyParcel ×2 — Need Fringe plot 4-3 — short 29543.
- buyParcel ×2 — Need Fringe plot 4-4 — short 65370.

Built:

- Runway strips 2, stands 8, terminal tiles 9, snack bars 2
- Shop units 8, leased 2, flights completed 197
- Signed: air_regional_1
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 324 points, 63 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airfield-5, terminal-5, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airside-5, landside-5, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, retail-5, safety-5, airfield-6, airside-6, landside-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-cargo-4, spec-green-3, spec-hub-3, spec-lowcost-3, spec-premium-3, retail-6, safety-6, spec-cargo-5, terminal-6, spec-green-4, spec-hub-4, spec-lowcost-4, spec-premium-4, airside-7, spec-green-5, spec-hub-5, spec-lowcost-5, spec-premium-5).
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 1, security 7.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 4 (peak 4.2), queue 18.6 (peak 18.6), delay 72s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 74.8. Guest peak 95. Field-ask fines booked at the full rate: 0. Penalties total $-27,900.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 55 | 828 | 0 | 0 | 55 | 2283.49 |
| 45 | 35 | 958 | 0 | 0 | 35 | 3467.74 |
| 60 | 324 | 1247 | 0 | 0 | 324 | 4404 |

End of run: desk 324 balance / 1247 earned, Wave 3 0 balance / 0 earned, Growth 324 balance / 4404 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 1: Stand classes (stand_class) for 40 points
- day 1: Widebody ops (widebody_ops) for 48 points
- day 2: Travelators (travelator) for 26 points
- day 5: Skywalks (skywalk) for 34 points
- day 5: Hydrant fuel system (hydrant_fuel) for 36 points
- day 7: Tank farm II (tank_farm_ii) for 30 points
- day 9: Hangar MRO (mro_hangar) for 72 points
- day 13: Scanner lanes (ct_lanes) for 28 points
- day 15: Transfer Centre (transfer_centre) for 36 points
- day 15: Military ramp (mil_ramp) for 42 points
- day 16: RFID bag line (rfid_bag_line) for 52 points
- day 17: Heavy metal pack (heavy_pack) for 55 points
- day 17: Tank farm III (tank_farm_iii) for 46 points
- day 18: Night bank (night_bank) for 28 points
- day 18: Fuel rail (rail_fuel) for 44 points
- day 18: Cargo night hub (cargo_night_hub) for 68 points
- day 34: E-gates (egates) for 40 points
- day 36: Automated baggage (bag_bhs) for 58 points
- day 36: People mover (people_mover) for 52 points
- day 44: pipeline_fuel (pipeline_fuel) for 0 points

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
- day 4: Control tower (airfield-5) for 76 points
- day 5: Skywalk (terminal-5) for 76 points
- day 5: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 5: Catering kitchen (airside-2) for 26 points
- day 6: Inn (landside-2) for 26 points
- day 6: GSE depot (airside-3) for 38 points
- day 7: Long-stay park (landside-3) for 38 points
- day 7: Wide hangar (airside-4) for 54 points
- day 8: Bus station (landside-4) for 54 points
- day 9: MRO bay (airside-5) for 76 points
- day 10: Rail spur (landside-5) for 76 points
- day 11: Transfer Centre (retail-1) for 0 points
- day 11: ARFF station (safety-1) for 0 points
- day 11: RFID bag line (retail-2) for 26 points
- day 11: Police post (safety-2) for 26 points
- day 11: Food hall (retail-3) for 38 points
- day 12: Guard lanes (safety-3) for 38 points
- day 12: Lounge (retail-4) for 54 points
- day 13: Security hall (safety-4) for 54 points
- day 14: Seating (retail-5) for 76 points
- day 15: Incident drill (safety-5) for 76 points
- day 17: Code E pier (airfield-6) for 108 points
- day 18: Night bank (airside-6) for 108 points
- day 19: Airport hotel (landside-6) for 108 points
- day 20: Specialisation charter (spec-charter) for 0 points
- day 20: Freight shed (spec-cargo-1) for 26 points
- day 20: Night freight (spec-cargo-2) for 38 points
- day 21: SAF blend (spec-green-1) for 39 points
- day 21: Transfer bank (spec-hub-1) for 39 points
- day 22: Fast turn (spec-lowcost-1) for 39 points
- day 22: Premium lane (spec-premium-1) for 39 points
- day 23: Sorter (spec-cargo-3) for 54 points
- day 24: Quiet hours (spec-green-2) for 57 points
- day 24: Wave scheduling (spec-hub-2) for 57 points
- day 25: Remote stand (spec-lowcost-2) for 57 points
- day 26: Fast track (spec-premium-2) for 57 points
- day 27: Freighter stand (spec-cargo-4) for 76 points
- day 28: Electric GSE (spec-green-3) for 81 points
- day 29: Minimum connect (spec-hub-3) for 81 points
- day 30: Thin lounge (spec-lowcost-3) for 81 points
- day 31: VIP room (spec-premium-3) for 81 points
- day 32: Comfort (retail-6) for 108 points
- day 34: Hardened perimeter (safety-6) for 108 points
- day 35: Cargo airline (spec-cargo-5) for 108 points
- day 36: People mover (terminal-6) for 108 points
- day 38: Rail first (spec-green-4) for 114 points
- day 39: Hub pier (spec-hub-4) for 114 points
- day 41: High frequency (spec-lowcost-4) for 114 points
- day 42: Bridge service (spec-premium-4) for 114 points
- day 44: Fuel pipeline (airside-7) for 154 points
- day 46: Green report (spec-green-5) for 162 points
- day 48: Alliance desk (spec-hub-5) for 162 points
- day 50: Low-cost deal (spec-lowcost-5) for 162 points
- day 52: Flagship deal (spec-premium-5) for 162 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-1,383,682 |
| payroll | $-695,947 |
| loan_repayment | $-187,074 |
| building_upkeep | $-148,337 |
| land_holding | $-82,673 |
| fuel_purchase | $-51,068 |
| loan_interest | $-46,800 |
| staff_hiring | $-19,700 |
| emergency_refuse | $-12,400 |
| security_shock | $-11,200 |
| retail_cogs | $-7,754 |
| penalties | $-4,300 |
| city_levy | $-937 |
| catering_fees | $12,397 |
| parking_fees | $21,483 |
| baggage_fees | $28,600 |
| level_reward | $30,500 |
| task_rewards | $38,900 |
| passenger_fees | $50,304 |
| retail_sales | $116,695 |
| fuel_sales | $201,818 |
| landside_fees | $261,600 |
| loan_proceeds | $365,000 |
| contract_fees | $523,967 |
| landing_fees | $903,469 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 86.7 | partner | 4 Priority |


- taxi-out recoveries cleared 2 stalls; teleport entries: 0

### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 31.7s wall.

Flights 84 (2.8/day). Diverts 0 (connection diverts 0). Go-arounds 1. Missed-connection cash $0. Curb crossed 1 on day 22. Fuel groundings 0. Tree complete day —. Preferred day 15, Trusted day 28. Hub checklist station from day 2.

#### Time to first landing

80s (day 0) — LIF102 entered landing.

#### Cash curve

Start $168,000 · end $202,742.

`▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▁▁▂▂████`  $1,957 → $213,880

| Day | Cash |
| --- | --- |
| 0 | $118,000 |
| 3 | $1,980 |
| 6 | $4,358 |
| 9 | $4,149 |
| 12 | $10,848 |
| 15 | $6,952 |
| 18 | $6,024 |
| 21 | $15,414 |
| 24 | $16,283 |
| 27 | $212,052 |
| 30 | $202,742 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 58.3.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 0 | — | 77 |
| 6 | 18 | 65.5 | 74 |
| 9 | 0 | — | 78 |
| 12 | 18 | 69.8 | 81 |
| 15 | 8 | 74 | 76 |
| 18 | 32 | 68.4 | 69 |
| 21 | 11 | 62 | 76 |
| 24 | 80 | 54.2 | 72 |
| 27 | 21 | 39.2 | 75 |
| 30 | 16 | 24.3 | 74 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 27.4 | 29 | 5223.8s | 5 | 24 |
| 26 | 24 | 4337.5s | 5 | 85 |
| 25.4 | 28 | 5048.8s | 5 | 14 |
| 24.5 | 29 | 5315s | 5 | 38 |
| 24.3 | 26 | 4761.3s | 5 | 40 |
| 23.9 | 21 | 3881.3s | 3 | 28 |
| 23.9 | 28 | 5197.5s | 5 | 24 |
| 23.8 | 22 | 4001.3s | 4 | 39 |

#### Anything the bot could not do

29 failed commands.

- hireJanitor ×11 — Janitor crew maxed (6).
- acceptContract ×7 — Puddle Jumper Airlines signed, and they will remember the squeeze.
- acceptContract ×1 — Puddle Jumper Airlines needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Puddle Jumper Airlines signed.
- buyRoom ×1 — Need Security — short 2800.
- buyRoom ×1 — Need Research desk — short 3261.
- hireJanitor ×1 — Need hire janitor — short 189.
- buyRoom ×1 — Need Gate hold — short 746.
- buyRoom ×1 — Need Security — short 2146.
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyRoom ×1 — Need Security — short 841.
- stamp ×1 — stand_s: That stand overlaps a building.

Built:

- Runway strips 1, stands 12, terminal tiles 9, snack bars 4
- Shop units 12, leased 8, flights completed 84
- Signed: zoomjet
- Rooms: checkin 5, security 5, gate 8, bagclaim 1, food 3, souvenir 5, bagdrop 1, lounge 3, bathroom 9, rdesk 6, rboard 7, rmachine 4

#### New systems

Research tree: 74 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airfield-5, airside-5, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, landside-5, retail-5, safety-5, terminal-5, airfield-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-cargo-4, spec-green-3).
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 2, security 9.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 1.4 (peak 1.6), queue 2.8 (peak 2.8), delay 11s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 75. Guest peak 80. Field-ask fines booked at the full rate: 0. Penalties total $-27,987.

#### Research pools

Lab furniture at the end: 6 research desks, 7 chalkboards, 4 lab benches. Researchers on payroll: 0.

Measured room rate: 0.46 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 0 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.16 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.16 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 74 | 619 | 0 | 0 | 74 | 2005.06 |

End of run: desk 74 balance / 619 earned, Wave 3 0 balance / 0 earned, Growth 74 balance / 2005.06 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 2: Stand classes (stand_class) for 40 points
- day 2: Widebody ops (widebody_ops) for 48 points
- day 3: Travelators (travelator) for 26 points
- day 5: Hydrant fuel system (hydrant_fuel) for 36 points
- day 8: Tank farm II (tank_farm_ii) for 30 points
- day 11: Hangar MRO (mro_hangar) for 72 points
- day 15: Scanner lanes (ct_lanes) for 28 points
- day 17: Military ramp (mil_ramp) for 42 points
- day 18: Skywalks (skywalk) for 34 points
- day 20: Heavy metal pack (heavy_pack) for 55 points
- day 20: Tank farm III (tank_farm_iii) for 46 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 1: De-ice pad (airfield-2) for 26 points
- day 1: Processing (terminal-2) for 26 points
- day 2: Large stands (airfield-3) for 38 points
- day 3: Concourse (terminal-3) for 38 points
- day 4: Heavy runway (airfield-4) for 54 points
- day 5: Jet bridge (terminal-4) for 54 points
- day 5: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 6: Catering kitchen (airside-2) for 26 points
- day 6: Inn (landside-2) for 26 points
- day 7: GSE depot (airside-3) for 38 points
- day 7: Long-stay park (landside-3) for 38 points
- day 8: Wide hangar (airside-4) for 54 points
- day 9: Bus station (landside-4) for 54 points
- day 10: Control tower (airfield-5) for 76 points
- day 11: MRO bay (airside-5) for 76 points
- day 11: Transfer Centre (retail-1) for 0 points
- day 11: ARFF station (safety-1) for 0 points
- day 12: RFID bag line (retail-2) for 26 points
- day 12: Police post (safety-2) for 26 points
- day 13: Food hall (retail-3) for 38 points
- day 13: Guard lanes (safety-3) for 38 points
- day 14: Lounge (retail-4) for 54 points
- day 15: Security hall (safety-4) for 54 points
- day 15: Rail spur (landside-5) for 76 points
- day 16: Seating (retail-5) for 76 points
- day 17: Incident drill (safety-5) for 76 points
- day 18: Skywalk (terminal-5) for 76 points
- day 20: Code E pier (airfield-6) for 108 points
- day 21: Specialisation charter (spec-charter) for 0 points
- day 21: Freight shed (spec-cargo-1) for 26 points
- day 22: Night freight (spec-cargo-2) for 38 points
- day 22: SAF blend (spec-green-1) for 39 points
- day 23: Transfer bank (spec-hub-1) for 39 points
- day 23: Fast turn (spec-lowcost-1) for 39 points
- day 23: Premium lane (spec-premium-1) for 39 points
- day 24: Sorter (spec-cargo-3) for 54 points
- day 25: Quiet hours (spec-green-2) for 57 points
- day 25: Wave scheduling (spec-hub-2) for 57 points
- day 26: Remote stand (spec-lowcost-2) for 57 points
- day 27: Fast track (spec-premium-2) for 57 points
- day 28: Freighter stand (spec-cargo-4) for 76 points
- day 29: Electric GSE (spec-green-3) for 81 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-470,800 |
| payroll | $-209,538 |
| loan_repayment | $-58,870 |
| building_upkeep | $-43,544 |
| staff_hiring | $-26,400 |
| fuel_purchase | $-24,472 |
| land_holding | $-18,220 |
| loan_interest | $-15,250 |
| emergency_refuse | $-14,400 |
| retail_cogs | $-6,293 |
| security_shock | $-4,800 |
| penalties | $-4,787 |
| crash_fine | $-4,000 |
| city_levy | $-1,224 |
| catering_fees | $750 |
| baggage_fees | $6,242 |
| parking_fees | $8,352 |
| level_reward | $12,500 |
| task_rewards | $35,300 |
| passenger_fees | $51,074 |
| fuel_sales | $73,600 |
| retail_sales | $73,716 |
| landing_fees | $125,037 |
| landside_fees | $129,600 |
| contract_fees | $196,169 |
| loan_proceeds | $225,000 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Zoomjet | 48.9 | warm | 3 Trusted |
| Puddle Jumper Airlines | -18 | neutral | 1 Published |


- Driver put the clock back to 5× after the persona touched the speed buttons.
- taxi-out recoveries cleared 0 stalls; teleport entries: 0

## Browser smoke

Scripted opening finished.

Opening played through the first landing.

Wall 134.6s. Clock ended at 151s.

#### Time to first landing

20.8s.

#### Cash curve

Ended at $61,899.

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
| 15.4 | 0 | 45.4s | 1 | 28 |
| 13.8 | 0 | 10s | 1 | 16 |
| 11.9 | 0 | 9.7s | 1 | 16 |
| 11.8 | 0 | 56.2s | 1 | 28 |
| 11.4 | 0 | 42.4s | 1 | 14 |
| 10.2 | 0 | 54.2s | 1 | 28 |
| 9.7 | 0 | 18.3s | 1 | 9 |
| 9.1 | 0 | 90.2s | 1 | 14 |

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
- Sim clock reached 147s before the 90s wall cap (target 300s).
- Opening check passed. Screenshots: /workspace/docs/playtest/opening/01-title.png, /workspace/docs/playtest/opening/02-plot.png, /workspace/docs/playtest/opening/03-coach.png, /workspace/docs/playtest/opening/04-runway-refused.png, /workspace/docs/playtest/opening/05-kit-stamped.png, /workspace/docs/playtest/opening/06-contract.png, /workspace/docs/playtest/opening/07-landing.png, /workspace/docs/playtest/opening/08-pause.png
