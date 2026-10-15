# Terminal interior build

Status: playable on floor 0. The shell is still built on the apron. Inside that shell, Terminal view follows Prison Architect: lay the indoor floor, drag walls, paint a room zone, then meet the room’s required items. The check stays on the bar.

Related: [INTERIOR_EDITOR.md](./INTERIOR_EDITOR.md) (floor index on every piece; only floor 0 is enabled).

## Prison Architect, and what we copy

Prison Architect builds indoors in four steps. Hatchfield uses the same order.

1. **Foundations.** Dragging a foundation lays indoor floor. Walls by themselves do not make a room. In Hatchfield the apron shell is that foundation for the starter hall: the outer walls, roof, and the first slab come with the building. The Foundation tool fills holes and new wings inside that shell. A tile that is already floor costs nothing the second time.
2. **Walls.** Drag a wall run inside the shell. Erase removes an interior wall. A door replaces one wall segment.
3. **Room zones.** Drag a rectangle to designate a room type (check-in, security, gate, shops, lounge, restroom, office, bag hall). The type paints the zone the walk uses. Resize and delete change that rectangle. Irregular, tile-by-tile zones are not this pass.
4. **Required items, checked immediately.** Each zone lists the item it needs before you paint it. A room without that item does not count as ready. The bar lists every interior room’s findings in one pass, not only the room you have selected. “Requirements met.” means the painted rooms are clean. “Place required” drops the missing piece on the first free tile and charges for it.

Floor and wallpaper stay in the bar as materials, after the four steps. They use the Gemini interior plates already in `public/art/textures/interiors`.

## Also borrowed

- **The Sims.** Floor and wall coverings are a catalog, painted per tile or per wall edge.
- **Two Point Hospital.** “Place required” is the one-click furnish after the zone exists. Hatchfield does not lock the room behind an accept button.
- **Project Hospital and Airport CEO.** Doors sit on a wall. The zone is what passengers use, once the required items are inside.

## How it is stored

The edit is data (`InteriorEdit` on the hall). The walk reads it by merging it onto the hall layout. The meshes only draw that edit. Floor 0 only; every new piece still carries a floor index. Upper-floor gameplay stays off (`ENABLED_STORIES = 1`).

Stills: `docs/devlog/media/terminal-interior/`.

## What this pass does not do

- No floor 1, no stair tool.
- No freeform zones. A room is a rectangle, the Prison Architect click-drag, edited with +/−.
- No per-room flood fill, no quarter-tile paint, no wallpaper on the curtain wall.
- Erasing a wall does not punch a hole in the shared exterior shell. It removes an interior wall, or a door the player added.
- A room can be any size from one tile up. There is no minimum-size blueprint. The finding stays on the bar until the required item is inside.
