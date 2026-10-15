# Menu UI

Note for the 15 Oct 2026 playtest. Desktop only. The apron stays the picture; the menu is a rail on top of it.

## What the reference games actually do

**Planet Coaster and Planet Zoo.** The menu is a vertical list on the left of a moving park. Continue, New, Load, Settings, and Exit are short labels, not boxed cards. Load rows carry a thumbnail, the park name, and the date. Players praise the feeling that the game has already started, and they use the thumbnail to recognise an old park. They complain when the list gets long and slow, and when the pause screen does not share the menu's type and spacing.

**Cities: Skylines 2.** A full-bleed city, a left column of plain type, almost no chrome. Panels slide in; the city stays visible. Players praise that restraint on the main menu. The early in-game UI was the complaint: low contrast, nested panels, and a pause screen that did not match the menu. Load rows were thin on city facts (money, date, progress).

**Two Point Hospital and Two Point Campus.** Illustrated, bright, one obvious next step. Players praise the personality and that New Game is never in doubt. They complain when a cute transition holds them, and when the management screens abandon that clarity for a different, denser system.

**Manor Lords.** A still landscape, a short serif list, the sound of the place under the type. Players praise the calm. They complain that save rows say too little, and that pause feels like a different product from the title.

**Airport CEO.** Grey stacks, equal-weight buttons, small type, saves as filenames. Players who stay praise that a switch is labeled. The repeated complaint is that the menu looks like a tool, not an airport, and that nothing has hierarchy.

**Frostpunk 2.** A living city behind a dark gradient, one accent, a short fade rather than a bounce. Players praise the atmosphere and that the menu is a promise of the city. They complain when a later panel is a different material language, and when type sits at low contrast on the cinematic background.

## What Hatchfield takes from that

- The background is the player's kind of airport: the existing slow orbit of a live starter field (`MenuFlyover`). The scrim is heavy on the left and open on the right.
- One rail. Continue, New Game, Load Game, Settings, Credits, Quit. The pause rail is Resume, Save, Load, Settings, Exit to menu. Same type, same gold rule, same glass.
- Type is IBM Plex. Labels are large and left-aligned. The gold accent is a 2px rule and the one primary action, not a stack of gold blocks.
- Motion is a short rise on the panel and a few pixels of travel on hover. The title does not bob. Reduced motion holds the camera and skips the rise.
- New Game is the climate, the starter kit, and an optional scenario. Free play stays the default. A scenario starts only when the plot is bought.
- Load rows show a thumbnail when the apron canvas can be read, otherwise a day plate. Each row has the name, the date, the game day, and the cash. Autosave is the live browser save. Two earlier autosaves are kept when the day rolls. Named copies are separate. Delete asks in the row. Rename is in the row.

## What this pass does not do

The pause sheet still leaves the field visible. It is not a blocking modal. Live aircraft, trucks, and hall guests are not part of the save picture; the timetable and the fuel contract are. That split is recorded in the save audit, not papered over here.
