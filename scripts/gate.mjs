/**
 * Local gate. GitHub Actions does not run, so this is the check a PR and a
 * main fast-forward both have to pass.
 *
 *   npm run gate                 30-day soak, Careful bots for 15 days
 *   npm run gate -- --full       150-day soak, every bot persona + browser smoke
 *   npm run gate -- --no-install skip npm ci
 *
 * Writes docs/devlog/gate/<sha>.json and .md for the commit it ran against.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const known = new Set(['--full', '--no-install', '--help'])
const unknown = args.filter((arg) => !known.has(arg))

if (args.includes('--help') && unknown.length === 0) {
  console.log('Usage: npm run gate -- [--full] [--no-install]')
  console.log('  default   Node >= 22, npm ci, unpack-art, tsc, oxlint, vitest, vite build,')
  console.log('            30-day soak, perf/people draw-call budgets, Careful bots (15 days)')
  console.log('  --full    150-day soak and the full bot playtest')
  console.log('  --no-install  skip npm ci')
  process.exit(0)
}

if (unknown.length) {
  console.error(`Unknown gate flag: ${unknown.join(' ')}`)
  console.error('Usage: npm run gate -- [--full] [--no-install]')
  process.exit(1)
}

const full = args.includes('--full')
const noInstall = args.includes('--no-install')
const soakDays = full ? 150 : 30
const mode = full ? 'full' : 'quick'

const BUDGET_TESTS = [
  'src/people/budget.test.ts',
  'src/render/people/crowd.test.ts',
  'src/render/hallFigures.test.ts',
  'src/perf/lodTune.test.ts',
  'src/perf/overlay.test.ts',
  'src/perf/rendererStats.test.ts',
]

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function git(gitArgs) {
  return new Promise((resolve) => {
    const child = spawn('git', gitArgs, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (buf) => {
      out += buf.toString()
    })
    child.on('error', () => resolve(''))
    child.on('close', (code) => resolve(code === 0 ? out.trim() : ''))
  })
}

function exec(cmd, cmdArgs, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (buf) => {
      const text = buf.toString()
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (buf) => {
      const text = buf.toString()
      stderr += text
      process.stderr.write(text)
    })
    child.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`${message}\n`)
      resolve({ code: 1, stdout, stderr: `${stderr}${message}\n`, signal: null })
    })
    child.on('close', (code, signal) => {
      resolve({ code: code ?? 1, stdout, stderr, signal: signal ?? null })
    })
  })
}

function stripAnsi(text) {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 27 && text[i + 1] === '[') {
      const end = text.indexOf('m', i + 2)
      if (end !== -1) {
        i = end
        continue
      }
    }
    out += text[i]
  }
  return out
}

function tail(text, lines = 30) {
  return stripAnsi(text).trim().split(/\r?\n/).slice(-lines).join('\n')
}

function lastLine(text, label) {
  const matches = [...stripAnsi(text).matchAll(new RegExp(`^\\s*${label}\\s+(.+)$`, 'gm'))]
  return matches.length ? matches[matches.length - 1][1] : ''
}

function countWord(line, word) {
  const match = line.match(new RegExp(`(\\d+)\\s+${word}`))
  return match ? Number(match[1]) : 0
}

function parseVitest(text) {
  const fileLine = lastLine(text, 'Test Files')
  const testLine = lastLine(text, 'Tests')
  if (!fileLine && !testLine) return null
  const fileTotal = fileLine.match(/\((\d+)\)/)
  const testTotal = testLine.match(/\((\d+)\)/)
  return {
    filesPassed: countWord(fileLine, 'passed'),
    filesFailed: countWord(fileLine, 'failed'),
    filesSkipped: countWord(fileLine, 'skipped'),
    files: fileTotal ? Number(fileTotal[1]) : 0,
    passed: countWord(testLine, 'passed'),
    failed: countWord(testLine, 'failed'),
    skipped: countWord(testLine, 'skipped'),
    total: testTotal ? Number(testTotal[1]) : 0,
  }
}

function readSoakReport() {
  try {
    return JSON.parse(readFileSync('/tmp/soak-report.json', 'utf8'))
  } catch {
    return null
  }
}

function soakFacts(report) {
  if (!report || typeof report !== 'object') {
    return { days: null, reachedDay: null, cashEnd: null, stuck: null, recoveries: null, heapGrowth: null }
  }
  return {
    days: typeof report.days === 'number' ? report.days : null,
    reachedDay: typeof report.reachedDay === 'number' ? report.reachedDay : null,
    cashEnd: typeof report.cashEnd === 'number' ? report.cashEnd : null,
    stuck: Array.isArray(report.outstanding) ? report.outstanding.length : null,
    recoveries: typeof report.recoveries === 'number' ? report.recoveries : null,
    heapGrowth: typeof report.heapGrowth === 'number' ? report.heapGrowth : null,
  }
}

function money(value) {
  if (typeof value !== 'number') return 'n/a'
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US')}`
}

function seconds(ms) {
  return Math.round(ms / 100) / 10
}

const steps = []

function push(step) {
  steps.push(step)
  const detail = step.detail ? ` — ${step.detail}` : ''
  console.log(`\n[gate] ${step.status} ${step.id} (${seconds(step.durationMs)}s)${detail}\n`)
}

async function runStep(id, command, cmdArgs, options = {}) {
  const started = Date.now()
  console.log(`\n[gate] run ${id}: ${command} ${cmdArgs.join(' ')}\n`)
  const result = await exec(command, cmdArgs, options.env ?? process.env)
  const counts = options.parse === 'vitest' ? parseVitest(`${result.stdout}\n${result.stderr}`) : null
  const soak = options.parse === 'soak' ? soakFacts(readSoakReport()) : null
  let detail = options.detail ?? ''
  if (counts) {
    detail = `${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped (${counts.files} files)`
  }
  if (soak) {
    detail = `${soak.days ?? soakDays} days, end cash ${money(soak.cashEnd)}, stuck ${soak.stuck ?? 'n/a'}, recoveries ${soak.recoveries ?? 'n/a'}`
  }
  const step = {
    id,
    status: result.code === 0 ? 'pass' : 'fail',
    durationMs: Date.now() - started,
    exitCode: result.code,
    command: [command, ...cmdArgs].join(' '),
    detail,
    tail: result.code === 0 ? '' : tail(`${result.stdout}\n${result.stderr}`),
    testCounts: counts,
    soak,
  }
  push(step)
  return step
}

function skipRest(ids) {
  for (const id of ids) {
    push({
      id,
      status: 'skip',
      durationMs: 0,
      exitCode: null,
      command: '',
      detail: 'not run',
      tail: '',
      testCounts: null,
      soak: null,
    })
  }
}

function renderMarkdown(summary) {
  const lines = []
  const title = summary.ok ? 'pass' : 'fail'
  lines.push(`# Gate ${title} \`${summary.shortSha}\``)
  lines.push('')
  lines.push(`- Mode: ${summary.mode}`)
  lines.push(`- Commit: \`${summary.sha}\``)
  lines.push(`- Node: ${summary.node}`)
  lines.push(`- Started: ${summary.startedAt}`)
  lines.push(`- Finished: ${summary.finishedAt}`)
  lines.push(`- Wall: ${seconds(summary.durationMs)}s`)
  lines.push('')
  lines.push('| Step | Result | Seconds | Detail |')
  lines.push('| --- | --- | ---: | --- |')
  for (const step of summary.steps) {
    const detail = (step.detail || '').replace(/\|/g, '\\|')
    lines.push(`| ${step.id} | ${step.status} | ${seconds(step.durationMs)} | ${detail} |`)
  }
  lines.push('')
  lines.push('## Tests')
  lines.push('')
  if (summary.testCounts) {
    const counts = summary.testCounts
    lines.push(
      `${counts.files} files (${counts.filesPassed} passed, ${counts.filesFailed} failed). ${counts.passed} tests passed, ${counts.failed} failed, ${counts.skipped} skipped (${counts.total} total).`,
    )
  } else {
    lines.push('Vitest did not print a test summary.')
  }
  lines.push('')
  lines.push('## Soak')
  lines.push('')
  const soak = summary.soak
  if (soak && soak.days != null) {
    lines.push(`- Days requested: ${soak.days}`)
    lines.push(`- Day reached: ${soak.reachedDay ?? 'n/a'}`)
    lines.push(`- End cash: ${money(soak.cashEnd)}`)
    lines.push(`- Still stuck: ${soak.stuck ?? 'n/a'}`)
    lines.push(`- Recoveries: ${soak.recoveries ?? 'n/a'}`)
    if (soak.heapGrowth != null) lines.push(`- Heap growth after warmup: ${soak.heapGrowth}`)
  } else {
    lines.push('No soak report.')
  }
  lines.push('')
  lines.push('## Result')
  lines.push('')
  lines.push(summary.ok ? 'PASS' : 'FAIL')
  const failed = summary.steps.filter((step) => step.status === 'fail')
  if (failed.length) {
    lines.push('')
    for (const step of failed) {
      lines.push(`### ${step.id}`)
      lines.push('')
      lines.push('```')
      lines.push(step.tail || '(no output)')
      lines.push('```')
    }
  }
  lines.push('')
  return `${lines.join('\n')}`
}

function writeReports(summary) {
  const dir = join(root, 'docs/devlog/gate')
  mkdirSync(dir, { recursive: true })
  const stem = summary.sha || 'unknown'
  const jsonPath = join(dir, `${stem}.json`)
  const mdPath = join(dir, `${stem}.md`)
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(mdPath, renderMarkdown(summary))
  return { jsonPath, mdPath }
}

async function main() {
  const startedAt = new Date()
  const sha = await git(['rev-parse', 'HEAD'])
  const shortSha = sha ? sha.slice(0, 12) : 'unknown'
  const nodeVersion = process.version
  const major = Number(process.versions.node.split('.')[0])
  const planned = [
    'node',
    'npm-ci',
    'unpack-art',
    'tsc',
    'oxlint',
    'vitest',
    'vite-build',
    'soak',
    'draw-budgets',
    'playtest-bots',
  ]

  console.log(`[gate] ${mode} on ${shortSha} (node ${nodeVersion})`)

  const nodeOk = Number.isFinite(major) && major >= 22
  push({
    id: 'node',
    status: nodeOk ? 'pass' : 'fail',
    durationMs: 0,
    exitCode: nodeOk ? 0 : 1,
    command: 'process.version',
    detail: nodeOk
      ? `${nodeVersion} (>= 22)`
      : `${nodeVersion} is too old. Hatchfield's gate needs Node.js 22 or newer — Vitest 5 does not run on Node 20. Install Node 22 and run npm run gate again.`,
    tail: '',
    testCounts: null,
    soak: null,
  })

  let failed = !nodeOk
  const remain = () => planned.filter((id) => !steps.some((step) => step.id === id))

  if (!failed && !noInstall) {
    const step = await runStep('npm-ci', npmBin(), ['ci'])
    failed = step.status !== 'pass'
  } else if (!failed && noInstall) {
    push({
      id: 'npm-ci',
      status: 'pass',
      durationMs: 0,
      exitCode: 0,
      command: 'npm ci',
      detail: 'skipped (--no-install)',
      tail: '',
      testCounts: null,
      soak: null,
    })
  }

  if (!failed) {
    const step = await runStep('unpack-art', process.execPath, ['scripts/unpack-art.mjs'])
    failed = step.status !== 'pass'
  }
  if (!failed) {
    const step = await runStep('tsc', process.execPath, ['node_modules/typescript/bin/tsc', '-b'])
    failed = step.status !== 'pass'
  }
  if (!failed) {
    const step = await runStep('oxlint', process.execPath, ['node_modules/oxlint/bin/oxlint'])
    failed = step.status !== 'pass'
  }
  if (!failed) {
    // Two workers: a full parallel run has OOM-killed this suite on 15 GB boxes.
    const step = await runStep('vitest', process.execPath, [
      'node_modules/vitest/vitest.mjs',
      'run',
      '--maxWorkers=2',
    ], { parse: 'vitest' })
    failed = step.status !== 'pass'
  }
  if (!failed) {
    const step = await runStep('vite-build', process.execPath, ['node_modules/vite/bin/vite.js', 'build'])
    failed = step.status !== 'pass'
  }
  if (!failed) {
    rmSync('/tmp/soak-report.json', { force: true })
    const step = await runStep('soak', process.execPath, ['scripts/soak-150.mjs', '--days', String(soakDays)], {
      parse: 'soak',
    })
    failed = step.status !== 'pass'
  }
  if (!failed) {
    const step = await runStep('draw-budgets', process.execPath, [
      'node_modules/vitest/vitest.mjs',
      'run',
      ...BUDGET_TESTS,
    ], { parse: 'vitest' })
    failed = step.status !== 'pass'
  }
  if (!failed) {
    const botsArgs = ['run', 'playtest:bots']
    if (!full) botsArgs.push('--', '--quick')
    const step = await runStep('playtest-bots', npmBin(), botsArgs, { parse: 'vitest' })
    failed = step.status !== 'pass'
  }

  if (failed) skipRest(remain())

  const vitestStep = steps.find((step) => step.id === 'vitest')
  const soakStep = steps.find((step) => step.id === 'soak')
  const finishedAt = new Date()
  const summary = {
    sha: sha || 'unknown',
    shortSha,
    mode,
    ok: steps.every((step) => step.status === 'pass'),
    node: nodeVersion,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    soakDays,
    testCounts: vitestStep?.testCounts ?? null,
    soak: soakStep?.soak ?? null,
    steps: steps.map((step) => ({
      id: step.id,
      status: step.status,
      durationMs: step.durationMs,
      exitCode: step.exitCode,
      command: step.command,
      detail: step.detail,
      tail: step.tail,
    })),
  }
  const paths = writeReports(summary)
  console.log(`\n[gate] ${summary.ok ? 'PASS' : 'FAIL'} wrote ${paths.mdPath}`)
  process.exit(summary.ok ? 0 : 1)
}

main()
