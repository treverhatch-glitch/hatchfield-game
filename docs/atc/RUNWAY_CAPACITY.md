# Runway capacity

The strip is busy only while an aircraft holds it. A gate turn is not a runway turn. This note is the measurement behind the bank, and it sits on top of [the flight-count regression](../playtest/flight_count_regression.md). That fix replaced a 150-second gate turn with a 48-second landing headway and kept the opening on 150 seconds. The constants below replace the 48-second headway with the measured lock times. The opening headway, the bag-tag expiry, and the cart-shipment fold from that fix stay.

## What was measured

Starter kit, one Harbor arrival, speed 1, 0.05-second steps, clock 400, clear weather. The harness is `src/atc/occupancy.test.ts`. The lock is the ground-control runway lock, not the whole landing phase (that phase includes the taxi to the stand).

Arrival lock, empty field, five samples: 10.60s, 10.60s, 11.05s, 10.60s, 13.45s. An earlier pair was 10.60s and 9.95s. The lock starts on short final and drops when the aircraft leaves the pavement at the mid-strip exit.

Departure lock, same harness, five samples: 13.30s, 14.00s, 13.90s, 13.90s, 12.70s. The lock starts at the hold line and drops when the aircraft is airborne.

Spawn-to-lock lead on the approach: 7.05 seconds. The aircraft is airborne for that lead. It is not strip occupancy.

## Constants

| Constant | Seconds | Why |
| --- | ---: | --- |
| `ARRIVAL_OCCUPANCY_SEC` | 14 | Longer repeated arrival sample, rounded up. |
| `DEPARTURE_OCCUPANCY_SEC` | 14 | Longer departure sample, rounded up. |
| `ARRIVAL_LOCK_LEAD_SEC` | 7.1 | Spawn until the arrival locks the strip. |
| `RUNWAY_SLOT_SLACK_SEC` | 4 | One playtest step is 1.25 sim seconds. A gap of exactly arrival + departure has no width: the step that sees the strip go free is already too late to finish the roll. Four seconds is the smallest allowance that stays inside one step of the measured sum. |

`runwayArrivalGapSec` is 14 + 14 + 4 = **32 seconds on every strip**. A second strip does not shrink that gap. It runs its own bank. The seeder picks the quieter linked strip first, then pushes an ETA only when that strip already has a slot inside the gap.

A day is 180 sim seconds. One strip books `floor((180 + 32) / 32) = 6` turns, 12 movements. The retired 150-second gap booked 2 turns, 4 movements. Twelve is three times four. Two linked strips book 24 movements. On one strip the seeder steps by that gap, and overnight the step stretches by at most 1.4 (about 45 seconds), which stays under the 76-second two-stand interval. A second strip keeps the shorter commercial step so the next flight can use the other strip. The 150-day idle soak on this gap finished 426 flights, heap growth 13.7%, jumps 0.

## Opening

For the first 600 seconds the seeder uses `max(32, OPENING_ARRIVAL_GAP_SEC)` and `OPENING_ARRIVAL_GAP_SEC` is still 150. The prefab sees one turn at a time at the start. After that the measured gap applies. In-capacity waits do not cascade. An overbooked bank still books lateness and can cascade. `src/game/runwayBank.test.ts` covers both.

## Per strip

Busy, approach, and may-enter take a runway index: the slot's `runwayPref`, or the strip on the flight's path. A landing on runway 1 does not hold a spawn or a departure on runway 2. An arrival with no strip still blocks every strip.

Pushback and the taxi to the hold line are not strip time. A departure may leave the stand while its own arrival is on final. The pavement stays closed until `departureFitsHole`: no arrival on that strip's final, no lock on that strip, and the roll finishes before the next arrival's lock. Taxi paths that cross a strip still yield at the crossing.

`runwayLoad()` is computed once per tick and dropped when the bank or the pavement changes.

## Deferred demand

The seeder counts a deferral only when an airline asked for a time an **existing** slot already held. Spacing this call's own slots out to the 32-second gap is the bank's cadence, and those slots count as booked. Otherwise every second slot of a normal bank would look deferred and the alert would fire at minute zero.

The Airfield numbers panel has a Deferred row. Its line is `Inputs: requested N vs booked M.` The runway alert uses the same key as the contract warning. When today's deferral count is above zero the detail is `Airlines wanted N more movements today. Add a strip.`

## What the live bank actually turns

Booked capacity is three times the old day. Completions are not, and the constants were not lowered to pretend they are.

On seed `0x5171`, speed 5, 0.25-second steps, eight days:

| Field | Completed flights | Diverts |
| --- | ---: | ---: |
| One strip, starter plus two grass stands (four stands), Harbor | more than 15 | 0 |
| One strip, six stands four cells apart, Harbor and Northline | 17 | 0 |
| Two linked strips, same six stands and airlines | 25 | 1 |

The farm is stocked in that harness. The starter tank is one load, and the spot offer expires, so an unstocked field grounds the bank for lack of fuel rather than lack of runway. The 150-second gap turned 15 flights in eight days on the four-stand shape of that seed. The stocked four-stand field finishes more than that. It does not finish 45. After the opening, the night closure (no night-bank research) and a turnaround longer than the 32-second hole are what leave stands idle. A remote stand boards on foot, and a busy apron holds pushback until the board limit. Those are player-side constraints.

The opening headway is shared, so the first ten minutes look alike on one strip and on two. After it, the two-strip field completed 16 and the one-strip field completed 10 (`src/game/runwayCapacity.test.ts`).

## Special flights

`scheduleOwnsRunway` is per strip. Boarding and pushback do not own it. A Guard jet or an ambulance may spawn on the first linked strip that has no arrival inside the departure window (14 + 4 seconds) and no roll on the lock.

Same seed, starter kit plus a hangar stand and a taxi link, agreement on, eight days, auto timetable:

| Code | Flights | Military | Ambulance | Diverts |
| --- | ---: | ---: | ---: | ---: |
| `origin/main` at `a938493` (48s shared headway) | 15 | 2 | 4 | 0 |
| This gap, per-strip window | 19 | 3 | 3 | 0 |

A direct `trySpawnMilitary()` with the next passenger arrival 80 seconds out spawns. That is the gap case. A packed bank still leaves only a short hole, so a special does not cut the passenger roll. The 150-second bank on an earlier tree, same seed and a 0.2-second step, spawned 4 Guard jets and 4 ambulances. The tighter bank does not stop them. It gives the Guard one more launch and the ambulance one fewer on this seed.
