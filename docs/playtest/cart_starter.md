# Starter cart fleet

Pushback waits until a bag cart has finished at the belt, and catering waits until a hi-lift has finished at the door. With two bag carts and one more per depot, a one-strip field with four stands needed about six depots before the carts stopped being the limit (`docs/playtest/runway_capacity.md`). That stall looked like a slow runway.

The numbers live in `src/carts/config.ts`.

| | Before | Now |
| --- | ---: | ---: |
| Bag carts before any depot | 2 | 8 |
| Bag carts each depot adds | 1 | 2 |
| Catering trucks before any depot | 1 | 2 |
| Catering trucks each depot adds | 1 | 1 |

Eight bag carts is the fleet that previously took the carts out of a four-stand, eight-day bank (two starter carts plus six depots). The prefab has two stands. Adding two more, still with no depot, has a cart for each stand. A ninth simultaneous bag load has no free cart. That is when the turn says **Waiting on bag cart**, and the note points at **Build → Vehicle depot**. Two catering trucks cover the prefab's two stands at once. A third galley with no free truck says **Waiting on catering** and the same depot hint.

Runway headway is unchanged. A faster claim releases arriving guests sooner and shifts the shared random stream, which was sending the strip mechanic down the live roll. The mechanic still draws a wander target. A walk that is already beside a rolling jet and follows ten or more cells of the remaining roll steps two cells off the strip instead. The starter-kit strip lock stays inside the occupancy constants.

Careful stamps one depot on a day when that cart wait is a larger count than deferred runway slots, the check-in line, the security line, and the curb queue, the field level allows the stamp, and cash covers the depot plus the $8,000 buffer. A depot already going up is not stamped again that day. Careful does not add another stand while the cart wait is still the top bottleneck.
