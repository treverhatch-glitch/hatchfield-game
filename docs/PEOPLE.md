# People renderer (`src/render/people/`)

Instanced, low-poly, animated people for the terminal and field. It's self-contained: it doesn't touch `sim.ts`, `world.ts` or `hallWorld.ts`. The terminal agent wires it in.

## API
```ts
import { createCrowd } from './render/people'
const crowd = createCrowd(scene, { camera, capacity: 6000, lod: [35, 110], cull: 400 })
// every frame:
crowd.update(agents, dtSec)   // agents: CrowdAgent[]
crowd.showThought(paxId, { icon: '🍔', text: 'wish they had burgers', duration: 4 })
crowd.hideThought(paxId)
crowd.setCamera(cam); crowd.dispose()
```
`CrowdAgent = { id, role, pos: {x,y?,z} | [x,y,z], heading, state?, bagIds?, bagsDropped?, speed? }`
- `role`: `passenger | checkin | security | gate | shop | cleaner | researcher`
- `heading`: radians around +Y. 0 faces +Z.
- `state`: a free-form sim string mapped to a pose by `poseFor()`: `seat/sit/waiting/lounge` gives seated, `research/desk` gives working at a desk, `queue/line` gives queue, `walk/move/to_*` gives walk. Anything else is idle, or walk if the position changed since the last frame.
- Checked bag: shown while `bagIds.length > 0`. It's hidden once `bagsDropped` is true or the state matches `checked_in|dropped|security|airside|gate|board|seat|...`.
- Carry-ons (none, backpack or rolling suitcase), body width and height, skin tone and clothing colours all come from a hash of `id`, so they stay the same across frames.
- Staff have fixed uniforms: check-in in navy, security in slate with a cap, gate in red, shop in green, cleaners in hi-vis, R&D in white lab coats with an instanced desk when seated.

## How it's fast
- One `InstancedMesh` per LOD tier: near is about 300 triangles, mid 72 and far 24. There's also one per prop type (backpack, rolling, checked, desk, cap). So 5,000 people take about 8 to 11 draw calls.
- Vertex animation: each vertex carries `aPart`, and a patched `MeshLambertMaterial` swings legs and arms around hip and shoulder pivots, using per-instance `iAnim` (phase, rate, pose, arms-forward). Seated and working lower the body and bend the legs forward. There are no bones and no skeleton uploads.
- The CPU does frustum culling and LOD picks per agent, and writes only the live instance ranges. That takes about 2.6 ms per update for 5,000 agents in Node.

## Perf (box, software GPU: llvmpipe, 1600x900)
| scene | visible | avg FPS | draw calls | tris |
|---|---|---|---|---|
| 5,000 wide | 3,605 | 21.8 | 11 | 184k |
| 5,000 close | 2,744 | 18.0 | 9 | 232k |
| 1,000 wide | 719 | 59.8 | 12 | 32k |

The box has no GPU. llvmpipe rasterises on the CPU, so these numbers are a floor. About 230k triangles over about 10 draw calls is a light load for any discrete or integrated GPU, so 60 FPS at 5,000 people still needs checking on real hardware.

## Run
- Tests: `npx vitest run src/render/people`
- Demo: `npm run dev`, then open `/src/render/people/demo.html?n=5000&view=wide|close`
- Perf + screenshots: `npx tsx src/render/people/perf-demo.mts`. This writes `/workspace/people/*.png` and `perf.json` (set `PEOPLE_OUT` to change the folder).
