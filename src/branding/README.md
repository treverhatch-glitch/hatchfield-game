# Airport branding (name + logo builder)

Self-contained module: pure SVG, no image assets, no dependency on `sim.ts` or existing UI.

| File | What |
|---|---|
| `types.ts` | `LogoSpec` (versioned, JSON-safe) and `BrandingSave` |
| `parts.ts` | 8 emblem shapes, 32 icons, 14 palettes, 8 font stacks, 4 layouts |
| `render.ts` | `renderLogoSVG(spec)` deterministic SVG string, `logoDataURL` |
| `validate.ts` | name validation (length 3-32, charset, profanity), `suggestCode`, `validateCode`, `validateLogoSpec`, `serializeBranding` / `deserializeBranding` |
| `presets.ts` | 24 presets (modern, retro, regional, luxury, cargo), `applyPreset` |
| `random.ts` | seeded `randomizeLogo` |
| `texture.ts` | `svgToCanvas`, `createLogoTexture` (THREE.CanvasTexture), `useLogoTexture` hook |
| `AirportBrandingScreen.tsx` | name + code + preset gallery + Customize tab + live preview + randomize |
| `LogoBadge.tsx` | compact HUD badge |

Contact sheet of all presets: render with `renderLogoSVG` + resvg (binary not committed via connector).

## Integration hooks (not wired yet, to avoid colliding with the UI redesign / terminal agents)

1. **New-game flow (title screen):** after "New game", render
   `<AirportBrandingScreen onConfirm={(b) => startNewGame({ branding: b })} onCancel={backToTitle} />`
   centred over the dimmed scene. Pass rival codes as `takenCodes` once rivals exist.
2. **Save data:** add `branding?: BrandingSave` to the save object. On save, store `serializeBranding(b)`
   (or the object itself); on load use `deserializeBranding(raw) ?? defaultBranding` so old saves keep working.
   Default: `{ airportName: 'Hatchfield', code: suggestCode('Hatchfield'), logo: PRESETS[0].spec }`.
3. **HUD:** put `<LogoBadge spec={branding.logo} onClick={openBrandingSettings} />` at the left of the top status strip.
   Re-opening `AirportBrandingScreen` with `initial={branding}` lets players rebrand later (could cost money / be a Field Level perk).
4. **3D world:** `const tex = useLogoTexture(branding.logo)` (or `await createLogoTexture(spec)` outside React) and use it as
   `map` on terminal roof signage, the guard-post sign or a ground decal. Texture object is stable; it updates in place.
5. **Fonts:** only CSS stacks are used. If web fonts get added later, await `document.fonts.ready` before creating textures.


## In-world props (`signs.ts`, `props.ts`)

`signs.ts` makes the SVG faces (flag, monument, facade, wayfinding, gate, decal). `props.ts` turns them into Three.js props:
`createFlagProp`, `createMonumentSign`, `createFacadeSign`, `createWayfindingSign`, `createTowerDecal`, `createGateSign(spec, n)`.

- Each returns `{ object: THREE.LOD, update?(t), dispose() }`. Close up you get the textured detail; past `lodDistance` (default 180 m) a flat-coloured box with no texture.
- Textures come from one shared `BrandTextureCache` (ref-counted, keyed by SVG). Create one per scene: `const cache = new BrandTextureCache()`. Gate signs with the same label share a texture; `dispose()` releases them, and the GPU texture is freed when nobody uses it.
- The flag waves in the vertex shader (`onBeforeCompile`, one `uTime` uniform). Call `flag.update(clock.elapsedTime)` each frame. It's cheap; skip it when the flag is far away.
- Rebrand: dispose the old props and create new ones. The cache drops the old textures.

Hooks (renderer owner wires these):
1. Entrance road: `createMonumentSign` at the map edge or guard post, `createFlagProp` ×2–3 beside it, `createWayfindingSign` at junctions.
2. Terminal: `createFacadeSign({ width: facadeWidthMeters })` on the landside facade.
3. Control tower: `createTowerDecal` just in front of the cab wall (it already uses polygonOffset).
4. Gates: `createGateSign(spec, gate.label)` above each stand or jetway door.

## Finance / IPO (`finance.ts`, `Finance.tsx`)

- `deriveTicker(code, name, takenTickers)` returns the code (HTF). If that's taken it adds letters from the name (HTFH), then A–Z. `formatTicker` gives `HATCH:HTF`.
- `certificateSVG` / `<ShareCertificate spec ticker shares holder serial issued />` makes a deterministic share certificate.
- `<StockTickerCard spec ticker price change history />` is a compact quote card with a sparkline, and `<ExchangeListingBadge spec ticker />` is a "Listed on HATCH" badge.

Hooks (I couldn't find the IPO / HATCH exchange code through GitHub code search, so adapt the names):
1. At IPO: `ticker = deriveTicker(branding.code, branding.airportName, rivalTickers)` and store it in the save next to `branding`.
2. Exchange panel: one `StockTickerCard` per listed company. The player's row uses `branding.logo`; rivals use their own `LogoSpec` (a preset works).
3. IPO-complete modal: `<ShareCertificate shares={founderShares} holder={playerName} serial={`${ticker}-0001`} issued={gameDateLabel} />`.
4. HUD or finance header: `ExchangeListingBadge` after listing.

Tests: `npx vitest run src/branding` (45 tests).
