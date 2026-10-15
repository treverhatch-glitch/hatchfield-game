import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Player-facing modules. A save-migration comment is not a sheet. */
const ROOTS = ['src/ui', 'src/phone', 'src/research', 'src/content', 'src/game', 'src/economy']
const BANNED = /Ops wallet|Growth > Ops/i

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      sources(path, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue
    out.push(path)
  }
  return out
}

describe('player-facing copy has no operations research sheet', () => {
  it('does not name that sheet in tooltips, news, letters, cards, or help', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
    const hits: string[] = []
    for (const rel of ROOTS) {
      for (const file of sources(join(root, rel))) {
        const text = readFileSync(file, 'utf8')
        if (BANNED.test(text)) hits.push(file.slice(root.length + 1))
      }
    }
    expect(hits).toEqual([])
  })
})
