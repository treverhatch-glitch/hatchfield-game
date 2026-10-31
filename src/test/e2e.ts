import { existsSync } from 'node:fs'

/** Chrome locations the browser tests try, in order. PLAYWRIGHT_CHROME wins when set. */
export const CHROME_PATHS = [
  process.env.PLAYWRIGHT_CHROME,
  '/usr/bin/google-chrome',
  '/usr/local/bin/google-chrome',
].filter((path): path is string => Boolean(path))

/** First Chrome found, or undefined so Playwright falls back to its own browser. */
export function findChrome(): string | undefined {
  return CHROME_PATHS.find((path) => existsSync(path))
}

/**
 * Game URL for browser tests. Headless Chrome has no GPU and draws 3D in software at about
 * one frame every 5 s, so game time barely moves. `noRender=1` skips only the 3D draw call;
 * the sim, HUD and DOM still run every frame. Screenshot tests (`npm run test:screens`) pass
 * draw=true to keep the 3D picture.
 */
export function gameUrl(port: number, draw = false): string {
  return draw ? `http://127.0.0.1:${port}/` : `http://127.0.0.1:${port}/?noRender=1`
}
