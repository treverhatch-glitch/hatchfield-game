# Runway capacity, 60-day headless playtest

Measured on this branch after the strip gap became arrival occupancy plus a departure slot (32 seconds per strip, opening still 150). Same driver as the other persona runs: standard difficulty, passenger focus, speed 5, 0.25-second ticks. Seeds are the persona seeds (`0x5eed`, `0x6eed`, `0xc0a0`).

The Airfield numbers panel for a deferred bank is `docs/playtest/runway_capacity_airfield.png`.

## Day 60

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Flights completed | 273 | 301 | 265 |
| Cash | $976,690 | $281,202 | $198,883 |
| Guests on the field | 77 | 99 | 66 |
| Connection diverts | 9 | 35 | 39 |
| Missed-connection $ | $27,900 | $68,820 | $87,420 |
| Deferred slots (run total) | 29 | 28 | 29 |
| Day strip 2 opened | 23 | 26 | not built |

Connection diverts are passengers whose connection was judged a divert. They are not the runway go-around divert. The eight-day runway tests on this branch finish with no runway divert on one strip, and one on the two-strip field.

Careful and Greedy both stamp the second strip once the Airfield figure shows deferred demand and cash clears the $38,000 stamp plus a $30,000 reserve. Careful opened it on day 23. Greedy opened it on day 26. Both finish well above $0. Chaotic is not one of the two personas the strip rule applies to. Chaotic finished at $198,883 with 14 stands and did not stamp a strip.

## Prefab strain

The opening headway is still 150 seconds for the first ten minutes, so the prefab does not fill at the start.

No persona had a sampled day with 4 or more people waiting at check-in. The runway answer on this seed is the second strip in the fourth week, later than the day-5-to-15 window. The hall queue did not jam.

## Idle soak

`npm run soak:150` on the starter kit, auto timetable, no rendering, farm stocked the way that harness keeps the rack from running dry: **426** flights in 150 days. Heap growth **13.7%** (cap 15%). Coordinate jumps **0**. Outstanding stalls empty. That is back above the 330-flight line. The 48-second shared headway on the previous tip of main finished 331.

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
