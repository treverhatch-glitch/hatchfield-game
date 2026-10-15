# Starter hall bottleneck

Seed 1. Default new game: easy, city plot, passenger starter kit, hints off, speed 1. The script accepts a letter only when the desk gate says the hall can clear it. It does not buy desks, lanes, or a bigger hall, and it does not run a bot persona.

The choke is the live walk's check-in or security flag. Someone joining now would wait `HALL_QUEUE_TUNING.bottleneckSec`, or the line has spilled its floor marks. The day-one pacing crowd does not raise that flag.

## Result

| | |
| --- | --- |
| Seed | 1 |
| First red line | in-game day 5 |
| Clock | 774 sim seconds (the opening ends at 600) |
| Facility | check-in desk |
| Queue | 4 waiting |
| Estimated wait | 368 nav seconds |
| Signed | `air_regional_1` only |

Re-run: `npx vitest run src/game/starterBottleneck.test.ts`

## What changed

The same seed used to never raise the flag. One regional wave is spread across the check-in window, so the starter kiosk peaked near 294 nav seconds during the opening and stayed there. The red line was 900 nav seconds, which that spread does not reach. Two onset numbers moved. Fees did not.

1. `STARTER_WAVE` in `src/game/openingData.ts`. A Prefab I departure whose scheduled time is still inside the opening, plus the 24-second show-up lead, releases 12 passengers. A departure scheduled after that releases 40, a full regional turn on the same two desks and two lanes. An expanded or custom hall keeps the airframe's own headcount, at most 18.
2. Check-in `bottleneckSec` in `src/game/hallNavData.ts`, from 900 to 360 nav seconds. 360 sits above the opening peak and under the full-turn peak. Security stays at 600. The first red line is the desks.

`STARTER_CAPACITY` is unchanged (46 passengers, 3.2 s service, 2 desks, 2 lanes). Those ceilings feed the lane throughput, not the walk's queue.

Day 5 is past the opening and in the band the hall pacing note already described. Another desk or a security lane clears the line. Prefab II is what opens a third carrier.
