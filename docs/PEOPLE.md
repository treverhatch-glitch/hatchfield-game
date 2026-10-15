# Hall and pax crowd (`src/render/people/`)

The hall crowd (passengers plus terminal staff) draws through the instanced renderer in `src/people/` (see `docs/PEOPLE_VISUALS.md`). `src/render/people/` is the adapter: it keeps the original `createCrowd` API and thought bubbles, and maps sim agents onto `PeopleRenderer`.

## API
```ts
import { createCrowd } from './render/people'
const crowd = createCrowd(scene, { camera, unitsPerMeter: WORLD_PER_METER })
// every frame:
crowd.update(agents, dtSec)   // agents: CrowdAgent[]
crowd.showThought(paxId, { icon: '🍔', text: 'wish they had burgers', duration: 4 })
crowd.hideThought(paxId)
crowd.setCamera(cam); crowd.dispose()
```
`CrowdAgent = { id, role, pos: {x,y?,z} | [x,y,z], heading, state?, bagIds?, bagsDropped?, speed? }`
- `role`: `passenger | checkin | security | gate | shop | cleaner | researcher`
- `heading`: radians around +Y. 0 faces +Z.
- `state`: a free-form sim string mapped to a pose by `poseFor()`: `seat/sit/waiting/lounge` gives seated, `research/desk` gives seated (typing), `queue/line` gives the queue shuffle, `walk/move/to_*` gives walk. Anything else is idle, or walk if the position changed since the last frame. A walking passenger with a roller bag uses the bag-pull pose.
- A passenger with `bagIds.length > 0` who has not dropped them (and whose state is not past check-in) is guaranteed to carry a roller or duffel. Everything else about a passenger (skin, hair, hat, clothes, backpack, carry-on) is deterministic from `id`.
- Staff wear crew uniforms from `src/people`: check-in is a navy jacket and lanyard, gate is cabin crew in red, security is the security uniform, cleaners are in maintenance coveralls. Shop staff are in green and R&D in white coats. Ramp crew in hi-vis, fuel, and catering each have their own uniform.

## Scale and detail
- `unitsPerMeter` converts world units to metres: bodies, bubbles and LOD distances all use metres. `lod` (`[nearM, midM]`) and `cull` (metres) override the defaults in `src/people/config.ts`.
- People outside the camera frustum are not drawn (`stats.culled`). With no camera everyone is drawn at full detail, capped by the LOD caps.
- Pass `lite` as the third `update` argument to skip full-detail bodies (fast-forward).

## Run
- Tests: `npx vitest run src/render/people src/people`
- Demo: `npm run dev`, then open `/src/render/people/demo.html?n=2500&view=wide|close`
