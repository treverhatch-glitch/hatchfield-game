#!/usr/bin/env node
/**
 * tools/replay/pack-rules.mjs: pack the game's rules into one file for the Unity port (option A: Unity runs
 * these same rules through Jint).
 *
 *   npm run pack:rules                                   → dist-sim/hatchfield-sim.mjs
 *   npm run pack:rules -- --unity <path to the Unity project>  → also copies it to <project>/Rules~/hatchfield-sim.mjs
 *
 * The packed file is this private repo's code. It is never committed: dist-sim/ is ignored here, and the copy
 * into a Unity project is refused unless that project's .gitignore ignores Rules~/ (the public Unity repo
 * ignores it, and its public guard blocks the file by name and content).
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const args = process.argv.slice(2)
const at = args.indexOf('--unity')
const unity = at >= 0 ? args[at + 1] : process.env.HATCHFIELD_UNITY
if (at >= 0 && !unity) fail('--unity needs the Unity project folder')

const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const r = spawnSync(process.execPath, [vite, 'build', '--config', 'tools/replay/vite.sim.config.ts'], { cwd: root, stdio: 'inherit' })
if (r.status !== 0) fail('the Vite build failed')

const out = path.join(root, 'dist-sim', 'hatchfield-sim.mjs')
if (!fs.existsSync(out)) fail(`no ${out} after the build`)
const bytes = fs.readFileSync(out)
const sha = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
console.log(`[pack-rules] dist-sim/hatchfield-sim.mjs  ${(bytes.length / 1048576).toFixed(1)} MB  sha256 ${sha}`)

if (unity) {
  const project = path.resolve(unity)
  if (!fs.existsSync(path.join(project, 'Assets')) || !fs.existsSync(path.join(project, 'ProjectSettings'))) fail(`${project} is not a Unity project (no Assets/ and ProjectSettings/)`)
  const ignore = fs.existsSync(path.join(project, '.gitignore')) ? fs.readFileSync(path.join(project, '.gitignore'), 'utf8') : ''
  if (!/^\/?Rules~\/?\s*$/m.test(ignore)) fail(`${project}/.gitignore does not ignore Rules~/, so the rules could be committed there. Not copying.`)
  const dest = path.join(project, 'Rules~', 'hatchfield-sim.mjs')
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(out, dest)
  console.log(`[pack-rules] copied to ${dest} (ignored by Git and by Unity)`)
}

function fail(why) {
  console.error(`[pack-rules] FAIL ${why}`)
  process.exit(1)
}
