# Building textures (base64)

The GitHub push path for this repo carries text only, so the building photo
textures (`public/art/textures/buildings/*.jpg`, 1024 px sRGB, repeat-wrapped
in `src/build/models/kit.ts` → `tmat`) live here as base64, same pattern as
`public/art/refs/pack6/_pack6_b64/`.

Unpacked at build time by `scripts/unpack-art.mjs` (Node, no Python), which `npm run dev`,
`npm run build` and `npm test` run first (`predev`/`prebuild`/`pretest`). It is idempotent and never
fails: bad or missing data only warns and the game keeps flat colours. Run it by hand with
`npm run unpack-art`. Textures load through `src/render/world/textureRegistry.ts`.

Sources: Gemini textures (`assets/gemini/textures/*.jpeg`) resized to 1024 px.
