# Runway capacity, 60-day headless playtest

Measured on this branch after the strip gap became arrival occupancy plus a departure slot (32 seconds per strip, opening still 150). Same driver as the other persona runs: standard difficulty, passenger focus, speed 5, 0.25-second ticks. Seeds are the persona seeds (`0x5eed`, `0x6eed`, `0xc0a0`).

The Airfield numbers panel for a deferred bank is `docs/playtest/runway_capacity_airfield.png`.

## Day 60

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Flights completed | 212 | 207 | 152 |
| Cash | $787,672 | $13,513 | $5,926 |
| Guests on the field | 94 | 77 | 45 |
| Connection diverts | 0 | 1 | 1 |
| Missed-connection $ | $0 | $1,860 | $1,860 |
| Deferred slots (run total) | 42 | 41 | 26 |
| Day strip 2 opened | 24 | 26 | not built |

Connection diverts are passengers whose connection was judged a divert. They are not the runway go-around divert. The eight-day runway tests on this branch finish with no runway divert on one strip or on two.

These rows were measured before helicopter carriers and the fuel pipeline landed on main. The eight-day counts below were remeasured after that rebase. The day-60 cash and flight totals will move again once those systems are in the run. Pushback waits for a cart to dock, so every persona finishes fewer flights than the table from before that gate. Careful and Greedy both stamp the second strip once the Airfield figure shows deferred demand and cash clears the $38,000 stamp plus a $30,000 reserve. Careful opened it on day 24. Greedy opened it on day 26. All three finish above $0. Greedy is thin at $13,513 with six stands and the second strip. Chaotic is not one of the two personas the strip rule applies to. Chaotic finished at $5,926 with 17 stands and did not stamp a strip.

## Prefab strain

The opening headway is still 150 seconds for the first ten minutes, so the prefab does not fill at the start.

Careful first had 4 or more people waiting at check-in on day 42. Greedy did on day 48. Chaotic never did. That is later than the day-5-to-15 window. The runway answer on this seed is the second strip in the fourth week.

## Idle soak

`npm run soak:150` on this tip, starter kit, auto timetable, no rendering, farm stocked by that harness: **312** flights in 150 days. Heap growth **14.3%** (cap 15%). Coordinate jumps **0**. Outstanding stalls empty. The same soak on `origin/main` at `820e03b` (48-second shared headway, same belt-cart gate) finished **289** flights and **14.6%** heap. Both are under the 330 line. That line was measured before pushback started waiting on the belt cart, and before the passenger starter dropped the police post Harbor requires, so the harness no longer signs Harbor. The earlier run of this gap, before those commits, finished 426.

## What the runway tests show

Booked movements on one strip are 12 a day. The retired 150-second gap booked 4. That is the 3× figure. Live completions are lower. See `docs/atc/RUNWAY_CAPACITY.md`.

On seed `0x5171`, eight days, farm stocked so an empty rack is not the bottleneck, and cart depots stamped so the two starter bag carts are not the bottleneck either. Pushback waits for a cart to dock at the belt, and two carts finish fewer flights than the old 150-second bank.

- One strip and four stands, Harbor only, six depots: 19 flights, 0 runway diverts. The 150-second gap turned 15 on that shape.
- Two linked strips against one, six stands four cells apart, Harbor and Northline, eight depots: 23 and 17 flights, 0 runway diverts on both. The opening headway is shared. After it, the two-strip field completed 14 flights and the one-strip field completed 11, about 1.3×. One strip is already finishing the flights its 32-second gap booked. The second strip adds the flights the airline spacing (about 18–28 seconds) can place on the other strip. Booked movements stay two strips to one.

Guard and ambulance, same seed, starter kit plus a hangar stand, eight days, auto timetable:

| | Flights | Military | Ambulance | Runway diverts |
| --- | ---: | ---: | ---: | ---: |
| `origin/main` (48s shared headway) | 15 | 2 | 4 | 0 |
| This gap | 19 | 3 | 3 | 0 |

A Guard jet also spawns when its strip's next arrival is 80 seconds out and the cool is clear.
