# Hatchfield bot playtest

Generated 2026-10-14T18:40:41.522Z.

Headless bots use the player command API (new game, land, starter kit, tile stamps, hall rooms, contract letters, loans, shop bids) and run at 5×. One sim day is 180s. Tick dt is 0.25s.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 68s wall.

#### Time to first landing

48.8s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $150,000 · end $-21,490.

`█▄▃▄▄▃▃▃▃▃▃▃▃▃▃▃▃▃▁▂▃▃▃▃▃▃▃▃▃▃▃▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁`  $-21,637 → $55,000

| Day | Cash |
| --- | --- |
| 0 | $55,000 |
| 4 | $8,113 |
| 8 | $3,716 |
| 12 | $2,180 |
| 16 | $3,718 |
| 20 | $-259 |
| 24 | $3,792 |
| 28 | $-2,931 |
| 32 | $-21,188 |
| 36 | $-21,361 |
| 40 | $-21,587 |
| 44 | $-19,844 |
| 45 | $-21,490 |

#### Stuck or recovered

No entity was still stuck at the end.

Recovered:

- PDJ117 taxi_out for 53s cleared at 740s
- PDJ117 stuck on the ground cleared at 741s
- ZO109 taxi_out for 41s cleared at 1534s
- ZO109 stuck on the ground cleared at 1536s
- LIF165 taxi_out for 41s cleared at 3503s
- BNW168 taxi_out for 45s cleared at 5014s
- BNW168 stuck on the ground cleared at 5016s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 116.8.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 30 | 82.4 | 78 |
| 8 | 171 | 63.9 | 57 |
| 12 | 151 | 102.1 | 56 |
| 16 | 118 | 169.6 | 54 |
| 20 | 76 | 230.9 | 47 |
| 24 | 53 | 232.6 | 47 |
| 28 | 17 | 64.2 | 47 |
| 32 | 6 | 48.6 | 37 |
| 36 | 0 | — | 25 |
| 40 | 0 | — | 25 |
| 44 | 0 | — | 25 |
| 45 | 0 | — | 25 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 83.5 | 0 | 13.8s | 0 | 0 |
| 48.7 | 8 | 1491.3s | 2 | 197 |
| 47.7 | 7 | 1430s | 2 | 154 |
| 47.7 | 8 | 1506.3s | 2 | 215 |
| 47.3 | 8 | 1501.3s | 2 | 215 |
| 46.6 | 8 | 1566.3s | 2 | 225 |
| 45.1 | 11 | 1986.3s | 2 | 183 |
| 44.9 | 8 | 1505s | 2 | 215 |

#### Anything the bot could not do

0 failed commands.

Every command succeeded.

Built:

- Runway strips 1, stands 2, terminal tiles 9, snack bars 1
- Shop units 4, leased 4, flights completed 76
- Signed: air_regional_1, zoomjet, alpine_swift, air_lowcost_1, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, borneo_wings, dune_jet, air_cargo_1
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 1, bagdrop 1, lounge 1, bathroom 2

### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 61.2s wall.

#### Time to first landing

51.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $150,000 · end $-18,424.

`█▃▃▃▃▄▃▁▂▃▃▃▃▂▂▂▂▂▂▁▁▁▁▁▁▁▁▂▁▁▁`  $-18,564 → $55,000

| Day | Cash |
| --- | --- |
| 0 | $55,000 |
| 5 | $4,768 |
| 10 | $8,127 |
| 15 | $-15,621 |
| 20 | $4,687 |
| 25 | $1,494 |
| 30 | $-12,089 |
| 35 | $-7,874 |
| 40 | $-15,177 |
| 45 | $-17,690 |
| 50 | $-18,363 |
| 55 | $-16,407 |
| 60 | $-18,424 |

#### Stuck or recovered

No entity was still stuck at the end.

Recovered:

- PDJ102 taxi_out for 41s cleared at 325s
- LIF119 taxi_out for 43s cleared at 619s
- LIF119 stuck on the ground cleared at 621s
- ZO108 taxi_out for 58s cleared at 1373s
- ZO108 stuck on the ground cleared at 1374s
- LIF132 taxi_out for 46s cleared at 1388s
- LIF132 stuck on the ground cleared at 1389s
- LIF136 taxi_out for 64s cleared at 1586s
- LIF136 stuck on the ground cleared at 1589s
- ZO109 taxi_out for 63s cleared at 1724s
- ZO109 stuck on the ground cleared at 1726s
- ALS118 taxi_out for 45s cleared at 1770s
- … 20 more

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 48.1.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 5 | 64 | 71 |
| 10 | 44 | 34.7 | 61 |
| 15 | 31 | 63.6 | 51 |
| 20 | 9 | 86 | 42 |
| 25 | 12 | 70 | 44 |
| 30 | 0 | — | 25 |
| 35 | 0 | — | 25 |
| 40 | 3 | -0.3 | 25 |
| 45 | 3 | -41 | 25 |
| 50 | 3 | -2 | 25 |
| 55 | 0 | — | 25 |
| 60 | 0 | — | 25 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 40.7 | 0 | 13.8s | 0 | 0 |
| 33.2 | 36 | 6552.5s | 0 | 0 |
| 27.3 | 9 | 1671.3s | 3 | 58 |
| 25.5 | 8 | 1586.3s | 2 | 53 |
| 23.1 | 8 | 1515s | 3 | 70 |
| 22.2 | 9 | 1741.3s | 2 | 47 |
| 21.9 | 8 | 1516.3s | 3 | 67 |
| 21.3 | 8 | 1585s | 2 | 53 |

#### Anything the bot could not do

7 failed commands.

- buyParcel ×7 — Parcel locked — reach Field Level 2 first.

Built:

- Runway strips 1, stands 6, terminal tiles 9, snack bars 2
- Shop units 8, leased 2, flights completed 57
- Signed: air_regional_1, zoomjet, alpine_swift, air_lowcost_1, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, air_cargo_1, borneo_wings
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2

### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 20.1s wall.

#### Time to first landing

80s (day 0) — LIF102 entered landing.

#### Cash curve

Start $150,000 · end $-323.

`█▄▂▂▂▂▃▃▂▃▂▂▂▂▂▂▂▂▃▃▃▃▁▁▁▁▁▁▂▂▂`  $-20,171 → $75,200

| Day | Cash |
| --- | --- |
| 0 | $75,200 |
| 3 | $-923 |
| 6 | $1,176 |
| 9 | $824 |
| 12 | $-3,064 |
| 15 | $-6,627 |
| 18 | $516 |
| 21 | $2,945 |
| 24 | $-16,245 |
| 27 | $-14,136 |
| 30 | $-323 |

#### Stuck or recovered

No entity was still stuck at the end.

Recovered:

- LIF114 taxi_out for 46s cleared at 1473s
- LIF114 stuck on the ground cleared at 1474s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

No hall guests were sampled.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 0 | — | 54 |
| 6 | 0 | — | 45 |
| 9 | 0 | — | 45 |
| 12 | 0 | — | 45 |
| 15 | 0 | — | 45 |
| 18 | 0 | — | 45 |
| 21 | 0 | — | 45 |
| 24 | 0 | — | 42 |
| 27 | 0 | — | 42 |
| 30 | 0 | — | 42 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 20 | 0 | 63.8s | 0 | 0 |
| 19.3 | 16 | 2902.5s | 0 | 0 |
| 14.6 | 29 | 5230s | 0 | 0 |
| 10.8 | 0 | 66.3s | 0 | 0 |
| 10 | 26 | 4856.3s | 0 | 0 |
| 9.5 | 23 | 4292.5s | 0 | 0 |
| 8.9 | 9 | 1767.5s | 1 | 0 |
| 8.5 | 26 | 4851.3s | 0 | 0 |

#### Anything the bot could not do

89 failed commands.

- hireJanitor ×3 — Need hire janitor — short 5700.
- buyRoom ×2 — Need Gate hold — short 6861.
- buyRoom ×2 — Need Hall food — short 6027.
- hireJanitor ×2 — Need hire janitor — short 3969.
- hireJanitor ×2 — Need hire janitor — short 1874.
- hireJanitor ×2 — Need hire janitor — short 2001.
- hireJanitor ×2 — Need hire janitor — short 18845.
- buyRoom ×2 — Need Airline lounge — short 22062.
- hireJanitor ×2 — Need hire janitor — short 15795.
- buyRoom ×2 — Need Restrooms — short 15736.
- buyRoom ×1 — Need Hall food — short 1921.
- buyRoom ×1 — Need Restrooms — short 3266.
- hireJanitor ×1 — Need hire janitor — short 4866.
- buyRoom ×1 — Need Security — short 6966.
- buyRoom ×1 — Need Restrooms — short 2566.
- hireJanitor ×1 — Need hire janitor — short 2689.
- buyRoom ×1 — Need Gate hold — short 1289.
- buyRoom ×1 — Need Airline lounge — short 4800.
- buyRoom ×1 — Need Souvenirs — short 3123.
- buyRoom ×1 — Need Security — short 1169.
- buyRoom ×1 — Need Restrooms — short 3265.
- buyRoom ×1 — Need Hall food — short 4265.
- buyRoom ×1 — Need Gate hold — short 4300.
- hireJanitor ×1 — Need hire janitor — short 3200.
- buyRoom ×1 — Need Hall food — short 2600.
- buyRoom ×1 — Need Check-in — short 2955.
- hireJanitor ×1 — Need hire janitor — short 555.
- hireJanitor ×1 — Need hire janitor — short 1578.
- buyRoom ×1 — Need Check-in — short 7158.
- buyRoom ×1 — Need Restrooms — short 8858.
- buyRoom ×1 — Need Airline lounge — short 10360.
- buyRoom ×1 — Need Restrooms — short 7160.
- hireJanitor ×1 — Need hire janitor — short 8760.
- hireJanitor ×1 — Need hire janitor — short 5560.
- buyRoom ×1 — Need Check-in — short 2400.
- buyRoom ×1 — Need Airline lounge — short 9764.
- buyRoom ×1 — Need Restrooms — short 6564.
- hireJanitor ×1 — Need hire janitor — short 8164.
- buyRoom ×1 — Need Restrooms — short 2429.
- buyRoom ×1 — Need Check-in — short 13061.

Built:

- Runway strips 1, stands 2, terminal tiles 9, snack bars 2
- Shop units 6, leased 3, flights completed 25
- Signed: nobody
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 2, souvenir 2, bagdrop 1, lounge 1, bathroom 3

- Driver put the clock back to 5× after the persona touched the speed buttons.

## Browser smoke

Scripted opening finished.

Opening played through the first landing.

Wall 120.3s. Clock ended at 248s.

#### Time to first landing

29.3s.

#### Cash curve

Ended at $3,873.

`█▁`  $3,207 → $6,300

#### Stuck or recovered

None still stuck.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness 93.8.

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 16 | 1 | 180.2s | 1 | 2 |
| 14.1 | 0 | 19.2s | 1 | 16 |
| 12.3 | 0 | 83.6s | 2 | 28 |
| 11.1 | 0 | 48.9s | 1 | 14 |
| 9.6 | 0 | 179.9s | 1 | 2 |
| 9.4 | 0 | 33s | 1 | 12 |
| 8.9 | 0 | 89.9s | 2 | 28 |
| 8.7 | 0 | 32.3s | 1 | 12 |

#### Anything the bot could not do

- buyRoom — Hall food was not on the services panel (no hall selected)
- buyRoom — Souvenirs was not on the services panel (no hall selected)

Script:

- open http://127.0.0.1:45991/?playtest=1
- sandbox off
- new game
- passenger start
- starter kit
- open contract letter
- accept contract
- open pavement tray
- select taxiway
- click the field
- services tab
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

- Sim clock reached 242s before the 90s wall cap (target 300s).
