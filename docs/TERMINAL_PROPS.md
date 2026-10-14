# Terminal props

Detailed, instanced 3D models for the terminal interior and a new hall shell
and exterior. Code: `src/render/terminalProps/`. Nothing in `src/terminal/`,
`src/build/`, `src/render/people` or `src/render/vehicles*` is touched.

## Files

| File | What |
| --- | --- |
| `props.ts` | One builder per prop type, parts in metres, front = +Z |
| `parts.ts` | Part type, `place`/`rowX` helpers, footprint |
| `materials.ts` | Material palette, Gemini textures (base64 → data URL), canvas signs and FIDS |
| `shell.ts` | `buildTerminalHall` (terrazzo, curtain walls, trusses, pendants, lights) and `buildTerminalExterior` (canopy, kerb, roof, sign) |
| `index.ts` | Registry, `TERMINAL_ITEM_TO_PROP`, `buildTerminalProps` |
| `demo.ts` + `/terminal-props.html` | Preview page: `?view=lineup`, `interior`, `exterior` |

## Registry

```ts
import { buildTerminalProps, TERMINAL_PROPS, TERMINAL_ITEM_TO_PROP } from '../render/terminalProps'
TERMINAL_PROPS.gate_seating()      // { parts, size: { w, d, h } }
scene.add(buildTerminalProps([{ type: 'checkin_row', x, z, yaw }], { shadows: true }))
```

All placements share one `InstancedMesh` per (primitive, material) pair, so a
full terminal is ~150 draw calls regardless of how many props are placed.

Types: `checkin_row, security_lane, walkthrough_arch, xray_machine,
shop_coffee, shop_dutyfree, shop_news, shop_fastfood, food_court, cafe_table,
gate_seating, seat_row, charging_post, gate_podium, restroom_block,
baggage_carousel, baggage_trolley, departures_board, wayfinding_sign,
wayfinding_totem, planter, planter_long, bin, stanchion, stanchion_queue`.

## Hookup to src/terminal (one line)

Where the playable terminal places an item, map its id and build:

```ts
const type = TERMINAL_ITEM_TO_PROP[item.kind]   // the one-line mapping
if (type) placements.push({ type, x: item.x, z: item.z, yaw: item.rot })
```

`TERMINAL_ITEM_TO_PROP` in `index.ts`:

| item id | prop type |
| --- | --- |
| checkin, checkin_desk | checkin_row |
| security, security_lane | security_lane |
| cafe, coffee | shop_coffee |
| duty_free, dutyfree | shop_dutyfree |
| shop, news | shop_news |
| fast_food | shop_fastfood |
| restaurant, food_court | food_court |
| bench, seat_row | seat_row |
| gate, gate_seating | gate_seating |
| charging | charging_post |
| restroom, restrooms | restroom_block |
| baggage_claim, baggage_reclaim, carousel | baggage_carousel |
| fids, departures_board | departures_board |
| sign | wayfinding_sign |
| plant, planter | planter |
| trash_can, bin | bin |
| queue | stanchion_queue |
| stanchion | stanchion |

Add or rename keys there once Jules's item ids in `src/terminal` are final.
Props are authored at real size; if the game grid cell is smaller, scale the
group or pick `seat_row`/`cafe_table` over the cluster types.

## Textures

Gemini textures `terrazzo_floor`, `terminal_glass`, `conveyor_belt`,
`diamond_plate`, `roof_membrane`, and the terminal concept images
(`checkin_row`, `security_lane`, `shop_*`) live in `tex/*.b64.txt`
(downsized JPEG, base64). Vite imports them `?raw` and they unpack to data URLs
at load, so the repo stays text-only. Shop concept images are used as
backlit menu boards and lightbox posters. Airline logo walls use
`/assets/pack4/logo_*.jpg`.

## Pass 2: desktop tier (RTX 4070 baseline)

Default `quality: 'high'`; pass `quality: 'low'` to `buildTerminalHall` /
`buildTerminalExterior` for the pass-1 look. Preview: add `&q=low`.
New views: `?view=checkin`, `gates`, `airside`.

| Area | Change |
| --- | --- |
| Environment | `env.ts` `setupTerminalEnvironment(renderer, scene)`: PMREM RoomEnvironment reflections, ACES, PCF soft shadows; demo uses 4K sun shadows |
| Floor | `hiq.ts` 2K procedural 1.2 m porcelain tiles (grout, veining, tone variation) + roughness map + clearcoat; carpeted gate lounges via `HallSpec.carpets` with stainless trims |
| Ceiling / structure | Timber slat baffle ceiling, warm LED perimeter cove, flared column capitals, stainless plinths; more interior lights |
| Glazing | Physical glass (IOR 1.5, clearcoat, env reflections); exterior aluminium fins and fritted sunshade louvres; rooftop skylight ridges |
| Exterior | 4 m roof overhang with timber soffit + downlights, lacquered roof edge, lit HATCHFIELD sign with blue halo, Departures/Arrivals signs, lamp posts, LED bollards, airside apron |
| Jet bridges | New `jet_bridge` prop (~18 m: rotunda, 2 telescoping corrugated tunnels with glazing, cab with bellows/canopy, drive bogie, rams, service stair). Exterior docks 3 by default (`HallSpec.jetBridges` x list, `[]` for none) |
| Check-in | Lacquer fronts + LED kick strip; new `self_checkin_kiosk` and `kiosk_bank` |
| Boards / signage | 2K split-flap FIDS with airline colour chips (14 rows), Arrivals variant; new `departures_wall` (3 panels, lit frame); new `gate_pylon` with lit gate number; podium uses the gate number |
| Restrooms | Ceramic wall tile (white + teal), mirrors, hand dryers, LED fascia |
| Materials | `MatSpec` gains `roughMap`, `clearcoat` (MeshPhysicalMaterial), `envI`; brushed/stainless roughness streaks; higher-segment cylinders/spheres |

New item ids: `kiosk`, `self_checkin`, `departures_wall`, `gate_sign`, `jet_bridge`, `airbridge`.
All new textures are canvas-generated at load (no binaries).
