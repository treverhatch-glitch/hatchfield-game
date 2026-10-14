# People and crew visuals (`src/people/`)

Issue #231. Presentation only: sim logic is untouched.

## API for terminal work
- `createPassengerMesh(seed, { age?, carry?, pose?, phase?, speed?, lod?, scale? })` returns a `THREE.Group` (feet at y = 0, faces +z, metres).
- `createCrewMesh(kind, seed, { airline?, pose?, ... })`, kinds: `pilot | cabin | ground | marshaller | security | fuel | maintenance`.
- Crowds: `new PeopleRenderer(parent, { capacity, unitsPerMeter })` then `update(agents, camera, dt, lite)`. `camera` may be `null` to draw everyone.
- The hall and pax crowd (`src/render/people`) is an adapter over `PeopleRenderer`; see `docs/PEOPLE.md`.
  One `InstancedMesh` per body part / accessory, per-instance colour, so draw calls do not grow with headcount.
- `groupLooks(seed, size, kids)` and `followSlot(...)` give families with kids kept inside a leash radius of the lead.

## Pieces
- `variants.ts` deterministic looks (skin, hair, hats, backpacks, roller/duffel/cart, uniforms).
- `parts.ts` part geometry and the per-person joint matrices (computed once, shared by all parts).
- `pose.ts` walk cycle tied to ground speed (`strideRate`), idle, queue shuffle, bag pull, wave, reach, seated.
- `lod.ts` three levels (full / simple / block) by distance with per-level caps; `lite` skips full bodies.
- `pool.ts` per-frame slot allocator; overflow is counted, never written past capacity.
- `crewAdapter.ts` maps `src/ramp` crew (#227) to uniforms and poses. `src/render/crew/figures.ts` now draws its full-detail tier through this.
- All tunables are in `config.ts`.

## Perf check
`npm run dev`, open `/src/people/demo.html?n=2500&view=wide|close|lineup`. The HUD shows update ms, draw calls and triangles.
CI sandbox (software GL, no GPU): 2,500 people update in about 2 to 4 ms CPU and 8 to 28 draw calls.
Not measured on an RTX 4070 Super: no GPU in CI, so the 60 fps target there is unverified.

Views: `view=lineup` (close-up gallery of every crew kind, poses, a family), `view=close` (street level, 2,500 people), `view=wide` (zoomed out).
Screenshots are not committed: the CI session could not copy them into the repo. Regenerate them from the demo page.

## Shared base body (rebuild)
Passengers and crew are one body (`parts.ts`): about 1.75 m, head about 1/7.4 of height, tapered torso, arms and legs, hands, shoes. Crew are the same body plus clothing and gear parts, not a separate model.
- Variety: height, build (`width`), age (`kid | teen | adult | elder`: kids get bigger heads, elders stoop), skin, hair (`short | long | bun | none`), outfits `casual | business | tourist`.
- Luggage: roller, backpack, duffel, cart, stroller (pushed with the `push` pose).
- Crew gear: pilot/cabin caps and jackets, hi-vis vest or jacket (`outer`), headset, ear defenders, lanyard badge, boots (a colour flag; shoes carry a short ankle cuff).
- **Matching the reference sheets**: `outfits.ts` is the data table (`CREW_OUTFITS`, `PASSENGER_OUTFITS`) of outfit, accessory and colour per role. Edit it, and `parts.ts` for shapes, when the Gemini sheets land in `public/art/refs/people/`. No sheets were on the branch when this was built, so the figures start from the #231 colours.
- Mesh budget: symmetric parts (arms, legs, hands, shoes) share one instanced mesh for both sides; mid detail is three meshes (`torsoLo` with arms, `headLo`, `legLo`).

### Budget, 1,300 walkers (`budget.test.ts`, camera at street level, 1 in 12 crew)
| | draws | triangles |
|---|---|---|
| #231 blocky figures | 26 | 58,372 |
| shared base body | 27 | 57,107 |
Draw calls are bounded by the number of part meshes and do not grow with headcount. One more draw than before comes from the richer variant set.

Screenshots: `docs/devlog/media/people-lineup.png`, `people-hall-crowd.png`, `people-hall-crowd-wide.png` (regenerate with `scripts/people-shots.mts` while `npm run dev -- --port 45218` runs).
