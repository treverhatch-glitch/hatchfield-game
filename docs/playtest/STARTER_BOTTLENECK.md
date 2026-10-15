# Starter hall bottleneck

Seed 1. Default new game: easy, city plot, passenger starter kit, hints off, speed 1. The script accepts a letter only when the desk gate says the hall can clear it. It does not buy desks, lanes, or a bigger hall, and it does not run a bot persona.

The choke is the live walk's check-in or security flag. Someone joining now would wait `HALL_QUEUE_TUNING.bottleneckSec`, or the line has spilled its floor marks. The day-one pacing crowd does not raise that flag.

## Result

| | |
| --- | --- |
| Seed | 1 |
| First red line | in-game day 6 |
| Clock | 1066 sim seconds (the opening ends at 600) |
| Facility | check-in desk |
| Queue | 3 waiting |
| Estimated wait | 446 nav seconds |
| Signed | `air_regional_1`, `zoomjet` |

Re-run: `npx vitest run src/game/starterBottleneck.test.ts`

Desks at 12 a minute let Zoomjet sign beside the regional. The first red line is day 6 at clock 1066. Both starter exits are in use, so the first flagged queue is 3 people and the wait is 446 nav seconds. The bowser loading beside the farm, one cell off the tank, is what moved the earlier day-6 mark (clock 932); the second carrier brings it forward from the day-7 mark that bowser change produced on its own.

## What changed

The same seed used to never raise the flag. One regional wave is spread across the check-in window, so the starter kiosk peaked near 294 nav seconds during the opening and, after that, the line stayed shorter (about 140 nav seconds). The red line was 900 nav seconds, which that spread does not reach. Two onset numbers moved. Fees did not. `STARTER_CAPACITY` did not (46 passengers, 3.2 s service, 2 desks, 2 lanes). Those ceilings feed the lane throughput, not the walk's queue.

1. Check-in `bottleneckSec` in `src/game/hallNavData.ts`, from 900 to 360 nav seconds. 360 sits above the opening peak. Security stays at 600. The first red line is the desks.
2. `STARTER_CHECKIN_PACE` in `src/game/openingData.ts`, set to 3. Prefab I check-in keeps the normal pace through the opening. Once the clock passes 600 seconds, those desks take three times as long. The same short queue then waits about 413 nav seconds. An expanded hall goes back to pace 1.

Day 6 is past the opening and in the band the hall pacing note already described. Another desk or a security lane clears the line. Prefab II is what opens a third carrier.
