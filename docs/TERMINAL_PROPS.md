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
