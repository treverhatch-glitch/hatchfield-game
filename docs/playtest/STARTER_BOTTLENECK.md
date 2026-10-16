# Starter hall bottleneck

Seed 1. Default new game: easy, city plot, passenger starter kit, hints off, speed 1. The script accepts a letter only when the desk gate says the hall can clear it. It does not buy desks, lanes, or a bigger hall, and it does not run a bot persona.

The choke is the live walk's check-in or security flag. Someone joining now would wait `HALL_QUEUE_TUNING.bottleneckSec`, or the line has spilled its floor marks. There is no day-one pacing crowd any more (terminal rebuild WP1). The hall stays empty until the first show-up window opens.

## Result

| | |
| --- | --- |
| Seed | 1 |
| First red line | none inside 16 days |
| Peak | check-in desk, day 6, queue 2, 358 nav seconds |
| Red line | 360 nav seconds at check-in. The four-stall curb meters the rides. Tug trains stay on the truck pavement and only meet the taxi at the stand, so the peak stays just under the line |
| Signed | `air_regional_1`, `zoomjet` |

Re-run: `npx vitest run src/game/starterBottleneck.test.ts`

Desks at 12 a minute let Zoomjet sign beside the regional. Departing passengers ride to the layby, and the 2×4 hall's four stalls meter them. Bag tugs drive the truck pavement from the bag room and join the taxi only beside the stand. The bowser joins the taxiway on the road cell east of the farm instead of the stub south of the tanks. Check-in peaks on day 6 at 358 nav seconds, a queue of 2, just under the 360-second red line, and does not flag inside 16 days. The city road forks ahead of the curb, so the guard is not on the passenger road and not on the apron road the bowsers use. Terminal rebuild WP1's animation clock does not draw from `Math.random`.

## What changed

The same seed used to never raise the flag. One regional wave is spread across the check-in window, so the starter kiosk peaked near 294 nav seconds during the opening and, after that, the line stayed shorter (about 140 nav seconds). The red line was 900 nav seconds, which that spread does not reach. Two onset numbers moved. Fees did not. `STARTER_CAPACITY` did not (46 passengers, 3.2 s service, 2 desks, 2 lanes). Those ceilings feed the lane throughput, not the walk's queue.

1. Check-in `bottleneckSec` in `src/game/hallNavData.ts`, from 900 to 360 nav seconds. 360 sits above the opening peak. Security stays at 600. The first red line is the desks.
2. `STARTER_CHECKIN_PACE` in `src/game/openingData.ts`, set to 3. Prefab I check-in keeps the normal pace through the opening. Once the clock passes 600 seconds, those desks take three times as long. The same short queue then waits about 413 nav seconds. An expanded hall goes back to pace 1.

Day 6 is past the opening and in the band the hall pacing note already described. Another desk or a security lane clears the line. Prefab II is what opens a third carrier.
