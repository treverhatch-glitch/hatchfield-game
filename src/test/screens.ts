import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** Set UPDATE_SCREENS=1 to refresh tracked docs/screens goldens. */
export const UPDATE_SCREENS = process.env.UPDATE_SCREENS === '1'

/** Screenshot root: docs/screens/<sub> when updating goldens, else test-output/screens/<sub>. */
export function screensDir(sub: string): string {
  const dir = UPDATE_SCREENS ? join('docs/screens', sub) : join('test-output/screens', sub)
  mkdirSync(dir, { recursive: true })
  return dir
}
