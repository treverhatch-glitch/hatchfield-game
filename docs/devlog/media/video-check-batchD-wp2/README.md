# Video check — Batch D and terminal WP2

Production builds, `?playtest=1`, graphics preset ultra, 1280×720. Clips are H.264 yuv420p, +faststart, 12 fps. The sim was frame-stepped. Verdicts use rendered meshes (instance matrices and surface triangles), not sim state alone.

Batch D was filmed on `main` `7c054d48`, which contains `58b5c6f6`. Terminal WP2 was filmed on `e6ce2c4c` because that commit is not on `main`.

Queue and service time in the hall walk was stepped at 1.6 clock seconds per frame so the curb-to-gate path fit in the clip. The city-cargo truck’s guard dwell was held at 60 sim seconds so it stayed in frame; the real dwell is about 1.4–2.2 seconds.

## Verdicts

1. **CONFIRMED.** The guard building is on cell 16,4, between the city road (column 17) and the service road (row 4). The drop-off frontage stays on the public road further south.
2. **CONFIRMED.** Drawn landside cars and taxis stay on the city-road lane (about column 16.7). The fuel tanker mesh crosses the guard tile onto the service road. This starter has no bus bays, so no bus mesh is spawned.
3. **CONFIRMED.** Eight `belt-bag` meshes travel the single belt from the north stand, past the sort (bags cell 13,9, sort yaw −π/2, bays facing west), to the south stand. The parade cart stays at the sort. The belt does not enter the terminal, so suitcases are not drawn leaving the check-in desks.
4. **CONFIRMED (known issue).** The city-cargo `fleet:box_truck` mesh holds cell 16,4 for the whole clip. The fuel tanker and baggage-train meshes enter that same tile and creep through it together. There is no pull-aside lane.

**WP2 CONFIRMED.** Live layout is version 2, 88×44 m, 1 m tiles, one story. Check-in is the landside room; security is one room containing both staffed lanes. Both stand cells sit on rendered `surface-stand-pad` / `surface-apron`, the taxi cell west of each stand is `surface-taxi`, and both stands reach the runway on the taxi graph. A filmed passenger’s drawn torso walks the curb, the check-in kiosk, security, and gate 1, then boards, with no wall intersection.

**Palette.** The build bar (Foundation, Walls, Erase, Door, Zone, Floor, Wallpaper) is a centered strip at x 352–928, y 209–313. It covers the upper middle of the hall and does not cover the viewport center (640, 360).
