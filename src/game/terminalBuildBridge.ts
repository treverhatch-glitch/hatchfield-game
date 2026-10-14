/**
 * Small adapter between the pure terminal builder (src/terminalbuild) and the sim.
 * Findings become advisor hints (all of them) and live alerts (only the ones
 * that stop passengers or bags moving). Prefab halls have no build and get nothing.
 */
import type { AdviceCell, Advice } from './advisor.ts'
import type { AlertInput } from './alerts.ts'
import { GRID_C, GRID_R, HALL_D, HALL_W } from './terminal.ts'
import { BUILD_TUNING, validateLayout, type BuildLayout, type Finding, type Tile } from '../terminalbuild/index.ts'

/** Build tile -> hall grid cell, so "Show me" lands on the right part of the hall. */
export function hallCellOf(t: Tile): AdviceCell {
  const m = BUILD_TUNING.tileMetres
  const c = Math.floor(((t.x + 0.5) * m) / (HALL_W / GRID_C))
  const r = Math.floor(((t.y + 0.5) * m) / (HALL_D / GRID_R))
  return { c: Math.min(GRID_C - 1, Math.max(0, c)), r: Math.min(GRID_R - 1, Math.max(0, r)) }
}

function hallCells(f: Finding): AdviceCell[] {
  const seen = new Set<string>()
  const out: AdviceCell[] = []
  for (const t of f.cells) {
    const cell = hallCellOf(t)
    const k = `${cell.c},${cell.r}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(cell)
  }
  return out
}

export function findingAdvice(f: Finding): Advice {
  return {
    id: `build-${f.id}`,
    title: f.title,
    detail: f.detail,
    fix: f.fix,
    cells: hallCells(f),
    scope: 'hall',
    severity: f.severity,
  }
}

/** Advisor hints for a built hall. */
export function buildAdvice(layout: BuildLayout): Advice[] {
  return validateLayout(layout).findings.map(findingAdvice)
}

/** Live alerts for a built hall: only findings that block flow. */
export function buildAlerts(layout: BuildLayout, hall: string, label: string): AlertInput[] {
  return validateLayout(layout)
    .findings.filter((f) => f.blocksFlow)
    .map((f) => ({
      key: `cond:build:${hall}:${f.id}`,
      severity: f.severity === 'blocker' ? 'critical' : 'warning',
      title: `${label}: ${f.title}`,
      detail: f.detail,
      at: { view: 'hall', hall, cells: hallCells(f) },
    }))
}
