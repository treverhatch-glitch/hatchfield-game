# People reference sheets

Full-resolution Gemini turnarounds. They are not served and nothing decodes
them at boot. The in-game figures are low-poly parts coloured from the
palettes in `src/people/outfits.ts`, which were taken off these sheets.

Same idea as `assets/liveries/`: the original stays here, the browser only
sees geometry. If a later pass samples a sheet, scale it with
`peopleSheetEdge` (`hatchfield-texture-quality`: low 320, med 640, high 1280)
and load that one file when the close-up needs it.

`outfit_swatch_atlas` was not in the upload set.
