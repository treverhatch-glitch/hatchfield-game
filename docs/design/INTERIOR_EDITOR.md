# Interior editor — floor-ready schema

Status: schema only. Floor 0 is the only story the game walks. No upper-floor gameplay, no stair tool, no second slab.

The live editor is `BuildLayout` in `src/terminalbuild`. The advisor reference is `TerminalPlan` in `src/terminaladvisor`. Both already name a story on every piece that will need one when floor 1 arrives.

## What ships today

- `ENABLED_STORIES` is 1 (`src/terminalbuild/floors.ts`). A piece on floor 1 can be stored. The nav graph does not walk it.
- `STARTER_STORIES` is 1. `blankLayout` and the prefab hall (`prefabNavLayout`) set `stories: 1` and `verticals: []`. The starter terminal stays one story.
- Floor 1 is reserved for a later mid-game upgrade: departures up, arrivals down. Raising `ENABLED_STORIES` is the switch. Do not build that upgrade in this pass.

## Live layout (`BuildLayout`)

| Piece | Field | Omitted means |
| --- | --- | --- |
| Wall (`Edge`) | `floor?: number` | 0 |
| Door (`Door` extends `Edge`) | `floor?: number` | 0 |
| Room | `floor?: number` | 0 |
| Furniture (`Equip`) | `floor?: number` | 0 |
| Tile | `floor?: number` | 0 |
| Layout | `stories?: number` | 1 |
| Vertical (`stairs` \| `escalator` \| `lift`) | `floor?` (from) and `toFloor` | from is 0 |

`placeWall`, `placeDoor`, `placeRoom`, `placeEquipment`, and `encloseFloor` stamp `floor: 0` on new pieces. Older saves that omit the field still read as floor 0.

Keys stay historical on the ground story so existing indexes do not move:

- `edgeKey` on floor 0 is `x,y,dir` (for example `1,2,E`), even when `floor: 0` is stamped.
- `tileKey(x, y)` and `tileKey(x, y, 0)` are `x,y`.
- Floor 1 and above prefix the story: `1|1,2,E`, `1|3,4`. Two stories cannot share a key.

Room overlap and furniture collision are per story. A desk on floor 0 does not block the same x,y on a later floor.

`edgeBetween`, `edgeTiles`, and `around` copy an explicit story onto the derived edge or tile. A ground tile that omits `floor` still produces an unprefixed key.

## Slab

`layout.floor` and `layout.zones` are the ground slab only. Upper stories are not stored in those arrays while only floor 0 ships. A floor-1 upgrade adds a slab (and a zone grid) per story. It does not have to migrate walls, doors, rooms, or furniture: those already carry the index.

## Nav graph

`buildNavGrid` always fills `NavGrid.links` from `floorLinks(layout)`.

A link is one stair, escalator, or lift. Both ends must sit inside the enabled story count, and the two ends must differ. With `ENABLED_STORIES = 1` a stair from 0 to 1 is kept on the layout and left out of `links`. Passing `enabledStories: 2` returns it, which is how the later upgrade turns the same data on.

The cell grid itself is still the ground floor. Walkers do not change story.

## Advisor reference (`TerminalPlan`)

The advisor was already multi-floor and stays that way. `blankPlan(w, h, floors)` builds one `Level` per story. `neighbours` steps through `stairs` (`kind: 'stairs' | 'escalator' | 'lift'`, `from` / `to`). The test `multi-floor: stairs connect floors` keeps working. That model is the reference, not the live editor.

Naming collision: `Cell.floor` on a level is a boolean slab flag (is there floor here), not the story index. The story is which `Level` the cell sits in (`floors[f]`). Do not overload `Cell.floor`.

`Edge.floor` on the advisor is the story index, optional, omitted means that level. `autoWalls` writes it. `Equipment.floor` is the story index and is required; a starter plan only places 0.

## What this pass does not do

- No floor-1 gameplay, camera, or palette.
- No stair, escalator, or lift tool, cost, or mesh.
- No second slab, no departures-up / arrivals-down split.
- No change to how passengers walk the ground floor.
