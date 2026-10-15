/**
 * One screen layout. Each region holds one panel. A second claim for the
 * same region waits in the queue. The boxes are the acceptance test for
 * 1280×800 and 1920×1080: edges may touch, areas may not.
 */

export type Box = { id: string; x: number; y: number; w: number; h: number }

export const HUD_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const

/** Pixel sizes shared with src/ui/layout/regions.css. */
export const REGION = {
  top: 52,
  info: 36,
  build: 152,
  dock: 300,
  inspector: 340,
  chips: 36,
  alertH: 148,
  queue: 28,
  gap: 8,
} as const

export type RegionId = 'top' | 'info' | 'alerts' | 'inspector' | 'build' | 'dock' | 'sheet' | 'interior'

export interface PanelClaim {
  id: string
  region: RegionId
  priority: number
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function assignRegions(claims: readonly PanelClaim[]): { placed: PanelClaim[]; queued: PanelClaim[] } {
  const placed: PanelClaim[] = []
  const queued: PanelClaim[] = []
  const taken = new Set<RegionId>()
  const sorted = [...claims].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  for (const claim of sorted) {
    if (taken.has(claim.region)) queued.push(claim)
    else {
      taken.add(claim.region)
      placed.push(claim)
    }
  }
  return { placed, queued }
}

function box(id: string, x: number, y: number, w: number, h: number): Box {
  return { id, x, y, w, h }
}

/** Apron HUD. The open timetable uses `sheet`, between the dock and the inspector. */
export function apronPanels(width: number, height: number, band = REGION.top + REGION.info): Box[] {
  const { build, dock, inspector, chips, alertH, queue, gap } = REGION
  const dockBox = box('dock', gap, band + gap, dock, height - band - gap * 2)
  const chipRow = box('chips', width - inspector - gap, band, inspector, chips)
  const alerts = box('alerts', width - inspector - gap, chipRow.y + chips + gap, inspector, alertH)
  const queueChip = box('queue', width - inspector - gap, alerts.y + alertH + gap, inspector, queue)
  const buildBox = box(
    'build',
    dockBox.x + dockBox.w + gap,
    height - build - gap,
    width - (dockBox.x + dockBox.w + gap) - inspector - gap * 2,
    build,
  )
  const inspectorBox = box(
    'inspector',
    width - inspector - gap,
    queueChip.y + queue + gap,
    inspector,
    buildBox.y - (queueChip.y + queue + gap) - gap,
  )
  const sheet = box(
    'sheet',
    buildBox.x,
    inspectorBox.y,
    buildBox.w,
    buildBox.y - inspectorBox.y - gap,
  )
  return [
    box('top', 0, 0, width, band),
    chipRow,
    alerts,
    queueChip,
    inspectorBox,
    buildBox,
    dockBox,
    sheet,
  ]
}

/** Terminal view. The build menu is centered in the middle band, clear of the dock. */
export function hallPanels(width: number, height: number): Box[] {
  const apron = apronPanels(width, height)
  const keep = new Set(['top', 'chips', 'alerts', 'queue', 'build', 'dock'])
  const middle = apron.find((item) => item.id === 'sheet')!
  const interior = box('interior', middle.x, middle.y, middle.w, 72)
  return [...apron.filter((item) => keep.has(item.id)), interior]
}
