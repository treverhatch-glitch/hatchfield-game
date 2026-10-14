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
