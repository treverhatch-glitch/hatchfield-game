/**
 * Test-only switch: `?noRender=1` skips the WebGL draw call so headless browser tests (no GPU,
 * software 3D at ~0.2 fps) run the game at normal speed. Everything else still updates.
 * Without the query parameter this is always false, so normal play is unchanged.
 */
export const NO_RENDER =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('noRender') === '1'
