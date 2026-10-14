# Building sockets

Pass 3 bays. Each row is a `service-bay:<id>` mark on the mesh and a socket of the same id. Positions are local to the building, in world units. A vehicle listed here docks nose-first: its `dock` socket meets the bay.

`socket defined, no vehicle yet` means the bay is on the mesh and in `MASS3_SOCKETS`, and no ground-vehicle model stops there.

| Building | Bay | Vehicle |
| --- | --- | --- |
| Hydrant pit | `dispenser` | `hydrant_cart` |
| Catering kitchen | `1`, `2` | `catering_hilift` |
| Bag sort | `1`, `2`, `3` | `baggage_train` |
| Bus station | `1`, `2` | `coach` |
| Rail station | `track1`, `track2` | socket defined, no vehicle yet |
| Helipad | `pad` | socket defined, no vehicle yet |
| Helipad | `bowser` | `fuel_tanker` |
| Airport inn | `drop` | `coach` |
| Airport inn | `service` | `van` |
| Business hotel | `drop` | `coach` |
| Business hotel | `service` | `van` |
| Airport resort | `drop` | `coach` |
| Airport resort | `service` | `van` |

Source of the positions: `MASS3_SOCKETS` in `src/render/socketLayout.ts`. The meshes are `src/render/world/massPass3.ts`. Throughput stays the bays a vehicle is actually using; this pass does not change economy rates.
