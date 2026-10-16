# Liveries: live in the game, and concept-only

Sampled 15 Oct 2026 from the files in the tree and from `docs/art/livery-concepts/`. A livery is live when a flight whose airline id is in the book wears it through the normal paint path. A plate that only resolves in the manifest is listed on its own.

## Live photographed plates

Served from `public/textures/liveries/<id>/`. High is the crop at its own pixels (the 4096 long-side figure is a ceiling). `med/` and `low/` are the only downscales. Sources in `assets/liveries/` are the uncropped photos the crop is taken from. They are not the UV layout, so the renderer does not sample them.

| Plate | Who wears it | Airframes |
| --- | --- | --- |
| `bushline_local` | Bushline (`bushline`) | `bn2`, `dhc6` |
| `crown_pacific` | Crown Pacific (`crown`) | `a380`, `b77w` |
| `zoomjet` | Zoomjet (`zoomjet`) | `a320neo`, `b738`, `b38m` |
| `siam_breeze` | Siam Breeze (`siam_breeze`) | `a320neo` |
| 40 Gemini roster plates | The roster id of the same name (`brisa`, `atlas_cargo`, …) | That carrier's fleet |

Zoomjet is a negotiation carrier. `game.allAirlines()` lists it, and a field that meets the asks can sign it. The scripted playthrough line "could not sign zoomjet" is from before that listing. It is not negotiation-only.

Its contract does not name metal. `CONTRACT_FLEET` stays unset, so spawn still draws from the 180-seat band. Pinning `a320neo`, `b738`, and `b38m` painted every Zoomjet flight with this plate, and it also kept the careful 35-day field from seating an eighth carrier and left every carrier on zero on-time through day 60. The plate paints those three types when one of them is the airframe. Other types in the band stay on the procedural shell.

## Plates with no carrier

These ids resolve a livery and the files are on disk. No row in the catalog, the roster, or the negotiation book uses the id, so a normal game never spawns an aircraft in that paint.

| Plate | Airframes on the plate | Why it does not fly |
| --- | --- | --- |
| `northstar_cargo` | `b752f`, `b763f`, `b748f` | No airline id `northstar_cargo` |

## Live procedural paint (concept palette + tail decal)

The five base roster carriers already exist. The Gemini concepts are their colour and tail reference, not new airlines. They are not photographed fuselage plates. The shell uses the sampled palette. The fin decal is a crop of the concept tail (`public/assets/airline-logos/<id>.jpg`). Top views set the crown and the wing, which is what the isometric camera sees. National Airways and HeavyLift were delivered as side views only.

| Concept file | Carrier | In game |
| --- | --- | --- |
| `puddle_jumper.jpeg`, `puddle_jumper_top.jpeg` | Puddle Jumper Airlines (`air_regional_1`) | Teal cheatline and tail, gold duck decal, white crown, teal wings |
| `skycheap.jpeg`, `skycheap_top.jpeg` | SkyCheap (`air_lowcost_1`) | Orange cheatline and tail, white bolt decal, white crown, grey wings |
| `prestige_air.jpeg`, `prestige_air_top.jpeg` | Prestige Air (`air_fullservice_1`) | Navy fuselage and tail, gold cheatline and crown decal, white belly, grey wings |
| `national_airways.jpeg` | National Airways (`air_flag_1`) | White fuselage, navy tail, red cheatline, flag decal. No top view, so the wing stays the default grey |
| `heavylift.jpeg` | HeavyLift Cargo (`air_cargo_1`) | Grey fuselage, yellow tail and cheatline, crane decal. No top view, so the wing uses the same grey as the fuselage |

## Concept-only

None of the eight attached concepts. All five carrier names are already in `src/airlines/data.ts`.

## Stills

`docs/devlog/media/liveries/` is the running game (starter kit, face noon, one parked flight retargeted onto that carrier and airframe). `siam-breeze-plate` and `northstar-cargo-plate` are posed wears of plates that no signed carrier uses. The other eight are carriers the game can actually field.
