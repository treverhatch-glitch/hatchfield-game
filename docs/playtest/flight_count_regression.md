# Flight-count regression after the stuck-watchdog change

The 150-day idle soak (`SOAK_150=1`, starter kit, auto timetable, no rendering) finished **345** flights on `1c8c21c` and **266** on `782cff0`. The watchdog commit is not the drop. The bank started missing flights one commit earlier, when arrivals were spaced by a full gate turn.

## Bisect

Same soak, this environment. `1c8c21c` and `782cff0` are the reported runs. The rest were measured here.

| Commit | Flights | Heap growth | What it is |
| --- | ---: | ---: | --- |
| `1c8c21c` | 345 | reported | Baseline. Late inbound can still catch its turn. |
| `04a9794` | 356 | 14.9% | Sim tank is the only fuel stock. |
| `9c1c3a9` | 355 | 14.4% | Parent of the runway-spacing commit. |
| `3360f09` | 268 | 16.7% | Space the auto-bank to a real runway turn. |
| `0ebe534` | 268 | 12.4% | Parent of the watchdog commit. |
| `782cff0` | 266 | reported | Hold-short replaces the teleport. |
| this fix, before the later main commits | 343 | 13.6% | Strip headway, second stand not held for a taxi. |
| this fix, rebased on `5120ac5` | 331 | 13.7% | Same soak on the shipped tip. |

`9c1c3a9` still completes 355 flights. `3360f09` completes 268. Everything after that, including the watchdog, stays on 268. The two-flight gap from 268 to the reported 266 is soak noise, not the ladder.

Recoveries on `0ebe534` were 24, three of them the old off-screen teleport. On `782cff0` the ladder is re-path, release, hold short, cancel. Those steps were not what cut the timetable.

## Cause

`RUNWAY_TURN_SEC` was 150 seconds. That number is how long one aircraft takes to come back for its own departure (about 130–140s on the starter field). The starter kit has two stands and one strip. The strip is free once the landing rolls off it. The next arrival can be on short final while the first aircraft is at the gate. Spacing every arrival by the whole turn, and stretching that gap by up to 1.4 overnight, leaves a stand empty. The idle time was only partly filled by other movements, so the soak fell from about 355 flights to 268.

The same commit also treated another jet's pushback or taxi-out as if it owned the strip. The second stand then waited out the first aircraft's whole taxi. Pushback and the taxi to the hold line are not strip time. An arrival on final, a runway lock, or a takeoff roll still holds the departure.

## Fix

`RUNWAY_TURN_SEC` is 48 seconds, the headway for one landing to roll clear. Night spacing still stretches it by at most 1.4, to about 67 seconds, which is inside the interval two stands already turn (about one completed flight every 76 seconds before this regression). During the opening ten minutes the gap stays 150 seconds, so the prefab security line still sees one turn at a time. A departure may enter the strip while another jet is pushing or taxiing. The hold-short ladder is unchanged: no teleport, and the soak records `jumps: 0`.

A later change replaced the 48-second shared headway with the measured per-strip gap (14 seconds of arrival lock, 14 seconds of departure lock, 4 seconds of slack). The opening stays on 150 seconds, and the bag-tag expiry and the cart fold below stayed. On this tree, after the fuel-standing meter and the hub-vehicle commits, the same soak completed **426** flights, heap growth **13.7%**, outstanding stalls empty, coordinate jumps **0**. The measurement and the 60-day table are in [runway capacity](../atc/RUNWAY_CAPACITY.md) and [the playtest](runway_capacity.md).

Restoring the flights kept every claimed bag tag and every finished cart shipment. A soak at 338 flights then grew the heap 16.1% and failed the 15% cap. A tag now stays 1,200 seconds after its passenger and both flights have left, which is long enough for the connection checks and short enough that a 150-day run does not keep day one. A finished cart shipment is folded into the delivered total on the following tick, which still leaves `socketsOf` readable on the tick that finished it. On the tree where the gap was first changed, the soak completed **343** flights with heap growth **13.6%**. After rebasing onto `5120ac5` (the fine cap, curb demand, and research-pace commits), the same soak completed **331** flights, heap growth **13.7%**, outstanding stalls empty, coordinate jumps **0**.
