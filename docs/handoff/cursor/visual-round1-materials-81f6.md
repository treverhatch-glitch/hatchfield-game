# Handoff — `cursor/visual-round1-materials-81f6` (PR #219)

Written by the producer bot from the diff; the agent ran out of usage before writing one.
Base: `cursor/audit-playtest-562d`. Single commit `745e5c0`, parent `6854f03` (old trunk, before #213/#214/#217/#218/#220/#223/#224/#225).

## Done (in `745e5c0`)

- Ground: road texture (`tex.road`), kerbs (`roadKerbs` in `world/layout.ts`, `kerbGeometry` in `world/surfaces.ts`, `GROUND_LOOK.kerb` in `look.ts`), lane paint, stronger grass macro variation (0.22→0.34), `world/raster.ts` additions.
- Aircraft: UVs for fuselage / tail / engine strips (`aircraft/liveryUv.ts` + test, `geom.ts`, `merge.ts`), `aircraft/liveryTex.ts` loads per-airline PNGs listed in `public/textures/liveries/manifest.json` (empty list here → procedural paint stays).
- Vehicles: instanced low-poly service vehicles rewrite of `src/render/vehicles.ts` (+test).
- `scripts/visual-round1-shots.mts` and screenshots in `docs/devlog/media/ROUND1-*.png`.

## Unfinished

- Liveries are not populated on this branch; PR #226 (`cursor/livery-art-81f6`) is this commit plus the airline jpgs and wiring. **Prefer merging #226 and closing #219.**
- Pack 3 ground/vehicle picks (runway, taxiway, apron, service road, grass, tug/fuel/bus/catering/ARFF) are not applied as image textures; surfaces are still procedural canvases.
- No Low/Medium/High handling of its own.

## Risky bits

- Conflicts in `src/render/world.ts` (−211 lines of churn) and `src/render/world/render.ts` against #218 lighting, #217 day/night and #224 batching. Keep trunk's `graphicsQuality()` / `applyGraphicsQuality`, `applyDayNight`/`World.setDayNight`, and #224's room batching; re-apply only the surface/kerb/vehicle bits.
- `vehicles.ts` rewrite vs #227 ramp crews (which drives belt loader, tug, catering, GPU positions): verify vehicle ids/kinds still match after both land.
- `lighting.test.ts` was edited; re-check against #218's tests.
- Run the heavy bot after merge — instancing changes affect FPS.
