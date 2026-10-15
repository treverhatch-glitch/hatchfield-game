# Runway capacity, 60-day headless playtest

Measured on this branch after the strip gap became arrival occupancy plus a departure slot (32 seconds per strip, opening still 150). Same driver as the other persona runs: standard difficulty, passenger focus, speed 5, 0.25-second ticks. Seeds are the persona seeds (`0x5eed`, `0x6eed`, `0xc0a0`).

The Airfield numbers panel for a deferred bank is `docs/playtest/runway_capacity_airfield.png`.

## Day 60

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Flights completed | 361 | 270 | 313 |
| Cash | $517,504 | $35,954 | $3,473 |
| Guests on the field | 60 | 0 | 159 |
| Connection diverts | 37 | 49 | 69 |
| Missed-connection $ | $83,700 | $89,280 | $133,920 |
| Deferred slots (run total) | 66 | 34 | 62 |
| Day strip 2 opened | 18 | not built | not built |

Connection diverts are passengers whose connection was judged a divert. They are not the runway go-around divert. The eight-day runway tests on this branch finish with no runway divert.

Careful is ahead of the till. The second strip opened on day 18, once the Airfield figure showed deferred demand and cash cleared the $38,000 stamp plus a $30,000 reserve. Greedy was over that reserve on the day-0 and day-25 samples only. Neither of those decisions saw today's deferred figure, so Greedy did not stamp. Greedy still finished above $0. Chaotic finished at $3,473 with 19 stands and did not stamp a strip. Chaotic is not one of the two personas the strip rule applies to. Chaotic also left a security queue and one departure stuck long enough for the softlock note.

## Prefab strain

The opening headway is still 150 seconds for the first ten minutes, so the prefab does not fill at the start.

The first sampled day with 4 or more people waiting at check-in was day 21 for Chaotic. Careful and Greedy never reached 4 on a sampled day. Careful's answer to runway pressure was the second strip on day 18, which is just after the day-5-to-15 window. The hall queue on this seed did not jam Careful in that window.

## Idle soak

`npm run soak:150` on the starter kit, auto timetable, no rendering, farm stocked the way that harness keeps the rack from running dry: **426** flights in 150 days. Heap growth **13.2%** (cap 15%). Coordinate jumps **0**. Outstanding stalls empty. That is back above the 330-flight line. The 48-second shared headway on the previous tip of main finished 331.

## What the runway tests show

Booked movements on one strip are 12 a day. The retired 150-second gap booked 4. That is the 3× figure. Live completions are lower. See `docs/atc/RUNWAY_CAPACITY.md`.

On seed `0x5171`, eight days, farm stocked so an empty rack is not the bottleneck:

- One strip and four stands, Harbor only: more than the 15 flights the 150-second gap turned, 0 runway diverts.
- Two linked strips against one, six stands four cells apart, Harbor and Northline: 25 and 17 flights. One runway divert on the two-strip field. The opening headway is shared. After it, the two-strip field completed 16 flights and the one-strip field completed 10, which is 1.6×.

Guard and ambulance, same seed, starter kit plus a hangar stand, eight days, auto timetable:

| | Flights | Military | Ambulance | Runway diverts |
| --- | ---: | ---: | ---: | ---: |
| `origin/main` (48s shared headway) | 15 | 2 | 4 | 0 |
| This gap | 19 | 3 | 3 | 0 |

A Guard jet also spawns when its strip's next arrival is 80 seconds out and the cool is clear.
