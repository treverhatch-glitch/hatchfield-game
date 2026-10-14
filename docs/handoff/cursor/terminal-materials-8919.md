# Handoff — `cursor/terminal-materials-8919`

PR: https://github.com/trevtheballer/hatchfield/pull/215
Base: `cursor/audit-playtest-562d`
Last commit on the branch: `1229f28` (pack 4). Parent: `ad0541e` (pack 1).

Stop point: pack 4 is wired, screenshotted, and pushed. `npx tsc -b` passed. `npm test` passed (1849 passed, 2 skipped). `npm run lint` passed with existing warnings only. No half-finished code was left uncommitted. Working tree was clean before this handoff file.

## Done

Texture pack 1 (already on the PR before this wind-down) and texture pack 4 are both in the terminal. High graphics quality uses each JPEG at its own 960² pixels. Med draws a 256 copy and low draws a 128. `pack4Edge` delegates to `pack1Edge` in `src/render/materials/pack1.ts`. Default boot quality is `bootQuality()` in `src/render/world/quality.ts` (localStorage `hatchfield-gfx`, else a GPU guess). SwiftShader / software GL boots low.

Pack 1 files in `public/assets/pack1/` (cream wall, glass curtain wall, oak, brushed steel, studded rubber, shop wood, navy seat fabric, navy gate carpet) map through `SurfaceLibrary.loadPack1` onto shell walls, glass, wood, steel, the belt, the kiosk shelf, and bench fabric.

Pack 4 files in `public/assets/pack4/`:

- `tex_terrazzo.jpg` — halls. `TERRAZZO_ROOMS` in `src/render/materials/pack4.ts`: checkin, security, airside, shops, lab. Floor mesh name `terminal-floor`.
- `tex_carpet_grey.jpg` — gates and offices. `CARPET_ROOMS`: gate, office. Mesh name `terminal-carpet`.
- `tex_ceiling_tiles.jpg` — mesh `terminal-ceiling` in `TerminalBuilding.buildRooms` (`src/render/world/terminal.ts`), parented to the shell at `ROOF_Y - m(0.12)`.
- `tex_granite_dark.jpg` — check-in counter top, podium top, and kiosk counter top (`surface: 'granite'` in `src/render/world/kit.ts`).
- `logo_bushline_local.jpg`, `logo_zoomjet.jpg`, `logo_crown_pacific.jpg`, `logo_siam_breeze.jpg`, `logo_northstar_cargo.jpg` — `AIRLINE_LOGOS`. Check-in desk slots and interior gate signs.
- `logo_hatchfield.jpg` — `BRAND_LOGO`. Landside facade plane in `TerminalBuilding.buildSigns` and a second plane `hatchfield-logo` on the fitted hall shell (`brandMark` in `src/render/hallWorld.ts`). Menu title is an `<img>` in `src/ui/TitleScreen.tsx` (`h1.game-title`, `data-testid="game-title"`), styled in `src/index.css`.

Repeat distances (meters) live in `PACK1_REPEAT_M` and `PACK4_REPEAT_M`. Interior tiling uses `packWorldRepeat` (`meters * WORLD_PER_METER`, 0.45) and `tileByPosition`. `applyPackMaps` in `terminal.ts` is an empty function so it cannot replace the JPEGs.

Check-in logo slot: `PlaneGeometry(0.72, 0.28)` translated to `(0, 0.22, 0.27)` on the counter, `mat: 'logo'`. `buildProps` groups those matrices by `i % AIRLINE_LOGOS.length` and instances `SurfaceLibrary.logoMaterial`. Materials are `MeshBasicMaterial`, `toneMapped: false`.

Interior gate signs: `TerminalBuilding.gateSign` builds a canvas via `wayfindingTexture('GATES', gateId)` (`GATE_SIGN` is 1536×512 in `src/render/world/textures.ts`). `SurfaceLibrary.onLogo` calls `stampWayfindingLogo`, which runs `inkBox` to crop the white paper and draws the mark on the left of the navy board. Both faces are named `gate-sign`. Check-in and Security stay text-only (`wayfindingSign`). Other room labels use `sign`.

Ceiling visibility: `TerminalBuilding.ceilingForce` (public). `update` sets `ceiling.visible = ceilingForce || camera is below the ceiling`. `HallWorld.stepInterior` sets `ceilingForce` from camera height before `update`. `hideTerminalShell` shows `terminal-floor` and `terminal-carpet` only. The ceiling is not in that whitelist. It is toggled every frame.

Also already on this PR, from earlier commits: nine-room plan, old hall furniture hidden when that plan shows, shell fitted to the rooms, Terminal camera minimum distance 8 m, instanced props, passenger bodies.

Screenshots (also copied to `/opt/cursor/artifacts/` for the PR):

- `docs/devlog/media/terminal-pack4-title.png`
- `docs/devlog/media/terminal-pack4-facade.png`
- `docs/devlog/media/terminal-pack4-counter.png`
- `docs/devlog/media/terminal-pack4-gate.png`
- refreshed `terminal-pack1-checkin.png`, `terminal-pack1-gate.png`, `terminal-pack1-office.png`, plus security, shops, hall, passengers

Verified in those shots: title logo, facade logo, terrazzo check-in floor, granite counters, Bushline / Zoomjet / Crown Pacific in the desk slots, ceiling tiles in the low counter shot, grey carpet in the gate and office, Bushline mark on the face-on `GATES A1` board. Pixel check on the gate close-up found the leaf green around x 364–466, y 298–372.

## Left

Nothing is required to finish the request that was in progress. These are the loose ends if someone keeps going. Do not touch `src/diplomacy`.

1. Exterior airside gate signs are not the composited board. `TerminalBuilding.buildSigns` (`src/render/world/terminal.ts`, the `airEdges.forEach` loop) still draws a small `GATE A1` text plane and a separate `logoMaterial(i)` plane offset by `m(1.7)` along `yaw + π/2`. Those live on `this.shell`. Hall view hides the shell except floor and carpet, so they do not show in Terminal view. They still show on the apron. To match the interior, call `gateSign` / `stampWayfindingLogo` there too, or delete the side plane.

2. Desk slots still map the full square JPEG, including white margins, onto a 0.72 m × 0.28 m plane. They read in the counter close-up, but the marks are stretched. Crop belongs on a cloned texture. Do not set `offset` / `repeat` on `SurfaceLibrary.airline[i]`. That texture is shared with every desk that uses the slot. Gate boards already crop in `inkBox` (`src/render/world/textures.ts`) onto their own canvas.

3. Airline choice is `slot % 5` in `buildProps` and `gateN++` in `buildRooms`. There is no link from a signed carrier to a logo. `AIRLINE_LOGOS` in `src/render/materials/pack4.ts` is the only list.

4. The departures board is static canvas text. `DEPARTURES_ROWS` and `departuresBoardTexture` in `src/render/world/textures.ts`. It does not follow live flights.

5. `maps.carpet` (pack 1 navy, `tex_carpet_gate_navy.jpg`) is still loaded by `loadPack1` and still has a repeat entry. Room floors use `maps.carpetGrey`. Nothing else needs the navy carpet unless a future room kind wants it.

6. `src/render/materials/library.ts` `onLogo` listeners are cleared only in `dispose`. A rebuilt terminal on the same library would stack listeners. Today `makeTerminalShared` loads pack 4 once.

## Known bugs

- Ceiling is invisible in the normal high hall camera on purpose. Forcing it always on blocks the build view. The counter screenshot sets `hall.interior.ceilingForce = true` and a low camera (logged y ≈ 0.92).
- `bootQuality()` on this SwiftShader box returns low until `localStorage['hatchfield-gfx'] = 'high'`. The close-up script sets that in the same `evaluate` as `setView('hall')`, before the first `makeTerminalShared`. Setting it later does not resize textures already uploaded.
- Gate close-up (`terminal-pack4-gate.png`) is very near the board and slightly oblique. The wide room shot `terminal-pack1-gate.png` still shows grey carpet and the gate, but the logo is small there. The mark is on the sign texture, not a second mesh.
- Passenger close-up at 8 m spanned about 0.29 of the frame. An older note wanted 0.4. Not part of pack 4. Camera minimum is already 8 m (`src/render/hallWorld.ts`).
- Logo JPEGs are 960×960 with large white margins. Content boxes measured with a 230 threshold: Bushline (102,196)–(858,771), Zoomjet (106,286)–(866,640), Crown Pacific (140,153)–(819,821), Siam Breeze (124,173)–(837,796), Northstar (50,189)–(911,812), Hatchfield (117,179)–(843,779). `inkBox` recomputes this in the browser. It is not hardcoded.
- Apron frame rate on SwiftShader at 5× settled around 20 fps (min about 10). Not a regression to chase here.
- Lint warnings in `scripts/` and `src/branding/` and `src/App.tsx` are pre-existing. Do not clean them in this branch unless you touch those lines.

## How to test

```bash
npm ci
npx tsc -b
npm test
npm run lint
```

Focused material tests:

```bash
npx vitest run src/render/materials/pack4.test.ts src/render/materials/pack1.test.ts src/render/materials/materials.test.ts
```

`pack4.test.ts` covers edge sizes, room lists, the 10 pack-4 URLs, granite plus a `logo` part on `propParts().counter`, and `SurfaceLibrary.onLogo` firing when the Bushline texture arrives.

Screenshots (dev server must already be up, or start one):

```bash
npx vite --port 45217 --host 127.0.0.1
npx tsx scripts/terminal-closeups.mts
```

Script: `scripts/terminal-closeups.mts`. It clears storage, shoots the title, starts a pax game, sets `hatchfield-gfx` to high, enters the hall, and writes the pngs under `docs/devlog/media/`. Chrome is `/usr/local/bin/google-chrome` with SwiftShader. Do not wait on `performance.getEntriesByType('resource')` for the JPEGs. Probe `hall.terminalShared.surfaces.maps.wall.image.width` (expect 960) and `surfaces.airline[0].image.width` (expect 960, src `logo_bushline_local.jpg`).

Manual check: new game, Terminal view, graphics high. Check-in floor light grey terrazzo, not the studded rubber (rubber stays on the belt). Gate and office floors grey diamond, not navy. Look up from inside a room, or set `ceilingForce`, to see ceiling tiles. Desk fronts show airline marks. A gate hanging sign shows a mark left of `GATES` / the gate id. Facade west face and the main menu show the Hatchfield tower.
