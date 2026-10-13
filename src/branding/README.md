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

Tests: `npx vitest run src/branding` (12 tests: catalogue, validation, code suggestion, serialization round-trip, render determinism, seeded randomize).
