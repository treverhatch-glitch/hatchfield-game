# Perf budget (P0-3)

Reference desktop: **Intel i7-14700KF**, **NVIDIA RTX 4070 Super**, 1920×1080, 60 fps.
Ultra stays the default on that GPU (`suggestQuality` returns `ultra` for a discrete RTX-class renderer with 8+ cores and 8+ GB). Texture size (1024), anisotropy (16×), and the pixel-ratio cap (2) are unchanged. This budget does not buy frame time by dropping resolution.

The 4070 Super frame rate is not measured here. This environment has no desktop GPU. Draw-call counts below come from mesh counts and from `renderer.info` in a browser; frame milliseconds on a software rasterizer are not the 4070 number.

## Frame

| | Budget |
| --- | --- |
| Mean frame | ≤ 16.7 ms (60 fps) |
| Slow frames (p99) | ≤ 33 ms, so a hitch drops at most one extra frame |
| Sim tick | ≤ 6.0 ms while 1,500 passengers and 150 vehicles are live |

The play loop calls `game.tick` once per animation frame (`dt` capped at 0.05 s). The sim tick has to leave about 10 ms for submission and the GPU. The roadmap’s “10 Hz sim” is not how the loop runs today, and this change does not retune the sim.

## Entities

| | Budget | Where it is counted |
| --- | --- | --- |
| Passengers | 1,500 | `game.hallGuests.length` |
| Vehicles | 150 | Apron: trucks, service, and catering poses already in the vehicle frame. Hall: `trucks` plus `servicePoses()` plus `cateringPoses()`. |
| Aircraft | live timetable count | `game.flights.length`. Not capped by this budget. |

Bottlenecks stay capacity, staffing, and layout. These counts are the load the frame has to hold, not a spawn cap.

## Draw calls and triangles

Hall guests used to draw seven meshes each: two legs, two arms, torso, head, and a carry-on. None of those cast shadows, so that is one color draw per mesh.

| Guests | Before (7 draws each) | After (one InstancedMesh per part) |
| --- | ---: | ---: |
| 48 | 336 | 5 |
| 1,500 | 10,500 | 5 |

Reduction at the passenger budget: **10,500 → 5** color draws (−10,495). Triangles do not change. At 1,500 guests, with a carry-on on every guest:

| Part | Copies | Triangles each | Triangles |
| --- | ---: | ---: | ---: |
| Legs | 3,000 | 12 | 36,000 |
| Arms | 3,000 | 12 | 36,000 |
| Torso | 1,500 | 12 | 18,000 |
| Head | 1,500 | 252 | 378,000 |
| Carry-on | 1,500 | 12 | 18,000 |
| **Total** | | | **486,000** |

Those five parts are the repeated meshes that grow with the passenger budget. Pins, checked bags, and snacks stay individual meshes; they are rarer than the body and were not in the five.

The starter apron (High, empty of passengers) does not have five meshes worth instancing. A shape census of individual, non-instanced meshes:

| Shape | Copies | Triangles |
| --- | ---: | ---: |
| `PlaneGeometry` (4 vertices) | 8 | 16 |
| `gate-sign` | 6 | 12 |
| `wayfinding-sign` | 4 | 8 |

No two of those already share one geometry object. Instancing them would save at most 15 draws. Trees, fence posts, grass, airfield lights, vehicles, and the apron crowd were already instanced.

## Browser readout (not the 4070)

A High preset playthrough in headless Chrome on this VM (`SwiftShader`, 1600×900). Frame time here is the software rasterizer. Draw calls and triangles are `renderer.info`.

| View | fps | frame | draws | tris | pax | vehicles | aircraft | sim |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Apron, starter kit | 2 | 584 ms | 191 | 173.0k | 12 | 0 | 0 | 0.5 ms |
| Terminal | 2 | 457 ms | 132 | 106.9k | 12 | 0 | 0 | 1.1 ms |

F3 hid the readout and showed it again. The panel uses `pointer-events: none`, and the Terminal button still received the click. No page errors.

At 12 hall guests the old body meshes would be 84 color draws. The instanced layer is 5. That 84 → 5 difference is the mesh count in `hallFigures.test.ts`, not a second captured GPU frame. The 1,500-passenger row (10,500 → 5) is the same count scaled to the entity budget.

## F3 overlay

F3 toggles a corner readout. `?perf` opens it. It ignores pointer input and does not cover the field. Text refreshes twice a second; the frame meter keeps every frame.

```
61 fps  16.3 ms  (p99 18.4 ms)
draws 420   tris 1250.0k
geos 90   tex 40 (~96.5 MB)
pax 1500   vehicles 150   aircraft 12
sim 4.3 ms
```

`draws` and `tris` are `renderer.info` for the frame just submitted. `sim` is the previous `game.tick` duration, recorded in the play loop. The renderer does not import the sim, and the sim does not import the overlay.

## Reflections

The studio reflection map (the #258 boot cost) is built only when High or Ultra building materials can sample it. Low and Medium never compile that PMREM. The aircraft sky probe is skipped only on Low, where the shells are unlit. Ultra, the default on the reference desktop, still builds both maps.
