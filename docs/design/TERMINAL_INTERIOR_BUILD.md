# Terminal interior build

Status: playable on floor 0. The shell is still built on the apron. This pass is how the player customizes the inside of that shell in Terminal view.

Related: [INTERIOR_EDITOR.md](./INTERIOR_EDITOR.md) (floor index on every piece; only floor 0 is enabled).

## What the other games do

**The Sims.** Build mode draws walls by dragging the wall tool. Shift drags a rectangle; Ctrl drags to delete. Closing a loop becomes a room, and the room tool resizes that room by its edges. Doors sit on a wall segment. Floor and wall coverings are a catalog: place by tile or by room, and Shift floods the room. Different floor patterns in one space are done by splitting with temporary walls, painting, then removing the walls. Cost sits on the cursor while you drag.

**Two Point Hospital.** Pick a room type, drag a blueprint at least the minimum size, then furnish. Required items are marked (the yellow starburst). The room cannot be accepted until those items are placed and reachable. Optional clutter with a bad footprint is removed on accept. Edit returns to the blueprint to resize, move the door, or sell the room. Adding items later does not require blueprint mode.

**Prison Architect.** Foundations make an indoor shell (floor, outer walls, ceiling). Walls alone do not. The player then paints a room type onto tiles inside that shell, any shape, and adds the objects that room needs. A room without its objects does not function. Doors go in the wall.

**Project Hospital.** Rooms are dragged as rectangles inside the building. Walls are thin and painted as a surface. One community note: a wall is a single surface, so two colours on one wall means painting the faces you can see, not a true two-sided material. Doors and windows replace a wall segment.

**Airport CEO.** The terminal foundation is the shell; the roof and outer walls come with it. Floors are decoration. Interior walls divide the shell, and doors drop onto a wall without deleting it first. Over-complicated walls make the room tool fail. The zone is a separate overlay: build the room, place the furniture, then mark the zone (shop, food, bathroom, staff, lounge). A zone with the right items is what passengers use. Ctrl-drag clears a zone.

## What Hatchfield takes

The shell stays the apron’s job. Terminal view edits the inside.

- Drag a wall run. A second mode erases. A door replaces one wall segment (Airport CEO, Sims).
- Paint is a catalog of the Gemini interior plates already in `public/art/textures/interiors`, split into floor and wall. Paint is per tile or per wall edge, not a second material system.
- A room is a dragged rectangle with a type: check-in, security, gate, shops, lounge, restroom, office, bag hall. Resizing and deleting change that rectangle. The type paints the zone underneath so the walk knows which side of security it is on.
- Required items are checked, not auto-filled (Two Point). A room with no desk, lane, counter, seat, or toilet reports that on the bar. “Place required” drops the missing piece on the first free tile and charges for it.
- The edit is data (`InteriorEdit` on the hall). The walk reads it by merging it onto the hall layout. The meshes only draw that edit. Floor 0 only; every new piece still carries a floor index.

Stills: `docs/devlog/media/terminal-interior/`.

## What this pass does not do

- No floor 1, no stair tool.
- No per-room flood fill, no quarter-tile paint, no wallpaper on the curtain wall.
- Erasing a wall does not punch a hole in the shared exterior shell. It removes an interior wall, or a door the player added.
- A room can be any size from one tile up. There is no minimum-size blueprint and no “accept” tick. The finding stays on the bar until the required item is inside.
