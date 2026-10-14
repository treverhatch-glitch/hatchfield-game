# Building textures (base64)

The GitHub push path for this repo carries text only, so the building photo
textures (`public/art/textures/buildings/*.jpg`, 1024 px sRGB; round 8 upgraded warehouse_panels, hangar_cladding, roof_membrane and tank_steel to 2048 px, repeat-wrapped
in `src/build/models/kit.ts` → `tmat`) live here as base64, same pattern as
`public/art/refs/pack6/_pack6_b64/`.

Unpack (from the repo root):

```sh
python3 public/art/textures/buildings/_b64/unpack.py
# or
node scripts/unpack-textures.mjs
```

`npm run build`, `npm run dev` and `npm test` run `scripts/unpack-textures.mjs`
first. It never fails: if Python/base64 data is missing or corrupt it prints a
warning and the game falls back to plain colours (tmat only applies a map
once the photo has loaded, so a missing file is harmless in the browser and
skipped entirely in Node/vitest).

Sources: Gemini textures (`assets/gemini/textures/*.jpeg`) resized to 1024 px.
